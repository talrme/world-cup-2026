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
python3 scripts/update_player_stats.py
python3 scripts/update_highlights.py
```

`update_schedule.py` refreshes scores, completed statuses, kickoff/network metadata, and later tournament teams when the source has real teams.

`update_player_stats.py` refreshes `data/player-stats.json` and `player-stats.js` from the Guardian Golden Boot feed. It preserves the existing generated timestamp when player rows are unchanged to avoid no-op commits.

`update_highlights.py` searches YouTube and stores direct video links only when metadata and title checks pass.

`api_football_poc.py` is a non-invasive API-Football adapter/comparison script. It requires `API_FOOTBALL_KEY` for real API calls, or `--mock-from-current` to test the mapping/report/dummy-site pipeline without a key. Generated PoC output goes under `poc/api-football/` and is ignored by git.

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

## Future AI Insights Plan

The user wants optional AI-written blurbs that are generated during refreshes and then served as static data. This should not call an LLM from the browser. Keep API keys in GitHub Actions or local environment variables only.

Preferred provider:

- Start with the cheapest Gemini API model that supports the needed structured JSON output, likely the Flash-Lite class. Do not hard-code forever; use `GEMINI_MODEL` with a low-cost default.
- Store the key as `GEMINI_API_KEY` locally and as a GitHub Actions repository secret.
- Never commit API keys and never put keys in `index.html`, `static-app.js`, or any browser-loaded file.

Local and GitHub key setup should use the same variable names so no code changes are needed between environments:

- Commit a safe `.env.example` template that lists required variables with placeholder values.
- Keep the real project-local `.env` file at the repo root, for example `/Users/talg/Desktop/Websites For Fun/world-cup-2026/.env`.
- Add `.env` to `.gitignore`; it lives on the user's computer and must not be pushed.
- Local scripts should load `.env` when present, then read `GEMINI_API_KEY` and `GEMINI_MODEL` from environment variables.
- GitHub Actions should read the same `GEMINI_API_KEY` name from repository secrets and pass it into the refresh step with `env:`.
- If no key is present locally or in GitHub Actions, `scripts/update_ai_insights.py` should print a clear skip message and exit successfully so normal schedule/video/player refreshes still work.

Example `.env.example`:

```text
GEMINI_API_KEY=put-your-gemini-key-here
GEMINI_MODEL=gemini-cheap-model-name
```

Likely files:

```text
data/ai-insights.json
ai-insights.js
scripts/update_ai_insights.py
prompts/match.md
prompts/group.md
prompts/player.md
```

Potential insight surfaces:

- Match Details: `More info` for each match.
- Groups: `Group info` for each group.
- Players: `More info` for the top 30 players in the Players view.

Spoiler posture:

- It is acceptable for these blurbs to contain spoilers because users must click into the extra info.
- Still avoid showing AI-generated spoiler text directly on schedule/group/player cards before the user clicks.

Data shape should be structured and cacheable:

```json
{
  "matches": {
    "12": {
      "headline": "A tight group-stage pressure point",
      "summary": "Short generated paragraph.",
      "bullets": ["Why it matters", "Player to watch", "What changed"],
      "updatedAt": "2026-06-20",
      "sourceHash": "hash-of-input-data",
      "promptHash": "hash-of-prompt",
      "model": "gemini-flash-lite-or-current-cheap-equivalent"
    }
  },
  "groups": {},
  "players": {}
}
```

Cost-control rules:

- Do not regenerate every object every 15 minutes.
- Add `--dry-run` and `--estimate-cost` modes before making paid calls.
- Log calls attempted, calls skipped by cache, estimated input/output tokens, and estimated cost.
- Add script-level hard caps such as `--max-calls`, `--max-estimated-cost`, `--max-matches`, `--max-groups`, and `--max-players`.
- Cache by `sourceHash` plus `promptHash`. If neither the data nor the prompt changed, skip the API call.
- Only commit when `data/ai-insights.json` or `ai-insights.js` actually changes.

Suggested generation cadence:

- Matches more than 48 hours away: skip or refresh rarely.
- Matches within 48 hours: generate once, then refresh only if relevant source data changes.
- Match day: allow one pre-match refresh.
- Completed matches: refresh after the score appears, after highlights appear, and then once per day for two days. After that, freeze unless the prompt changes.
- Groups: refresh when a group result/standings context changes, otherwise at most once daily during group play.
- Players: refresh top 30 player blurbs once daily, or when that player's goals/assists/minutes/rank changes.

Billing and safety:

- Use a separate Google Cloud project/API key for this site if possible.
- Set Google Cloud budget alerts for the project. Budget alerts notify; do not assume they are a perfect hard stop.
- Restrict the API key as much as practical in Google Cloud.
- Keep GitHub Actions secrets limited to the repository and do not echo secrets in logs.
- Prefer a low `--max-estimated-cost` default in CI so a bad prompt loop fails closed.

GitHub Actions setup:

- Add `GEMINI_API_KEY` as a repository secret in GitHub.
- The refresh workflow can call `scripts/update_ai_insights.py` after schedule/player/video data refreshes.
- The script should exit successfully with a clear log if the secret is missing, unless an explicit `--require-api-key` flag is passed.
- The GitHub log should show a concise summary line, for example: `AI insights: generated 8, skipped 138, estimated cost $0.01`.

User follow-up question idea:

- Add an optional `Ask Gemini` or `Ask follow-up` button inside Match Details, Group Info, and Player Info.
- Reliable version: build a compact prompt from the current match/group/player data, put it in a modal textarea, provide `Copy prompt`, and open `https://gemini.google.com/app` in a new tab. The user pastes into their own Gemini account.
- Do not rely on a Gemini URL that pre-fills a prompt unless Google documents or verifies that URL behavior. If a supported prompt/deep-link URL exists later, it can encode a compact prompt and the user's question, but keep payloads short to avoid URL length/browser issues.
- This user-owned Gemini flow should not use the site's API key and should not add project billing.

## Verification Checklist

After UI changes:

```bash
/Users/talg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check static-app.js
/Users/talg/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check schedule-data.js
```

After Python changes:

```bash
PYTHONPYCACHEPREFIX=/private/tmp/codex-pycache python3 -m py_compile scripts/update_schedule.py scripts/update_player_stats.py scripts/update_highlights.py scripts/refresh_all.py
```

After data refresh:

- Confirm `schedule-data.js` was regenerated.
- Confirm `player-stats.js` was regenerated after player stat changes.
- Spot-check a completed match with direct links.
- Spot-check a completed match with no direct links to verify the single `YouTube Search` fallback.
- Spot-check a future match to verify scores and videos remain quiet.

## Known User Preference

The user is intentionally avoiding spoilers. Optimize for highlight discovery without accidental score exposure, even if that means fewer automatic direct video links.
