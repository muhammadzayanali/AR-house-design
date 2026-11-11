#!/usr/bin/env python3
"""Append one AI-camera trial to a CSV. Refuses to run without your measurements.

Example:
  python3 scripts/log_camera_trial.py --true 180 --measured 174.2 --device "Pixel 7"
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "docs" / "qa" / "ai-camera-trials.csv"
FIELDS = ["recorded_at", "true_area_m2", "measured_area_m2", "error_percent", "device", "notes"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Log one tape-vs-camera trial. Does not invent rows.")
    parser.add_argument("--true", type=float, required=True, help="Tape area in m²")
    parser.add_argument("--measured", type=float, required=True, help="Camera area in m²")
    parser.add_argument("--device", required=True, help="Phone and browser")
    parser.add_argument("--notes", default="")
    args = parser.parse_args()
    if args.true <= 0:
        raise SystemExit("true area must be > 0")
    error = round((args.measured - args.true) / args.true * 100.0, 2)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    new_file = not OUT.exists()
    with OUT.open("a", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        if new_file:
            writer.writeheader()
        writer.writerow(
            {
                "recorded_at": datetime.now(timezone.utc).isoformat(),
                "true_area_m2": args.true,
                "measured_area_m2": args.measured,
                "error_percent": error,
                "device": args.device,
                "notes": args.notes,
            }
        )
    print(f"appended 1 row to {OUT}")


if __name__ == "__main__":
    main()
