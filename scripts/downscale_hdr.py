#!/usr/bin/env python3
"""Downscale a Radiance HDR to 256 px wide so PMREM does not hitch on Evening."""

from __future__ import annotations

import math
from pathlib import Path


def _read_header(data: bytes):
    index = 0
    blanks = 0
    while index < len(data):
        end = data.index(b"\n", index)
        line = data[index:end].strip()
        index = end + 1
        if line.startswith(b"-Y") or line.startswith(b"+Y") or line.startswith(b"-X") or line.startswith(b"+X"):
            parts = line.split()
            height = int(parts[1])
            width = int(parts[3])
            return index, width, height
        if not line:
            blanks += 1
            if blanks > 2:
                break
    raise ValueError("no resolution line")


def _decode(data: bytes, start: int, width: int, height: int):
    pixels = [[None] * width for _ in range(height)]
    pos = start

    def take(n: int) -> bytes:
        nonlocal pos
        chunk = data[pos : pos + n]
        if len(chunk) < n:
            raise ValueError("truncated hdr")
        pos += n
        return chunk

    for y in range(height):
        marker = take(4)
        if marker[0] != 2 or marker[1] != 2:
            row = marker + take(width * 4 - 4)
            pixels[y] = [tuple(row[i : i + 4]) for i in range(0, width * 4, 4)]
            continue
        span = (marker[2] << 8) | marker[3]
        if span != width:
            raise ValueError("scanline width mismatch")
        channels = []
        for _channel in range(4):
            values = []
            while len(values) < width:
                code = take(1)[0]
                if code > 128:
                    values.extend([take(1)[0]] * (code - 128))
                else:
                    values.extend(take(code))
            channels.append(values[:width])
        pixels[y] = [tuple(channels[c][x] for c in range(4)) for x in range(width)]
    return pixels


def _to_float(pixel):
    r, g, b, e = pixel
    if e == 0:
        return 0.0, 0.0, 0.0
    scale = 2 ** (e - 128 - 8)
    return r * scale, g * scale, b * scale


def _from_float(r, g, b):
    peak = max(r, g, b)
    if peak < 1e-32:
        return (0, 0, 0, 0)
    mantissa, exponent = math.frexp(peak)
    scale = mantissa * 256.0 / peak
    return (
        max(0, min(255, int(r * scale))),
        max(0, min(255, int(g * scale))),
        max(0, min(255, int(b * scale))),
        max(0, min(255, exponent + 128)),
    )


def downscale(src: Path, dest: Path, target_width: int = 256) -> None:
    data = src.read_bytes()
    start, width, height = _read_header(data)
    pixels = _decode(data, start, width, height)
    step = max(1, width // target_width)
    out_w = width // step
    out_h = max(1, height // step)
    out = []
    for y in range(out_h):
        row = []
        for x in range(out_w):
            acc = [0.0, 0.0, 0.0]
            count = 0
            for yy in range(y * step, min(height, (y + 1) * step)):
                for xx in range(x * step, min(width, (x + 1) * step)):
                    fr, fg, fb = _to_float(pixels[yy][xx])
                    acc[0] += fr
                    acc[1] += fg
                    acc[2] += fb
                    count += 1
            row.append(_from_float(acc[0] / count, acc[1] / count, acc[2] / count))
        out.append(row)
    header = (
        "#?RADIANCE\nSOFTWARE=plotline-downscale\nFORMAT=32-bit_rle_rgbe\n\n"
        f"-Y {out_h} +X {out_w}\n"
    ).encode()
    body = bytearray()
    for row in out:
        body.extend((2, 2, (out_w >> 8) & 255, out_w & 255))
        for channel in range(4):
            values = [pixel[channel] for pixel in row]
            index = 0
            while index < out_w:
                run = 1
                while (
                    run < 127
                    and index + run < out_w
                    and values[index + run] == values[index]
                ):
                    run += 1
                if run >= 3:
                    body.append(128 + run)
                    body.append(values[index])
                    index += run
                    continue
                start = index
                index += 1
                while index < out_w and index - start < 128:
                    if (
                        index + 2 < out_w
                        and values[index] == values[index + 1] == values[index + 2]
                    ):
                        break
                    index += 1
                body.append(index - start)
                body.extend(values[start:index])
    dest.write_bytes(header + body)
    print(f"{src.name}: {width}x{height} -> {out_w}x{out_h} ({dest.stat().st_size} bytes)")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "frontend" / "public" / "textures" / "cc0" / "hdri"
    for name in ("day", "evening"):
        downscale(root / f"{name}.hdr", root / f"{name}-256.hdr")
