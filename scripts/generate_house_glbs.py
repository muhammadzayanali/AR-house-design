#!/usr/bin/env python3
"""Generate metre-accurate architectural massing GLBs for Plotline.

Conventions: units=m, origin=footprint centre, y=0 ground, +Y up, facing +Z.
License: project-generated (Plotline FYP). Not photoreal scans.
Modern variant targets the quality bar in docs/reference/house-reference.png.
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "models" / "houses"
MANIFEST = ROOT / "frontend" / "lib" / "houses" / "manifest.json"


def _pad4(data: bytes, pad_byte: bytes = b"\x00") -> bytes:
    return data + (pad_byte * ((4 - (len(data) % 4)) % 4))


def _add_box(positions, normals, colors, indices, center, size, color):
    cx, cy, cz = center
    sx, sy, sz = size
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
    faces = [
        ((0.0, 1.0, 0.0), [(-hx, hy, -hz), (hx, hy, -hz), (hx, hy, hz), (-hx, hy, hz)]),
        ((0.0, -1.0, 0.0), [(-hx, -hy, hz), (hx, -hy, hz), (hx, -hy, -hz), (-hx, -hy, -hz)]),
        ((1.0, 0.0, 0.0), [(hx, -hy, -hz), (hx, -hy, hz), (hx, hy, hz), (hx, hy, -hz)]),
        ((-1.0, 0.0, 0.0), [(-hx, -hy, hz), (-hx, -hy, -hz), (-hx, hy, -hz), (-hx, hy, hz)]),
        ((0.0, 0.0, 1.0), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
        ((0.0, 0.0, -1.0), [(hx, -hy, -hz), (-hx, -hy, -hz), (-hx, hy, -hz), (hx, hy, -hz)]),
    ]
    for normal, quad in faces:
        base = len(positions) // 3
        for vx, vy, vz in quad:
            positions.extend([cx + vx, cy + vy, cz + vz])
            normals.extend(list(normal))
            colors.extend(list(color))
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])


def _add_prism_roof(positions, normals, colors, indices, cx, cz, w, d, eave_y, ridge_y, color):
    hw, hd = w / 2.0, d / 2.0
    slopes = [
        (
            [(-hw, eave_y, -hd), (hw, eave_y, -hd), (hw, ridge_y, 0.0), (-hw, ridge_y, 0.0)],
            (0.0, 0.55, -0.83),
        ),
        (
            [(hw, eave_y, hd), (-hw, eave_y, hd), (-hw, ridge_y, 0.0), (hw, ridge_y, 0.0)],
            (0.0, 0.55, 0.83),
        ),
    ]
    for quad, normal in slopes:
        base = len(positions) // 3
        for vx, vy, vz in quad:
            positions.extend([cx + vx, vy, cz + vz])
            normals.extend(list(normal))
            colors.extend(list(color))
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])


def build_modern(w: float, d: float, floors: int):
    """Modern cantilever house matching reference language."""
    P, N, C, I = [], [], [], []
    plaster = (0.92, 0.90, 0.88)
    concrete = (0.82, 0.80, 0.76)
    glass = (0.55, 0.70, 0.80)
    frame = (0.12, 0.13, 0.15)
    dark = (0.18, 0.19, 0.21)
    wood = (0.55, 0.40, 0.28)
    fabric = (0.42, 0.48, 0.52)

    storey = 3.2
    ground_h = storey
    upper_h = storey * 0.92 if floors > 1 else 0.0
    cant = min(1.8, d * 0.18) if floors > 1 else 0.0
    upper_w = w * 0.92
    upper_d = d - cant * 0.35
    slab = 0.22
    parapet = 0.28

    # Site slab
    _add_box(P, N, C, I, (0, 0.04, 0.15), (w + 2.4, 0.08, d + 3.2), concrete)
    # Ground volume
    _add_box(P, N, C, I, (0, ground_h / 2 + 0.08, 0), (w, ground_h, d), plaster)

    # Front glazing panels
    panels = 4
    gap = 0.35
    usable = w - 1.2
    pw = (usable - gap * (panels - 1)) / panels
    front_z = d / 2
    for i in range(panels):
        x = -usable / 2 + pw / 2 + i * (pw + gap)
        _add_box(P, N, C, I, (x, ground_h * 0.52 + 0.08, front_z + 0.02), (pw * 0.95, ground_h * 0.72, 0.06), glass)
        # mullions
        _add_box(P, N, C, I, (x - pw * 0.45, ground_h * 0.52 + 0.08, front_z + 0.05), (0.04, ground_h * 0.72, 0.04), frame)
        _add_box(P, N, C, I, (x + pw * 0.45, ground_h * 0.52 + 0.08, front_z + 0.05), (0.04, ground_h * 0.72, 0.04), frame)

    # Interior hints
    _add_box(P, N, C, I, (-w * 0.22, 0.42, d * 0.1), (1.6, 0.08, 0.9), wood)
    _add_box(P, N, C, I, (w * 0.2, 0.38, d * 0.02), (2.1, 0.45, 0.85), fabric)

    if floors > 1:
        _add_box(P, N, C, I, (0, ground_h + slab / 2 + 0.08, cant / 2), (w + 0.35, slab, d + cant), concrete)
        _add_box(
            P, N, C, I,
            (0, ground_h + slab + upper_h / 2 + 0.08, -cant * 0.2),
            (upper_w, upper_h, upper_d),
            plaster,
        )
        upanels = 5
        uusable = upper_w - 1.0
        upw = (uusable - 0.28 * (upanels - 1)) / upanels
        uz = front_z - cant * 0.15 - 0.28
        for i in range(upanels):
            x = -uusable / 2 + upw / 2 + i * (upw + 0.28)
            _add_box(
                P, N, C, I,
                (x, ground_h + slab + upper_h * 0.5 + 0.08, uz),
                (upw * 0.95, upper_h * 0.75, 0.06),
                glass,
            )
        # Glass railing
        _add_box(P, N, C, I, (0, ground_h + slab + 0.6, front_z + cant * 0.35), (w * 0.9, 1.0, 0.03), glass)
        _add_box(P, N, C, I, (0, ground_h + slab + 1.12, front_z + cant * 0.35), (w * 0.92, 0.04, 0.05), frame)
        # Roof + parapet
        roof_y = ground_h + slab + upper_h + slab / 2 + 0.08
        _add_box(P, N, C, I, (0, roof_y, -cant * 0.2), (upper_w + 0.25, slab, upper_d + 0.25), concrete)
        _add_box(P, N, C, I, (0, roof_y + slab / 2 + parapet / 2, front_z - cant * 0.35), (upper_w + 0.3, parapet, 0.08), concrete)
        _add_box(P, N, C, I, (0, roof_y + slab / 2 + parapet / 2, -d / 2), (upper_w + 0.3, parapet, 0.08), concrete)
    else:
        _add_box(P, N, C, I, (0, ground_h + slab / 2 + 0.08, 0), (w + 0.3, slab, d + 0.3), concrete)

    # Downpipe
    total_h = ground_h + (upper_h + slab if floors > 1 else 0)
    _add_box(P, N, C, I, (w / 2 - 0.12, total_h / 2 + 0.3, front_z - 0.15), (0.07, total_h + 0.4, 0.07), dark)

    return P, N, C, I, w, d, total_h + 0.5


def build_pitched(w: float, d: float, floors: int, style: str):
    P, N, C, I = [], [], [], []
    if "italian" in style or "cottage" in style or "traditional" in style:
        wall = (0.90, 0.82, 0.70) if "italian" in style else (0.85, 0.75, 0.60)
        roof_c = (0.55, 0.28, 0.18)
    elif "american" in style:
        wall = (0.86, 0.88, 0.90)
        roof_c = (0.35, 0.30, 0.28)
    else:
        wall = (0.91, 0.89, 0.86)
        roof_c = (0.22, 0.23, 0.25)
    glass = (0.55, 0.70, 0.80)
    storey = 3.1
    h = floors * storey
    _add_box(P, N, C, I, (0, 0.04, 0), (w + 1.5, 0.08, d + 1.5), (0.75, 0.73, 0.70))
    _add_box(P, N, C, I, (0, h / 2 + 0.08, 0), (w, h, d), wall)
    # windows
    for side, z in (("front", d / 2), ("back", -d / 2)):
        for i in range(3):
            x = -w * 0.3 + i * (w * 0.3)
            for fl in range(floors):
                y = storey * (fl + 0.55)
                _add_box(P, N, C, I, (x, y, z + (0.04 if side == "front" else -0.04)), (1.1, 1.4, 0.08), glass)
    eave = h + 0.08
    ridge = eave + (1.6 if "cottage" in style else 2.0)
    _add_prism_roof(P, N, C, I, 0, 0, w + 0.6, d + 0.6, eave, ridge, roof_c)
    if "italian" in style:
        # columns
        for x in (-1.4, 1.4):
            _add_box(P, N, C, I, (x, 1.5, d / 2 + 0.5), (0.35, 3.0, 0.35), (0.92, 0.90, 0.86))
    return P, N, C, I, w, d, ridge


def write_glb(path: Path, positions, normals, colors, indices) -> int:
    pos = struct.pack("<{}f".format(len(positions)), *positions)
    nor = struct.pack("<{}f".format(len(normals)), *normals)
    col = struct.pack("<{}f".format(len(colors)), *colors)
    idx = struct.pack("<{}H".format(len(indices)), *indices) if max(indices) < 65535 else struct.pack(
        "<{}I".format(len(indices)), *indices
    )
    idx_comp = "UNSIGNED_SHORT" if max(indices) < 65535 else "UNSIGNED_INT"

    blobs = [pos, nor, col, idx]
    offsets = []
    cursor = 0
    bin_parts = []
    for b in blobs:
        pad = _pad4(b)
        offsets.append((cursor, len(b)))
        bin_parts.append(pad)
        cursor += len(pad)
    binary = b"".join(bin_parts)

    buffer_views = [
        {"buffer": 0, "byteOffset": off, "byteLength": length}
        for off, length in offsets
    ]
    n_verts = len(positions) // 3
    accessors = [
        {
            "bufferView": 0,
            "componentType": 5126,
            "count": n_verts,
            "type": "VEC3",
            "min": [min(positions[0::3]), min(positions[1::3]), min(positions[2::3])],
            "max": [max(positions[0::3]), max(positions[1::3]), max(positions[2::3])],
        },
        {"bufferView": 1, "componentType": 5126, "count": n_verts, "type": "VEC3"},
        {"bufferView": 2, "componentType": 5126, "count": n_verts, "type": "VEC3"},
        {
            "bufferView": 3,
            "componentType": 5123 if idx_comp == "UNSIGNED_SHORT" else 5125,
            "count": len(indices),
            "type": "SCALAR",
        },
    ]

    gltf = {
        "asset": {"version": "2.0", "generator": "plotline-generate_house_glbs"},
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
        "materials": [
            {
                "name": "vertexColor",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1, 1, 1, 1],
                    "metallicFactor": 0.05,
                    "roughnessFactor": 0.75,
                },
                "doubleSided": True,
            }
        ],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                        "indices": 3,
                        "material": 0,
                        "mode": 4,
                    }
                ]
            }
        ],
        "nodes": [{"mesh": 0, "name": "House"}],
        "scenes": [{"nodes": [0]}],
        "scene": 0,
    }
    json_bytes = _pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    header = struct.pack("<4sII", b"glTF", 2, total)
    json_chunk = struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
    bin_chunk = struct.pack("<I4s", len(binary), b"BIN\x00") + binary
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + json_chunk + bin_chunk)
    return len(indices) // 3


def main():
    data = json.loads(MANIFEST.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    updated = []
    for m in data["models"]:
        w = float(m["footprint_m"]["width"])
        d = float(m["footprint_m"]["depth"])
        floors = int(m["floors"])
        style = (m["style"] or "").lower()
        if "modern" in style or "contemporary" in style or "luxury" in style:
            P, N, C, I, bw, bd, bh = build_modern(w, d, floors)
        else:
            P, N, C, I, bw, bd, bh = build_pitched(w, d, floors, style)
        out_path = OUT / Path(m["glb"]).name
        tris = write_glb(out_path, P, N, C, I)
        size_kb = round(out_path.stat().st_size / 1024, 1)
        # bbox check vs metadata
        xs, ys, zs = P[0::3], P[1::3], P[2::3]
        span_w = max(xs) - min(xs)
        span_d = max(zs) - min(zs)
        # Site slab is intentionally larger than footprint; require span covers meta size.
        ok = span_w >= w * 0.98 and span_d >= d * 0.98 and span_w <= w * 2 + 6 and span_d <= d * 2 + 6
        m["triangles"] = tris
        m["file_size_kb"] = size_kb
        m["bbox_span_m"] = {"width": round(span_w, 3), "depth": round(span_d, 3), "height": round(max(ys) - min(ys), 3)}
        m["bbox_ok"] = bool(ok)
        updated.append(m)
        print(
            f"{m['id']}: {tris} tris, {size_kb} KB, span {span_w:.2f}x{span_d:.2f}m (meta {w}x{d}) ok={m['bbox_ok']}"
        )

    data["models"] = updated
    MANIFEST.write_text(json.dumps(data, indent=2) + "\n")
    # Mirror to public for static fetch
    (OUT / "manifest.json").write_text(json.dumps(data, indent=2) + "\n")
    print(f"Wrote {len(updated)} models → {OUT}")


if __name__ == "__main__":
    main()
