#!/usr/bin/env python3
"""Run schedule refresh, then highlight refresh."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run(command: list[str]) -> int:
    print(f"$ {' '.join(command)}")
    return subprocess.call(command, cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh schedule/results and then YouTube highlights.")
    parser.add_argument("--all-videos", action="store_true", help="Search videos for every match")
    parser.add_argument("--force-videos", action="store_true", help="Replace existing direct video links")
    parser.add_argument("--dry-run-schedule", action="store_true", help="Dry-run the schedule refresh only")
    args = parser.parse_args()

    schedule_command = [sys.executable, "scripts/update_schedule.py"]
    if args.dry_run_schedule:
        schedule_command.append("--dry-run")
    schedule_status = run(schedule_command)
    if schedule_status != 0:
        return schedule_status

    if args.dry_run_schedule:
        return 0

    video_command = [sys.executable, "scripts/update_highlights.py"]
    if args.all_videos:
        video_command.append("--all")
    if args.force_videos:
        video_command.append("--force")
    return run(video_command)


if __name__ == "__main__":
    raise SystemExit(main())
