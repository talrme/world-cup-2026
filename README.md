# World Cup Highlights

**Live site:** [https://talrme.github.io/world-cup-2026/](https://talrme.github.io/world-cup-2026/)

**Refresh workflow:** [https://github.com/talrme/world-cup-2026/actions/workflows/refresh-data.yml](https://github.com/talrme/world-cup-2026/actions/workflows/refresh-data.yml)

A local, spoiler-conscious 2026 World Cup schedule dashboard. It keeps scores in the data file so the schedule can be updated, but the UI hides them by default so you can jump straight to highlights without accidentally seeing a result.

## What It Does

- Shows the tournament across Schedule, Groups, and Players by default. Optional Tiles and Bracket views can be enabled in Settings.
- Keeps the top controls focused: choose a view, manage score visibility, and filter by country.
- Shows a Players view with Golden Boot stats: points, goals, assists, games played, minutes, goals per 90, and points per 90.
- Opens player details from the Players table, with player basics and optional Gemini-generated insights.
- Saves view and country selections in the URL, while leaving spoiler reveal state local to the page.
- Keeps Schedule uncluttered by default. Click a match to open a floating match-details panel, then minimize or close it when needed.
- Hides scores by default. Click a blurred score pill to reveal one score, or use `Show all scores` when spoilers are okay.
- Includes an optional `Show scores before` date control. It is off by default and starts five days back; when enabled, score pills through that date are revealed.
- Shows the match location in Match Details. Click the location to open a stadium map with all World Cup venues and the selected venue highlighted.
- Shows a rank-based favorite in Match Details when both teams have FIFA ranking data.
- In Groups, selected countries filter the fixture list while the standings table keeps the full group context. Use each group's score control to reveal that group only.
- Includes a Feedback button that opens a Google Form without leaving the dashboard.
- Shows direct Fox Sports/Fox Soccer YouTube links when verified highlight videos are available.
- Shows optional `Insights` buttons near match video links when Gemini blurbs have been generated; they open Match Details with the extra context expanded.
- Always shows the latest generated data timestamp in the footer as `Last updated`.
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

The static page reads `schedule-data.js`, generated from `data/world-cup-2026.json`; `player-stats.js`, generated from `data/player-stats.json`; and `ai-insights.js`, generated from `data/ai-insights.json`.

## Analytics

The deployed GitHub Pages site uses GoatCounter:

- Dashboard: [https://talrme.goatcounter.com](https://talrme.goatcounter.com)
- Counter endpoint: `https://talrme.goatcounter.com/count`
- Tracked site: [https://talrme.github.io/world-cup-2026/](https://talrme.github.io/world-cup-2026/)

The tracker is loaded conditionally in `index.html` only when the page is served from `talrme.github.io` under `/world-cup-2026`. Local `file://` use and local dev servers are intentionally not counted.

GoatCounter may show `No data received` until the account email is confirmed and the deployed site receives its first non-blocked page view. Browser ad blockers can block GoatCounter requests.

## Feedback

The site has a Feedback button in the controls. It opens the Google Form in an embedded modal, with an `Open in Google Forms` fallback link if a browser blocks the iframe.

- Feedback form: [https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?usp=sharing&ouid=104982845318929976228](https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?usp=sharing&ouid=104982845318929976228)
- Responses sheet: [https://docs.google.com/spreadsheets/d/1LvzMmvmk-Q-TDuziLJHdFeo-DewOnXNM4lVE3g8wzoE/edit?resourcekey=&gid=1959176771#gid=1959176771](https://docs.google.com/spreadsheets/d/1LvzMmvmk-Q-TDuziLJHdFeo-DewOnXNM4lVE3g8wzoE/edit?resourcekey=&gid=1959176771#gid=1959176771)

## Refresh Data

Run schedule/results, ESPN knockout bracket, player stats, and highlight refreshes:

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

Refresh only player stats:

```bash
python3 scripts/update_player_stats.py
```

The player stats refresh preserves the existing generated timestamp when player rows are unchanged, so stable runs should not create timestamp-only commits.

Refresh optional Gemini AI blurbs:

```bash
python3 scripts/update_ai_insights.py --dry-run --mode standard
python3 scripts/update_ai_insights.py --mode standard --sleep 10
```

The AI insight refresh is safe when no key exists. It prints `No GEMINI_API_KEY found; skipping AI insights.` and exits successfully, so normal refreshes still work.

Useful AI options:

```bash
python3 scripts/update_ai_insights.py --mode minimal
python3 scripts/update_ai_insights.py --mode standard
python3 scripts/update_ai_insights.py --mode seed --match-content previews --max-groups 0 --max-players 0 --sleep 10 --max-estimated-cost 0.25
python3 scripts/update_ai_insights.py --mode seed --sleep 10 --max-estimated-cost 0.25
python3 scripts/update_ai_insights.py --force --match-id 12 --max-calls 1
python3 scripts/update_ai_insights.py --force --match-id 12 --match-content previews --max-calls 1
python3 scripts/update_ai_insights.py --force --player "Lionel Messi|Argentina" --max-calls 1
python3 scripts/update_ai_insights.py --force --group B --max-calls 1
python3 scripts/update_ai_insights.py --force-all --sleep 10 --max-estimated-cost 0.25
```

Modes:

- `minimal`: a small capped batch for quick tests or cautious manual runs.
- `standard`: the normal automation mode. It considers all future matches with real teams, matches from the past five days, active groups, and the top 30 players, then only calls Gemini for missing/stale/changed targets.
- `seed`: one-time backfill mode for all planned-team matches, all groups, and the top 30 players. Useful before deployment or after prompt changes; at 10 seconds between calls, a full seed can take about 20 minutes.
- `all`: all configured targets, still subject to call and cost caps.
- `--force-all`: regenerate everything, subject to `--max-calls` and `--max-estimated-cost`.
- `--match-id`, `--group`, and `--player`: targeted test refreshes. These are restrictive, so `--match-id 12` refreshes only that match unless you add more targets.

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
npm run refresh:players
npm run refresh:ai
npm run refresh:ai:dry
npm run refresh:ai:seed
npm run refresh:videos
npm run refresh:videos:all
```

## Gemini API Setup

AI blurbs are generated by Python during refreshes, then saved into static data files. The browser never receives the Gemini API key.

To get a key:

1. Open [Google AI Studio API keys](https://aistudio.google.com/apikey).
2. Create or select a Google Cloud project.
3. Click **Create API key**.
4. Copy the key.

For local use:

```bash
cp .env.example .env
```

Edit `.env` and paste the key:

```text
GEMINI_API_KEY=your-real-key
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_SLEEP_SECONDS=10
```

`.env` is ignored by git. `.env.example` is the safe template that is committed.

For GitHub Actions:

1. Open the GitHub repo.
2. Go to **Settings -> Secrets and variables -> Actions**.
3. Click **New repository secret**.
4. Name it `GEMINI_API_KEY`.
5. Paste the key.

The workflow passes that secret to `scripts/update_ai_insights.py`. The script reads the same `GEMINI_API_KEY` name locally and on GitHub, so no code change is needed between environments.

Cost and free-tier notes:

- The default model is `gemini-3.1-flash-lite`, chosen as the current cheap Gemini option.
- `--dry-run` estimates the paid-tier cost before making calls.
- `--sleep 10` spaces calls out for free-tier/rate-limit friendliness.
- `--max-calls` and `--max-estimated-cost` stop accidental runaway runs.
- Google Cloud budget alerts are recommended. Budget alerts are useful guardrails, but do not assume they are a perfect hard stop.

## Betting Odds POC

Match Details can show a proof-of-concept "Win chance" card when a match has odds in `match-odds.js`. The current POC uses real published odds copied into `data/match-odds.json` / `match-odds.js` for a small number of matches, with source links in the expanded "Show math" section.

The math converts American odds into raw implied probabilities, then normalizes the raw probabilities across the listed market outcomes to remove the sportsbook margin. For group-stage 90-minute-result markets this includes the draw. The result is a no-vig estimate, not betting advice.

This is not automated yet. A production version should add `scripts/update_odds.py`, pick an odds API/provider, store the provider timestamp and bookmaker/source, and avoid showing stale odds as live market data.

## API-Football Proof Of Concept

There is a non-invasive API-Football comparison script at `scripts/api_football_poc.py`. It does not modify the live site data. It can fetch one World Cup fixtures response, map it into this project's match shape, compare it against `data/world-cup-2026.json`, and optionally write a throwaway static copy under `poc/api-football/site`.

Run it against the real API after creating a free API-Football/API-Sports key:

```bash
API_FOOTBALL_KEY=your_key_here python3 scripts/api_football_poc.py --write-site
```

Run it without a key to test only the mapper/report/dummy-site pipeline:

```bash
python3 scripts/api_football_poc.py --mock-from-current --write-site
```

The PoC writes disposable reports under `poc/api-football/`. The generated output files are ignored by git; the instructions live in `poc/api-football/README.md`.

## Automated Refresh

The repo includes a GitHub Actions workflow at `.github/workflows/refresh-data.yml`: [Refresh World Cup data](https://github.com/talrme/world-cup-2026/actions/workflows/refresh-data.yml). It has already been committed and pushed, so there is nothing else to install in GitHub as long as Actions are enabled for the repo.

If the first run fails while pushing a refresh commit, check **Settings → Actions → General → Workflow permissions** and make sure the repository allows GitHub Actions to write repository contents. The workflow itself already requests `contents: write`.

What it does:

- Runs `python scripts/refresh_all.py` every 15 minutes at `:07`, `:22`, `:37`, and `:52` UTC. Scheduled runs use AI `standard` mode.
- Refreshes the knockout bracket from ESPN's World Cup scoreboard JSON before player stats, highlights, and AI insights run.
- Lets you run the same refresh manually from GitHub.
- Writes the full refresh log into the Actions run output.
- Adds a run summary with the trigger, changed files, diff summary, elapsed refresh runtime in seconds/minutes, and a final one-line commit/no-op verdict.
- Uploads a `refresh-output-*` artifact for each run, retained for 30 days.
- Commits refreshed schedule, player stats, and AI insight data back to `main` only when those files changed.

AI insight automation rules:

- Match AI has two match buckets: spoiler-free `matchPreviews` and spoiler recap `matches`. The tile still says `Insights`; Match Details shows `Pregame Preview` and, when present, `Match Recap`.
- Pregame previews use a scrubbed context that omits the current match score/result/status/video data. They are safe to read before highlights, even after the match has finished.
- Match recaps use the normal match context and may include spoilers. If the score is hidden, the recap is collapsed by default but still available if the user opens it. If the score is revealed, the recap opens by default and the pregame preview collapses.
- Future matches with at least one real team are populated and then refreshed only when their source data/prompt changes or they become weekly stale. Bracket matches with exactly one known team use a special partial-field prompt. Knockout matches with zero real teams are skipped until a team appears.
- Matches from the past five days are eligible once daily, and any meaningful status/result/video/source change jumps ahead immediately.
- Groups refresh when standings or group match context changes, otherwise at most daily during active group windows.
- Top 30 player insights refresh when player stats/source context changes, otherwise at most daily.
- Manual `seed` mode backfills the planned-team schedule, all groups, and the top 30 players before deployment. The workflow timeout allows this longer deliberate run.
- No-op runs should not commit. A run with `Schedule updates applied: 0`, `Bracket matches changed: 0`, and `New/updated direct video links saved: 0` should leave the data files untouched.

To see automated runs:

1. Open the GitHub repo.
2. Go to **Actions**.
3. Choose **Refresh World Cup data**.
4. Click any run to see the summary, logs, runtime, artifacts, and any data-refresh commit.

To run it manually:

1. Go to **Actions**.
2. Choose **Refresh World Cup data**.
3. Click **Run workflow**.
4. Usually leave `commit_changes` enabled.
5. Use `all_videos` only when you want a slower full-video pass.
6. Use `force_videos` only when you want existing direct video links replaced if a new match is found.

To pause the automation:

1. Go to **Actions**.
2. Choose **Refresh World Cup data**.
3. Click the `...` menu.
4. Choose **Disable workflow**.

To resume it later, return to the same workflow and choose **Enable workflow**.

Usage notes:

- For a public repo using standard GitHub-hosted runners, GitHub Actions usage is generally free.
- For a private repo, scheduled runs count against the account's GitHub Actions minutes/quota.
- This workflow is intentionally lightweight. At a 15-minute cadence it runs 96 times per day. If each run takes about 1 minute end-to-end, that is roughly 96 runner minutes per day.
- GitHub's run page shows total job duration. The workflow summary also shows the refresh script's elapsed runtime.
- Scheduled workflows can be delayed during busy GitHub periods. The cron is offset from common quarter-hour boundaries to reduce that risk.

If you use the local Desktop copy, run `git pull` to bring in the automated refresh commits. The GitHub Pages URL updates from the pushed data automatically once Pages rebuilds.

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
- `player-stats.js`: generated browser player stats. Do not hand-edit unless necessary.
- `ai-insights.js`: generated browser AI insight data. Do not hand-edit unless necessary.
- `match-odds.js`: browser odds POC data with sourced American odds and implied-probability math inputs.
- `data/world-cup-2026.json`: source schedule/results/video data.
- `data/player-stats.json`: source player scoring stats from the Guardian Golden Boot feed.
- `data/ai-insights.json`: source AI insight blurbs generated by Gemini. `matchPreviews` are spoiler-free setup reads; `matches` are spoiler recaps.
- `data/match-odds.json`: source odds POC data. Static/manual for now.
- `scripts/update_schedule.py`: schedule/results updater.
- `scripts/update_bracket.py`: ESPN knockout bracket updater.
- `scripts/update_player_stats.py`: player stats updater.
- `scripts/update_highlights.py`: Fox Sports YouTube highlights updater.
- `scripts/update_ai_insights.py`: optional Gemini AI insight updater. Use `--match-content previews`, `--match-content recaps`, or `--match-content all` to choose match content.
- `scripts/refresh_all.py`: runs schedule refresh, ESPN bracket refresh, player stats refresh, highlight refresh, then optional AI insight refresh.
- `components/world-cup-dashboard.tsx`: React/Vinext mirror of the static app.

## Data Notes

- Group-stage schedule and result data were seeded from SBNation's 2026 World Cup schedule.
- Knockout structure was seeded from the published bracket structure, then refreshed from ESPN's World Cup scoreboard JSON for confirmed teams, dates, kickoff times, venues, statuses, and later knockout scores.
- Times are stored with an Eastern Time offset and displayed in the browser's local timezone.
- Scores are intentionally stored in JSON but visually hidden until revealed.
- Venue IDs are stored per match and rendered from the top-level `venues` catalog.
- Player stats come from the Guardian Golden Boot feed. The browser also tries to fetch the live feed directly, with the generated snapshot as the fallback.
