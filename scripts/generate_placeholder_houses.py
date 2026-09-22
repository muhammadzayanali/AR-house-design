#!/usr/bin/env python3
"""Generate true-to-scale .glb house masses for Plotline AR / viewer.

Models are architectural massings in metres (origin at footprint centre, y=0).
The Italian villa is a Mediterranean / Italianate façade inspired by classical
portico villas (columns, pediment, arched openings, quoins, bay windows) —
not a photoreal CGI asset, but clearly a 3D structure rather than a photo.
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path


def _pad4(data: bytes, pad_byte: bytes = b"\x00") -> bytes:
    # glTF Binary: JSON chunks must be padded with 0x20 (space), BIN with 0x00.
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
    """Simple gable roof along local X."""
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
    # Gable end triangles
    for z_sign in (-1.0, 1.0):
        base = len(positions) // 3
        verts = [
            (-hw, eave_y, z_sign * hd),
            (hw, eave_y, z_sign * hd),
            (0.0, ridge_y, 0.0),
        ]
        normal = (0.0, 0.2, z_sign)
        for vx, vy, vz in verts:
            positions.extend([cx + vx, vy, cz + vz])
            normals.extend(list(normal))
            colors.extend(list(color))
        indices.extend([base, base + 1, base + 2])


def _add_cylinder(
    positions,
    normals,
    colors,
    indices,
    cx,
    cy0,
    cy1,
    radius,
    color,
    segments=10,
    cz=0.0,
):
    """Vertical column / cylinder between cy0 and cy1, centred at (cx, cz)."""
    for i in range(segments):
        a0 = (2.0 * math.pi * i) / segments
        a1 = (2.0 * math.pi * (i + 1)) / segments
        x0, z0 = math.cos(a0) * radius, math.sin(a0) * radius
        x1, z1 = math.cos(a1) * radius, math.sin(a1) * radius
        base = len(positions) // 3
        verts = [
            (cx + x0, cy0, cz + z0, x0, z0),
            (cx + x1, cy0, cz + z1, x1, z1),
            (cx + x1, cy1, cz + z1, x1, z1),
            (cx + x0, cy1, cz + z0, x0, z0),
        ]
        for vx, vy, vz, nx, nz in verts:
            ln = math.hypot(nx, nz) or 1.0
            positions.extend([vx, vy, vz])
            normals.extend([nx / ln, 0.0, nz / ln])
            colors.extend(list(color))
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])


def _add_pediment(positions, normals, colors, indices, cx, cy, cz, width, height, depth, color):
    """Triangular pediment facing +Z."""
    hw = width / 2.0
    hd = depth / 2.0
    # Front face
    base = len(positions) // 3
    for vx, vy, vz in (
        (cx - hw, cy, cz + hd),
        (cx + hw, cy, cz + hd),
        (cx, cy + height, cz + hd),
    ):
        positions.extend([vx, vy, vz])
        normals.extend([0.0, 0.2, 1.0])
        colors.extend(list(color))
    indices.extend([base, base + 1, base + 2])
    # Back face
    base = len(positions) // 3
    for vx, vy, vz in (
        (cx + hw, cy, cz - hd),
        (cx - hw, cy, cz - hd),
        (cx, cy + height, cz - hd),
    ):
        positions.extend([vx, vy, vz])
        normals.extend([0.0, 0.2, -1.0])
        colors.extend(list(color))
    indices.extend([base, base + 1, base + 2])
    # Sloped sides as thin boxes via two quads
    for side in (-1.0, 1.0):
        base = len(positions) // 3
        verts = [
            (cx + side * hw, cy, cz - hd),
            (cx + side * hw, cy, cz + hd),
            (cx, cy + height, cz + hd),
            (cx, cy + height, cz - hd),
        ]
        normal = (side * 0.7, 0.5, 0.0)
        for vx, vy, vz in verts:
            positions.extend([vx, vy, vz])
            normals.extend(list(normal))
            colors.extend(list(color))
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])


def _add_arch_frame(positions, normals, colors, indices, cx, cy, cz, w, h, depth, color, segs=8):
    """Flat arched window/door surround extruded slightly on +Z."""
    # Rectangular lower frame
    _add_box(positions, normals, colors, indices, (cx, cy + h * 0.35, cz), (w, h * 0.7, depth), color)
    # Arc voussoirs approximated as boxes
    r = w / 2.0
    arch_cy = cy + h * 0.7
    for i in range(segs):
        t0 = math.pi * i / segs
        t1 = math.pi * (i + 1) / segs
        mx = (math.cos(t0) + math.cos(t1)) * 0.5 * r
        my = (math.sin(t0) + math.sin(t1)) * 0.5 * r
        _add_box(
            positions,
            normals,
            colors,
            indices,
            (cx + mx, arch_cy + my, cz),
            (w / segs * 1.2, h * 0.12, depth),
            color,
        )


def _add_balustrade(positions, normals, colors, indices, x0, x1, y, z, color, posts=6):
    rail_w = abs(x1 - x0)
    _add_box(positions, normals, colors, indices, ((x0 + x1) / 2, y + 0.45, z), (rail_w, 0.08, 0.12), color)
    _add_box(positions, normals, colors, indices, ((x0 + x1) / 2, y, z), (rail_w, 0.08, 0.14), color)
    for i in range(posts):
        t = i / max(posts - 1, 1)
        x = x0 + (x1 - x0) * t
        _add_box(positions, normals, colors, indices, (x, y + 0.22, z), (0.08, 0.36, 0.08), color)


def _mesh_to_glb(positions, normals, colors, indices) -> bytes:
    if max(indices, default=0) > 65535:
        raise RuntimeError("Index overflow — reduce mesh detail")
    pos_b = struct.pack("<%sf" % len(positions), *positions)
    nrm_b = struct.pack("<%sf" % len(normals), *normals)
    col_b = struct.pack("<%sf" % len(colors), *colors)
    idx_b = struct.pack("<%sH" % len(indices), *indices)

    views = []
    offset = 0
    for blob in (pos_b, nrm_b, col_b, idx_b):
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(blob)})
        offset += len(blob)
        pad = (4 - (len(blob) % 4)) % 4
        offset += pad

    n_verts = len(positions) // 3
    xs, ys, zs = positions[0::3], positions[1::3], positions[2::3]
    gltf = {
        "asset": {"version": "2.0", "generator": "fyp-mediterranean-houses"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "HouseMassing"}],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                        "indices": 3,
                        "material": 0,
                    }
                ]
            }
        ],
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1, 1, 1, 1],
                    "metallicFactor": 0.02,
                    "roughnessFactor": 0.82,
                },
                "doubleSided": True,
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": n_verts,
                "type": "VEC3",
                "min": [min(xs), min(ys), min(zs)],
                "max": [max(xs), max(ys), max(zs)],
            },
            {"bufferView": 1, "componentType": 5126, "count": n_verts, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": n_verts, "type": "VEC3"},
            {
                "bufferView": 3,
                "componentType": 5123,
                "count": len(indices),
                "type": "SCALAR",
            },
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": offset}],
    }

    bin_chunk = b"".join([_pad4(pos_b), _pad4(nrm_b), _pad4(col_b), _pad4(idx_b)])
    json_chunk = _pad4(
        json.dumps(gltf, separators=(",", ":")).encode("utf-8"),
        pad_byte=b" ",
    )

    json_header = struct.pack("<II", len(json_chunk), 0x4E4F534A)
    bin_header = struct.pack("<II", len(bin_chunk), 0x004E4942)
    total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    header = struct.pack("<4sII", b"glTF", 2, total)
    return header + json_header + json_chunk + bin_header + bin_chunk


def compact_cottage():
    p, n, c, i = [], [], [], []
    cream, roof, door, glass, trim = (
        (0.86, 0.80, 0.70),
        (0.72, 0.32, 0.22),
        (0.28, 0.16, 0.10),
        (0.35, 0.50, 0.62),
        (0.55, 0.45, 0.35),
    )
    _add_box(p, n, c, i, (0, 1.6, 0), (8.0, 3.2, 7.0), cream)
    _add_prism_roof(p, n, c, i, 0, 0, 8.4, 7.4, 3.2, 5.0, roof)
    _add_box(p, n, c, i, (0, 1.05, 3.52), (1.1, 2.1, 0.12), door)
    _add_box(p, n, c, i, (-2.2, 1.8, 3.52), (1.4, 1.2, 0.08), glass)
    _add_box(p, n, c, i, (2.2, 1.8, 3.52), (1.4, 1.2, 0.08), glass)
    _add_box(p, n, c, i, (0, 0.08, 0), (8.2, 0.16, 7.2), trim)
    return p, n, c, i


def modern_family():
    p, n, c, i = [], [], [], []
    white, charcoal, glass, accent = (
        (0.90, 0.90, 0.88),
        (0.22, 0.24, 0.26),
        (0.30, 0.45, 0.55),
        (0.75, 0.62, 0.38),
    )
    _add_box(p, n, c, i, (0, 3.25, 0), (12.0, 6.5, 9.0), white)
    _add_box(p, n, c, i, (5.5, 1.6, 2.0), (5.0, 3.2, 6.0), white)
    _add_box(p, n, c, i, (0, 6.55, 0), (12.4, 0.18, 9.4), charcoal)
    _add_box(p, n, c, i, (0, 3.4, 4.55), (8.5, 1.4, 0.1), glass)
    _add_box(p, n, c, i, (-4.0, 1.7, 4.55), (2.4, 1.6, 0.1), glass)
    _add_box(p, n, c, i, (4.0, 1.7, 4.55), (2.4, 1.6, 0.1), glass)
    _add_box(p, n, c, i, (0, 0.2, 6.2), (4.0, 0.12, 2.4), accent)
    _add_box(p, n, c, i, (0, 1.1, 4.55), (1.2, 2.2, 0.12), charcoal)
    return p, n, c, i


def italian_villa():
    """Mediterranean / Italianate two-storey villa with central classical portico.

    Visual language matches the FYP reference CGI: peach stucco, cream quoins,
    four-column portico, triangular pediment, arched upper openings, bay windows
    with terracotta overhangs, and balustrades — as a true 3D structure for AR.
    """
    p, n, c, i = [], [], [], []
    stucco = (0.91, 0.78, 0.62)  # peach / light terracotta plaster
    cream = (0.93, 0.88, 0.78)  # quoins, columns, pediment
    roof = (0.72, 0.34, 0.22)  # terracotta tile
    stone = (0.78, 0.72, 0.62)
    glass = (0.22, 0.28, 0.34)
    dark = (0.20, 0.14, 0.10)
    shutter = (0.18, 0.32, 0.28)

    # Main two-storey mass
    _add_box(p, n, c, i, (0, 3.4, 0), (18.0, 6.8, 12.0), stucco)
    # Upper roof volume + hip/gable terracotta
    _add_box(p, n, c, i, (0, 7.0, 0), (18.4, 0.35, 12.4), roof)
    _add_prism_roof(p, n, c, i, 0, 0, 18.6, 12.6, 7.15, 9.2, roof)

    # Corner quoins (cream block accents)
    for x in (-8.7, 8.7):
        for z in (-5.7, 5.7):
            for y in (0.9, 2.5, 4.1, 5.7):
                _add_box(p, n, c, i, (x, y, z), (0.55, 1.1, 0.55), cream)

    # Central two-storey portico / loggia
    portico_z = 6.55
    _add_box(p, n, c, i, (0, 0.25, portico_z), (7.2, 0.5, 2.4), stone)  # plinth
    # Four cream columns
    for x in (-2.55, -0.85, 0.85, 2.55):
        _add_cylinder(
            p, n, c, i, x, 0.5, 6.4, 0.28, cream, segments=12, cz=portico_z - 0.15
        )
        # Capitals / bases
        _add_box(p, n, c, i, (x, 0.55, portico_z - 0.15), (0.55, 0.2, 0.55), cream)
        _add_box(p, n, c, i, (x, 6.35, portico_z - 0.15), (0.6, 0.22, 0.6), cream)

    # Entablature + second-floor balcony slab
    _add_box(p, n, c, i, (0, 6.55, portico_z), (7.4, 0.35, 2.5), cream)
    _add_box(p, n, c, i, (0, 3.35, portico_z), (7.0, 0.28, 2.3), cream)
    _add_balustrade(p, n, c, i, -3.2, 3.2, 6.7, portico_z + 0.9, cream, posts=9)

    # Triangular pediment at roof line
    _add_pediment(p, n, c, i, 0, 7.2, portico_z + 0.1, 7.6, 2.2, 0.9, cream)
    # Wide arch over second-storey balcony
    _add_arch_frame(p, n, c, i, 0, 4.6, 6.05, 4.2, 2.4, 0.2, cream, segs=10)
    _add_box(p, n, c, i, (0, 5.2, 6.0), (3.4, 2.0, 0.08), glass)

    # Grand ground-floor entrance under portico
    _add_arch_frame(p, n, c, i, 0, 0.9, 6.05, 2.4, 2.8, 0.18, cream, segs=8)
    _add_box(p, n, c, i, (0, 1.6, 6.08), (1.6, 2.6, 0.1), dark)

    # Upper arched windows with mouldings + mini balustrades
    for x in (-6.2, -3.6, 3.6, 6.2):
        _add_arch_frame(p, n, c, i, x, 4.3, 6.02, 1.5, 2.2, 0.14, cream, segs=7)
        _add_box(p, n, c, i, (x, 5.0, 6.05), (1.15, 1.7, 0.08), glass)
        _add_balustrade(p, n, c, i, x - 0.7, x + 0.7, 4.15, 6.15, cream, posts=4)

    # Ground-floor tall rectangular windows (left wing)
    for x in (-6.8, -4.4):
        _add_box(p, n, c, i, (x, 2.2, 6.02), (1.7, 0.12, 0.12), cream)  # lintel
        _add_box(p, n, c, i, (x, 2.0, 6.05), (1.35, 2.4, 0.08), glass)
        _add_box(p, n, c, i, (x - 0.75, 2.0, 6.05), (0.12, 2.4, 0.1), shutter)
        _add_box(p, n, c, i, (x + 0.75, 2.0, 6.05), (0.12, 2.4, 0.1), shutter)

    # Curved bay windows (right / front) with small terracotta overhangs
    for x in (4.2, 6.8):
        _add_box(p, n, c, i, (x, 1.9, 6.55), (2.0, 2.6, 1.1), stucco)
        _add_box(p, n, c, i, (x, 1.9, 7.05), (1.6, 2.2, 0.1), glass)
        _add_prism_roof(p, n, c, i, x, 6.55, 2.2, 1.4, 3.25, 4.0, roof)
        _add_box(p, n, c, i, (x, 3.35, 6.55), (2.15, 0.12, 1.25), roof)

    # Side façade accents
    for z in (-2.0, 2.0):
        _add_box(p, n, c, i, (-9.05, 5.0, z), (0.1, 1.6, 1.2), glass)
        _add_box(p, n, c, i, (9.05, 5.0, z), (0.1, 1.6, 1.2), glass)

    # Front steps
    for step, y, z, d in ((0, 0.12, 7.6, 1.6), (1, 0.28, 7.95, 1.2), (2, 0.44, 8.2, 0.8)):
        _add_box(p, n, c, i, (0, y, z), (3.2 - step * 0.3, 0.16, d), stone)

    # Ground plinth
    _add_box(p, n, c, i, (0, 0.12, 0), (18.3, 0.24, 12.3), stone)

    return p, n, c, i


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "frontend" / "public" / "models"
    out.mkdir(parents=True, exist_ok=True)
    houses = {
        "compact-cottage.glb": compact_cottage,
        "modern-family.glb": modern_family,
        "italian-villa.glb": italian_villa,
    }
    for name, builder in houses.items():
        data = _mesh_to_glb(*builder())
        path = out / name
        path.write_bytes(data)
        print("wrote", path, "bytes", len(data))


if __name__ == "__main__":
    main()
