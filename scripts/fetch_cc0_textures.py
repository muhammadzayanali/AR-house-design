#!/usr/bin/env python3
"""Download Poly Haven CC0 1K maps and store them as WebP. Skips any id the API does not have."""

from __future__ import annotations

import json
import subprocess
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "textures" / "cc0"
# folder -> Poly Haven asset slug. All CC0.
SLUGS = {
    "plaster": "plastered_wall_04",
    "roof": "roof_tiles_14",
    "stone": "stone_wall_02",
    "timber": "wood_planks",
    "paving": "cobblestone_floor_001",
    "grass": "aerial_grass_rock",
}
MAPS = {"albedo": "Diffuse", "normal": "nor_gl", "rough": "Rough"}


def api(slug: str) -> dict:
    req = urllib.request.Request(
        f"https://api.polyhaven.com/files/{slug}",
        headers={"User-Agent": "Plotline-FYP/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def main() -> None:
    notes = ["Poly Haven CC0. Converted here from the 1K JPG to WebP. Not a photoreal claim."]
    for folder, slug in SLUGS.items():
        try:
            payload = api(slug)
        except Exception as exc:
            notes.append(f"{folder}: skipped ({exc})")
            continue
        dest = ROOT / folder
        dest.mkdir(parents=True, exist_ok=True)
        for name, key in MAPS.items():
            try:
                url = payload[key]["1k"]["jpg"]["url"]
            except KeyError:
                notes.append(f"{folder}/{name}: no 1k jpg")
                continue
            data = urllib.request.urlopen(
                urllib.request.Request(url, headers={"User-Agent": "Plotline-FYP/1.0"}),
                timeout=60,
            ).read()
            image = Image.open(BytesIO(data)).convert("RGB")
            image.thumbnail((1024, 1024))
            image.save(dest / f"{name}.webp", "WEBP", quality=68, method=4)
            notes.append(f"{folder}/{name}.webp from {slug} ({len(data)} byte jpg)")
        (dest / "LICENSE.txt").write_text(
            f"{slug}\nCC0 1.0 — Poly Haven (polyhaven.com)\nMaps: albedo, normal (OpenGL), roughness. 1K WebP.\n"
        )
    (ROOT / "SOURCES.txt").write_text("\n".join(notes) + "\n")
    print("\n".join(notes))


if __name__ == "__main__":
    main()
