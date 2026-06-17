# World Cup Highlights

**Live site:** [https://talrme.github.io/world-cup-2026/](https://talrme.github.io/world-cup-2026/)

**Refresh workflow:** [https://github.com/talrme/world-cup-2026/actions/workflows/refresh-data.yml](https://github.com/talrme/world-cup-2026/actions/workflows/refresh-data.yml)

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
- Includes a Feedback button that opens a Google Form without leaving the dashboard.
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

## Automated Refresh

The repo includes a GitHub Actions workflow at `.github/workflows/refresh-data.yml`: [Refresh World Cup data](https://github.com/talrme/world-cup-2026/actions/workflows/refresh-data.yml). It has already been committed and pushed, so there is nothing else to install in GitHub as long as Actions are enabled for the repo.

If the first run fails while pushing a refresh commit, check **Settings → Actions → General → Workflow permissions** and make sure the repository allows GitHub Actions to write repository contents. The workflow itself already requests `contents: write`.

What it does:

- Runs `python scripts/refresh_all.py` every 15 minutes at `:07`, `:22`, `:37`, and `:52` UTC.
- Lets you run the same refresh manually from GitHub.
- Writes the full refresh log into the Actions run output.
- Adds a run summary with the trigger, changed files, diff summary, elapsed refresh runtime in seconds/minutes, and a final one-line commit/no-op verdict.
- Uploads a `refresh-output-*` artifact for each run, retained for 30 days.
- Commits refreshed `data/world-cup-2026.json` and `schedule-data.js` back to `main` only when those files changed.
- No-op runs should not commit. A run with `Schedule updates applied: 0` and `New/updated direct video links saved: 0` should leave the data files untouched.

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
