#!/usr/bin/env python3
"""Run schedule refresh, player stat refresh, highlight refresh, then AI insights."""

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
    parser = argparse.ArgumentParser(description="Refresh schedule/results, player stats, YouTube highlights, and AI insights.")
    parser.add_argument("--all-videos", action="store_true", help="Search videos for every match")
    parser.add_argument("--force-videos", action="store_true", help="Replace existing direct video links")
    parser.add_argument("--dry-run-schedule", action="store_true", help="Dry-run the schedule refresh only")
    parser.add_argument("--skip-ai", action="store_true", help="Skip AI insight generation")
    parser.add_argument("--ai-mode", choices=["minimal", "standard", "seed", "all"], default="standard", help="AI insight target breadth")
    parser.add_argument("--force-ai", action="store_true", help="Regenerate selected AI insight targets")
    parser.add_argument("--force-all-ai", action="store_true", help="Regenerate all AI insight targets subject to cost/call caps")
    parser.add_argument("--ai-max-calls", type=int, default=None, help="Maximum Gemini calls this run")
    parser.add_argument("--ai-max-cost", type=float, default=None, help="Maximum estimated paid-tier Gemini cost this run")
    parser.add_argument("--ai-match-id", action="append", default=[], help="Refresh one AI match insight by id. Repeatable.")
    parser.add_argument("--ai-group", action="append", default=[], help="Refresh one AI group insight by letter. Repeatable.")
    parser.add_argument("--ai-player", action="append", default=[], help="Refresh one AI player insight by name or 'Name|Team'. Repeatable.")
    args = parser.parse_args()

    schedule_command = [sys.executable, "scripts/update_schedule.py"]
    if args.dry_run_schedule:
        schedule_command.append("--dry-run")
    schedule_status = run(schedule_command)
    if schedule_status != 0:
        return schedule_status

    if args.dry_run_schedule:
        return 0

    player_stats_status = run([sys.executable, "scripts/update_player_stats.py"])
    if player_stats_status != 0:
        return player_stats_status

    video_command = [sys.executable, "scripts/update_highlights.py"]
    if args.all_videos:
        video_command.append("--all")
    if args.force_videos:
        video_command.append("--force")
    video_status = run(video_command)
    if video_status != 0:
        return video_status

    if args.skip_ai:
        print("Skipping AI insights by request")
        return 0

    ai_command = [sys.executable, "scripts/update_ai_insights.py", "--mode", args.ai_mode]
    if args.force_ai:
        ai_command.append("--force")
    if args.force_all_ai:
        ai_command.append("--force-all")
    if args.ai_max_calls is not None:
        ai_command.extend(["--max-calls", str(args.ai_max_calls)])
    if args.ai_max_cost is not None:
        ai_command.extend(["--max-estimated-cost", str(args.ai_max_cost)])
    for match_id in args.ai_match_id:
        ai_command.extend(["--match-id", str(match_id)])
    for group in args.ai_group:
        ai_command.extend(["--group", str(group)])
    for player in args.ai_player:
        ai_command.extend(["--player", str(player)])
    return run(ai_command)


if __name__ == "__main__":
    raise SystemExit(main())
