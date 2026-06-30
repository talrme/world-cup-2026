#!/usr/bin/env python3
"""Run schedule, bracket, player stat, highlight, then AI insight refreshes."""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
START_TIME = time.monotonic()


def format_elapsed(seconds: float) -> str:
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def elapsed_label() -> str:
    return format_elapsed(time.monotonic() - START_TIME)


def run(command: list[str]) -> int:
    step_start = time.monotonic()
    print(f"[{elapsed_label()}] $ {' '.join(command)}", flush=True)
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        stderr=subprocess.STDOUT,
        stdout=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    assert process.stdout is not None
    for line in process.stdout:
        print(f"[{elapsed_label()}] {line}", end="", flush=True)
    status = process.wait()
    print(
        f"[{elapsed_label()}] Command finished in {format_elapsed(time.monotonic() - step_start)} "
        f"with exit {status}",
        flush=True,
    )
    return status


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh schedule/results, bracket, player stats, YouTube highlights, and AI insights.")
    parser.add_argument("--all-videos", action="store_true", help="Search videos for every match")
    parser.add_argument("--force-videos", action="store_true", help="Replace existing direct video links")
    parser.add_argument("--video-recent-hours", type=float, default=None, help="Only search recent video candidates within this many hours")
    parser.add_argument("--video-max-searches", type=int, default=None, help="Maximum video-slot searches this run")
    parser.add_argument("--dry-run-schedule", action="store_true", help="Dry-run the schedule refresh only")
    parser.add_argument("--dry-run-bracket", action="store_true", help="Dry-run the ESPN bracket refresh only")
    parser.add_argument("--skip-ai", action="store_true", help="Skip AI insight generation")
    parser.add_argument("--ai-mode", choices=["minimal", "standard", "seed", "all"], default="standard", help="AI insight target breadth")
    parser.add_argument("--force-ai", action="store_true", help="Regenerate selected AI insight targets")
    parser.add_argument("--force-all-ai", action="store_true", help="Regenerate all AI insight targets subject to cost/call caps")
    parser.add_argument("--ai-max-calls", type=int, default=None, help="Maximum Gemini calls this run")
    parser.add_argument("--ai-max-cost", type=float, default=None, help="Maximum estimated paid-tier Gemini cost this run")
    parser.add_argument("--ai-max-matches", type=int, default=None, help="Maximum AI match targets this run")
    parser.add_argument("--ai-max-groups", type=int, default=None, help="Maximum AI group targets this run")
    parser.add_argument("--ai-max-players", type=int, default=None, help="Maximum AI player targets this run")
    parser.add_argument(
        "--ai-match-content",
        choices=["all", "previews", "recaps"],
        default="all",
        help="Which match AI content to refresh",
    )
    parser.add_argument("--ai-match-id", action="append", default=[], help="Refresh one AI match insight by id. Repeatable.")
    parser.add_argument("--ai-group", action="append", default=[], help="Refresh one AI group insight by letter. Repeatable.")
    parser.add_argument("--ai-player", action="append", default=[], help="Refresh one AI player insight by name or 'Name|Team'. Repeatable.")
    args = parser.parse_args()

    if args.dry_run_bracket:
        return run([sys.executable, "scripts/update_bracket.py", "--dry-run"])

    schedule_command = [sys.executable, "scripts/update_schedule.py"]
    if args.dry_run_schedule:
        schedule_command.append("--dry-run")
    schedule_status = run(schedule_command)
    if schedule_status != 0:
        return schedule_status

    if args.dry_run_schedule:
        return 0

    bracket_status = run([sys.executable, "scripts/update_bracket.py"])
    if bracket_status != 0:
        return bracket_status

    player_stats_status = run([sys.executable, "scripts/update_player_stats.py"])
    if player_stats_status != 0:
        return player_stats_status

    video_command = [sys.executable, "scripts/update_highlights.py"]
    if args.all_videos:
        video_command.append("--all")
    if args.force_videos:
        video_command.append("--force")
    if args.video_recent_hours is not None:
        video_command.extend(["--recent-hours", str(args.video_recent_hours)])
    if args.video_max_searches is not None:
        video_command.extend(["--max-searches", str(args.video_max_searches)])
    video_status = run(video_command)
    if video_status != 0:
        return video_status

    if args.skip_ai:
        print(f"[{elapsed_label()}] Skipping AI insights by request")
        return 0

    ai_command = [sys.executable, "scripts/update_ai_insights.py", "--mode", args.ai_mode]
    ai_command.extend(["--match-content", args.ai_match_content])
    if args.force_ai:
        ai_command.append("--force")
    if args.force_all_ai:
        ai_command.append("--force-all")
    if args.ai_max_calls is not None:
        ai_command.extend(["--max-calls", str(args.ai_max_calls)])
    if args.ai_max_cost is not None:
        ai_command.extend(["--max-estimated-cost", str(args.ai_max_cost)])
    if args.ai_max_matches is not None:
        ai_command.extend(["--max-matches", str(args.ai_max_matches)])
    if args.ai_max_groups is not None:
        ai_command.extend(["--max-groups", str(args.ai_max_groups)])
    if args.ai_max_players is not None:
        ai_command.extend(["--max-players", str(args.ai_max_players)])
    for match_id in args.ai_match_id:
        ai_command.extend(["--match-id", str(match_id)])
    for group in args.ai_group:
        ai_command.extend(["--group", str(group)])
    for player in args.ai_player:
        ai_command.extend(["--player", str(player)])
    return run(ai_command)


if __name__ == "__main__":
    raise SystemExit(main())
