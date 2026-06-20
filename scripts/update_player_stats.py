#!/usr/bin/env python3
"""Refresh World Cup player scoring stats from the Guardian Golden Boot feed."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "player-stats.json"
DEFAULT_STATIC_DATA = ROOT / "player-stats.js"
GUARDIAN_GOLDEN_BOOT = "https://mobile.guardianapis.com/sport/football/competitions/700/golden-boot"
GUARDIAN_PAGE = (
    "https://www.theguardian.com/football/ng-interactive/2026/jun/04/"
    "golden-boot-world-cup-2026-top-goalscorers-winner"
)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)

COUNTRY_ALIASES = {
    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
    "Congo DR": "DR Congo",
    "Czech Republic": "Czechia",
    "USA": "United States",
}

POSITION_ALIASES = {
    "Defender": "DEF",
    "Goalkeeper": "GK",
    "Midfielder": "MID",
    "Striker": "FW",
}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def fetch_json(url: str) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def normalize_player(player: dict[str, Any]) -> dict[str, Any]:
    goals = int(player.get("goals") or 0)
    assists = int(player.get("assists") or 0)
    minutes = int(player.get("minutesPlayed") or player.get("minutes") or 0)
    points = goals + assists
    games = player.get("games") if isinstance(player.get("games"), list) else []
    country = COUNTRY_ALIASES.get(player.get("country", ""), player.get("country", ""))
    position = POSITION_ALIASES.get(player.get("position", ""), player.get("position", ""))

    return {
        "rank": int(player.get("rank") or 0),
        "player": player.get("name") or player.get("player") or "Unknown player",
        "team": country,
        "position": position,
        "goals": goals,
        "assists": assists,
        "points": points,
        "matches": len(games) if games else int(player.get("matches") or 0),
        "minutes": minutes,
        "goalsPer90": round((goals * 90) / max(1, minutes), 1),
        "pointsPer90": round((points * 90) / max(1, minutes), 1),
    }


def player_key(player: dict[str, Any]) -> tuple[str, str]:
    return (str(player.get("player", "")).casefold(), str(player.get("team", "")).casefold())


def changed_rows(old_players: list[dict[str, Any]], new_players: list[dict[str, Any]]) -> int:
    old = {player_key(player): player for player in old_players}
    new = {player_key(player): player for player in new_players}
    keys = set(old) | set(new)
    return sum(1 for key in keys if old.get(key) != new.get(key))


def read_existing(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def build_payload(players: list[dict[str, Any]], existing: dict[str, Any] | None) -> dict[str, Any]:
    existing_players = existing.get("players", []) if isinstance(existing, dict) else []
    generated_at = existing.get("generatedAt") if existing_players == players else utc_now()

    return {
        "generatedAt": generated_at,
        "sources": [
            {"label": "Guardian Golden Boot", "url": GUARDIAN_PAGE},
            {"label": "Guardian data feed", "url": GUARDIAN_GOLDEN_BOOT},
        ],
        "players": players,
    }


def write_if_changed(path: Path, text: str) -> bool:
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def write_static_data(data: dict[str, Any], path: Path) -> bool:
    payload = json.dumps(data, indent=2, ensure_ascii=True)
    return write_if_changed(path, f"window.WORLD_CUP_PLAYER_STATS = {payload};\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh player stats from the Guardian Golden Boot feed.")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--static-data", type=Path, default=DEFAULT_STATIC_DATA)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    raw_players = fetch_json(GUARDIAN_GOLDEN_BOOT)
    if not isinstance(raw_players, list):
        raise ValueError("Guardian player stats response was not a list")

    players = [normalize_player(player) for player in raw_players]
    existing = read_existing(args.data)
    old_players = existing.get("players", []) if isinstance(existing, dict) else []
    changed = changed_rows(old_players, players)
    payload = build_payload(players, existing)

    print(f"Player stat rows: {len(players)}")
    print(f"Updated player rows: {changed}")

    if args.dry_run:
        return 0

    args.data.parent.mkdir(parents=True, exist_ok=True)
    data_text = json.dumps(payload, indent=2, ensure_ascii=True) + "\n"
    data_changed = write_if_changed(args.data, data_text)
    static_changed = write_static_data(payload, args.static_data)
    print(f"Files changed: {'yes' if data_changed or static_changed else 'no'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
