#!/usr/bin/env python3
"""Refresh World Cup schedule data from a schedule/results page.

This updater intentionally keeps scores in the data file while the UI keeps
them hidden by default. It updates group-stage results, status, kickoff/network
metadata, and can replace knockout placeholders when the source later lists real
teams by match number or round/date order.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import unicodedata
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "world-cup-2026.json"
DEFAULT_STATIC_DATA = ROOT / "schedule-data.js"
DEFAULT_SOURCE_URL = (
    "https://www.sbnation.com/soccer/1117513/"
    "world-cup-schedule-2026-how-to-watch-every-match-scores-and-more"
)
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)

MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}

ROUND_ALIASES = {
    "round of 32": "Round of 32",
    "round of 16": "Round of 16",
    "quarterfinals": "Quarterfinals",
    "quarter-finals": "Quarterfinals",
    "semifinals": "Semifinals",
    "semi-finals": "Semifinals",
    "third place": "Third Place",
    "match for third place": "Third Place",
    "final": "Final",
}

TEAM_ALIASES = {
    "usa": "united states",
    "u s": "united states",
    "u s a": "united states",
    "usmnt": "united states",
    "korea republic": "south korea",
    "czech republic": "czechia",
    "turkiye": "turkey",
    "tuerkiye": "turkey",
    "cote divoire": "ivory coast",
    "cote d ivoire": "ivory coast",
    "cape verde": "cabo verde",
    "congo dr": "dr congo",
    "d r congo": "dr congo",
    "democratic republic of congo": "dr congo",
}


@dataclass
class Fixture:
    date: str | None
    stage: str
    group: str | None
    home: str
    away: str
    home_score: int | None = None
    away_score: int | None = None
    time: str | None = None
    network: str | None = None
    match_id: int | None = None


def normalize_text(value: str) -> str:
    value = html.unescape(value)
    value = value.replace("\u2013", "-").replace("\u2014", "-")
    value = value.replace("\u00a0", " ")
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def team_key(name: str) -> str:
    key = normalize_text(name)
    return TEAM_ALIASES.get(key, key)


def clean_team(name: str) -> str:
    name = html.unescape(name).strip()
    name = re.sub(r"\s+", " ", name)
    replacements = {
        "USA": "United States",
        "U.S.": "United States",
        "Korea Republic": "South Korea",
        "Türkiye": "Turkey",
        "Curaçao": "Curacao",
        "Côte d'Ivoire": "Ivory Coast",
        "Cape Verde": "Cabo Verde",
    }
    return replacements.get(name, name)


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def extract_article_text(document: str) -> str:
    if "\n" in document and "Group " in document and "<html" not in document[:200].lower():
        return document

    match = re.search(r'"articleBody":"((?:\\.|[^"\\])*)"', document)
    if match:
        try:
            return json.loads(f'"{match.group(1)}"')
        except json.JSONDecodeError:
            pass

    document = re.sub(r"(?is)<script.*?</script>", "\n", document)
    document = re.sub(r"(?is)<style.*?</style>", "\n", document)
    document = re.sub(r"(?i)<br\s*/?>", "\n", document)
    document = re.sub(r"(?i)</(p|li|h[1-6]|div)>", "\n", document)
    document = re.sub(r"(?s)<[^>]+>", " ", document)
    document = html.unescape(document)
    return re.sub(r"[ \t]+", " ", document)


def parse_date_heading(line: str, year: int) -> str | None:
    match = re.match(
        r"^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+"
        r"([A-Za-z]+)\s+(\d{1,2})(?:,?\s+\d{4})?$",
        line,
        flags=re.IGNORECASE,
    )
    if not match:
        return None

    month = MONTHS.get(match.group(1).lower())
    if not month:
        return None
    return dt.date(year, month, int(match.group(2))).isoformat()


def parse_time(value: str) -> str | None:
    value = value.strip().lower().replace("oo", "00").replace(".", "")
    match = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*([ap])m$", value)
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2) or "00")
    marker = match.group(3)
    if marker == "p" and hour != 12:
        hour += 12
    if marker == "a" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def stage_from_line(line: str, current_stage: str) -> str:
    key = normalize_text(line)
    return ROUND_ALIASES.get(key, current_stage)


def parse_fixture_line(line: str, date: str | None, stage: str) -> Fixture | None:
    line = html.unescape(line).strip()
    line = re.sub(r"\s+", " ", line)
    line = line.replace(" vs ", " vs. ")
    line = line.replace(" v. ", " vs. ")
    line = line.replace(" v ", " vs. ")

    match_id = None
    id_match = re.match(r"^Match\s+(\d+):\s*(.+)$", line, flags=re.IGNORECASE)
    if id_match:
        match_id = int(id_match.group(1))
        line = id_match.group(2).strip()

    group = None
    group_match = re.match(r"^Group\s+([A-L]):\s*(.+)$", line, flags=re.IGNORECASE)
    if group_match:
        group = group_match.group(1).upper()
        stage = "Group"
        line = group_match.group(2).strip()

    result_match = re.match(r"^(.+?)\s+(\d+),\s*(.+?)\s+(\d+)$", line)
    if not result_match:
        result_match = re.match(r"^(.+?)\s+(\d+)\s+(.+?)\s+(\d+)$", line)
    if result_match:
        return Fixture(
            date=date,
            stage=stage,
            group=group,
            home=clean_team(result_match.group(1)),
            away=clean_team(result_match.group(3)),
            home_score=int(result_match.group(2)),
            away_score=int(result_match.group(4)),
            match_id=match_id,
        )

    schedule_match = re.match(r"^(.+?)\s+vs\.\s+(.+?)(?:,\s*([^,]+))?(?:,\s*([A-Z0-9]+))?$", line)
    if schedule_match:
        raw_time = schedule_match.group(3) or ""
        raw_network = schedule_match.group(4) or ""
        return Fixture(
            date=date,
            stage=stage,
            group=group,
            home=clean_team(schedule_match.group(1)),
            away=clean_team(schedule_match.group(2)),
            time=parse_time(raw_time),
            network=raw_network.strip() or None,
            match_id=match_id,
        )

    return None


def parse_fixtures(text: str, year: int) -> list[Fixture]:
    fixtures: list[Fixture] = []
    current_date: str | None = None
    current_stage = "Group"

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        parsed_date = parse_date_heading(line, year)
        if parsed_date:
            current_date = parsed_date
            continue

        next_stage = stage_from_line(line, current_stage)
        if next_stage != current_stage:
            current_stage = next_stage
            continue

        fixture = parse_fixture_line(line, current_date, current_stage)
        if fixture:
            fixtures.append(fixture)

    return fixtures


def indexed_matches(data: dict[str, Any]) -> tuple[dict[tuple[str, str, str], dict[str, Any]], dict[int, dict[str, Any]]]:
    by_group_teams: dict[tuple[str, str, str], dict[str, Any]] = {}
    by_id: dict[int, dict[str, Any]] = {}
    for match in data["matches"]:
        by_id[match["id"]] = match
        if match.get("group"):
            teams = sorted([team_key(match["home"]), team_key(match["away"])])
            by_group_teams[(match["group"], teams[0], teams[1])] = match
    return by_group_teams, by_id


def find_match(
    fixture: Fixture,
    data: dict[str, Any],
    by_group_teams: dict[tuple[str, str, str], dict[str, Any]],
    by_id: dict[int, dict[str, Any]],
    stage_ordinals: dict[tuple[str, str | None], int],
) -> dict[str, Any] | None:
    if fixture.match_id and fixture.match_id in by_id:
        return by_id[fixture.match_id]

    if fixture.group:
        teams = sorted([team_key(fixture.home), team_key(fixture.away)])
        match = by_group_teams.get((fixture.group, teams[0], teams[1]))
        if match:
            return match

    if fixture.stage != "Group" and fixture.date:
        key = (fixture.stage, fixture.date)
        ordinal = stage_ordinals.get(key, 0)
        stage_ordinals[key] = ordinal + 1
        candidates = [
            match
            for match in data["matches"]
            if match.get("stage") == fixture.stage and match.get("date") == fixture.date
        ]
        candidates.sort(key=lambda item: item["id"])
        if ordinal < len(candidates):
            return candidates[ordinal]

    return None


def orient_scores(match: dict[str, Any], fixture: Fixture) -> tuple[int | None, int | None]:
    if fixture.home_score is None or fixture.away_score is None:
        return None, None

    fixture_home = team_key(fixture.home)
    fixture_away = team_key(fixture.away)
    match_home = team_key(match["home"])
    match_away = team_key(match["away"])

    if fixture_home == match_home and fixture_away == match_away:
        return fixture.home_score, fixture.away_score
    if fixture_home == match_away and fixture_away == match_home:
        return fixture.away_score, fixture.home_score
    return fixture.home_score, fixture.away_score


def changed(match: dict[str, Any], key: str, value: Any) -> bool:
    return match.get(key) != value


def apply_fixture(match: dict[str, Any], fixture: Fixture) -> list[str]:
    changes: list[str] = []

    if fixture.stage != "Group":
        for side, value in (("home", fixture.home), ("away", fixture.away)):
            if value and not normalize_text(value).startswith(("winner ", "runner up ", "loser ", "best 3rd")):
                if changed(match, side, value):
                    match[side] = value
                    changes.append(f"{side} team")

    if fixture.time and changed(match, "time", fixture.time):
        match["time"] = fixture.time
        match.setdefault("offset", "-04:00")
        match.setdefault("timezoneLabel", "ET")
        changes.append("kickoff")

    if fixture.network and changed(match, "network", fixture.network):
        match["network"] = fixture.network
        changes.append("network")

    if fixture.home_score is not None and fixture.away_score is not None:
        home_score, away_score = orient_scores(match, fixture)
        if changed(match, "homeScore", home_score):
            match["homeScore"] = home_score
            changes.append("home score")
        if changed(match, "awayScore", away_score):
            match["awayScore"] = away_score
            changes.append("away score")
        if changed(match, "status", "completed"):
            match["status"] = "completed"
            changes.append("status")

    return changes


def write_static_data(data: dict[str, Any], path: Path) -> None:
    payload = json.dumps(data, indent=2, ensure_ascii=True)
    path.write_text(f"window.WORLD_CUP_DATA = {payload};\n", encoding="utf-8")


def refresh_schedule(args: argparse.Namespace) -> tuple[int, int, list[str]]:
    data = json.loads(args.data.read_text(encoding="utf-8"))
    source_text = args.source_file.read_text(encoding="utf-8") if args.source_file else fetch(args.source_url)
    article_text = extract_article_text(source_text)
    fixtures = parse_fixtures(article_text, args.year)
    by_group_teams, by_id = indexed_matches(data)
    stage_ordinals: dict[tuple[str, str | None], int] = {}
    changed_matches = 0
    change_log: list[str] = []

    for fixture in fixtures:
        match = find_match(fixture, data, by_group_teams, by_id, stage_ordinals)
        if not match:
            continue

        changes = apply_fixture(match, fixture)
        if changes:
            changed_matches += 1
            change_log.append(f"Match {match['id']}: {', '.join(changes)}")

    if not args.dry_run:
        data["generatedAt"] = dt.date.today().isoformat()
        data["scheduleUpdatedAt"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        data["scheduleSourceUrl"] = args.source_url
        args.data.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        write_static_data(data, args.static_data)

    return len(fixtures), changed_matches, change_log


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Refresh World Cup scores, statuses, and later-stage teams.")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="Path to world-cup-2026.json")
    parser.add_argument("--static-data", type=Path, default=DEFAULT_STATIC_DATA, help="Path to browser data JS")
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL, help="Schedule/results page to scrape")
    parser.add_argument("--source-file", type=Path, help="Use saved HTML/text instead of fetching source-url")
    parser.add_argument("--year", type=int, default=2026, help="Tournament year for date headings")
    parser.add_argument("--dry-run", action="store_true", help="Parse and report without writing changes")
    parser.add_argument("--verbose", action="store_true", help="Print changed match ids and changed fields")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    fixture_count, changed_matches, change_log = refresh_schedule(args)
    print(f"Parsed fixtures: {fixture_count}")
    print(f"Changed matches: {changed_matches}")
    if args.verbose:
        for line in change_log:
            print(line)
    if args.dry_run:
        print("Dry run: no files written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
