#!/usr/bin/env python3
"""Refresh knockout chance-to-advance odds from ESPN event summary JSON."""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import re
import unicodedata
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEDULE_DATA = ROOT / "data" / "world-cup-2026.json"
DEFAULT_DATA = ROOT / "data" / "match-odds.json"
DEFAULT_STATIC_DATA = ROOT / "match-odds.js"
SUMMARY_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={event_id}"
MATCH_PAGE_URL = "https://www.espn.com/soccer/match/_/gameId/{event_id}/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)
PLACEHOLDER_PREFIXES = ("winner ", "runner up ", "loser ", "best 3rd ", "tbd", "to be determined")


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii")
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def is_real_team(value: Any) -> bool:
    normalized = normalize_text(str(value or ""))
    return bool(normalized) and not normalized.startswith(PLACEHOLDER_PREFIXES)


def is_completed(match: dict[str, Any]) -> bool:
    return str(match.get("status", "")).strip().lower() == "completed"


def american_to_raw_probability(value: Any) -> float | None:
    try:
        odds = float(value)
    except (TypeError, ValueError):
        return None
    if odds == 0:
        return None
    if odds > 0:
        return 100 / (odds + 100)
    return abs(odds) / (abs(odds) + 100)


def int_or_none(value: Any) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8", errors="replace"))


def team_name_from_odds(team_odds: dict[str, Any], fallback: str) -> str:
    team = team_odds.get("team") or {}
    return team.get("displayName") or team.get("shortDisplayName") or team.get("name") or fallback


def odds_payload_for_match(match: dict[str, Any], summary: dict[str, Any], generated_at: str) -> dict[str, Any] | None:
    odds = (summary.get("odds") or summary.get("pickcenter") or [{}])[0] or {}
    home_odds = odds.get("homeTeamOdds") or {}
    away_odds = odds.get("awayTeamOdds") or {}
    draw_odds = odds.get("drawOdds") or {}
    home_american = int_or_none(home_odds.get("moneyLine"))
    away_american = int_or_none(away_odds.get("moneyLine"))
    draw_american = int_or_none(draw_odds.get("moneyLine"))
    home_raw = american_to_raw_probability(home_american)
    away_raw = american_to_raw_probability(away_american)
    draw_raw = american_to_raw_probability(draw_american)
    team_raw_total = (home_raw or 0) + (away_raw or 0)
    if home_raw is None or away_raw is None or not team_raw_total:
        return None

    provider = odds.get("provider") or {}
    event_id = str(match.get("espnEventId") or "")
    source_url = MATCH_PAGE_URL.format(event_id=event_id)
    home_probability = home_raw / team_raw_total
    away_probability = away_raw / team_raw_total

    return {
        "market": "Chance to advance",
        "calculation": "Derived from ESPN-listed team moneylines; the draw path is allocated proportionally to the two teams.",
        "book": provider.get("name") or "ESPN odds",
        "sourceLabel": "ESPN",
        "sourceUrl": source_url,
        "asOf": generated_at,
        "espnEventId": event_id,
        "outcomes": [
            {
                "key": "home",
                "label": team_name_from_odds(home_odds, match.get("home", "Home")),
                "american": home_american,
                "rawProbability": home_raw,
                "advanceProbability": home_probability,
            },
            {
                "key": "away",
                "label": team_name_from_odds(away_odds, match.get("away", "Away")),
                "american": away_american,
                "rawProbability": away_raw,
                "advanceProbability": away_probability,
            },
        ],
        "draw": {
            "label": "Draw after 90 minutes",
            "american": draw_american,
            "rawProbability": draw_raw,
        },
        "rawTeamTotal": team_raw_total,
        "rawMarketTotal": team_raw_total + (draw_raw or 0),
    }


