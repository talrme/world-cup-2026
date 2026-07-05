#!/usr/bin/env python3
"""Refresh World Cup highlight links from YouTube search pages.

The script intentionally uses only the Python standard library so it can run on
any local machine. YouTube markup changes often; when a direct video match is
not confident, the script stores the search URL instead of inventing a link.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "world-cup-2026.json"
DEFAULT_STATIC_DATA = ROOT / "schedule-data.js"
YOUTUBE_RESULTS = "https://www.youtube.com/results?search_query={query}"
YOUTUBE_OEMBED = "https://www.youtube.com/oembed?{query}"
FOX_SPORTS_VIDEOS = "https://www.youtube.com/@foxsports/videos"
TOURNAMENT_YEAR = "2026"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)
SEARCH_CANDIDATE_LIMIT = 20
FOX_SPORTS_CHANNEL_CANDIDATES: list[dict[str, str]] | None = None


ALIASES = {
    "united states": ["united states", "usa", "usmnt", "u.s."],
    "south korea": ["south korea", "korea republic", "korea"],
    "bosnia and herzegovina": ["bosnia", "bosnia herzegovina", "bosnia and herzegovina"],
    "dr congo": ["dr congo", "congo"],
    "ivory coast": ["ivory coast", "cote d'ivoire"],
    "cabo verde": ["cabo verde", "cape verde"],
    "turkey": ["turkey", "turkiye", "tuerkiye"],
    "curacao": ["curacao"],
}


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def parse_kickoff(match: dict[str, Any]) -> dt.datetime | None:
    if not match.get("time") or not match.get("offset"):
        return None

    return dt.datetime.fromisoformat(
        f"{match['date']}T{match['time']}:00{match['offset']}"
    )


def is_video_eligible(match: dict[str, Any], include_all: bool, recent_hours: float | None) -> bool:
    if include_all:
        return True

    kickoff = parse_kickoff(match)
    if not kickoff:
        return False

    elapsed = utc_now() - kickoff.astimezone(dt.timezone.utc)
    if elapsed <= dt.timedelta(hours=2, minutes=30):
        return False

    if recent_hours is not None and elapsed > dt.timedelta(hours=recent_hours):
        return False

    return True


def normalized_needles(team: str) -> list[str]:
    key = searchable_text(team)
    return ALIASES.get(key, [key])


def searchable_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.lower().replace("&", " and ")
    value = re.sub(r"[^a-z0-9 ]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def search_url(query: str) -> str:
    return YOUTUBE_RESULTS.format(query=urllib.parse.quote_plus(query))


def video_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def video_id_from_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.strip("/").split("/")[0]
        return video_id if re.fullmatch(r"[\w-]{11}", video_id) else ""

    params = urllib.parse.parse_qs(parsed.query)
    video_id = params.get("v", [""])[0]
    return video_id if re.fullmatch(r"[\w-]{11}", video_id) else ""


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_json(url: str) -> dict[str, Any]:
    return json.loads(fetch(url))


def extract_json_assignment(page: str, name: str) -> Any | None:
    match = re.search(rf"(?:var\s+)?{re.escape(name)}\s*=\s*", page)
    if not match:
        return None

    try:
        value, _ = json.JSONDecoder().raw_decode(page[match.end() :])
    except json.JSONDecodeError:
        return None

    return value


def clean_text(value: str) -> str:
    try:
        value = json.loads(f'"{value}"')
    except json.JSONDecodeError:
        pass
    return html.unescape(value).strip()


def text_from_runs(value: Any) -> str:
    if isinstance(value, str):
        return clean_text(value)
    if not isinstance(value, dict):
        return ""
    if isinstance(value.get("content"), str):
        return clean_text(value["content"])
    if isinstance(value.get("simpleText"), str):
        return clean_text(value["simpleText"])
    runs = value.get("runs")
    if isinstance(runs, list):
        return clean_text("".join(run.get("text", "") for run in runs if isinstance(run, dict)))
    return ""


def normalize_duration(value: str) -> str:
    value = clean_text(value).lower()
    numbers = [int(item) for item in re.findall(r"\d+", value)]
    if not numbers:
        return ""

    if "hour" in value:
        minutes = numbers[0] * 60 + (numbers[1] if len(numbers) > 1 else 0)
    elif "minute" in value:
        minutes = numbers[0]
    elif ":" in value:
        parts = numbers
        if len(parts) == 3:
            minutes = parts[0] * 60 + parts[1]
        elif len(parts) == 2:
            minutes = parts[0]
        else:
            minutes = max(1, round(parts[0] / 60))
    else:
        minutes = max(1, round(numbers[0] / 60))

    return f"{minutes} min"


def duration_from_seconds(value: Any) -> str:
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        return ""
    if seconds <= 0:
        return ""
    return f"{max(1, round(seconds / 60))} min"


def looks_like_duration(value: str) -> bool:
    text = value.lower()
    if "ago" in text or "view" in text:
        return False
    if re.search(r"\b(hour|minute|second)s?\b", text):
        return True
    return bool(re.search(r"\b\d{1,2}:\d{2}(?::\d{2})?\b", text))


def iter_strings(value: Any) -> list[str]:
    strings: list[str] = []
    if isinstance(value, str):
        strings.append(clean_text(value))
    elif isinstance(value, dict):
        for item in value.values():
            strings.extend(iter_strings(item))
    elif isinstance(value, list):
        for item in value:
            strings.extend(iter_strings(item))
    return strings


def duration_from_node(value: Any) -> str:
    for item in iter_strings(value):
        if looks_like_duration(item):
            duration = normalize_duration(item)
            if duration:
                return duration
    return ""


def duration_minutes(value: str) -> int | None:
    match = re.search(r"~?(\d+)\s*min", value)
    return int(match.group(1)) if match else None


def safe_duration(kind: str, value: str) -> str:
    minutes = duration_minutes(value)
    if minutes is None:
        return ""
    return value


def normalize_channel(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def is_fox_channel(value: str) -> bool:
    channel = normalize_channel(value)
    return channel in {"fox sports", "fox soccer"} or channel.startswith("fox sports ")


def title_matches_tournament(title: str) -> bool:
    normalized = title.lower()
    years = re.findall(r"\b20\d{2}\b", title)
    if "world cup" not in normalized:
        return False
    if years and any(year != TOURNAMENT_YEAR for year in years):
        return False
    return TOURNAMENT_YEAR in years or TOURNAMENT_YEAR in normalized


def existing_video_is_safe(video: dict[str, str] | None) -> bool:
    if not video or not video.get("url"):
        return False

    title = video.get("title", "")
    if not title_matches_tournament(title):
        return False

    if video.get("channelVerified") and video.get("spoilerSafeTitle"):
        return True

    return is_fox_channel(video.get("channel", "")) and not title_has_spoiler(
        title
    )


def verified_existing_video(video: dict[str, Any], checked: str) -> dict[str, Any] | None:
    video_id = video_id_from_url(str(video.get("url", "")))
    if not video_id:
        return None

    metadata = fetch_video_metadata(video_id)
    title = metadata.get("title") or video.get("title", "")
    channel = metadata.get("channel") or video.get("channel", "")
    duration = metadata.get("durationText") or video.get("durationText", "")
    if not title_matches_tournament(title):
        return None

    verified = dict(video)
    verified.update(
        {
            "lastCheckedAt": checked,
            "title": title,
            "channel": channel,
            "durationText": duration,
            "channelVerified": is_fox_channel(channel),
            "spoilerSafeTitle": not title_has_spoiler(title),
        }
    )
    return verified


def title_has_spoiler(title: str) -> bool:
    title = title.lower()
    if re.search(r"\b\d+\s*[-–]\s*\d+\b", title):
        return True

    spoiler_phrases = [
        "defeat",
        "defeats",
        "defeated",
        "beats",
        "beat ",
        "win over",
        "dominant win",
        "draw",
        "draws",
        "edges",
        "edged",
        "stuns",
        "stunned",
        "crushes",
        "dominates",
        "thrashes",
        "knocks out",
        "penalty shootout",
    ]
    if any(phrase in title for phrase in spoiler_phrases):
        return True

    if "goal" in title and "highlights" not in title:
        return True

    return False


def fetch_video_metadata(video_id: str) -> dict[str, str]:
    try:
        page = fetch(video_url(video_id))
        match = re.search(r"ytInitialPlayerResponse\s*=\s*", page)
        if match:
            data, _ = json.JSONDecoder().raw_decode(page[match.end() :])
            details = data.get("videoDetails", {})
            metadata = {
                "title": clean_text(details.get("title", "")),
                "channel": clean_text(details.get("author", "")),
                "durationText": duration_from_seconds(details.get("lengthSeconds")),
            }
            return {key: value for key, value in metadata.items() if value}
    except Exception:
        pass

    query = urllib.parse.urlencode({"url": video_url(video_id), "format": "json"})
    data = fetch_json(YOUTUBE_OEMBED.format(query=query))
    return {
        "title": clean_text(data.get("title", "")),
        "channel": clean_text(data.get("author_name", "")),
    }


def extract_candidates(page: str) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []
    seen: set[str] = set()

    pattern = re.compile(
        r'"videoId":"(?P<id>[\w-]{11})".{0,2200}?'
        r'"title":\{"runs":\[\{"text":"(?P<title>.*?)"\}\]',
        re.DOTALL,
    )

    for match in pattern.finditer(page):
        video_id = match.group("id")
        if video_id in seen:
            continue

        start = max(0, match.start() - 400)
        end = min(len(page), match.end() + 1800)
        nearby = page[start:end]
        channel_match = re.search(
            r'"ownerText":\{"runs":\[\{"text":"(?P<channel>.*?)"', nearby, re.DOTALL
        )
        duration_match = re.search(
            r'"lengthText":\{"accessibility":\{"accessibilityData":\{"label":"(?P<label>.*?)"\}\}',
            nearby,
            re.DOTALL,
        ) or re.search(
            r'"lengthText":\{"simpleText":"(?P<label>.*?)"\}',
            nearby,
            re.DOTALL,
        )

        seen.add(video_id)
        candidates.append(
            {
                "id": video_id,
                "title": clean_text(match.group("title")),
                "channel": clean_text(channel_match.group("channel")) if channel_match else "",
                "durationText": normalize_duration(duration_match.group("label")) if duration_match else "",
                "url": video_url(video_id),
            }
        )

    return candidates


def first_video_id(value: Any) -> str:
    if isinstance(value, dict):
        direct = value.get("videoId")
        if isinstance(direct, str) and re.fullmatch(r"[\w-]{11}", direct):
            return direct
        for item in value.values():
            found = first_video_id(item)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = first_video_id(item)
            if found:
                return found
    return ""


def lockup_title(value: dict[str, Any]) -> str:
    models = []
    if isinstance(value.get("lockupMetadataViewModel"), dict):
        models.append(value["lockupMetadataViewModel"])
    metadata = value.get("metadata")
    if isinstance(metadata, dict) and isinstance(metadata.get("lockupMetadataViewModel"), dict):
        models.append(metadata["lockupMetadataViewModel"])

    for model in models:
        title = text_from_runs(model.get("title"))
        if title:
            return title
    return ""


def extract_structured_candidates(page: str, channel_hint: str = "") -> list[dict[str, str]]:
    data = extract_json_assignment(page, "ytInitialData")
    if not data:
        return []

    candidates: list[dict[str, str]] = []
    seen: set[str] = set()

    def add_candidate(candidate: dict[str, str]) -> None:
        video_id = candidate.get("id", "")
        if not video_id or video_id in seen:
            return
        seen.add(video_id)
        candidates.append(candidate)

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            renderer = value.get("videoRenderer")
            if isinstance(renderer, dict):
                video_id = renderer.get("videoId", "")
                title = text_from_runs(renderer.get("title"))
                owner = text_from_runs(renderer.get("ownerText")) or text_from_runs(renderer.get("longBylineText"))
                if video_id and title:
                    add_candidate(
                        {
                            "id": video_id,
                            "title": title,
                            "channel": owner or channel_hint,
                            "durationText": duration_from_node(renderer),
                            "url": video_url(video_id),
                        }
                    )

            title = lockup_title(value)
            if title:
                video_id = first_video_id(value)
                if video_id:
                    add_candidate(
                        {
                            "id": video_id,
                            "title": title,
                            "channel": channel_hint,
                            "durationText": duration_from_node(value),
                            "url": video_url(video_id),
                        }
                    )

            for item in value.values():
                visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)

    visit(data)
    return candidates


def fox_sports_channel_candidates() -> list[dict[str, str]]:
    global FOX_SPORTS_CHANNEL_CANDIDATES
    if FOX_SPORTS_CHANNEL_CANDIDATES is None:
        page = fetch(FOX_SPORTS_VIDEOS)
        FOX_SPORTS_CHANNEL_CANDIDATES = extract_structured_candidates(page, "FOX Sports")
    return FOX_SPORTS_CHANNEL_CANDIDATES


def score_candidate(
    candidate: dict[str, str], match: dict[str, Any], kind: str
) -> int:
    title = candidate["title"].lower()
    searchable_title = searchable_text(candidate["title"])
    channel = candidate["channel"].lower()
    combined = f"{title} {channel}"
    minutes = duration_minutes(candidate.get("durationText", ""))
    is_long_highlight = minutes is not None and minutes >= 16 and "highlights" in title
    score = 0

    if not is_fox_channel(candidate["channel"]):
        return -999
    if title_has_spoiler(candidate["title"]):
        return -999
    if not title_matches_tournament(candidate["title"]):
        return -999

    if "fox soccer" in combined:
        score += 70
    if "fox sports" in combined:
        score += 55
    if TOURNAMENT_YEAR in title:
        score += 35
    if "fifa world cup" in title or "world cup" in title:
        score += 20

    home_hits = any(needle in searchable_title for needle in normalized_needles(match["home"]))
    away_hits = any(needle in searchable_title for needle in normalized_needles(match["away"]))
    if not home_hits or not away_hits:
        return -999

    if "world cup" not in title:
        return -999

    if kind == "extended" and "extended highlights" not in title and not is_long_highlight:
        return -999

    if kind == "short" and "highlights" not in title:
        return -999

    if kind == "short" and "extended highlights" in title:
        return -999

    if kind == "short" and minutes is not None and minutes > 15:
        return -999

    if kind == "extended" and minutes is not None and minutes < 8:
        return -999

    if home_hits:
        score += 35
    if away_hits:
        score += 35

    if "highlights" in title:
        score += 25
    if "extended highlights" in title:
        score += 55 if kind == "extended" else -25
    elif is_long_highlight and kind == "extended":
        score += 45
    elif kind == "short":
        score += 15

    if "full match" in title or "watchalong" in title or "reaction" in title:
        score -= 45

    return score


def unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        key = searchable_text(item)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def query_name_variants(team: str) -> list[str]:
    variants = [team, *normalized_needles(team)]
    team_key = searchable_text(team)
    if " and " in team_key:
        variants.append(team_key.replace(" and ", " "))
    return unique(variants)[:3]


def search_queries(match: dict[str, Any], kind: str) -> list[str]:
    label = "extended highlights" if kind == "extended" else "highlights"
    home_names = query_name_variants(match["home"])
    away_names = query_name_variants(match["away"])
    pairs = unique(
        [
            f"{match['home']} vs {match['away']}",
            f"{home_names[0]} vs {away_names[0]}",
            f"{home_names[0]} {away_names[0]}",
            f"{home_names[0]} vs {away_names[-1]}",
            f"{home_names[0]} {away_names[-1]}",
        ]
    )

    queries: list[str] = []
    for pair in pairs:
        queries.extend(
            [
                f"Fox Soccer {pair} {label} 2026 FIFA World Cup",
                f"FOX Sports {pair} {label} 2026 FIFA World Cup",
                f"{pair} {label} FOX Sports 2026 FIFA World Cup",
            ]
        )

    return unique(queries)[:10]


def best_video(match: dict[str, Any], kind: str) -> tuple[dict[str, str] | None, str]:
    queries = search_queries(match, kind)
    fallback_url = search_url(queries[0])
    seen_ids: set[str] = set()

    try:
        channel_candidates = fox_sports_channel_candidates()
    except Exception as exc:
        print(f"  Fox Sports channel scan failed for match {match['id']} {kind}: {exc}")
    else:
        for candidate in channel_candidates:
            if candidate["id"] in seen_ids:
                continue

            seen_ids.add(candidate["id"])
            score = score_candidate(candidate, match, kind)
            if score >= 90:
                candidate["source"] = "foxsports-channel"
                return candidate, FOX_SPORTS_VIDEOS

    for query in queries:
        url = search_url(query)
        try:
            page = fetch(url)
        except Exception as exc:
            print(f"  YouTube search failed for match {match['id']} {kind}: {exc}")
            continue

        candidates = extract_candidates(page)
        candidates.extend(extract_structured_candidates(page))
        if not candidates:
            continue

        for candidate in candidates[:SEARCH_CANDIDATE_LIMIT]:
            if candidate["id"] in seen_ids:
                continue

            seen_ids.add(candidate["id"])
            try:
                candidate.update(fetch_video_metadata(candidate["id"]))
            except Exception as exc:
                print(f"  Metadata failed for {candidate['id']}: {exc}")
                continue

            score = score_candidate(candidate, match, kind)
            if score >= 90:
                return candidate, url

    return None, fallback_url


def comparable_video(value: dict[str, Any] | None) -> dict[str, Any]:
    if not value:
        return {}
    return {key: item for key, item in value.items() if key != "lastCheckedAt"}


def prune_duplicate_video_slots(match: dict[str, Any], checked: str, dry_run: bool) -> int:
    videos = match.get("videos") if isinstance(match.get("videos"), dict) else {}
    short = videos.get("short")
    extended = videos.get("extended")
    if (
        not isinstance(short, dict)
        or not isinstance(extended, dict)
        or not short.get("url")
        or short.get("url") != extended.get("url")
    ):
        return 0

    if not dry_run:
        stored_videos = match.setdefault("videos", {})
        stored_videos.pop("short", None)
        stored_videos["lastCheckedAt"] = checked
    return 1


def refresh_match(
    match: dict[str, Any],
    force: bool,
    dry_run: bool,
    delay: float,
    max_searches: int | None = None,
) -> tuple[int, int, int]:
    videos = match.get("videos") if isinstance(match.get("videos"), dict) else {}
    checked = utc_now().isoformat(timespec="seconds")
    found = 0
    updated = 0
    checked_count = 0

    for kind in ("extended", "short"):
        if max_searches is not None and checked_count >= max_searches:
            break

        existing = videos.get(kind)
        if existing and existing.get("url") and not force:
            try:
                verified = verified_existing_video(existing, checked)
            except Exception as exc:
                print(f"  Existing video metadata failed for match {match['id']} {kind}: {exc}")
            else:
                if verified:
                    existing = verified
                    if comparable_video(videos.get(kind)) != comparable_video(verified):
                        updated += 1
                        if not dry_run:
                            stored_videos = match.setdefault("videos", {})
                            stored_videos[kind] = verified
                            stored_videos["lastCheckedAt"] = checked

        if existing_video_is_safe(existing) and not force:
            continue

        remove_existing = bool(existing and existing.get("url") and not existing_video_is_safe(existing))
        checked_count += 1
        candidate, url = best_video(match, kind)
        next_value: dict[str, Any] | None = None

        if candidate:
            next_value = {
                "searchUrl": url,
                "lastCheckedAt": checked,
                "title": candidate["title"],
                "url": candidate["url"],
                "channel": candidate["channel"],
                "durationText": safe_duration(kind, candidate.get("durationText") or ""),
                "channelVerified": True,
                "spoilerSafeTitle": True,
                "source": candidate.get("source", "youtube-search"),
            }
            found += 1

        if next_value and comparable_video(existing) != comparable_video(next_value):
            updated += 1
            if not dry_run:
                stored_videos = match.setdefault("videos", {})
                stored_videos[kind] = next_value
                stored_videos["lastCheckedAt"] = checked
        elif remove_existing:
            updated += 1
            if not dry_run:
                stored_videos = match.setdefault("videos", {})
                stored_videos.pop(kind, None)
                stored_videos["lastCheckedAt"] = checked

        if delay:
            time.sleep(delay)

    updated += prune_duplicate_video_slots(match, checked, dry_run)
    return checked_count, found, updated


def write_static_data(data: dict[str, Any], path: Path) -> None:
    payload = json.dumps(data, indent=2, ensure_ascii=True)
    path.write_text(f"window.WORLD_CUP_DATA = {payload};\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh World Cup YouTube highlight links.")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA, help="Path to world-cup-2026.json")
    parser.add_argument("--static-data", type=Path, default=DEFAULT_STATIC_DATA, help="Path to browser data JS")
    parser.add_argument("--all", action="store_true", help="Search every match, including future fixtures")
    parser.add_argument("--force", action="store_true", help="Replace existing direct video links")
    parser.add_argument("--dry-run", action="store_true", help="Search without writing changes")
    parser.add_argument("--sync-only", action="store_true", help="Only regenerate schedule-data.js")
    parser.add_argument("--sleep", type=float, default=1.2, help="Seconds to wait between YouTube requests")
    parser.add_argument(
        "--match-id",
        action="append",
        default=[],
        help="Only refresh this match id. May be passed multiple times.",
    )
    parser.add_argument(
        "--recent-hours",
        type=float,
        default=72,
        help="Only search matches whose kickoff was within this many hours. Use --all for a full sweep.",
    )
    parser.add_argument("--max-searches", type=int, default=None, help="Stop after this many video-slot searches")
    args = parser.parse_args()

    data = json.loads(args.data.read_text(encoding="utf-8"))
    if args.sync_only:
        write_static_data(data, args.static_data)
        print(f"Wrote {args.static_data}")
        return 0

    checked = 0
    found = 0
    updated = 0
    eligible = 0
    match_ids = {int(value) for value in args.match_id}

    for match in data["matches"]:
        if match_ids and match.get("id") not in match_ids:
            continue

        if not is_video_eligible(match, args.all, args.recent_hours):
            continue

        remaining_searches = None
        if args.max_searches is not None:
            remaining_searches = max(0, args.max_searches - checked)
            if remaining_searches <= 0:
                print(f"Video search cap reached: {args.max_searches}")
                break

        eligible += 1
        match_checked, match_found, match_updated = refresh_match(
            match,
            args.force,
            args.dry_run,
            args.sleep,
            remaining_searches,
        )
        checked += match_checked
        found += match_found
        updated += match_updated
        print(
            f"{match['id']:03d} {match['home']} vs {match['away']}: "
            f"video searches attempted {match_checked}, candidate links found {match_found}"
        )

    if not args.dry_run and updated:
        data["generatedAt"] = utc_now().date().isoformat()
        args.data.write_text(json.dumps(data, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        write_static_data(data, args.static_data)
    elif not args.dry_run:
        print("No video data changes to write")

    print(f"Matches eligible for video search: {eligible}")
    print(f"Video searches attempted: {checked}")
    print(f"Candidate direct video links found: {found}")
    print(f"New/updated direct video links saved: {updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
