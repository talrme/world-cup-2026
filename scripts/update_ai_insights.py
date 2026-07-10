#!/usr/bin/env python3
"""Generate cached Gemini blurbs for matches, groups, and top players."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEDULE_DATA = ROOT / "data" / "world-cup-2026.json"
DEFAULT_PLAYER_DATA = ROOT / "data" / "player-stats.json"
DEFAULT_AI_DATA = ROOT / "data" / "ai-insights.json"
DEFAULT_STATIC_DATA = ROOT / "ai-insights.js"
DEFAULT_MODEL = "gemini-3.1-flash-lite"
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
PROMPTS = {
    "match": ROOT / "prompts" / "match.md",
    "match_preview": ROOT / "prompts" / "match_preview.md",
    "match_partial": ROOT / "prompts" / "match_partial.md",
    "group": ROOT / "prompts" / "group.md",
    "player": ROOT / "prompts" / "player.md",
}
TARGET_LIMITS = {
    "minimal": {"matches": 80, "groups": 6, "players": 10, "calls": 10},
    "standard": {"matches": 200, "groups": 12, "players": 30, "calls": 40},
    "seed": {"matches": 200, "groups": 12, "players": 30, "calls": 120},
    "all": {"matches": 200, "groups": 12, "players": 30, "calls": 250},
}
RECENT_MATCH_REFRESH_DAYS = 5
FUTURE_MATCH_STALE_HOURS = 24 * 7
ARCHIVE_MATCH_STALE_HOURS = 24 * 30
GROUP_ACTIVE_STALE_HOURS = 24
GROUP_QUIET_STALE_HOURS = 24 * 7
PLAYER_STALE_HOURS = 24
PLACEHOLDER_TEAM_PREFIXES = (
    "winner ",
    "runner-up ",
    "loser ",
    "best 3rd ",
    "tbd",
    "to be determined",
)
LIVE_STATUS_VALUES = {"live", "in_progress", "in-progress", "playing", "halftime", "half-time"}
JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "summary": {"type": "string"},
        "story": {"type": "array", "items": {"type": "string"}},
        "bullets": {"type": "array", "items": {"type": "string"}},
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["title", "body"],
            },
        },
    },
    "required": ["headline", "summary", "bullets", "sections"],
}


@dataclass
class Target:
    kind: str
    target_id: str
    label: str
    context: dict[str, Any]
    source_hash: str
    prompt_hash: str
    prompt: str
    stale_hours: int
    reason: str
    priority: tuple[int, float, int]


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def load_dotenv(path: Path = ROOT / ".env") -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def read_json(path: Path, fallback: Any = None) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_if_changed(path: Path, text: str) -> bool:
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def write_static_data(data: dict[str, Any], path: Path) -> bool:
    payload = json.dumps(data, indent=2, ensure_ascii=True)
    return write_if_changed(path, f"window.WORLD_CUP_AI_INSIGHTS = {payload};\n")


def stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":"))


def stable_hash(value: Any) -> str:
    return hashlib.sha256(stable_json(value).encode("utf-8")).hexdigest()[:16]


def text_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def player_key(player: dict[str, Any]) -> str:
    raw = f"{player.get('player', '')}|{player.get('team', '')}".lower()
    keep = [char if char.isalnum() else "-" for char in raw]
    return "-".join("".join(keep).split("-")).strip("-")


def slugify(value: str) -> str:
    keep = [char if char.isalnum() else "-" for char in value.lower()]
    return "-".join("".join(keep).split("-")).strip("-")


def player_matches_selector(player: dict[str, Any], selectors: list[str]) -> bool:
    if not selectors:
        return True
    name = str(player.get("player", "")).strip()
    team = str(player.get("team", "")).strip()
    text_candidates = {
        name.lower(),
        f"{name}|{team}".lower(),
        f"{name} ({team})".lower(),
    }
    slug_candidates = {
        slugify(name),
        slugify(f"{name}|{team}"),
        slugify(f"{name} {team}"),
        player_key(player),
    }
    for selector in selectors:
        raw = selector.strip().lower()
        if raw in text_candidates or slugify(selector) in slug_candidates:
            return True
    return False


def kickoff_datetime(match: dict[str, Any]) -> dt.datetime:
    time_value = match.get("time") or "12:00"
    offset = match.get("offset") or "-04:00"
    return dt.datetime.fromisoformat(f"{match['date']}T{time_value}:00{offset}")


def has_score(match: dict[str, Any]) -> bool:
    return match.get("homeScore") is not None and match.get("awayScore") is not None


def has_penalty_shootout(match: dict[str, Any]) -> bool:
    return match.get("homePenaltyScore") is not None and match.get("awayPenaltyScore") is not None


def match_result_text(match: dict[str, Any]) -> str | None:
    if not has_score(match):
        return None
    result = f"{match['home']} {match['homeScore']}, {match['away']} {match['awayScore']}"
    if has_penalty_shootout(match):
        result += f" ({match['homePenaltyScore']}-{match['awayPenaltyScore']} on penalties)"
    return result


def match_insight_focus(match: dict[str, Any]) -> str:
    status = str(match.get("status", "")).strip().lower()
    if has_score(match) or status in {"completed", "final"}:
        return "completed_recap"
    if status in LIVE_STATUS_VALUES:
        return "in_progress"
    return "preview"


def standings_for(group_matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    table: dict[str, dict[str, Any]] = {}
    for match in group_matches:
        for side in ("home", "away"):
            team = match[side]
            table.setdefault(team, {"team": team, "points": 0, "played": 0, "gf": 0, "ga": 0, "gd": 0})

        if not has_score(match):
            continue

        home = table[match["home"]]
        away = table[match["away"]]
        hs = int(match["homeScore"])
        away_score = int(match["awayScore"])
        home["played"] += 1
        away["played"] += 1
        home["gf"] += hs
        home["ga"] += away_score
        away["gf"] += away_score
        away["ga"] += hs
        if hs > away_score:
            home["points"] += 3
        elif hs < away_score:
            away["points"] += 3
        else:
            home["points"] += 1
            away["points"] += 1

    for row in table.values():
        row["gd"] = row["gf"] - row["ga"]

    return sorted(table.values(), key=lambda row: (-row["points"], -row["gd"], -row["gf"], row["team"]))


def group_map(matches: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for match in matches:
        if match.get("stage") == "Group" and match.get("group"):
            groups.setdefault(str(match["group"]), []).append(match)
    return groups


def compact_match(match: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": match.get("id"),
        "stage": match.get("stage"),
        "round": match.get("round"),
        "group": match.get("group"),
        "date": match.get("date"),
        "time": match.get("time"),
        "timezone": match.get("timezoneLabel"),
        "home": match.get("home"),
        "away": match.get("away"),
        "status": match.get("status"),
        "insightFocus": match_insight_focus(match),
        "result": match_result_text(match),
        "homeScore": match.get("homeScore"),
        "awayScore": match.get("awayScore"),
        "homePenaltyScore": match.get("homePenaltyScore"),
        "awayPenaltyScore": match.get("awayPenaltyScore"),
        "network": match.get("network"),
        "hasHighlights": bool(match.get("videos", {}).get("short", {}).get("url")),
        "hasExtendedHighlights": bool(match.get("videos", {}).get("extended", {}).get("url")),
        "homeSource": match.get("homeSource"),
        "awaySource": match.get("awaySource"),
        "espnEventId": match.get("espnEventId"),
    }


def spoiler_free_compact_match(match: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": match.get("id"),
        "stage": match.get("stage"),
        "round": match.get("round"),
        "group": match.get("group"),
        "date": match.get("date"),
        "time": match.get("time"),
        "timezone": match.get("timezoneLabel"),
        "home": match.get("home"),
        "away": match.get("away"),
        "network": match.get("network"),
        "homeSource": match.get("homeSource"),
        "awaySource": match.get("awaySource"),
        "espnEventId": match.get("espnEventId"),
    }


def standings_before_match(group_matches: list[dict[str, Any]], match: dict[str, Any]) -> list[dict[str, Any]]:
    cutoff = kickoff_utc(match)
    table: dict[str, dict[str, Any]] = {}
    for item in group_matches:
        for side in ("home", "away"):
            team = item[side]
            table.setdefault(team, {"team": team, "points": 0, "played": 0, "gf": 0, "ga": 0, "gd": 0})

        if item.get("id") == match.get("id") or not has_score(item) or kickoff_utc(item) >= cutoff:
            continue

        home = table[item["home"]]
        away = table[item["away"]]
        hs = int(item["homeScore"])
        away_score = int(item["awayScore"])
        home["played"] += 1
        away["played"] += 1
        home["gf"] += hs
        home["ga"] += away_score
        away["gf"] += away_score
        away["ga"] += hs
        if hs > away_score:
            home["points"] += 3
        elif hs < away_score:
            away["points"] += 3
        else:
            home["points"] += 1
            away["points"] += 1

    for row in table.values():
        row["gd"] = row["gf"] - row["ga"]

    return sorted(table.values(), key=lambda row: (-row["points"], -row["gd"], -row["gf"], row["team"]))


def match_context(match: dict[str, Any], schedule: dict[str, Any], groups: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    venues = {venue.get("id"): venue for venue in schedule.get("venues", [])}
    venue = venues.get(match.get("venueId"))
    known_teams = [team for team in (match.get("home"), match.get("away")) if planned_team_name(team)]
    unknown_slots = [team for team in (match.get("home"), match.get("away")) if not planned_team_name(team)]
    team_matches = {
        team: [
            compact_match(item)
            for item in schedule.get("matches", [])
            if item.get("id") != match.get("id") and (item.get("home") == team or item.get("away") == team)
        ][:8]
        for team in known_teams
    }
    context: dict[str, Any] = {
        "kind": "match",
        "match": compact_match(match),
        "venue": venue,
        "knownTeamCount": len(known_teams),
        "knownTeams": known_teams,
        "unknownSlots": unknown_slots,
        "teamMatches": team_matches,
    }
    group = match.get("group")
    if group and group in groups:
        group_matches = groups[group]
        context["groupStandings"] = standings_for(group_matches)
        context["groupMatches"] = [compact_match(item) for item in group_matches]
    return context


def match_preview_context(match: dict[str, Any], schedule: dict[str, Any], groups: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    venues = {venue.get("id"): venue for venue in schedule.get("venues", [])}
    venue = venues.get(match.get("venueId"))
    known_teams = [team for team in (match.get("home"), match.get("away")) if planned_team_name(team)]
    unknown_slots = [team for team in (match.get("home"), match.get("away")) if not planned_team_name(team)]
    current_kickoff = kickoff_utc(match)
    team_matches = {
        team: [
            compact_match(item)
            for item in schedule.get("matches", [])
            if (
                item.get("id") != match.get("id")
                and (item.get("home") == team or item.get("away") == team)
                and kickoff_utc(item) < current_kickoff
            )
        ][:8]
        for team in known_teams
    }
    context: dict[str, Any] = {
        "kind": "match_preview",
        "spoilerFree": True,
        "match": spoiler_free_compact_match(match),
        "venue": venue,
        "knownTeamCount": len(known_teams),
        "knownTeams": known_teams,
        "unknownSlots": unknown_slots,
        "teamPreviousMatches": team_matches,
    }
    group = match.get("group")
    if group and group in groups:
        group_matches = groups[group]
        previous_group_matches = [
            item for item in group_matches if item.get("id") != match.get("id") and kickoff_utc(item) < current_kickoff
        ]
        context["groupStandingsBeforeMatch"] = standings_before_match(group_matches, match)
        context["previousGroupMatches"] = [compact_match(item) for item in previous_group_matches]
    return context


def group_context(group: str, group_matches: list[dict[str, Any]], schedule: dict[str, Any]) -> dict[str, Any]:
    ordered = sorted(group_matches, key=lambda item: (item.get("date", ""), item.get("time", ""), item.get("id", 0)))
    return {
        "kind": "group",
        "group": group,
        "standings": standings_for(group_matches),
        "matches": [compact_match(match) for match in ordered],
    }


def player_context(player: dict[str, Any], schedule: dict[str, Any]) -> dict[str, Any]:
    team = player.get("team")
    team_matches = [
        compact_match(match)
        for match in schedule.get("matches", [])
        if match.get("home") == team or match.get("away") == team
    ]
    return {
        "kind": "player",
        "player": player,
        "teamMatches": team_matches[:8],
    }


def prompt_key(kind: str, context: dict[str, Any]) -> str:
    if kind == "match_preview":
        return "match_preview"
    if kind == "match" and context.get("knownTeamCount") == 1:
        return "match_partial"
    return kind


def read_prompt(kind: str, context: dict[str, Any]) -> str:
    return PROMPTS[prompt_key(kind, context)].read_text(encoding="utf-8").strip()


def build_target(
    kind: str,
    target_id: str,
    label: str,
    context: dict[str, Any],
    stale_hours: int,
    reason: str,
    priority: tuple[int, float, int],
) -> Target:
    prompt = read_prompt(kind, context)
    return Target(
        kind=kind,
        target_id=str(target_id),
        label=label,
        context=context,
        source_hash=stable_hash(context),
        prompt_hash=text_hash(prompt),
        prompt=prompt,
        stale_hours=stale_hours,
        reason=reason,
        priority=priority,
    )


def target_limits(mode: str, args: argparse.Namespace) -> dict[str, int]:
    limits = TARGET_LIMITS[mode].copy()
    for key in ("matches", "groups", "players"):
        value = getattr(args, f"max_{key}")
        if value is not None:
            limits[key] = value
    return limits


def match_sort_id(match: dict[str, Any]) -> int:
    try:
        return int(match.get("id", 0))
    except (TypeError, ValueError):
        return 0


def planned_team_name(name: Any) -> bool:
    value = str(name or "").strip()
    lowered = value.lower()
    return bool(value) and not any(lowered.startswith(prefix) for prefix in PLACEHOLDER_TEAM_PREFIXES)


def has_planned_teams(match: dict[str, Any]) -> bool:
    return planned_team_name(match.get("home")) and planned_team_name(match.get("away"))


def planned_team_count(match: dict[str, Any]) -> int:
    return sum(1 for side in ("home", "away") if planned_team_name(match.get(side)))


def has_insight_eligible_team(match: dict[str, Any]) -> bool:
    return planned_team_count(match) >= 1


def kickoff_utc(match: dict[str, Any]) -> dt.datetime:
    return kickoff_datetime(match).astimezone(dt.timezone.utc)


def match_delta_hours(match: dict[str, Any], now: dt.datetime) -> float:
    return (kickoff_utc(match) - now).total_seconds() / 3600


def is_live_match(match: dict[str, Any], now: dt.datetime) -> bool:
    status = str(match.get("status", "")).strip().lower()
    if status in LIVE_STATUS_VALUES:
        return True
    delta_hours = match_delta_hours(match, now)
    return -3 <= delta_hours <= 3 and status not in {"completed", "final"} and not has_score(match)


def is_future_match(match: dict[str, Any], now: dt.datetime) -> bool:
    return match_delta_hours(match, now) >= 0


def is_recent_past_match(match: dict[str, Any], now: dt.datetime) -> bool:
    delta_hours = match_delta_hours(match, now)
    return -(RECENT_MATCH_REFRESH_DAYS * 24) <= delta_hours < 0


def cached_source_or_prompt_changed(target: Target, existing: dict[str, Any] | None) -> bool:
    return bool(
        existing
        and (
            existing.get("sourceHash") != target.source_hash
            or existing.get("promptHash") != target.prompt_hash
        )
    )


def match_stale_hours(match: dict[str, Any], now: dt.datetime) -> int:
    if is_live_match(match, now):
        return 1
    if is_recent_past_match(match, now):
        return 24
    if is_future_match(match, now):
        return FUTURE_MATCH_STALE_HOURS
    return ARCHIVE_MATCH_STALE_HOURS


def match_target_reason_and_priority(
    match: dict[str, Any],
    target: Target,
    existing: dict[str, Any] | None,
    now: dt.datetime,
    mode: str,
) -> tuple[bool, str, tuple[int, float, int]]:
    delta_hours = match_delta_hours(match, now)
    sort_id = match_sort_id(match)
    source_changed = cached_source_or_prompt_changed(target, existing)
    if source_changed:
        return True, "source or prompt changed", (0, abs(delta_hours), sort_id)
    cache_issue = completed_match_cache_issue(target, existing)
    if cache_issue:
        return True, cache_issue, (0, abs(delta_hours), sort_id)
    if is_live_match(match, now):
        return True, "live or in-progress match", (1, abs(delta_hours), sort_id)
    if is_recent_past_match(match, now):
        return True, f"past {RECENT_MATCH_REFRESH_DAYS} days", (2, abs(delta_hours), sort_id)
    if is_future_match(match, now):
        if planned_team_count(match) == 1:
            return True, "future match with one confirmed team", (4, max(delta_hours, 0), sort_id)
        return True, "future planned match", (4, max(delta_hours, 0), sort_id)
    if mode in {"seed", "all"}:
        return True, "seed planned match", (7, abs(delta_hours), sort_id)
    return False, "outside refresh window", (99, abs(delta_hours), sort_id)


def preview_stale_hours(match: dict[str, Any], now: dt.datetime) -> int:
    if is_future_match(match, now):
        return FUTURE_MATCH_STALE_HOURS
    return ARCHIVE_MATCH_STALE_HOURS


def match_preview_reason_and_priority(
    match: dict[str, Any],
    target: Target,
    existing: dict[str, Any] | None,
    now: dt.datetime,
    mode: str,
) -> tuple[bool, str, tuple[int, float, int]]:
    delta_hours = match_delta_hours(match, now)
    sort_id = match_sort_id(match)
    if cached_source_or_prompt_changed(target, existing):
        return True, "preview source or prompt changed", (2, abs(delta_hours), sort_id)
    if is_future_match(match, now):
        return True, "future spoiler-free preview", (5, max(delta_hours, 0), sort_id)
    if mode in {"seed", "all"} or not existing:
        return True, "seed spoiler-free preview", (7, abs(delta_hours), sort_id)
    return False, "preview cache current", (99, abs(delta_hours), sort_id)


def group_stale_hours(group_matches: list[dict[str, Any]], now: dt.datetime) -> int:
    if any(is_live_match(match, now) or is_recent_past_match(match, now) for match in group_matches):
        return GROUP_ACTIVE_STALE_HOURS
    if any(has_score(match) for match in group_matches):
        return GROUP_ACTIVE_STALE_HOURS
    if any(0 <= match_delta_hours(match, now) <= 7 * 24 for match in group_matches):
        return GROUP_ACTIVE_STALE_HOURS
    return GROUP_QUIET_STALE_HOURS


def group_reason_and_priority(
    group: str,
    target: Target,
    existing: dict[str, Any] | None,
    group_matches: list[dict[str, Any]],
    now: dt.datetime,
    mode: str,
) -> tuple[bool, str, tuple[int, float, int]]:
    source_changed = cached_source_or_prompt_changed(target, existing)
    upcoming_delta = min((abs(match_delta_hours(match, now)) for match in group_matches), default=9999.0)
    group_order = ord(group[0]) if group else 90
    if source_changed:
        return True, "group standings or prompt changed", (1, upcoming_delta, group_order)
    if any(is_live_match(match, now) or is_recent_past_match(match, now) for match in group_matches):
        return True, "active or recent group", (3, upcoming_delta, group_order)
    if any(0 <= match_delta_hours(match, now) <= 7 * 24 for match in group_matches):
        return True, "upcoming group", (5, upcoming_delta, group_order)
    if mode in {"seed", "all"} or not existing:
        return True, "seed group", (8, upcoming_delta, group_order)
    return False, "quiet group", (99, upcoming_delta, group_order)


def build_targets(
    schedule: dict[str, Any],
    player_stats: dict[str, Any],
    ai_data: dict[str, Any],
    args: argparse.Namespace,
) -> list[Target]:
    now = utc_now()
    matches = list(schedule.get("matches", []))
    groups = group_map(matches)
    limits = target_limits(args.mode, args)
    targets: list[Target] = []
    specific_match_ids = {str(match_id) for match_id in args.match_id}
    specific_groups = {str(group).strip().upper() for group in args.group}
    specific_players = [player.strip() for player in args.player if player.strip()]
    has_specific_targets = bool(specific_match_ids or specific_groups or specific_players)

    match_targets: list[Target] = []
    if specific_match_ids:
        match_candidates = [match for match in matches if str(match.get("id")) in specific_match_ids]
        for match in match_candidates:
            if not has_insight_eligible_team(match):
                continue
            label = f"{match.get('home')} vs {match.get('away')}"
            if args.match_content in {"all", "previews"}:
                match_targets.append(
                    build_target(
                        "match_preview",
                        str(match.get("id")),
                        label,
                        match_preview_context(match, schedule, groups),
                        0,
                        "manual spoiler-free preview target",
                        (0, abs(match_delta_hours(match, now)), match_sort_id(match)),
                    )
                )
            if args.match_content in {"all", "recaps"} and match_insight_focus(match) != "preview":
                match_targets.append(
                    build_target(
                        "match",
                        str(match.get("id")),
                        label,
                        match_context(match, schedule, groups),
                        0,
                        "manual match recap target",
                        (1, abs(match_delta_hours(match, now)), match_sort_id(match)),
                    )
                )
    elif not has_specific_targets:
        for match in matches:
            if not has_insight_eligible_team(match):
                continue
            label = f"{match.get('home')} vs {match.get('away')}"

            if args.match_content in {"all", "previews"}:
                preview_placeholder = build_target(
                    "match_preview",
                    str(match.get("id")),
                    label,
                    match_preview_context(match, schedule, groups),
                    preview_stale_hours(match, now),
                    "pending",
                    (99, abs(match_delta_hours(match, now)), match_sort_id(match)),
                )
                existing_preview = insight_bucket(ai_data, "match_preview").get(preview_placeholder.target_id)
                include, reason, priority = match_preview_reason_and_priority(
                    match, preview_placeholder, existing_preview, now, args.mode
                )
                if include:
                    match_targets.append(
                        build_target(
                            "match_preview",
                            str(match.get("id")),
                            label,
                            preview_placeholder.context,
                            preview_placeholder.stale_hours,
                            reason,
                            priority,
                        )
                    )

            if args.match_content not in {"all", "recaps"} or match_insight_focus(match) == "preview":
                continue

            placeholder = build_target(
                "match",
                str(match.get("id")),
                label,
                match_context(match, schedule, groups),
                match_stale_hours(match, now),
                "pending",
                (99, abs(match_delta_hours(match, now)), match_sort_id(match)),
            )
            existing = insight_bucket(ai_data, "match").get(placeholder.target_id)
            include, reason, priority = match_target_reason_and_priority(match, placeholder, existing, now, args.mode)
            if not include:
                continue
            match_targets.append(
                build_target(
                    "match",
                    str(match.get("id")),
                    label,
                    placeholder.context,
                    placeholder.stale_hours,
                    reason,
                    priority,
                )
            )
    targets.extend(sorted(match_targets, key=lambda target: target.priority)[: limits["matches"]])

    group_targets: list[Target] = []
    if specific_groups:
        group_ids = [group for group in sorted(groups) if group.upper() in specific_groups]
    elif has_specific_targets:
        group_ids = []
    else:
        group_ids = sorted(groups)

    for group in group_ids:
        target = build_target(
            "group",
            group,
            f"Group {group}",
            group_context(group, groups[group], schedule),
            group_stale_hours(groups[group], now),
            "manual group target" if specific_groups else "pending",
            (0 if specific_groups else 99, 0, ord(group[0]) if group else 90),
        )
        if not specific_groups:
            existing = insight_bucket(ai_data, "group").get(target.target_id)
            include, reason, priority = group_reason_and_priority(group, target, existing, groups[group], now, args.mode)
            if not include:
                continue
            target = build_target("group", group, f"Group {group}", target.context, target.stale_hours, reason, priority)
        group_targets.append(target)
    targets.extend(sorted(group_targets, key=lambda target: target.priority)[: limits["groups"]])

    player_targets: list[Target] = []
    if specific_players:
        players = [player for player in player_stats.get("players", []) if player_matches_selector(player, specific_players)]
    elif has_specific_targets:
        players = []
    else:
        players = list(player_stats.get("players", []))[: limits["players"]]

    for index, player in enumerate(players):
        key = player_key(player)
        rank = int(player.get("rank") or index + 1)
        label = f"{player.get('player')} ({player.get('team')})"
        target = build_target(
            "player",
            key,
            label,
            player_context(player, schedule),
            0 if specific_players else PLAYER_STALE_HOURS,
            "manual player target" if specific_players else "top player",
            (0 if specific_players else 6, float(rank), rank),
        )
        existing = insight_bucket(ai_data, "player").get(target.target_id)
        if cached_source_or_prompt_changed(target, existing):
            target = build_target("player", key, label, target.context, target.stale_hours, "player stats or prompt changed", (2, float(rank), rank))
        player_targets.append(target)
    targets.extend(sorted(player_targets, key=lambda target: target.priority)[: limits["players"]])

    return sorted(targets, key=lambda target: target.priority)


def insight_bucket(data: dict[str, Any], kind: str) -> dict[str, Any]:
    return data.setdefault(
        {"match": "matches", "match_preview": "matchPreviews", "group": "groups", "player": "players"}[kind],
        {},
    )


def prune_preview_only_match_recaps(ai_data: dict[str, Any], schedule: dict[str, Any]) -> int:
    """Remove stale recap entries for matches that are still preview-only."""
    recaps = ai_data.setdefault("matches", {})
    removed = 0
    for match in schedule.get("matches", []):
        match_id = str(match.get("id"))
        if match_id in recaps and match_insight_focus(match) == "preview":
            del recaps[match_id]
            removed += 1
    return removed


def parse_time(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(dt.timezone.utc)
    except ValueError:
        return None


def should_refresh(target: Target, existing: dict[str, Any] | None, force: bool) -> bool:
    if force or not existing:
        return True
    if existing.get("sourceHash") != target.source_hash or existing.get("promptHash") != target.prompt_hash:
        return True
    if completed_match_cache_issue(target, existing):
        return True

    updated = parse_time(existing.get("updatedAt"))
    if not updated:
        return True
    age_hours = (utc_now() - updated).total_seconds() / 3600
    return age_hours >= target.stale_hours


def estimate_tokens(target: Target) -> tuple[int, int]:
    text = target.prompt + "\n\nContext JSON:\n" + json.dumps(target.context, ensure_ascii=True)
    input_tokens = max(1, math.ceil(len(text) / 4))
    output_tokens = 1200
    return input_tokens, output_tokens


def estimate_cost(targets: list[Target], input_price: float, output_price: float) -> float:
    input_tokens = 0
    output_tokens = 0
    for target in targets:
        target_input, target_output = estimate_tokens(target)
        input_tokens += target_input
        output_tokens += target_output
    return (input_tokens / 1_000_000) * input_price + (output_tokens / 1_000_000) * output_price


GENERIC_HIGHLIGHT_PHRASES = (
    "highlight",
    "highlights",
    "catch the action",
    "watch the action",
    "watch now",
    "available for viewing",
    "available to watch",
    "video links",
)

COMPLETED_MATCH_PREVIEW_PATTERNS = (
    r"\bfaces?\b",
    r"\bmeets?\b",
    r"\bsquare(?:s|d)? off\b",
    r"\blook(?:s|ing)? to\b",
    r"\bseek(?:s|ing)?\b",
    r"\bneed(?:s|ed|ing)?\s+(?:a\s+|the\s+)?(?:win|victory|result|points?)\b",
    r"\bdesperate for\b",
    r"\bprepare(?:s|d|ing)? to\b",
    r"\bhead(?:s|ed|ing)? into (?:this|the) (?:match|fixture|clash|game)\b",
    r"\benter(?:s|ed|ing)? (?:this|the) (?:match|fixture|clash|game)\b",
    r"\bset to\b",
    r"\bscheduled to\b",
    r"\bupcoming\b",
    r"\bwhat to watch\b",
)


def is_generic_highlight_text(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in GENERIC_HIGHLIGHT_PHRASES)


def remove_generic_highlight_sentences(text: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    kept = [sentence for sentence in sentences if sentence and not is_generic_highlight_text(sentence)]
    return " ".join(kept).strip() or text.strip()


def completed_match_score_present(target: Target, text: str) -> bool:
    match = target.context.get("match", {})
    if match.get("homeScore") is None or match.get("awayScore") is None:
        return True

    home_score = str(match.get("homeScore"))
    away_score = str(match.get("awayScore"))
    lowered = text.lower()
    patterns = (
        rf"\b{re.escape(home_score)}\s*[-\u2013\u2014]\s*{re.escape(away_score)}\b",
        rf"\b{re.escape(home_score)}\s+to\s+{re.escape(away_score)}\b",
        rf"\b{re.escape(str(match.get('home', '')).lower())}\s+{re.escape(home_score)}\s*,\s*"
        rf"{re.escape(str(match.get('away', '')).lower())}\s+{re.escape(away_score)}\b",
    )
    return any(re.search(pattern, lowered) for pattern in patterns)


def completed_match_final_sentence(target: Target) -> str | None:
    match = target.context.get("match", {})
    if match.get("homeScore") is None or match.get("awayScore") is None:
        return None
    final = f"Final: {match.get('home')} {match.get('homeScore')}, {match.get('away')} {match.get('awayScore')}"
    if has_penalty_shootout(match):
        final += f" ({match.get('homePenaltyScore')}-{match.get('awayPenaltyScore')} on penalties)"
    return f"{final}."


def completed_match_preview_framing(text: str) -> bool:
    lowered = f" {text.lower()} "
    return any(re.search(pattern, lowered) for pattern in COMPLETED_MATCH_PREVIEW_PATTERNS)


def completed_match_cache_issue(target: Target, existing: dict[str, Any] | None) -> str | None:
    if target.kind != "match" or not existing:
        return None

    match = target.context.get("match", {})
    if match.get("insightFocus") != "completed_recap" and not match.get("result"):
        return None

    headline = str(existing.get("headline", ""))
    summary = str(existing.get("summary", ""))
    key_text = f"{headline} {summary}"

    if completed_match_preview_framing(key_text):
        return "completed match insight still reads like a preview"
    if not completed_match_score_present(target, f"{headline} {summary}"):
        return "completed match insight does not clearly include the final score"
    return None


def clean_generated(value: Any, kind: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("Gemini response was not a JSON object")
    headline = str(value.get("headline", "")).strip()
    summary = str(value.get("summary", "")).strip()
    bullets = value.get("bullets", [])
    if not isinstance(bullets, list):
        bullets = []
    bullets = [str(item).strip() for item in bullets if str(item).strip()]
    if kind in {"match", "match_preview"}:
        bullets = [item for item in bullets if not is_generic_highlight_text(item)]
    bullets = bullets[:6]
    story = value.get("story", [])
    if not isinstance(story, list):
        story = []
    story = [str(item).strip() for item in story if str(item).strip()]
    if kind in {"match", "match_preview"}:
        story = [item for item in story if not is_generic_highlight_text(item)]
    story = story[:8]
    sections = value.get("sections", [])
    if not isinstance(sections, list):
        sections = []
    cleaned_sections = []
    for section in sections:
        if not isinstance(section, dict):
            continue
        title = str(section.get("title", "")).strip()
        body = str(section.get("body", "")).strip()
        if kind in {"match", "match_preview"} and is_generic_highlight_text(f"{title} {body}"):
            continue
        if title and body:
            cleaned_sections.append({"title": title[:100], "body": body[:1800]})
        if len(cleaned_sections) >= 5:
            break
    if not headline or not summary:
        raise ValueError("Gemini response missing headline or summary")
    if kind in {"match", "match_preview"}:
        summary = remove_generic_highlight_sentences(summary)
    return {
        "headline": headline[:140],
        "summary": summary[:2200],
        "story": [paragraph[:1800] for paragraph in story],
        "bullets": bullets,
        "sections": cleaned_sections,
    }


def completed_match_validation_error(target: Target, generated: dict[str, Any]) -> str | None:
    if target.kind != "match":
        return None

    match = target.context.get("match", {})
    if match.get("insightFocus") != "completed_recap" and not match.get("result"):
        return None

    summary = str(generated.get("summary", "")).strip()
    recap_text = f"{generated.get('headline', '')} {summary}"
    if completed_match_preview_framing(recap_text):
        return "completed match headline/summary used preview framing"
    if not completed_match_score_present(target, recap_text):
        return "completed match summary did not clearly include the final score"

    return None


def match_preview_validation_error(target: Target, generated: dict[str, Any]) -> str | None:
    if target.kind != "match_preview":
        return None

    text = " ".join(
        [
            str(generated.get("headline", "")),
            str(generated.get("summary", "")),
            *[str(item) for item in generated.get("story", [])],
            *[str(item) for item in generated.get("bullets", [])],
            *[
                f"{section.get('title', '')} {section.get('body', '')}"
                for section in generated.get("sections", [])
                if isinstance(section, dict)
            ],
        ]
    )
    if is_generic_highlight_text(text):
        return "spoiler-free preview referenced highlights or video availability"
    return None


def normalize_completed_match_generated(target: Target, generated: dict[str, Any]) -> dict[str, Any]:
    if target.kind != "match":
        return generated

    match = target.context.get("match", {})
    if match.get("insightFocus") != "completed_recap" and not match.get("result"):
        return generated

    headline = str(generated.get("headline", "")).strip()
    summary = str(generated.get("summary", "")).strip()
    if completed_match_score_present(target, f"{headline} {summary}"):
        return generated

    final_sentence = completed_match_final_sentence(target)
    if not final_sentence:
        return generated

    generated = generated.copy()
    generated["summary"] = f"{final_sentence} {summary}".strip()
    return generated


def call_gemini(target: Target, api_key: str, model: str, timeout: int) -> dict[str, Any]:
    prompt = (
        f"{target.prompt}\n\n"
        "Context JSON:\n"
        f"{json.dumps(target.context, indent=2, ensure_ascii=True)}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.45,
            "maxOutputTokens": 1800,
            "responseMimeType": "application/json",
            "responseJsonSchema": JSON_SCHEMA,
        },
    }
    url = GEMINI_ENDPOINT.format(model=urllib.parse.quote(model, safe="-_.")).strip()
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini request failed with HTTP {exc.code}: {detail[:500]}") from exc

    parts = raw.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts)
    if not text:
        raise ValueError("Gemini response did not contain text")
    generated = normalize_completed_match_generated(target, clean_generated(json.loads(text), target.kind))
    validation_error = completed_match_validation_error(target, generated)
    validation_error = validation_error or match_preview_validation_error(target, generated)
    if validation_error:
        raise ValueError(validation_error)
    return generated


def build_entry(target: Target, generated: dict[str, Any], model: str) -> dict[str, Any]:
    return {
        **generated,
        "updatedAt": utc_now().isoformat(),
        "sourceHash": target.source_hash,
        "promptHash": target.prompt_hash,
        "model": model,
        "refreshReason": target.reason,
    }


def sync_static_only(ai_data: dict[str, Any], static_path: Path) -> bool:
    return write_static_data(ai_data, static_path)


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Generate Gemini AI insight blurbs for the World Cup site.")
    parser.add_argument("--schedule-data", type=Path, default=DEFAULT_SCHEDULE_DATA)
    parser.add_argument("--player-data", type=Path, default=DEFAULT_PLAYER_DATA)
    parser.add_argument("--data", type=Path, default=DEFAULT_AI_DATA)
    parser.add_argument("--static-data", type=Path, default=DEFAULT_STATIC_DATA)
    parser.add_argument("--mode", choices=["minimal", "standard", "seed", "all"], default="minimal")
    parser.add_argument("--force", action="store_true", help="Regenerate selected targets even if cached")
    parser.add_argument("--force-all", action="store_true", help="Regenerate all targets, subject to cost/call caps")
    parser.add_argument("--dry-run", action="store_true", help="Plan and estimate only; do not call Gemini or write files")
    parser.add_argument("--estimate-cost", action="store_true", help="Alias for --dry-run with cost output")
    parser.add_argument("--require-api-key", action="store_true", help="Fail instead of skipping when GEMINI_API_KEY is missing")
    parser.add_argument("--max-calls", type=int, default=None)
    parser.add_argument("--max-estimated-cost", type=float, default=0.25)
    parser.add_argument("--max-matches", type=int, default=None)
    parser.add_argument("--max-groups", type=int, default=None)
    parser.add_argument("--max-players", type=int, default=None)
    parser.add_argument(
        "--match-content",
        choices=["all", "previews", "recaps"],
        default="all",
        help="Which match insight content to refresh.",
    )
    parser.add_argument("--match-id", action="append", default=[], help="Only refresh this match id. Repeatable.")
    parser.add_argument("--group", action="append", default=[], help="Only refresh this group letter. Repeatable.")
    parser.add_argument(
        "--player",
        action="append",
        default=[],
        help="Only refresh this player by name, key, or 'Name|Team'. Repeatable.",
    )
    parser.add_argument("--sleep", type=float, default=float(os.environ.get("GEMINI_SLEEP_SECONDS", "4")))
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()

    if args.force_all:
        args.mode = "all"
        args.force = True
        if args.max_calls is None:
            args.max_calls = TARGET_LIMITS["all"]["calls"]
    if args.estimate_cost:
        args.dry_run = True
    if args.max_calls is None:
        args.max_calls = TARGET_LIMITS[args.mode]["calls"]

    model = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)
    api_key = os.environ.get("GEMINI_API_KEY", "")
    input_price = float(os.environ.get("GEMINI_INPUT_PRICE_PER_MILLION", "0.25"))
    output_price = float(os.environ.get("GEMINI_OUTPUT_PRICE_PER_MILLION", "1.50"))

    schedule = read_json(args.schedule_data, {})
    player_stats = read_json(args.player_data, {"players": []})
    ai_data = read_json(args.data, {"generatedAt": None, "matches": {}, "matchPreviews": {}, "groups": {}, "players": {}})
    ai_data.setdefault("matches", {})
    ai_data.setdefault("matchPreviews", {})
    ai_data.setdefault("groups", {})
    ai_data.setdefault("players", {})
    pruned_preview_recaps = prune_preview_only_match_recaps(ai_data, schedule)

    targets = build_targets(schedule, player_stats, ai_data, args)
    all_refresh_targets = [
        target
        for target in targets
        if should_refresh(target, insight_bucket(ai_data, target.kind).get(target.target_id), args.force)
    ]
    refresh_targets = all_refresh_targets[: args.max_calls]
    queued_not_selected = max(0, len(all_refresh_targets) - len(refresh_targets))
    skipped_by_cache = max(0, len(targets) - len(all_refresh_targets))
    estimated = estimate_cost(refresh_targets, input_price, output_price)

    print(f"AI insights mode: {args.mode}")
    print(f"AI insights model: {model}")
    print(f"AI insight targets considered: {len(targets)}")
    print(f"AI insight targets queued for refresh: {len(all_refresh_targets)}")
    print(f"AI insight targets selected this run: {len(refresh_targets)}")
    print(f"AI insight targets queued but not updated this run: {queued_not_selected}")
    print(f"AI insight targets skipped by cache/cadence: {skipped_by_cache}")
    print(f"AI insight max calls this run: {args.max_calls}")
    print(f"AI insight estimated paid-tier cost: ${estimated:.4f}")
    if pruned_preview_recaps:
        print(f"AI stale preview-only recap entries pruned: {pruned_preview_recaps}")

    if args.dry_run:
        for target in refresh_targets:
            input_tokens, output_tokens = estimate_tokens(target)
            print(
                f"DRY {target.kind} {target.target_id} {target.label} "
                f"[{target.reason}]: ~{input_tokens} in, ~{output_tokens} out"
            )
        print(
            f"AI insights summary: updated=0; failed=0; dry_run=true; "
            f"queued_for_refresh={len(all_refresh_targets)}; selected_this_run={len(refresh_targets)}; "
            f"queued_not_updated={queued_not_selected}; skipped_by_cache_or_cadence={skipped_by_cache}; "
            f"estimated_cost=${estimated:.4f}"
        )
        return 0

    if not api_key:
        message = "No GEMINI_API_KEY found; skipping AI insights."
        if args.require_api_key:
            raise RuntimeError(message)
        print(message)
        static_changed = sync_static_only(ai_data, args.static_data)
        print(f"AI insights static sync changed: {'yes' if static_changed else 'no'}")
        print("AI insights generated: 0; skipped missing key")
        print(
            f"AI insights summary: updated=0; failed=0; skipped_missing_key=true; "
            f"queued_for_refresh={len(all_refresh_targets)}; selected_this_run={len(refresh_targets)}; "
            f"queued_not_updated={len(all_refresh_targets)}; skipped_by_cache_or_cadence={skipped_by_cache}; "
            f"estimated_cost=${estimated:.4f}"
        )
        return 0

    if estimated > args.max_estimated_cost:
        print(
            f"AI insight estimated cost ${estimated:.4f} exceeds cap ${args.max_estimated_cost:.4f}; "
            "skipping paid calls."
        )
        print(
            f"AI insights summary: updated=0; failed=0; skipped_cost_cap=true; "
            f"queued_for_refresh={len(all_refresh_targets)}; selected_this_run={len(refresh_targets)}; "
            f"queued_not_updated={len(all_refresh_targets)}; skipped_by_cache_or_cadence={skipped_by_cache}; "
            f"estimated_cost=${estimated:.4f}"
        )
        return 0

    generated_count = 0
    failed_count = 0
    for index, target in enumerate(refresh_targets):
        if index and args.sleep > 0:
            time.sleep(args.sleep)
        try:
            generated = call_gemini(target, api_key, model, args.timeout)
        except Exception as exc:  # noqa: BLE001 - keep refresh resilient and log enough context.
            failed_count += 1
            print(f"AI insight failed for {target.kind} {target.target_id} {target.label}: {exc}")
            continue

        bucket = insight_bucket(ai_data, target.kind)
        bucket[target.target_id] = build_entry(target, generated, model)
        generated_count += 1
        print(f"AI insight generated for {target.kind} {target.target_id}: {target.label}")

    if generated_count:
        ai_data["generatedAt"] = utc_now().isoformat()

    data_text = json.dumps(ai_data, indent=2, ensure_ascii=True) + "\n"
    data_changed = write_if_changed(args.data, data_text)
    static_changed = write_static_data(ai_data, args.static_data)

    print(f"AI insights generated: {generated_count}")
    print(f"AI insights failed: {failed_count}")
    print(f"AI insights queued but not updated this run: {queued_not_selected + failed_count}")
    print(f"AI insights files changed: {'yes' if data_changed or static_changed else 'no'}")
    print(
        f"AI insights summary: updated={generated_count}; failed={failed_count}; "
        f"queued_for_refresh={len(all_refresh_targets)}; selected_this_run={len(refresh_targets)}; "
        f"queued_not_updated={queued_not_selected + failed_count}; "
        f"skipped_by_cache_or_cadence={skipped_by_cache}; estimated_cost=${estimated:.4f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