def load_existing(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def payload_without_timestamp(payload: dict[str, Any]) -> dict[str, Any]:
    comparable = copy.deepcopy(payload)
    comparable.pop("asOf", None)
    return comparable


def payloads_match(existing: dict[str, Any] | None, fresh: dict[str, Any]) -> bool:
    if not existing:
        return False
    return payload_without_timestamp(existing) == payload_without_timestamp(fresh)


def data_without_generated_at(data: dict[str, Any]) -> dict[str, Any]:
    comparable = copy.deepcopy(data)
    comparable.pop("generatedAt", None)
    return comparable


def refresh_odds(args: argparse.Namespace) -> tuple[int, int, int, list[str], list[str], bool]:
    schedule = json.loads(args.schedule_data.read_text(encoding="utf-8"))
    existing_data = load_existing(args.data)
    existing_matches = existing_data.get("matches") if isinstance(existing_data.get("matches"), dict) else {}
    generated_at = utc_now()
    matches: dict[str, Any] = {}
    changed: list[str] = []
    failures: list[str] = []
    checked = 0

    for match in schedule.get("matches", []):
        event_id = match.get("espnEventId")
        if not event_id or is_completed(match):
            continue
        if not (is_real_team(match.get("home")) and is_real_team(match.get("away"))):
            continue

        checked += 1
        if args.dry_run:
            continue

        match_id = str(match["id"])
        try:
            summary = fetch_json(SUMMARY_URL.format(event_id=event_id))
        except Exception as exc:  # noqa: BLE001 - keep scheduled refreshes resilient to ESPN/API hiccups.
            failures.append(f"Match {match_id}: {match.get('home')} vs {match.get('away')} ({exc})")
            if match_id in existing_matches:
                matches[match_id] = existing_matches[match_id]
            continue

        payload = odds_payload_for_match(match, summary, generated_at)
        if payload:
            if payloads_match(existing_matches.get(match_id), payload):
                matches[match_id] = existing_matches[match_id]
            else:
                matches[match_id] = payload
                changed.append(f"Match {match_id}: {match.get('home')} vs {match.get('away')}")

    source = {
        "label": "ESPN odds",
        "url": "https://www.espn.com/soccer/",
        "note": "Chance to advance is derived from ESPN-listed team moneylines. It is an estimate, not betting advice.",
    }
    fresh_data = {
        "generatedAt": generated_at,
        "source": source,
        "matches": matches,
    }
    data = fresh_data
    if existing_data and data_without_generated_at(existing_data) == data_without_generated_at(fresh_data):
        data = existing_data

    wrote = False
    if not args.dry_run:
        data_payload = json.dumps(data, indent=2, ensure_ascii=True) + "\n"
        static_payload = f"window.WORLD_CUP_MATCH_ODDS = {json.dumps(data, indent=2, ensure_ascii=True)};\n"
        existing_data_payload = args.data.read_text(encoding="utf-8") if args.data.exists() else ""
        existing_static_payload = args.static_data.read_text(encoding="utf-8") if args.static_data.exists() else ""
        if existing_data_payload != data_payload:
            args.data.write_text(data_payload, encoding="utf-8")
            wrote = True
        if existing_static_payload != static_payload:
            args.static_data.write_text(static_payload, encoding="utf-8")
            wrote = True

    return checked, len(matches), len(changed), changed, failures, wrote


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh ESPN chance-to-advance odds.")
    parser.add_argument("--schedule-data", type=Path, default=DEFAULT_SCHEDULE_DATA)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--static-data", type=Path, default=DEFAULT_STATIC_DATA)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    checked, saved, changed_count, changes, failures, wrote = refresh_odds(args)
    print(f"Odds matches eligible: {checked}")
    print(f"Odds matches saved: {saved}")
    print(f"Odds matches changed: {changed_count}")
    print(f"Odds files changed: {'yes' if wrote else 'no'}")
    for change in changes:
        print(f"- {change}")
    for failure in failures:
        print(f"Odds fetch skipped: {failure}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
