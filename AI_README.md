# AI README

This project is a local, spoiler-safe World Cup highlight dashboard. Future AI edits should preserve the core promise: users can find highlights without seeing scores unless they explicitly reveal them.

## Operating Principles

- Before starting work, run `git status --short --branch`. Because GitHub Actions refreshes and may commit data every 15 minutes, run `git pull` first when the tree is clean, especially before local refreshes, code edits, commits, or pushes. If the tree is not clean, inspect the local changes before pulling and do not overwrite user work.
- Do not show scores by default in any view.
- Keep score data in `data/world-cup-2026.json`; hiding is a UI responsibility.
- Direct highlight links must be Fox Sports/Fox Soccer only.
- Do not surface YouTube titles that reveal scores or results.
- Search `https://www.youtube.com/@foxsports/videos` before broader YouTube result pages. YouTube titles often use country variants such as `Türkiye`, so keep accent folding and aliases flexible.
- If a direct highlight link is missing, show one generic `YouTube Search` fallback, not separate missing-video buttons.
- Direct saved YouTube video links should open YouTube directly. Do not use an iframe/modal player unless the user explicitly asks to retry embedding.
- The Match Details panel must remain dismissible/minimizable so it does not cover schedule content.
- Schedule should not show a match-details panel by default. It should appear as a floating panel only after the user selects a match.
- Groups should filter fixture rows by selected countries, while standings can retain full group context.
- Group standings and fixture scores remain hidden by default and are revealed with a per-group control or the global score reveal.
- The `Show scores before` date control is allowed to reveal match score pills through the chosen date, but it should not automatically reveal group standings points/GD/GP.
- Match-details location is driven by each match's `venueId` and the top-level `venues` catalog. Keep those synchronized when schedule sources change.
- Keep `data/world-cup-2026.json` and `schedule-data.js` synchronized after data changes.

## Current Architecture

There are two app surfaces:

- Static local app: `index.html`, `static-app.js`, `site.css`, `schedule-data.js`.
- React/Vinext source mirror: `components/world-cup-dashboard.tsx`, `app/`, `data/world-cup-2026.json`.

The user's browser is usually pointed at the static app, so `static-app.js` and `schedule-data.js` are the immediate runtime files. When changing UI behavior, update both `static-app.js` and `components/world-cup-dashboard.tsx` unless the user explicitly wants only one surface changed.

## Data Flow

Primary data file:

```text
data/world-cup-2026.json
```

Generated browser data:

```text
schedule-data.js
```

Regenerate `schedule-data.js` after any JSON edit:

```bash
python3 scripts/update_highlights.py --sync-only
```

## Refresh Workflow

GitHub Actions also runs the refresh workflow on a cadence:

```text
.github/workflows/refresh-data.yml
```

Those automated runs can commit refreshed `data/world-cup-2026.json` and `schedule-data.js` back to `main`, so local work should start from an up-to-date branch whenever possible.

No-op refreshes should not create commits. Avoid timestamp-only writes such as `lastCheckedAt` or `scheduleUpdatedAt` when no schedule result, team, kickoff, network, or direct video link changed.

Use this for a normal update:

```bash
python3 scripts/refresh_all.py
```

That runs:

```bash
python3 scripts/update_schedule.py
python3 scripts/update_highlights.py
```

`update_schedule.py` refreshes scores, completed statuses, kickoff/network metadata, and later tournament teams when the source has real teams.

`update_highlights.py` searches YouTube and stores direct video links only when metadata and title checks pass.

Network access may require sandbox escalation in Codex.

## Spoiler Safety

Scores:

- Use `score-pill score-hidden` for hidden score display.
- Clicking a score pill reveals only that match.
- `Show all scores` is the only global reveal.
- `Show scores before` is a bounded reveal for already-safe dates and defaults off.
- Group standings must show hidden placeholders unless `showAllScores` is true.

Videos:

- Store direct links only when `channelVerified` and `spoilerSafeTitle` are true.
- `title_has_spoiler()` rejects score patterns and result language.
- `existing_video_is_safe()` preserves known safe direct links if a later YouTube search misses them.
- Avoid using YouTube search result titles directly in UI fallback states.

## YouTube Fallback Behavior

When no direct highlight links are available and a match is live, completed, or past kickoff, show one link:

```text
YouTube Search
```

It should search:

```text
Fox Sports [Home] vs [Away] Highlights
```

Do not show `Find extended`, `Find short`, `Extended pending`, or `Short pending` buttons for played matches.

For future scheduled matches, a quiet pending label is fine.

## Video Link Behavior

Direct highlight anchors should be ordinary YouTube links with `target="_blank"`. The attempted embedded player produced YouTube Error 153 for Fox Sports videos from the local file page, so the reliable behavior is to open YouTube directly.

## Feedback

The site has a Feedback control that opens an embedded Google Form modal and includes a fallback `Open in Google Forms` link. Keep the responses sheet documented in `README.md` for project maintenance; it should not be surfaced as a public website link unless the user asks.

- Form: `https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?usp=sharing&ouid=104982845318929976228`
- Responses sheet: `https://docs.google.com/spreadsheets/d/1LvzMmvmk-Q-TDuziLJHdFeo-DewOnXNM4lVE3g8wzoE/edit?resourcekey=&gid=1959176771#gid=1959176771`

## Verification Checklist

After UI changes:

```bash
/Users/talg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check static-app.js
/Users/talg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check schedule-data.js
```

After Python changes:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/codex-pycache python3 -m py_compile scripts/update_schedule.py scripts/update_highlights.py scripts/refresh_all.py
```

After data refresh:

- Confirm `schedule-data.js` was regenerated.
- Spot-check a completed match with direct links.
- Spot-check a completed match with no direct links to verify the single `YouTube Search` fallback.
- Spot-check a future match to verify scores and videos remain quiet.

## Known User Preference

The user is intentionally avoiding spoilers. Optimize for highlight discovery without accidental score exposure, even if that means fewer automatic direct video links.
