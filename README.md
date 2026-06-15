# World Cup Snapshot

**Live site:** [https://talrme.github.io/world-cup-2026/](https://talrme.github.io/world-cup-2026/)

A local, spoiler-conscious 2026 World Cup schedule dashboard. It keeps scores in the data file so the schedule can be updated, but the UI hides them by default so you can jump straight to highlights without accidentally seeing a result.

## What It Does

- Shows the tournament schedule across the Schedule, Groups, and Tiles views, with Bracket available as an optional settings toggle.
- Keeps the top controls focused: choose a view, manage score visibility, and filter by country.
- Saves view and country selections in the URL, while leaving spoiler reveal state local to the page.
- Keeps Schedule uncluttered by default. Click a match to open a floating match-details panel, then minimize or close it when needed.
- Hides scores by default. Click a blurred score pill to reveal one score, or use `Show all scores` when spoilers are okay.
- Includes an optional `Show scores before` date control. It is off by default and starts five days back; when enabled, score pills through that date are revealed.
- Shows the match location in Match Details. Click the location to open a stadium map with all World Cup venues and the selected venue highlighted.
- Shows a rank-based favorite in Match Details when both teams have FIFA ranking data.
- In Groups, selected countries filter the fixture list while the standings table keeps the full group context. Use each group's score control to reveal that group only.
- Shows direct Fox Sports/Fox Soccer YouTube links when verified highlight videos are available.
- Opens direct highlight links on YouTube, since many Fox Sports videos block third-party embeds from local files.
- Scans the Fox Sports YouTube videos page first, then falls back to one `YouTube Search` link for played/live matches with no saved direct highlight link. The matcher tolerates country-name variants such as `Turkey` / `Türkiye`.
- Lets you minimize Match Details when it is covering the board, then restore it from a compact match-details pill.

## Open Locally

No build is required for normal use. Open:

```text
index.html
```

If your browser blocks local scripts, serve the folder and open the printed local URL:

```bash
python3 -m http.server 4173
```

The static page reads `schedule-data.js`, which is generated from `data/world-cup-2026.json`.

## Refresh Data

Run both schedule/results and highlight refreshes:

```bash
python3 scripts/refresh_all.py
```

Refresh only the schedule, scores, match status, broadcast info, and later-stage team names:

```bash
python3 scripts/update_schedule.py
```

Refresh only direct YouTube highlight links:

```bash
python3 scripts/update_highlights.py
```

Useful highlight options:

```bash
python3 scripts/update_highlights.py --all
python3 scripts/update_highlights.py --force
python3 scripts/update_highlights.py --dry-run
python3 scripts/update_highlights.py --sync-only
```

Useful schedule options:

```bash
python3 scripts/update_schedule.py --dry-run
python3 scripts/update_schedule.py --verbose
python3 scripts/update_schedule.py --source-file saved-source.html
```

If npm is available, the same refresh commands are also available as:

```bash
npm run refresh:all
npm run refresh:schedule
npm run refresh:videos
npm run refresh:videos:all
```

## Highlight Rules

The highlight scraper checks `https://www.youtube.com/@foxsports/videos` before broader search-result pages. It only stores a direct video URL when it is confident that:

- The YouTube metadata identifies the channel as Fox Sports or Fox Soccer.
- The video title includes both teams and World Cup context.
- The title does not contain obvious score/result spoilers.
- Extended highlights and shorter highlights are classified separately.

When a direct link cannot be verified, the site does not invent one. It shows a single spoiler-safe YouTube search fallback instead.

## Key Files

- `index.html`: local no-build entry point.
- `static-app.js`: browser app used by `index.html`.
- `site.css`: all static UI styling.
- `schedule-data.js`: generated browser data. Do not hand-edit unless necessary.
- `data/world-cup-2026.json`: source schedule/results/video data.
- `scripts/update_schedule.py`: schedule/results updater.
- `scripts/update_highlights.py`: Fox Sports YouTube highlights updater.
- `scripts/refresh_all.py`: runs schedule refresh, then highlight refresh.
- `components/world-cup-dashboard.tsx`: React/Vinext mirror of the static app.

## Data Notes

- Group-stage schedule and result data were seeded from SBNation's 2026 World Cup schedule.
- Knockout structure was seeded from the published bracket structure, with teams updated later when the schedule source lists real teams.
- Times are stored with an Eastern Time offset and displayed in the browser's local timezone.
- Scores are intentionally stored in JSON but visually hidden until revealed.
- Venue IDs are stored per match and rendered from the top-level `venues` catalog.
