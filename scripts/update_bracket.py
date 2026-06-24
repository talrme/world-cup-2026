#!/usr/bin/env python3
"""Refresh knockout bracket slots from ESPN's World Cup scoreboard JSON."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "world-cup-2026.json"
DEFAULT_STATIC_DATA = ROOT / "schedule-data.js"
DEFAULT_SOURCE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
ESPN_PAGE_URL = "https://www.espn.com/soccer/bracket"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)
EASTERN = ZoneInfo("America/New_York")

KNOCKOUT_START = dt.date(2026, 6, 28)
KNOCKOUT_END = dt.date(2026, 7, 19)

# ESPN event ids are stable for the published 2026 World Cup knockout bracket.
# They map to this app's seeded match ids.
ESPN_EVENT_TO_MATCH_ID = {
    760486: 73,
    760489: 74,
    760488: 75,
    760487: 76,
    760492: 77,
    760490: 78,
    760491: 79,
    760495: 80,
    760494: 81,
    760493: 82,
    760496: 83,
    760497: 84,
    760498: 85,
    760500: 86,
    760501: 87,
    760499: 88,
    760502: 89,
    760503: 90,
    760504: 91,
    760505: 92,
    760506: 93,
    760507: 94,
    760509: 95,
    760508: 96,
    760510: 97,
    760511: 98,
    760512: 99,
    760513: 100,
    760514: 101,
    760515: 102,
    760516: 103,
    760517: 104,
}

ROUND_OF_32_MATCH_IDS = list(range(73, 89))
ROUND_OF_16_MATCH_IDS = list(range(89, 97))
QUARTERFINAL_MATCH_IDS = list(range(97, 101))
SEMIFINAL_MATCH_IDS = [101, 102]

VENUE_ALIASES = {
    "att stadium": "dallas",
    "bc place": "vancouver",
    "bmo field": "toronto",
    "estadio banorte": "mexico-city",
    "estadio bbva": "monterrey",
    "geha field at arrowhead stadium": "kansas-city",
    "gillette stadium": "boston",
    "hard rock stadium": "miami",
    "levis stadium": "sf-bay",
    "lincoln financial field": "philadelphia",
    "lumen field": "seattle",
    "mercedes benz stadium": "atlanta",
    "metlife stadium": "ny-nj",
    "nrg stadium": "houston",
    "sofi stadium": "los-angeles",
}

TEAM_REPLACEMENTS = {
    "USA": "United States",
    "U.S.": "United States",
    "Korea Republic": "South Korea",
    "Türkiye": "Turkey",
    "Curaçao": "Curacao",
    "Côte d'Ivoire": "Ivory Coast",
    "Cape Verde": "Cabo Verde",
}


def normalize_text(value: str) -> str:
    value = html.unescape(value)
    value = value.replace("\u2013", "-").replace("\u2014", "-")
    value = value.replace("\u00a0", " ")
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def clean_team(value: str) -> str:
    value = html.unescape(value or "").strip()
    value = re.sub(r"\s+", " ", value)
    return TEAM_REPLACEMENTS.get(value, value)


def is_placeholder(value: Any) -> bool:
    normalized = normalize_text(str(value or ""))
    return normalized.startswith(("winner ", "runner up ", "best 3rd", "loser "))


def bracket_placeholder(value: str) -> str:
    value = clean_team(value)

    match = re.fullmatch(r"Group ([A-L]) Winner", value, flags=re.IGNORECASE)
    if match:
        return f"Winner Group {match.group(1).upper()}"

    match = re.fullmatch(r"Group ([A-L]) 2nd Place", value, flags=re.IGNORECASE)
    if match:
        return f"Runner-up Group {match.group(1).upper()}"

    match = re.fullmatch(r"Third Place Group ([A-L](?:/[A-L])*)", value, flags=re.IGNORECASE)
    if match:
        return f"Best 3rd Group {match.group(1).upper()}"

    match = re.fullmatch(r"Round of 32 (\d+) Winner", value, flags=re.IGNORECASE)
    if match:
        index = int(match.group(1)) - 1
        if 0 <= index < len(ROUND_OF_32_MATCH_IDS):
            return f"Winner Match {ROUND_OF_32_MATCH_IDS[index]}"

    match = re.fullmatch(r"Round of 16 (\d+) Winner", value, flags=re.IGNORECASE)
    if match:
        index = int(match.group(1)) - 1
        if 0 <= index < len(ROUND_OF_16_MATCH_IDS):
            return f"Winner Match {ROUND_OF_16_MATCH_IDS[index]}"

    match = re.fullmatch(r"Quarterfinal (\d+) Winner", value, flags=re.IGNORECASE)
    if match:
        index = int(match.group(1)) - 1
        if 0 <= index < len(QUARTERFINAL_MATCH_IDS):
            return f"Winner Match {QUARTERFINAL_MATCH_IDS[index]}"

    match = re.fullmatch(r"Semifinal (\d+) Winner", value, flags=re.IGNORECASE)
    if match:
        index = int(match.group(1)) - 1
        if 0 <= index < len(SEMIFINAL_MATCH_IDS):
            return f"Winner Match {SEMIFINAL_MATCH_IDS[index]}"

    match = re.fullmatch(r"Semifinal (\d+) Loser", value, flags=re.IGNORECASE)
    if match:
        index = int(match.group(1)) - 1
        if 0 <= index < len(SEMIFINAL_MATCH_IDS):
            return f"Loser Match {SEMIFINAL_MATCH_IDS[index]}"

    return value


def fetch_scoreboard(source_url: str, date: dt.date) -> dict[str, Any]:
    query = urllib.parse.urlencode({"dates": date.strftime("%Y%m%d"), "limit": 100})
    separator = "&" if "?" in source_url else "?"
    url = f"{source_url}{separator}{query}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def event_datetime(event: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    raw = event.get("date")
    if not raw:
        return None, None, None
    parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    local = parsed.astimezone(EASTERN)
    offset = local.strftime("%z")
    return (
        local.date().isoformat(),
        local.strftime("%H:%M"),
        f"{offset[:3]}:{offset[3:]}",
    )


def venue_id_for(event: dict[str, Any]) -> str | None:
    competitions = event.get("competitions") or []
    venue = (competitions[0].get("venue") if competitions else None) or {}
    full_name = venue.get("fullName") or ""
    return VENUE_ALIASES.get(normalize_text(full_name))


def status_for(event: dict[str, Any]) -> str:
    status_type = ((event.get("status") or {}).get("type") or {})
    if status_type.get("completed"):
        return "completed"
    if status_type.get("state") == "in":
        return "live"
    return "scheduled"


def competitors_for(event: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    competitions = event.get("competitions") or []
    competitors = (competitions[0].get("competitors") if competitions else None) or []
    home = next((item for item in competitors if item.get("homeAway") == "home"), None)
    away = next((item for item in competitors if item.get("homeAway") == "away"), None)
    if home and away:
        return home, away
    if len(competitors) >= 2:
        return competitors[0], competitors[1]
    return None, None


def competitor_label(competitor: dict[str, Any] | None) -> str | None:
    if not competitor:
        return None
    team = competitor.get("team") or {}
    label = team.get("displayName") or team.get("shortDisplayName") or team.get("name")
    return bracket_placeholder(label) if label else None


def competitor_score(competitor: dict[str, Any] | None) -> int | None:
    if not competitor:
        return None
    try:
        return int(competitor.get("score"))
    except (TypeError, ValueError):
        return None


def changed(match: dict[str, Any], key: str, value: Any) -> bool:
    return match.get(key) != value


def update_side(match: dict[str, Any], side: str, value: str, changes: list[str]) -> None:
    current = match.get(side)
    if not value or current == value:
        return
    if is_placeholder(value) and current and not is_placeholder(current):
        return
    if is_placeholder(current) and not is_placeholder(value) and not match.get(f"{side}Source"):
        match[f"{side}Source"] = current
    match[side] = value
    changes.append(f"{side} team")


def update_match_from_event(match: dict[str, Any], event: dict[str, Any]) -> list[str]:
    changes: list[str] = []
    home, away = competitors_for(event)
    home_label = competitor_label(home)
    away_label = competitor_label(away)

    if home_label:
        update_side(match, "home", home_label, changes)
    if away_label:
        update_side(match, "away", away_label, changes)

    date_value, time_value, offset_value = event_datetime(event)
    if date_value and changed(match, "date", date_value):
        match["date"] = date_value
        changes.append("date")
    if time_value and changed(match, "time", time_value):
        match["time"] = time_value
        changes.append("kickoff")
    if offset_value and changed(match, "offset", offset_value):
        match["offset"] = offset_value
        changes.append("timezone")
    if changed(match, "timezoneLabel", "ET"):
        match["timezoneLabel"] = "ET"
        changes.append("timezone label")

    venue_id = venue_id_for(event)
    if venue_id and changed(match, "venueId", venue_id):
        match["venueId"] = venue_id
        changes.append("venue")

    status = status_for(event)
    if changed(match, "status", status):
        match["status"] = status
        changes.append("status")

    if changed(match, "espnEventId", str(event.get("id"))):
        match["espnEventId"] = str(event.get("id"))
        changes.append("espn id")

    if status in {"completed", "live"}:
        home_score = competitor_score(home)
        away_score = competitor_score(away)
        if home_score is not None and changed(match, "homeScore", home_score):
            match["homeScore"] = home_score
            changes.append("home score")
        if away_score is not None and changed(match, "awayScore", away_score):
            match["awayScore"] = away_score
            changes.append("away score")

    return changes


def ensure_source(data: dict[str, Any]) -> None:
    sources = data.setdefault("sources", [])
    if not any(source.get("url") == ESPN_PAGE_URL for source in sources if isinstance(source, dict)):
        sources.append({"label": "ESPN knockout bracket", "url": ESPN_PAGE_URL})


def write_static_data(data: dict[str, Any], path: Path) -> None:
    payload = json.dumps(data, indent=2, ensure_ascii=True)
    path.write_text(f"window.WORLD_CUP_DATA = {payload};\n", encoding="utf-8")


def refresh_bracket(args: argparse.Namespace) -> tuple[int, int, list[str]]:
    data = json.loads(args.data.read_text(encoding="utf-8"))
    by_id = {match["id"]: match for match in data["matches"]}
    seen_events: dict[int, dict[str, Any]] = {}
    current = args.start_date
    while current <= args.end_date:
        scoreboard = fetch_scoreboard(args.source_url, current)
        for event in scoreboard.get("events", []):
            try:
                event_id = int(event.get("id"))
            except (TypeError, ValueError):
                continue
            if event_id in ESPN_EVENT_TO_MATCH_ID:
                seen_events[event_id] = event
        current += dt.timedelta(days=1)

    changed_matches = 0
    change_log: list[str] = []
    for event_id in sorted(seen_events):
        match_id = ESPN_EVENT_TO_MATCH_ID[event_id]
        match = by_id.get(match_id)
        if not match:
            continue
        changes = update_match_from_event(match, seen_events[event_id])
        if changes:
            changed_matches += 1
            change_log.append(f"Match {match_id}: {', '.join(changes)}")

    if not args.dry_run and changed_matches:
        ensure_source(data)
        data["generatedAt"] = dt.datetime.now(dt.timezone.utc).date().isoformat()
        data["bracketUpdatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        data["bracketSourceUrl"] = args.source_url
        args.data.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        write_static_data(data, args.static_data)

    return len(seen_events), changed_matches, change_log


def date_arg(value: str) -> dt.date:
    return dt.date.fromisoformat(value)


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh knockout bracket slots from ESPN.")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="Path to world-cup-2026.json")
    parser.add_argument("--static-data", type=Path, default=DEFAULT_STATIC_DATA, help="Path to schedule-data.js")
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL, help="ESPN scoreboard endpoint")
    parser.add_argument("--start-date", type=date_arg, default=KNOCKOUT_START, help="First date to query")
    parser.add_argument("--end-date", type=date_arg, default=KNOCKOUT_END, help="Last date to query")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing files")
    args = parser.parse_args()

    event_count, changed_matches, change_log = refresh_bracket(args)
    print(f"ESPN knockout events read: {event_count}")
    print(f"Bracket matches changed: {changed_matches}")
    if change_log:
        print("Bracket changes:")
        for line in change_log:
            print(f"- {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
