(() => {
  const data = window.WORLD_CUP_DATA;
  const app = document.getElementById("app");

  if (!data || !app) {
    return;
  }

  const modes = [
    ["timeline", "Schedule"],
    ["groups", "Groups"],
    ["bracket", "Bracket"],
    ["constellation", "Tiles"],
  ];
  const modeIds = modes.map(([id]) => id);
  const settingsKey = "worldCup2026Settings";
  const spoilerStateKey = "worldCup2026Spoilers";
  const staleDataReloadKey = "worldCup2026LastStaleReloadAt";
  const staleDataReloadMs = 60 * 60 * 1000;
  const feedbackFormUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?usp=sharing&ouid=104982845318929976228";
  const feedbackEmbedUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?embedded=true";
  const defaultSettings = {
    theme: "match",
    density: "comfortable",
    videoStyle: "compact",
    timelineStart: "yesterday",
    scoreStartupMode: "previous",
    showBracketViewOption: false,
  };
  const settingGroups = [
    {
      key: "theme",
      label: "Color theme",
      options: [
        ["match", "Stadium"],
        ["midnight", "Midnight"],
        ["daylight", "Daylight"],
        ["electric", "Electric"],
      ],
    },
    {
      key: "density",
      label: "Card density",
      options: [
        ["comfortable", "Comfortable"],
        ["compact", "Compact"],
      ],
    },
    {
      key: "videoStyle",
      label: "Video buttons",
      options: [
        ["compact", "Compact"],
        ["full", "Full labels"],
      ],
    },
    {
      key: "timelineStart",
      label: "Schedule opens at",
      options: [
        ["yesterday", "Yesterday"],
        ["today", "Today"],
        ["top", "Top"],
      ],
    },
    {
      key: "scoreStartupMode",
      label: "Scores open as",
      options: [
        ["previous", "Show previously revealed"],
        ["hidden", "Always hidden"],
        ["shown", "Always showing"],
      ],
    },
  ];

  function readSettings() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(settingsKey) || "{}");
      return { ...defaultSettings, ...stored };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(settingsKey, JSON.stringify(state.settings));
    } catch {
      // Settings are optional device preferences.
    }
  }

  const teamFlagCodes = {
    Algeria: "DZ",
    Argentina: "AR",
    Australia: "AU",
    Austria: "AT",
    Belgium: "BE",
    "Bosnia and Herzegovina": "BA",
    Brazil: "BR",
    "Cabo Verde": "CV",
    Canada: "CA",
    Colombia: "CO",
    Croatia: "HR",
    Curacao: "CW",
    Czechia: "CZ",
    "DR Congo": "CD",
    Ecuador: "EC",
    Egypt: "EG",
    England: "gbeng",
    France: "FR",
    Germany: "DE",
    Ghana: "GH",
    Haiti: "HT",
    Iran: "IR",
    Iraq: "IQ",
    "Ivory Coast": "CI",
    Japan: "JP",
    Jordan: "JO",
    Mexico: "MX",
    Morocco: "MA",
    Netherlands: "NL",
    "New Zealand": "NZ",
    Norway: "NO",
    Panama: "PA",
    Paraguay: "PY",
    Portugal: "PT",
    Qatar: "QA",
    "Saudi Arabia": "SA",
    Scotland: "gbsct",
    Senegal: "SN",
    "South Africa": "ZA",
    "South Korea": "KR",
    Spain: "ES",
    Sweden: "SE",
    Switzerland: "CH",
    Tunisia: "TN",
    Turkey: "TR",
    "United States": "US",
    Uruguay: "UY",
    Uzbekistan: "UZ",
  };

  const teamFifaRanks = {
    Algeria: 35,
    Argentina: 2,
    Australia: 26,
    Austria: 24,
    Belgium: 8,
    "Bosnia and Herzegovina": 71,
    Brazil: 5,
    "Cabo Verde": 68,
    Canada: 27,
    Colombia: 13,
    Croatia: 10,
    Curacao: 82,
    Czechia: 44,
    "DR Congo": 56,
    Ecuador: 23,
    Egypt: 34,
    England: 4,
    France: 3,
    Germany: 9,
    Ghana: 72,
    Haiti: 84,
    Iran: 20,
    Iraq: 58,
    "Ivory Coast": 42,
    Japan: 18,
    Jordan: 66,
    Mexico: 15,
    Morocco: 11,
    Netherlands: 7,
    "New Zealand": 86,
    Norway: 29,
    Panama: 30,
    Paraguay: 39,
    Portugal: 6,
    Qatar: 51,
    "Saudi Arabia": 60,
    Scotland: 36,
    Senegal: 19,
    "South Africa": 61,
    "South Korea": 22,
    Spain: 1,
    Sweden: 43,
    Switzerland: 17,
    Tunisia: 40,
    Turkey: 25,
    "United States": 14,
    Uruguay: 16,
    Uzbekistan: 50,
  };

  function inputDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function defaultScoreCutoffDate() {
    const date = new Date();
    date.setDate(date.getDate() - 5);
    return inputDateValue(date);
  }

  function baseSpoilerState(scoreCutoffDate = defaultScoreCutoffDate()) {
    return {
      showAllScores: false,
      scoreCutoffEnabled: false,
      scoreCutoffDate,
      revealedScores: new Set(),
      hiddenScores: new Set(),
      revealedGroups: new Set(),
      hiddenGroups: new Set(),
      hiddenScoresStored: true,
    };
  }

  function applyScoreStartupMode(spoilers, startupMode) {
    if (startupMode === "hidden") {
      return baseSpoilerState(spoilers.scoreCutoffDate);
    }

    if (startupMode === "shown") {
      return {
        ...baseSpoilerState(spoilers.scoreCutoffDate),
        showAllScores: true,
      };
    }

    return spoilers;
  }

  function readSpoilerState(startupMode = "previous") {
    try {
      const stored = JSON.parse(window.localStorage.getItem(spoilerStateKey) || "{}");
      const scoreCutoffDate =
        typeof stored.scoreCutoffDate === "string" && stored.scoreCutoffDate
          ? stored.scoreCutoffDate
          : defaultScoreCutoffDate();
      const hiddenScoresStored = Array.isArray(stored.hiddenScores);

      return applyScoreStartupMode({
        showAllScores: Boolean(stored.showAllScores),
        scoreCutoffEnabled: Boolean(stored.scoreCutoffEnabled),
        scoreCutoffDate,
        revealedScores: new Set(
          Array.isArray(stored.revealedScores)
            ? stored.revealedScores.map(Number).filter(Number.isFinite)
            : [],
        ),
        hiddenScores: new Set(hiddenScoresStored ? stored.hiddenScores.map(Number).filter(Number.isFinite) : []),
        revealedGroups: new Set(Array.isArray(stored.revealedGroups) ? stored.revealedGroups.filter((item) => typeof item === "string") : []),
        hiddenGroups: new Set(Array.isArray(stored.hiddenGroups) ? stored.hiddenGroups.filter((item) => typeof item === "string") : []),
        hiddenScoresStored,
      }, startupMode);
    } catch {
      return applyScoreStartupMode(baseSpoilerState(), startupMode);
    }
  }

  const savedSettings = readSettings();
  const savedSpoilers = readSpoilerState(savedSettings.scoreStartupMode);

  const state = {
    mode: "timeline",
    countryMode: "all",
    selectedCountries: new Set(),
    countryPickerOpen: false,
    mobileMenuOpen: false,
    settingsOpen: false,
    feedbackOpen: false,
    shareOpen: false,
    installOpen: false,
    shareCopied: false,
    settings: savedSettings,
    pendingViewScroll: null,
    selectedId: null,
    detailOpen: true,
    showAllScores: savedSpoilers.showAllScores,
    scoreCutoffEnabled: savedSpoilers.scoreCutoffEnabled,
    scoreCutoffDate: savedSpoilers.scoreCutoffDate,
    revealedScores: savedSpoilers.revealedScores,
    hiddenScores: savedSpoilers.hiddenScores,
    revealedGroups: savedSpoilers.revealedGroups,
    hiddenGroups: savedSpoilers.hiddenGroups,
    hiddenScoresStored: savedSpoilers.hiddenScoresStored,
    mapVenueId: null,
    timelineAutoScrolled: false,
    now: new Date(),
  };

  const matches = [...data.matches].sort((a, b) => {
    return kickoffDate(a).getTime() - kickoffDate(b).getTime() || a.id - b.id;
  });
  const venues = Array.isArray(data.venues) ? data.venues : [];
  let todayJumpFrame = null;
  let todayJumpPulseTimer = null;
  let shareCopyTimer = null;

  function saveSpoilerState() {
    try {
      window.localStorage.setItem(
        spoilerStateKey,
        JSON.stringify({
          showAllScores: state.showAllScores,
          scoreCutoffEnabled: state.scoreCutoffEnabled,
          scoreCutoffDate: state.scoreCutoffDate,
          revealedScores: [...state.revealedScores],
          hiddenScores: [...state.hiddenScores],
          revealedGroups: [...state.revealedGroups],
          hiddenGroups: [...state.hiddenGroups],
        }),
      );
    } catch {
      // Spoiler reveal state is a best-effort device preference.
    }
  }

  function groupScoreIds(group) {
    return scoredMatchIds((match) => match.stage === "Group" && match.group === group);
  }

  function scoredMatchIds(filter = () => true) {
    return matches.filter((match) => hasScore(match) && filter(match)).map((match) => match.id);
  }

  function allScoredMatchesVisible() {
    const scoredMatches = matches.filter(hasScore);
    return Boolean(scoredMatches.length && scoredMatches.every((match) => isScoreVisible(match)));
  }

  function setScoreIdsVisible(ids, visible) {
    ids.forEach((id) => {
      if (visible) {
        state.hiddenScores.delete(id);
        state.revealedScores.add(id);
      } else {
        state.revealedScores.delete(id);
        state.hiddenScores.add(id);
      }
    });
  }

  function hideGroupScores(group) {
    setScoreIdsVisible(groupScoreIds(group), false);
  }

  function showGroupScores(group) {
    setScoreIdsVisible(groupScoreIds(group), true);
  }

  function hideAllScoredMatches() {
    setScoreIdsVisible(scoredMatchIds(), false);
  }

  function showAllScoredMatches() {
    setScoreIdsVisible(scoredMatchIds(), true);
  }

  function revealScoresThroughCutoff() {
    if (!state.scoreCutoffEnabled || !state.scoreCutoffDate) return;

    state.revealedGroups.clear();
    state.hiddenGroups.clear();
    setScoreIdsVisible(scoredMatchIds((match) => localDateKey(match) <= state.scoreCutoffDate), true);
  }

  function migrateScoreVisibilityState() {
    let changed = false;

    if (state.showAllScores && (state.settings.scoreStartupMode === "shown" || !state.hiddenScoresStored)) {
      showAllScoredMatches();
      changed = true;
    }

    if (state.revealedGroups.size) {
      state.revealedGroups.forEach((group) => showGroupScores(group));
      state.revealedGroups.clear();
      changed = true;
    }

    if (state.hiddenGroups.size) {
      state.hiddenGroups.forEach((group) => hideGroupScores(group));
      state.hiddenGroups.clear();
      changed = true;
    }

    if (!state.hiddenScoresStored) {
      changed = true;
    }

    state.hiddenScoresStored = true;
    if (changed) {
      saveSpoilerState();
    }
  }

  migrateScoreVisibilityState();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function kickoffDate(match) {
    if (!match.time || !match.offset) {
      return new Date(`${match.date}T12:00:00-04:00`);
    }

    return new Date(`${match.date}T${match.time}:00${match.offset}`);
  }

  function formatDate(match) {
    return kickoffDate(match).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(match) {
    if (!match.time) return "Time TBD";

    return kickoffDate(match).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatCompactDateTime(match) {
    if (!match.time) return formatDate(match);

    const date = kickoffDate(match);
    const dateText = date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    });
    const timeText = date
      .toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
      .replace(":00", "")
      .replace(/\s/g, "")
      .toLowerCase();

    return `${dateText} @ ${timeText}`;
  }

  function isRealTeam(team) {
    return !/^(Winner|Runner-up|Best|Loser|3rd)\b/.test(team);
  }

  function allCountries() {
    const teams = [...new Set(matches.flatMap((match) => [match.home, match.away]).filter(isRealTeam))].sort();
    const priority = ["United States", "Argentina"].filter((team) => teams.includes(team));
    const rest = teams.filter((team) => !priority.includes(team));
    return [...priority, ...rest];
  }

  function countryFilterLabel() {
    if (state.countryMode === "all") return "All countries";
    if (!state.selectedCountries.size) return "No countries";
    if (selectedAllCountries()) return "All countries";
    if (state.selectedCountries.size === 1) return [...state.selectedCountries][0];
    return `${state.selectedCountries.size} countries`;
  }

  function currentModeLabel() {
    return modes.find(([id]) => id === state.mode)?.[1] || "Schedule";
  }

  function modeIsVisible(id) {
    return id !== "bracket" || state.settings.showBracketViewOption;
  }

  function visibleModes() {
    return modes.filter(([id]) => modeIsVisible(id));
  }

  function selectedAllCountries() {
    const countries = allCountries();
    return state.countryMode === "all" || Boolean(countries.length && state.selectedCountries.size === countries.length);
  }

  function countryIsSelected(team) {
    return state.countryMode === "all" || state.selectedCountries.has(team);
  }

  function applyUrlState() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const countries = params.getAll("country");
    const countrySet = new Set(allCountries());

    state.mode = "timeline";
    state.countryMode = "all";
    state.selectedCountries = new Set();

    if (view && modeIds.includes(view) && modeIsVisible(view)) {
      state.mode = view;
    }
    if (params.get("countries") === "none") {
      state.countryMode = "custom";
      state.selectedCountries.clear();
    } else {
      state.selectedCountries = new Set(countries.filter((country) => countrySet.has(country)));
      if (state.selectedCountries.size && state.selectedCountries.size !== countrySet.size) {
        state.countryMode = "custom";
      } else {
        state.countryMode = "all";
        state.selectedCountries.clear();
      }
    }
  }

  function syncUrlState() {
    const params = new URLSearchParams();

    if (state.mode !== "timeline" && modeIsVisible(state.mode)) params.set("view", state.mode);
    if (state.countryMode === "custom" && !state.selectedCountries.size) {
      params.set("countries", "none");
    } else if (state.countryMode === "custom" && !selectedAllCountries()) {
      [...state.selectedCountries].sort().forEach((country) => params.append("country", country));
    }

    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
  }

  function generatedDataTime() {
    const timestamp = Date.parse(data.generatedAt || "");
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function noteRefreshAttempt() {
    try {
      window.localStorage.setItem(staleDataReloadKey, String(Date.now()));
    } catch {
      // Refresh throttling is a best-effort device preference.
    }
  }

  function reloadPage() {
    noteRefreshAttempt();
    window.location.reload();
  }

  function autoReloadStaleHostedData() {
    if (!["http:", "https:"].includes(window.location.protocol)) return false;

    const generatedAt = generatedDataTime();
    if (!generatedAt || Date.now() - generatedAt < staleDataReloadMs) return false;

    try {
      const lastReload = Number(window.localStorage.getItem(staleDataReloadKey) || 0);
      if (Number.isFinite(lastReload) && Date.now() - lastReload < staleDataReloadMs) {
        return false;
      }
    } catch {
      // If storage is unavailable, a single reload attempt is still harmless.
    }

    reloadPage();
    return true;
  }

  function cleanShareUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.href;
  }

  function localDateKey(match) {
    const date = kickoffDate(match);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function matchState(match) {
    if (match.status === "completed") return "completed";
    if (!match.time) return "scheduled";

    const elapsed = state.now.getTime() - kickoffDate(match).getTime();
    const liveWindow = 1000 * 60 * 150;

    if (elapsed >= 0 && elapsed <= liveWindow) return "live";
    if (elapsed > liveWindow) return "needs-result";
    return "scheduled";
  }

  function scoreText(match) {
    if (typeof match.homeScore === "number" && typeof match.awayScore === "number") {
      return `${match.homeScore} - ${match.awayScore}`;
    }

    return "vs";
  }

  function hasScore(match) {
    return typeof match.homeScore === "number" && typeof match.awayScore === "number";
  }

  function hasDirectVideo(match) {
    return Boolean(match.videos && (match.videos.extended?.url || match.videos.short?.url));
  }

  function isScorePending(match, current = matchState(match)) {
    return !hasScore(match) && (current === "live" || current === "needs-result" || current === "completed" || hasDirectVideo(match));
  }

  function flagEmojiForCode(code) {
    if (!code) return "";

    if (code === "gbeng" || code === "gbsct") {
      return String.fromCodePoint(
        0x1f3f4,
        ...code.split("").map((letter) => 0xe0000 + letter.charCodeAt(0)),
        0xe007f,
      );
    }

    if (!/^[A-Z]{2}$/.test(code)) return "";
    return code
      .split("")
      .map((letter) => String.fromCodePoint(0x1f1a5 + letter.charCodeAt(0)))
      .join("");
  }

  function flagForTeam(team) {
    return flagEmojiForCode(teamFlagCodes[team]);
  }

  function teamResultClass(match, side, forceVisible = false, forceHidden = false) {
    if (!hasScore(match) || !isScoreVisible(match, forceVisible, forceHidden) || match.homeScore === match.awayScore) {
      return "";
    }

    const homeWon = match.homeScore > match.awayScore;
    return (side === "home" && homeWon) || (side === "away" && !homeWon) ? "is-winner" : "is-loser";
  }

  function renderTeamName(team, className = "team-name") {
    const flag = flagForTeam(team);
    const flagHtml = flag ? `<span class="team-flag" aria-hidden="true">${escapeHtml(flag)}</span>` : "";
    return `<span class="${escapeHtml(className)}">${flagHtml}<span class="team-label">${escapeHtml(team)}</span></span>`;
  }

  function teamRank(team) {
    return teamFifaRanks[team] || null;
  }

  function renderRankingRow(match) {
    const homeRank = teamRank(match.home);
    const awayRank = teamRank(match.away);

    if (!homeRank || !awayRank) {
      return "";
    }

    const rankings = [
      { team: match.home, rank: homeRank, order: 0 },
      { team: match.away, rank: awayRank, order: 1 },
    ].sort((a, b) => a.rank - b.rank || a.order - b.order);

    return `
      <div>
        <dt>Rankings</dt>
        <dd>
          <span class="detail-rankings" aria-label="FIFA rankings">
            ${rankings
              .map((item, index) => `
                <span class="detail-ranking ${index === 0 ? "is-top-ranked" : ""}">
                  ${renderTeamName(item.team, "detail-ranking-team")}
                  <span class="detail-ranking-number">#${item.rank}</span>
                </span>
              `)
              .join("")}
          </span>
        </dd>
      </div>
    `;
  }

  function scoreCutoffReveals(match) {
    return Boolean(state.scoreCutoffEnabled && state.scoreCutoffDate && localDateKey(match) <= state.scoreCutoffDate);
  }

  function isScoreVisible(match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match) || state.hiddenScores.has(match.id)) return false;
    if (state.revealedScores.has(match.id)) return true;
    if (forceHidden) return false;
    return Boolean(forceVisible || scoreCutoffReveals(match));
  }

  function spoilerText(match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match)) return "vs";
    return isScoreVisible(match, forceVisible, forceHidden) ? scoreText(match) : "?? - ??";
  }

  function renderScorePill(match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match)) {
      return isScorePending(match)
        ? `<span class="score-pill score-pending">Score pending</span>`
        : `<span class="score-pill score-empty">vs</span>`;
    }
    const visible = isScoreVisible(match, forceVisible, forceHidden);
    const label = visible ? "Hide score" : "Reveal score";
    const tooltip = visible ? "Click to hide" : "Click to reveal";
    return `<button aria-label="${label}" class="score-pill ${visible ? "score-revealed" : "score-hidden"}" data-score-id="${match.id}" data-score-tooltip="${escapeHtml(tooltip)}" type="button"><span class="score-hidden-text">${escapeHtml(spoilerText(match, forceVisible, forceHidden))}</span></button>`;
  }

  function videoStatus(match) {
    const current = matchState(match);
    if (hasDirectVideo(match)) return "";
    if (current === "live") return "Game In Progress";
    if (current === "completed" || current === "needs-result") return "Game Completed, highlights not ready yet";
    return "";
  }

  function matchNotice(match, current = matchState(match)) {
    if (current === "live") return "Game In Progress";
    if ((current === "completed" || current === "needs-result") && !hasDirectVideo(match)) {
      return "Game Completed, highlights not ready yet";
    }
    return "";
  }

  function videoDuration(kind, video) {
    const duration = video?.durationText || "";
    return duration.replace(/^~\s*/, "");
  }

  function youtubeSearchUrl(match) {
    const query = `Fox Sports ${match.home} vs ${match.away} Highlights`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  function canSearchVideo(match) {
    const current = matchState(match);
    return current === "completed" || current === "needs-result" || current === "live";
  }

  function renderVideoLink(kind, video, label) {
    const duration = videoDuration(kind, video);
    const compactLabel = kind === "extended" ? "Extended" : "Highlights";
    const visibleLabel = state.settings.videoStyle === "full" ? label : compactLabel;
    const durationLabel = duration ? `${duration} ` : "";
    const durationMarkup = duration ? `<small>${escapeHtml(duration)}</small>` : "";
    return `<a aria-label="Open ${escapeHtml(durationLabel)}${escapeHtml(visibleLabel)} on YouTube" class="video-link video-link-${kind}" href="${escapeHtml(video.url)}" rel="noreferrer" target="_blank" title="Open ${escapeHtml(label)} on YouTube"><span class="yt-mark" aria-hidden="true"></span>${durationMarkup}<span class="video-link-label">${escapeHtml(visibleLabel)}</span></a>`;
  }

  function videoDurationChip(kind, video) {
    const match = videoDuration(kind, video).match(/\d+/);
    return match ? `${match[0]} min` : "";
  }

  function renderTileVideoLink(kind, video) {
    const chip = videoDurationChip(kind, video);
    const label = kind === "extended" ? "Extended highlights" : "Highlights";
    const chipMarkup = chip ? `<span>${escapeHtml(chip)}</span>` : "";
    return `<a aria-label="Open ${escapeHtml(label)} on YouTube" class="tile-video-link tile-video-link-${kind}" href="${escapeHtml(video.url)}" rel="noreferrer" target="_blank" title="Open ${escapeHtml(label)} on YouTube"><span class="yt-mark" aria-hidden="true"></span>${chipMarkup}</a>`;
  }

  function renderTileVideoLinks(match) {
    const links = [];
    const short = match.videos?.short || null;
    const extended = match.videos?.extended || null;
    if (short?.url) links.push(renderTileVideoLink("short", short));
    if (extended?.url) links.push(renderTileVideoLink("extended", extended));
    return links.length ? `<div class="tile-video-links">${links.join("")}</div>` : "";
  }

  function renderVideoSearchLink(match) {
    const visibleLabel = state.settings.videoStyle === "full" ? "YouTube Search" : "Search";
    return `<a aria-label="Search YouTube" class="video-link video-link-search" href="${escapeHtml(youtubeSearchUrl(match))}" rel="noreferrer" target="_blank" title="Search YouTube"><span class="yt-mark" aria-hidden="true"></span><small>YouTube</small><span class="video-link-label">${escapeHtml(visibleLabel)}</span></a>`;
  }

  function renderInlineVideoLinks(match) {
    const links = [];
    const extended = match.videos?.extended || null;
    const short = match.videos?.short || null;

    if (short?.url) {
      links.push(renderVideoLink("short", short, "Highlights"));
    }
    if (extended?.url) {
      links.push(renderVideoLink("extended", extended, "Extended"));
    }

    if (!links.length && canSearchVideo(match)) {
      return `<span class="video-links video-search-links">${renderVideoSearchLink(match)}</span>`;
    }

    if (!links.length) {
      return "";
    }

    return `<span class="video-links">${links.join("")}</span>`;
  }

  function groupByDate(list) {
    return list.reduce((acc, match) => {
      const key = localDateKey(match);
      acc[key] = acc[key] || [];
      acc[key].push(match);
      return acc;
    }, {});
  }

  function standingsFor(list) {
    const rows = new Map();

    function ensure(team) {
      if (!rows.has(team)) {
        rows.set(team, {
          team,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          points: 0,
        });
      }

      return rows.get(team);
    }

    list.forEach((match) => {
      ensure(match.home);
      ensure(match.away);

      if (
        match.status !== "completed" ||
        typeof match.homeScore !== "number" ||
        typeof match.awayScore !== "number"
      ) {
        return;
      }

      const home = ensure(match.home);
      const away = ensure(match.away);
      home.played += 1;
      away.played += 1;
      home.gf += match.homeScore;
      home.ga += match.awayScore;
      away.gf += match.awayScore;
      away.ga += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.wins += 1;
        away.losses += 1;
        home.points += 3;
      } else if (match.homeScore < match.awayScore) {
        away.wins += 1;
        home.losses += 1;
        away.points += 3;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }

      home.gd = home.gf - home.ga;
      away.gd = away.gf - away.ga;
    });

    return [...rows.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    });
  }

  function filteredMatches() {
    return matches.filter((match) => {
      const countryMatches =
        state.countryMode === "all" ||
        state.selectedCountries.has(match.home) ||
        state.selectedCountries.has(match.away);

      if (!countryMatches) return false;
      return true;
    });
  }

  function selectedMatch() {
    if (state.selectedId === null) return null;
    return matches.find((match) => match.id === state.selectedId) || null;
  }

  function venueFor(match) {
    if (!match.venueId) return null;
    return venues.find((venue) => venue.id === match.venueId) || null;
  }

  function venueLocation(venue) {
    if (!venue) return "Venue TBD";
    return [venue.city, venue.region || venue.country].filter(Boolean).join(", ");
  }

  function venueDisplayName(venue) {
    if (!venue) return "Venue TBD";
    return `${venueLocation(venue)} - ${venue.stadium || venue.fifaName}`;
  }

  function renderVenueButton(match) {
    const venue = venueFor(match);
    if (!venue) return `<span class="venue-empty">Venue TBD</span>`;

    return `
      <button class="venue-link" data-venue-map="${escapeHtml(venue.id)}" type="button">
        <span>${escapeHtml(venueLocation(venue))}</span>
        <small>${escapeHtml(venue.stadium || venue.fifaName)}</small>
      </button>
    `;
  }

  function isGroupRevealed(group) {
    if (completedGroupScoresVisible(group)) return true;
    return false;
  }

  function completedGroupScoresVisible(group) {
    const completed = matches.filter((match) => {
      return match.stage === "Group" && match.group === group && match.status === "completed" && hasScore(match);
    });

    return completed.length > 0 && completed.every((match) => isScoreVisible(match));
  }

  function hiddenStat() {
    return `<span class="hidden-stat" aria-label="Hidden until revealed">??</span>`;
  }

  function renderVideoActions(match) {
    const current = matchState(match);
    const extended = match.videos?.extended || null;
    const short = match.videos?.short || null;
    const actions = [];

    if (short?.url) {
      actions.push(renderVideoLink("short", short, "Highlights"));
    }

    if (extended?.url) {
      actions.push(renderVideoLink("extended", extended, "Extended highlights"));
    }

    if (!actions.length && canSearchVideo(match)) {
      actions.push(renderVideoSearchLink(match));
    }

    const notice = matchNotice(match, current);
    if (!actions.length && notice) {
      actions.push(`<span>${escapeHtml(notice)}</span>`);
    }

    return `<div class="video-actions">${actions.join("")}</div>`;
  }

  function renderMatchCard(match, variant = "match-card") {
    const current = matchState(match);
    const videoClass = hasDirectVideo(match) ? "video-ready" : "";
    const notice = matchNotice(match, current);
    const videoLinks = renderInlineVideoLinks(match);
    const footer = notice || videoLinks
      ? `<span class="card-footer">
            ${notice ? `<span class="match-notice">${escapeHtml(notice)}</span>` : "<span></span>"}
            ${videoLinks ? `<span class="${videoClass}">${videoLinks}</span>` : "<span></span>"}
          </span>`
      : "";

    return `
      <article class="${variant} is-${current}">
        <div class="match-select" data-match-id="${match.id}" role="button" tabindex="0">
          <span class="card-meta">
            <span>${escapeHtml(match.group ? `Group ${match.group}` : match.stage)}</span>
            <span>${escapeHtml(formatTime(match))}</span>
          </span>
          <span class="teams">
            ${renderTeamName(match.home, `team-name ${teamResultClass(match, "home")}`)}
            ${renderScorePill(match)}
            ${renderTeamName(match.away, `team-name team-away ${teamResultClass(match, "away")}`)}
          </span>
          ${footer}
        </div>
      </article>
    `;
  }

  function renderDetailPanel(match) {
    const current = matchState(match);
    const checked = match.videos?.lastCheckedAt
      ? `<p class="last-checked">Checked ${escapeHtml(new Date(match.videos.lastCheckedAt).toLocaleString())}</p>`
      : "";

    return `
      <aside class="detail-panel is-${current}">
        <div class="detail-panel-header">
          <span class="eyebrow">Match details</span>
          <button aria-label="Minimize match details" class="icon-button" data-detail-close title="Minimize match details" type="button">×</button>
        </div>
        <h2 class="detail-title-teams">
          ${renderTeamName(match.home, `detail-team-name ${teamResultClass(match, "home")}`)}
          <span class="detail-vs">vs</span>
          ${renderTeamName(match.away, `detail-team-name ${teamResultClass(match, "away")}`)}
        </h2>
        <div class="detail-score">${renderScorePill(match)}</div>
        <dl>
          ${renderRankingRow(match)}
          <div><dt>Stage</dt><dd>${escapeHtml(match.group ? `Group ${match.group}` : match.stage)}</dd></div>
          <div><dt>Match #</dt><dd>${escapeHtml(String(match.id))}</dd></div>
          <div><dt>Kickoff</dt><dd>${escapeHtml(formatDate(match))} at ${escapeHtml(formatTime(match))}</dd></div>
          <div><dt>Location</dt><dd>${renderVenueButton(match)}</dd></div>
          <div><dt>Broadcast</dt><dd>${escapeHtml(match.network || "TBD")}</dd></div>
          ${matchNotice(match, current) ? `<div><dt>Status</dt><dd>${escapeHtml(matchNotice(match, current))}</dd></div>` : ""}
        </dl>
        ${videoStatus(match) ? `<div class="detail-video-state">${escapeHtml(videoStatus(match))}</div>` : ""}
        ${renderVideoActions(match)}
        ${checked}
      </aside>
    `;
  }

  function renderDetailHandle(match) {
    return `
      <button aria-label="Show match details" class="detail-mini" data-detail-open title="Show match details" type="button">
        <span>Match details</span>
        <strong>${renderTeamName(match.home, "mini-team-name")} vs ${renderTeamName(match.away, "mini-team-name")}</strong>
      </button>
    `;
  }

  function renderTimeline(list) {
    const byDate = groupByDate(list);
    const todayKey = inputDateValue(state.now);

    const days = Object.entries(byDate)
      .map(([date, dayMatches]) => {
        const todayClass = date === todayKey ? " is-today" : "";
        const todayBadge = date === todayKey ? `<span class="today-badge">Today</span>` : "";
        return `
          <section class="day-band${todayClass}" data-day-key="${escapeHtml(date)}">
            <div class="day-label">
              <strong>${escapeHtml(formatDate(dayMatches[0]))}</strong>
              ${todayBadge}
              <em>${dayMatches.length} ${dayMatches.length === 1 ? "match" : "matches"}</em>
            </div>
            <div class="day-matches">
              ${dayMatches.map((match) => renderMatchCard(match)).join("")}
            </div>
          </section>
        `;
      })
      .join("");

    return `
      <div class="timeline-layout">
        <div class="date-stream">${days}</div>
      </div>
    `;
  }

  function renderGroups() {
    const groups = matches
      .filter((match) => match.stage === "Group")
      .reduce((acc, match) => {
        acc[match.group] = acc[match.group] || [];
        acc[match.group].push(match);
        return acc;
      }, {});

    const groupHtml = Object.keys(groups)
      .sort()
      .map((group) => {
        const groupMatches = groups[group].sort((a, b) => kickoffDate(a).getTime() - kickoffDate(b).getTime() || a.id - b.id);
        const visibleGroupMatches =
          state.countryMode === "all"
            ? groupMatches
            : groupMatches.filter((match) => state.selectedCountries.has(match.home) || state.selectedCountries.has(match.away));

        if (state.countryMode !== "all" && !visibleGroupMatches.length) {
          return "";
        }

        const revealed = isGroupRevealed(group);
        const rows = revealed
          ? standingsFor(groups[group])
              .map((row) => {
                const gd = row.gd > 0 ? `+${row.gd}` : row.gd;
                return `<tr><td>${renderTeamName(row.team, "standing-team-name")}</td><td>${row.points}</td><td>${gd}</td><td>${row.played}</td></tr>`;
              })
              .join("")
          : groups[group]
              .map((match) => [match.home, match.away])
              .flat()
              .filter((team, index, teams) => teams.indexOf(team) === index)
              .sort()
              .map((team) => `<tr><td>${renderTeamName(team, "standing-team-name")}</td><td>${hiddenStat()}</td><td>${hiddenStat()}</td><td>${hiddenStat()}</td></tr>`)
              .join("");

        const fixtureRows = visibleGroupMatches
          .map((match) => {
            const current = matchState(match);
            return `
              <article class="fixture-row is-${current}">
                <div class="fixture-select" data-match-id="${match.id}" role="button" tabindex="0">
                  <span class="fixture-time">${escapeHtml(formatCompactDateTime(match))}</span>
                  <span class="fixture-teams">
                    ${renderTeamName(match.home, `fixture-team fixture-home ${teamResultClass(match, "home")}`)}
                    ${renderScorePill(match)}
                    ${renderTeamName(match.away, `fixture-team fixture-away ${teamResultClass(match, "away")}`)}
                  </span>
                </div>
              </article>
            `;
          })
          .join("");

        return `
          <section class="group-board">
            <header>
              <div>
                <span>Group ${escapeHtml(group)}</span>
                <strong>${visibleGroupMatches.length} ${visibleGroupMatches.length === 1 ? "match" : "matches"}</strong>
              </div>
              <button aria-pressed="${revealed ? "true" : "false"}" class="group-reveal" data-group-reveal="${escapeHtml(group)}" type="button">
                ${revealed ? "Hide scores" : "Show scores"}
              </button>
            </header>
            <table>
              <thead><tr><th>Team</th><th>Pts</th><th><span class="stat-help" title="Goal difference: goals scored minus goals conceded">GD</span></th><th><span class="stat-help" title="Games played">GP</span></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="group-fixtures">${fixtureRows}</div>
          </section>
        `;
      })
      .join("");

    return groupHtml
      ? `<div class="groups-layout">${groupHtml}</div>`
      : `<div class="empty-state"><strong>No group matches found</strong><span>Adjust the country filter or switch views.</span></div>`;
  }

  function renderBracket(list) {
    const knockout = list.filter((match) => match.stage !== "Group");
    const rounds = ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Third Place", "Final"];

    if (!knockout.length) {
      return `<div class="empty-state"><strong>No knockout matches found</strong><span>Adjust the country filter or switch to the schedule.</span></div>`;
    }

    const html = rounds
      .map((round) => {
        const roundMatches = knockout.filter((match) => match.stage === round);
        if (!roundMatches.length) return "";

        return `
          <section class="bracket-round">
            <header>${escapeHtml(round)}</header>
            <div class="bracket-stack">${roundMatches.map((match) => renderMatchCard(match, "bracket-slot")).join("")}</div>
          </section>
        `;
      })
      .join("");

    return `<div class="bracket-layout">${html}</div>`;
  }

  function renderConstellation(list) {
    return `
      <div class="constellation-layout">
        ${list
          .map((match) => {
            const current = matchState(match);
            return `
              <article class="star-node is-${current}">
                <div class="star-select" data-match-id="${match.id}" role="button" tabindex="0">
                  <span class="tile-time">${escapeHtml(formatCompactDateTime(match))}</span>
                  <div class="tile-teams">
                    <strong>${renderTeamName(match.home, `star-team-name ${teamResultClass(match, "home")}`)}</strong>
                    <span class="tile-score">${renderScorePill(match)}</span>
                    <strong>${renderTeamName(match.away, `star-team-name ${teamResultClass(match, "away")}`)}</strong>
                  </div>
                </div>
                ${renderTileVideoLinks(match)}
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderActiveView(list) {
    if (!list.length) {
      return `<div class="empty-state"><strong>No matches found</strong><span>Adjust the country filter or switch views.</span></div>`;
    }

    if (state.mode === "groups") return renderGroups(list);
    if (state.mode === "bracket") return renderBracket(list);
    if (state.mode === "constellation") return renderConstellation(list);
    return renderTimeline(list);
  }

  function renderControls() {
    const modeButtons = visibleModes()
      .map(([id, label]) => {
        const pressed = state.mode === id ? "true" : "false";
        return `<button aria-pressed="${pressed}" data-mode="${id}" type="button">${escapeHtml(label)}</button>`;
      })
      .join("");

    return `
      <div class="mobile-menu-bar">
        <button class="mobile-menu-toggle" aria-controls="schedule-controls" aria-expanded="${state.mobileMenuOpen ? "true" : "false"}" data-mobile-menu-toggle type="button">
          <span class="hamburger-icon" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="sr-only">${state.mobileMenuOpen ? "Close menu" : "Open menu"}</span>
          <strong>${escapeHtml(currentModeLabel())}</strong>
        </button>
        <button class="mobile-country-shortcut" data-country-picker-toggle type="button">
          <strong>${escapeHtml(countryFilterLabel())}</strong>
        </button>
      </div>
      <section class="control-deck ${state.mobileMenuOpen ? "is-open" : ""}" id="schedule-controls" aria-label="Schedule controls">
        <div class="mobile-drawer-head">
          <span>Menu</span>
          <strong>${escapeHtml(currentModeLabel())}</strong>
        </div>
        <div class="control-section control-section-view">
          <span class="control-section-title">View</span>
          <div class="view-toggle" aria-label="Viewing option">${modeButtons}</div>
        </div>
        <div class="control-section control-section-scores">
          <span class="control-section-title">Scores</span>
          <button class="spoiler-control" data-show-all-scores type="button">
            ${allScoredMatchesVisible() ? "Hide all scores" : "Show all scores"}
          </button>
        </div>
        <div class="control-section filters">
          <label class="country-filter-wrap">
            <span>Country</span>
            <button class="country-filter-trigger" data-country-picker-toggle type="button">
              <strong>${escapeHtml(countryFilterLabel())}</strong>
              <em>${state.countryMode === "all" ? "All" : "Filtered"}</em>
            </button>
          </label>
        </div>
        <div class="mobile-action-row">
          <button aria-label="Settings" class="settings-trigger" data-settings-open type="button" title="Settings">
            <span class="action-icon action-icon-settings" aria-hidden="true"></span>
            <strong>Settings</strong>
          </button>
          <button aria-label="Feedback" class="feedback-trigger" data-feedback-open type="button" title="Feedback">
            <span class="action-icon action-icon-feedback" aria-hidden="true"></span>
            <strong>Feedback</strong>
          </button>
          <button aria-label="Share" class="share-trigger" data-share-open type="button" title="Share">
            <span class="action-icon action-icon-share" aria-hidden="true"></span>
            <strong>Share</strong>
          </button>
          <button aria-label="Save as app" class="install-trigger" data-install-open type="button" title="Save as app">
            <span class="action-icon action-icon-app" aria-hidden="true"></span>
            <strong>App</strong>
          </button>
        </div>
      </section>
    `;
  }

  function renderSettingsModal() {
    if (!state.settingsOpen) return "";

    const sections = settingGroups
      .map((group) => {
        const options = group.options
          .map(([value, label]) => {
            const pressed = state.settings[group.key] === value ? "true" : "false";
            return `<button aria-pressed="${pressed}" data-setting-key="${escapeHtml(group.key)}" data-setting-value="${escapeHtml(value)}" type="button">${escapeHtml(label)}</button>`;
          })
          .join("");
        return `
          <section class="settings-section">
            <span>${escapeHtml(group.label)}</span>
            <div class="settings-options">${options}</div>
          </section>
        `;
      })
      .join("");

    return `
      <div class="settings-modal" data-settings-modal role="dialog" aria-modal="true" aria-label="Display settings">
        <section class="settings-panel">
          <header class="settings-header">
            <div>
              <span class="eyebrow">Settings</span>
              <h2>Display</h2>
            </div>
            <button aria-label="Close settings" class="icon-button settings-close" data-settings-close title="Close settings" type="button">×</button>
          </header>
          ${sections}
          <section class="settings-section settings-view-section">
            <span>Views</span>
            <label class="settings-toggle">
              <input data-control="show-bracket-view" type="checkbox" ${state.settings.showBracketViewOption ? "checked" : ""} />
              <span>Show Bracket View Option</span>
            </label>
          </section>
          <section class="settings-section settings-score-section">
            <span>Score reveal</span>
            <div class="settings-score-card score-date-control" data-score-date-open>
              <label class="score-date-toggle">
                <input data-control="score-cutoff-enabled" type="checkbox" ${state.scoreCutoffEnabled ? "checked" : ""} />
                <span>Show scores before</span>
              </label>
              <input aria-label="Show scores before date" data-control="score-cutoff-date" type="date" value="${escapeHtml(state.scoreCutoffDate)}" />
            </div>
          </section>
          <footer class="settings-footer">
            <button data-settings-reset type="button">Reset defaults</button>
            <span>Saved on this device</span>
          </footer>
        </section>
      </div>
    `;
  }

  function renderFeedbackModal() {
    if (!state.feedbackOpen) return "";

    return `
      <div class="feedback-modal" data-feedback-modal role="dialog" aria-modal="true" aria-label="Feedback and suggestions">
        <section class="feedback-panel">
          <header class="feedback-header">
            <div>
              <span class="eyebrow">Feedback</span>
              <h2>Suggestions</h2>
              <p>Share ideas, bugs, or anything that would make this better.</p>
            </div>
            <button aria-label="Close feedback" class="icon-button feedback-close" data-feedback-close title="Close feedback" type="button">×</button>
          </header>
          <div class="feedback-frame-wrap">
            <iframe class="feedback-frame" title="World Cup Highlights feedback form" src="${escapeHtml(feedbackEmbedUrl)}" loading="lazy">Loading feedback form</iframe>
          </div>
          <footer class="feedback-footer">
            <a href="${escapeHtml(feedbackFormUrl)}" rel="noreferrer" target="_blank">Open in Google Forms</a>
          </footer>
        </section>
      </div>
    `;
  }

  function renderShareModal() {
    if (!state.shareOpen) return "";

    const url = cleanShareUrl();

    return `
      <div class="share-modal" data-share-modal role="dialog" aria-modal="true" aria-label="Share World Cup Highlights">
        <section class="share-panel">
          <header class="share-header">
            <div>
              <span class="eyebrow">Share</span>
              <h2>World Cup Highlights</h2>
              <p>Copy the clean homepage link, without your current filters or view.</p>
            </div>
            <button aria-label="Close share" class="icon-button share-close" data-share-close title="Close share" type="button">×</button>
          </header>
          <div class="share-body">
            <div class="share-copy-card">
              <label>
                <span>Website link</span>
                <input aria-label="Clean website link" readonly value="${escapeHtml(url)}" />
              </label>
              <button data-share-copy type="button">${state.shareCopied ? "Copied" : "Copy"}</button>
            </div>
            <section class="share-phone-card">
              <span class="share-app-icon" aria-hidden="true">
                <img src="./public/assets/action-app.png" alt="" />
              </span>
              <div>
                <span>Save to your phone</span>
                <p>Add World Cup Highlights to your home screen so it opens like an app with the soccer ball icon.</p>
              </div>
            </section>
            <div class="share-install-grid">
              <section>
                <span class="install-method-icon" aria-hidden="true">
                  <img src="./public/assets/soccer-ball-192.png" alt="" />
                </span>
                <div>
                  <span>iPhone / iPad home screen</span>
                  <p>Open the site in Safari, tap Share, then choose Add to Home Screen.</p>
                </div>
              </section>
              <section>
                <span class="install-method-icon" aria-hidden="true">
                  <img src="./public/assets/soccer-ball-192.png" alt="" />
                </span>
                <div>
                  <span>Android home screen</span>
                  <p>Open the site in Chrome, tap the menu, then choose Add to Home screen or Install app.</p>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderInstallModal() {
    if (!state.installOpen) return "";

    return `
      <div class="install-modal" data-install-modal role="dialog" aria-modal="true" aria-label="Save World Cup Highlights to your phone">
        <section class="install-panel">
          <header class="install-header">
            <div>
              <span class="eyebrow">App</span>
              <h2>Save to Your Phone</h2>
              <p>Add World Cup Highlights to your home screen so it opens like an app.</p>
            </div>
            <button aria-label="Close app install help" class="icon-button install-close" data-install-close title="Close app install help" type="button">×</button>
          </header>
          <div class="install-body">
            <div class="share-install-grid">
              <section>
                <span class="install-method-icon" aria-hidden="true">
                  <img src="./public/assets/soccer-ball-192.png" alt="" />
                </span>
                <div>
                  <span>iPhone / iPad home screen</span>
                  <p>Open the site in Safari, tap Share, then choose Add to Home Screen.</p>
                </div>
              </section>
              <section>
                <span class="install-method-icon" aria-hidden="true">
                  <img src="./public/assets/soccer-ball-192.png" alt="" />
                </span>
                <div>
                  <span>Android home screen</span>
                  <p>Open the site in Chrome, tap the menu, then choose Add to Home screen or Install app.</p>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderCountryPicker() {
    if (!state.countryPickerOpen) return "";

    const options = allCountries()
      .map((team) => {
        const selected = countryIsSelected(team);
        const priority = team === "United States" || team === "Argentina" ? "is-priority" : "";
        return `
          <button aria-pressed="${selected ? "true" : "false"}" class="country-option ${priority}" data-country-option="${escapeHtml(team)}" type="button">
            <span class="country-check" aria-hidden="true">${selected ? "✓" : ""}</span>
            ${renderTeamName(team, "country-option-name")}
          </button>
        `;
      })
      .join("");

    return `
      <div class="country-picker-modal" data-country-picker-backdrop role="dialog" aria-modal="true" aria-label="Country filter">
        <section class="country-picker-panel">
          <header class="country-picker-header">
            <div>
              <span class="eyebrow">Country filter</span>
              <h2>${escapeHtml(countryFilterLabel())}</h2>
            </div>
            <button aria-label="Close country filter" class="icon-button" data-country-picker-close title="Close country filter" type="button">×</button>
          </header>
          <div class="country-picker-actions">
            <button aria-pressed="${state.countryMode === "all" ? "true" : "false"}" class="country-option country-option-all" data-country-all type="button">
              <span class="country-check" aria-hidden="true">${state.countryMode === "all" ? "✓" : ""}</span>
              <span class="country-option-name"><span class="team-label">All countries</span></span>
            </button>
            <button class="country-clear" data-country-clear type="button">Clear selected</button>
          </div>
          <div class="country-options">${options}</div>
        </section>
      </div>
    `;
  }

  function renderStadiumMap() {
    const selected = venues.find((venue) => venue.id === state.mapVenueId);
    if (!selected) return "";

    const dots = venues
      .map((venue) => {
        const selectedClass = venue.id === selected.id ? "is-selected" : "";
        return `
          <button
            aria-label="${escapeHtml(venueDisplayName(venue))}"
            class="stadium-dot ${selectedClass}"
            data-venue-map="${escapeHtml(venue.id)}"
            style="--x: ${Number(venue.mapX) || 50}; --y: ${Number(venue.mapY) || 50};"
            title="${escapeHtml(venueDisplayName(venue))}"
            type="button"
          >
            <span>${escapeHtml(venue.city)}</span>
          </button>
        `;
      })
      .join("");

    const list = venues
      .map((venue) => {
        const selectedClass = venue.id === selected.id ? "is-selected" : "";
        return `
          <button class="stadium-list-item ${selectedClass}" data-venue-map="${escapeHtml(venue.id)}" type="button">
            <strong>${escapeHtml(venue.city)}</strong>
            <span>${escapeHtml(venue.stadium || venue.fifaName)}</span>
            <em>${escapeHtml(venue.region || venue.country || "")}</em>
          </button>
        `;
      })
      .join("");

    return `
      <div class="stadium-map-modal" data-stadium-modal role="dialog" aria-modal="true" aria-label="World Cup stadium map">
        <section class="stadium-map-panel">
          <header class="stadium-map-header">
            <div>
              <span class="eyebrow">Stadium map</span>
              <h2>${escapeHtml(selected.fifaName || selected.stadium)}</h2>
              <p>${escapeHtml(venueDisplayName(selected))}</p>
            </div>
            <button aria-label="Close stadium map" class="icon-button" data-stadium-close title="Close stadium map" type="button">×</button>
          </header>
          <div class="stadium-map-art" aria-label="Host cities map">${dots}</div>
          <div class="stadium-list">${list}</div>
        </section>
      </div>
    `;
  }

  function timelineLandingCutoffKey() {
    const cutoff = new Date(state.now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (state.settings.timelineStart === "today" ? 0 : 1));
    return inputDateValue(cutoff);
  }

  function stickyChromeOffset() {
    const chrome = app.querySelector(".page-chrome");
    return chrome ? Math.ceil(chrome.getBoundingClientRect().height + 14) : 0;
  }

  function todayKey() {
    return inputDateValue(state.now);
  }

  function todayBand() {
    return app.querySelector(`[data-day-key="${todayKey()}"]`);
  }

  function updateTodayJumpButton() {
    const button = app.querySelector("[data-today-jump]");
    if (!button) return;

    const target = todayBand();
    if (state.mode !== "timeline" || !target) {
      button.classList.remove("is-visible");
      button.setAttribute("aria-hidden", "true");
      return;
    }

    const offset = stickyChromeOffset();
    const rect = target.getBoundingClientRect();
    const viewportBottom = window.innerHeight - 96;
    const visible = rect.bottom > offset + 12 && rect.top < viewportBottom;

    if (visible) {
      button.classList.remove("is-visible");
      button.setAttribute("aria-hidden", "true");
      return;
    }

    const direction = rect.top < offset ? "up" : "down";
    button.dataset.direction = direction;
    button.style.setProperty("--today-jump-top", `${Math.max(12, offset + 8)}px`);
    button.querySelector("[data-today-jump-arrow]").textContent = direction === "up" ? "↑" : "↓";
    button.setAttribute("aria-label", `Go to today. Today is ${direction === "up" ? "above" : "below"}.`);
    button.setAttribute("aria-hidden", "false");
    button.classList.add("is-visible");
  }

  function requestTodayJumpUpdate() {
    if (todayJumpFrame) return;
    todayJumpFrame = window.requestAnimationFrame(() => {
      todayJumpFrame = null;
      updateTodayJumpButton();
    });
  }

  function pulseTodayBand(target) {
    window.clearTimeout(todayJumpPulseTimer);
    target.classList.remove("is-jump-target");
    // Restart the animation even when the user taps the button repeatedly.
    void target.offsetWidth;
    target.classList.add("is-jump-target");
    todayJumpPulseTimer = window.setTimeout(() => {
      target.classList.remove("is-jump-target");
    }, 1200);
  }

  function scrollToToday() {
    const target = todayBand();
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - stickyChromeOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    pulseTodayBand(target);
    window.setTimeout(requestTodayJumpUpdate, 420);
  }

  function autoScrollTimelineOnce() {
    if (state.timelineAutoScrolled || state.mode !== "timeline") return;
    if (state.settings.timelineStart === "top") {
      state.timelineAutoScrolled = true;
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      return;
    }

    window.requestAnimationFrame(() => {
      const dayBands = [...app.querySelectorAll("[data-day-key]")];
      if (!dayBands.length || state.timelineAutoScrolled) return;

      const cutoffKey = timelineLandingCutoffKey();
      const target = dayBands.find((band) => band.dataset.dayKey >= cutoffKey) || dayBands[dayBands.length - 1];
      state.timelineAutoScrolled = true;
      const top = target.getBoundingClientRect().top + window.scrollY - stickyChromeOffset();
      window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      requestTodayJumpUpdate();
    });
  }

  function settleViewScroll() {
    const pending = state.pendingViewScroll;
    state.pendingViewScroll = null;

    if (pending && pending !== "timeline") {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      return;
    }

    autoScrollTimelineOnce();
    requestTodayJumpUpdate();
  }

  function renderTodayJumpButton() {
    if (state.mode !== "timeline") return "";

    return `
      <button aria-hidden="true" aria-label="Go to today" class="today-jump" data-today-jump data-direction="down" type="button">
        <span class="today-jump-arrow" data-today-jump-arrow aria-hidden="true">↓</span>
        <span class="today-jump-text">Today</span>
      </button>
    `;
  }

  function render() {
    state.now = new Date();
    const list = filteredMatches();
    const selected = selectedMatch();

    app.dataset.view = state.mode;
    app.dataset.theme = state.settings.theme;
    app.dataset.density = state.settings.density;
    app.dataset.videoStyle = state.settings.videoStyle;
    app.dataset.mobileMenu = state.mobileMenuOpen ? "open" : "closed";
    app.innerHTML = `
      <div class="hero-texture" aria-hidden="true"></div>
      <div class="page-chrome">
        <header class="topbar">
          <div>
            <span class="eyebrow">2026</span>
            <h1><a aria-label="World Cup Highlights" class="home-title" href="${escapeHtml(window.location.pathname)}">W<span class="title-ball" aria-hidden="true"><span class="title-ball-icon">⚽</span><span class="title-ball-letter">o</span></span>rld Cup Highlights</a></h1>
          </div>
          <button aria-label="Refresh schedule" class="phone-refresh" data-page-refresh title="Refresh schedule" type="button">
            <span aria-hidden="true">↻</span>
          </button>
        </header>
        ${renderControls()}
      </div>
      <section class="active-view" aria-live="polite">${renderActiveView(list)}</section>
      ${
        selected
          ? `<div class="floating-detail ${state.detailOpen ? "" : "is-minimized"}" data-detail-backdrop>${
              state.detailOpen ? renderDetailPanel(selected) : renderDetailHandle(selected)
            }</div>`
          : ""
      }
      ${renderCountryPicker()}
      ${renderSettingsModal()}
      ${renderFeedbackModal()}
      ${renderShareModal()}
      ${renderInstallModal()}
      ${renderStadiumMap()}
      ${renderTodayJumpButton()}
      <footer class="source-strip">
        <span>Data refreshed ${escapeHtml(data.generatedAt)}</span>
        ${data.sources
          .map((source) => `<a href="${escapeHtml(source.url)}" rel="noreferrer" target="_blank">${escapeHtml(source.label)}</a>`)
          .join("")}
      </footer>
    `;

    syncUrlState();
    syncMobileMenuDom();
    settleViewScroll();
    requestTodayJumpUpdate();
  }

  function syncMobileMenuDom() {
    app.dataset.mobileMenu = state.mobileMenuOpen ? "open" : "closed";

    const toggle = app.querySelector("[data-mobile-menu-toggle]");
    const deck = app.querySelector("#schedule-controls");
    if (toggle) {
      toggle.setAttribute("aria-expanded", state.mobileMenuOpen ? "true" : "false");
      const label = toggle.querySelector(".sr-only");
      if (label) {
        label.textContent = state.mobileMenuOpen ? "Close menu" : "Open menu";
      }
    }
    if (deck) {
      deck.classList.toggle("is-open", state.mobileMenuOpen);
    }
  }

  function setMobileMenuOpen(open) {
    if (state.mobileMenuOpen === open) return false;
    state.mobileMenuOpen = open;
    syncMobileMenuDom();
    requestTodayJumpUpdate();
    return true;
  }

  function closeMobileMenu() {
    return setMobileMenuOpen(false);
  }

  function markShareCopied() {
    if (!state.shareOpen) return;
    window.clearTimeout(shareCopyTimer);
    state.shareCopied = true;
    render();
    shareCopyTimer = window.setTimeout(() => {
      if (!state.shareOpen) return;
      state.shareCopied = false;
      render();
    }, 1800);
  }

  function fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.top = "-9999px";
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand("copy");
      markShareCopied();
    } finally {
      input.remove();
    }
  }

  function copyShareUrl() {
    const url = cleanShareUrl();
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(url).then(markShareCopied).catch(() => fallbackCopy(url));
      return;
    }
    fallbackCopy(url);
  }

  function isOutsideMobileMenu(target) {
    return (
      state.mobileMenuOpen &&
      target instanceof Element &&
      !target.closest("[data-mobile-menu-toggle], [data-country-picker-toggle], #schedule-controls")
    );
  }

  function closeMobileMenuFromOutsideScroll(event) {
    if (isOutsideMobileMenu(event.target)) {
      closeMobileMenu();
    }
  }

  document.addEventListener("click", (event) => {
    const pageRefresh = event.target.closest("[data-page-refresh]");
    if (pageRefresh) {
      reloadPage();
      return;
    }

    if (isOutsideMobileMenu(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      closeMobileMenu();
      return;
    }

    const stadiumClose = event.target.closest("[data-stadium-close]");
    if (stadiumClose) {
      state.mapVenueId = null;
      render();
      return;
    }

    const stadiumBackdrop = event.target.closest("[data-stadium-modal]");
    if (stadiumBackdrop && event.target === stadiumBackdrop) {
      state.mapVenueId = null;
      render();
      return;
    }

    const venueMapButton = event.target.closest("[data-venue-map]");
    if (venueMapButton) {
      state.mapVenueId = venueMapButton.dataset.venueMap;
      render();
      return;
    }

    const youtubeLink = event.target.closest('a[href*="youtube.com"], a[href*="youtu.be"]');
    if (youtubeLink) {
      event.preventDefault();
      event.stopPropagation();
      window.open(youtubeLink.href, "_blank", "noopener,noreferrer");
      return;
    }

    const countryPickerClose = event.target.closest("[data-country-picker-close]");
    if (countryPickerClose) {
      state.countryPickerOpen = false;
      render();
      return;
    }

    const countryBackdrop = event.target.closest("[data-country-picker-backdrop]");
    if (countryBackdrop && event.target === countryBackdrop) {
      state.countryPickerOpen = false;
      render();
      return;
    }

    const settingsClose = event.target.closest("[data-settings-close]");
    if (settingsClose) {
      state.settingsOpen = false;
      render();
      return;
    }

    const settingsBackdrop = event.target.closest("[data-settings-modal]");
    if (settingsBackdrop && event.target === settingsBackdrop) {
      state.settingsOpen = false;
      render();
      return;
    }

    const settingsOpen = event.target.closest("[data-settings-open]");
    if (settingsOpen) {
      state.settingsOpen = true;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const feedbackClose = event.target.closest("[data-feedback-close]");
    if (feedbackClose) {
      state.feedbackOpen = false;
      render();
      return;
    }

    const feedbackBackdrop = event.target.closest("[data-feedback-modal]");
    if (feedbackBackdrop && event.target === feedbackBackdrop) {
      state.feedbackOpen = false;
      render();
      return;
    }

    const feedbackOpen = event.target.closest("[data-feedback-open]");
    if (feedbackOpen) {
      state.feedbackOpen = true;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const shareClose = event.target.closest("[data-share-close]");
    if (shareClose) {
      state.shareOpen = false;
      state.shareCopied = false;
      render();
      return;
    }

    const shareBackdrop = event.target.closest("[data-share-modal]");
    if (shareBackdrop && event.target === shareBackdrop) {
      state.shareOpen = false;
      state.shareCopied = false;
      render();
      return;
    }

    const shareOpen = event.target.closest("[data-share-open]");
    if (shareOpen) {
      state.shareOpen = true;
      state.shareCopied = false;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const shareCopy = event.target.closest("[data-share-copy]");
    if (shareCopy) {
      copyShareUrl();
      return;
    }

    const installClose = event.target.closest("[data-install-close]");
    if (installClose) {
      state.installOpen = false;
      render();
      return;
    }

    const installBackdrop = event.target.closest("[data-install-modal]");
    if (installBackdrop && event.target === installBackdrop) {
      state.installOpen = false;
      render();
      return;
    }

    const installOpen = event.target.closest("[data-install-open]");
    if (installOpen) {
      state.installOpen = true;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const settingsReset = event.target.closest("[data-settings-reset]");
    if (settingsReset) {
      state.settings = { ...defaultSettings };
      if (!state.settings.showBracketViewOption && state.mode === "bracket") {
        state.mode = "timeline";
      }
      state.timelineAutoScrolled = false;
      state.pendingViewScroll = state.mode;
      saveSettings();
      render();
      return;
    }

    const settingButton = event.target.closest("[data-setting-key]");
    if (settingButton) {
      const key = settingButton.dataset.settingKey;
      const value = settingButton.dataset.settingValue;
      if (key && value && Object.hasOwn(defaultSettings, key)) {
        state.settings = { ...state.settings, [key]: value };
        if (key === "timelineStart") {
          state.timelineAutoScrolled = false;
          state.pendingViewScroll = state.mode;
        }
        if (key === "scoreStartupMode") {
          const nextSpoilers = readSpoilerState(value);
          state.showAllScores = nextSpoilers.showAllScores;
          state.scoreCutoffEnabled = nextSpoilers.scoreCutoffEnabled;
          state.scoreCutoffDate = nextSpoilers.scoreCutoffDate;
          state.revealedScores = nextSpoilers.revealedScores;
          state.hiddenScores = nextSpoilers.hiddenScores;
          state.revealedGroups = nextSpoilers.revealedGroups;
          state.hiddenGroups = nextSpoilers.hiddenGroups;
          state.hiddenScoresStored = nextSpoilers.hiddenScoresStored;
          migrateScoreVisibilityState();
        }
        saveSettings();
        render();
      }
      return;
    }

    const countryPickerToggle = event.target.closest("[data-country-picker-toggle]");
    if (countryPickerToggle) {
      state.countryPickerOpen = true;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const mobileMenuToggle = event.target.closest("[data-mobile-menu-toggle]");
    if (mobileMenuToggle) {
      setMobileMenuOpen(!state.mobileMenuOpen);
      return;
    }

    const countryAll = event.target.closest("[data-country-all]");
    if (countryAll) {
      state.countryMode = state.countryMode === "all" ? "custom" : "all";
      state.selectedCountries.clear();
      render();
      return;
    }

    const scoreDateOpen = event.target.closest("[data-score-date-open]");
    if (scoreDateOpen && !event.target.matches('[data-control="score-cutoff-enabled"]')) {
      if (!state.scoreCutoffEnabled) {
        state.scoreCutoffEnabled = true;
        revealScoresThroughCutoff();
        const checkbox = scoreDateOpen.querySelector('[data-control="score-cutoff-enabled"]');
        if (checkbox) {
          checkbox.checked = true;
        }
        saveSpoilerState();
      }

      const input = scoreDateOpen.querySelector('[data-control="score-cutoff-date"]');
      if (input) {
        input.focus();
        try {
          if (typeof input.showPicker === "function") {
            input.showPicker();
          }
        } catch {
          // Some browsers open the picker from the native input click first.
        }
      }
      return;
    }

    const countryClear = event.target.closest("[data-country-clear]");
    if (countryClear) {
      state.countryMode = "custom";
      state.selectedCountries.clear();
      render();
      return;
    }

    const countryOption = event.target.closest("[data-country-option]");
    if (countryOption) {
      const country = countryOption.dataset.countryOption;
      if (state.countryMode === "all") {
        state.countryMode = "custom";
        state.selectedCountries = new Set(allCountries().filter((team) => team !== country));
      } else if (state.selectedCountries.has(country)) {
        state.selectedCountries.delete(country);
      } else {
        state.selectedCountries.add(country);
      }
      if (state.selectedCountries.size === allCountries().length) {
        state.countryMode = "all";
        state.selectedCountries.clear();
      }
      render();
      return;
    }

    if (event.target.closest("a")) {
      return;
    }

    const detailClose = event.target.closest("[data-detail-close]");
    if (detailClose) {
      state.detailOpen = false;
      render();
      return;
    }

    const detailOpen = event.target.closest("[data-detail-open]");
    if (detailOpen) {
      state.detailOpen = true;
      render();
      return;
    }

    const detailBackdrop = event.target.closest("[data-detail-backdrop]");
    if (detailBackdrop && event.target === detailBackdrop) {
      state.detailOpen = false;
      render();
      return;
    }

    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) {
      const nextMode = modeButton.dataset.mode;
      if (nextMode !== state.mode) {
        state.timelineAutoScrolled = false;
        state.pendingViewScroll = nextMode;
      }
      state.mode = nextMode;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const todayJump = event.target.closest("[data-today-jump]");
    if (todayJump) {
      scrollToToday();
      return;
    }

    const showAllButton = event.target.closest("[data-show-all-scores]");
    if (showAllButton) {
      const allVisible = allScoredMatchesVisible();
      state.showAllScores = !allVisible;
      state.revealedGroups.clear();
      state.hiddenGroups.clear();
      if (allVisible) {
        state.scoreCutoffEnabled = false;
        hideAllScoredMatches();
      } else {
        showAllScoredMatches();
      }
      saveSpoilerState();
      render();
      return;
    }

    const groupReveal = event.target.closest("[data-group-reveal]");
    if (groupReveal) {
      const group = groupReveal.dataset.groupReveal;
      const revealed = isGroupRevealed(group);
      if (revealed) {
        hideGroupScores(group);
      } else {
        showGroupScores(group);
      }
      state.revealedGroups.delete(group);
      state.hiddenGroups.delete(group);
      saveSpoilerState();
      render();
      return;
    }

    const scoreButton = event.target.closest("[data-score-id]");
    if (scoreButton) {
      const matchId = Number(scoreButton.dataset.scoreId);
      const match = matches.find((item) => item.id === matchId);
      const visible = match ? isScoreVisible(match) : state.revealedScores.has(matchId);
      if (visible) {
        state.revealedScores.delete(matchId);
        state.hiddenScores.add(matchId);
      } else {
        state.hiddenScores.delete(matchId);
        state.revealedScores.add(matchId);
      }
      saveSpoilerState();
      render();
      return;
    }

    const matchButton = event.target.closest("[data-match-id]");
    if (matchButton) {
      state.selectedId = Number(matchButton.dataset.matchId);
      state.detailOpen = true;
      render();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.dataset.control === "score-cutoff-enabled") {
      state.scoreCutoffEnabled = event.target.checked;
      if (state.scoreCutoffEnabled) {
        revealScoresThroughCutoff();
      }
      saveSpoilerState();
      render();
    }
    if (event.target.dataset.control === "score-cutoff-date") {
      state.scoreCutoffDate = event.target.value;
      state.scoreCutoffEnabled = Boolean(event.target.value);
      if (state.scoreCutoffEnabled) {
        revealScoresThroughCutoff();
      }
      saveSpoilerState();
      render();
    }
    if (event.target.dataset.control === "show-bracket-view") {
      state.settings = { ...state.settings, showBracketViewOption: event.target.checked };
      if (!state.settings.showBracketViewOption && state.mode === "bracket") {
        state.mode = "timeline";
        state.timelineAutoScrolled = false;
        state.pendingViewScroll = "timeline";
      }
      saveSettings();
      render();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.mapVenueId) {
      state.mapVenueId = null;
      render();
    }
    if (event.key === "Escape" && state.countryPickerOpen) {
      state.countryPickerOpen = false;
      render();
    }
    if (event.key === "Escape" && state.settingsOpen) {
      state.settingsOpen = false;
      render();
    }
    if (event.key === "Escape" && state.feedbackOpen) {
      state.feedbackOpen = false;
      render();
    }
    if (event.key === "Escape" && state.shareOpen) {
      state.shareOpen = false;
      state.shareCopied = false;
      render();
    }
    if (event.key === "Escape" && state.installOpen) {
      state.installOpen = false;
      render();
    }
    if (event.key === "Escape" && state.mobileMenuOpen) {
      closeMobileMenu();
    }
  });

  function handleWindowScroll() {
    requestTodayJumpUpdate();
  }

  window.setInterval(render, 60_000);
  document.addEventListener("wheel", closeMobileMenuFromOutsideScroll, { passive: true });
  document.addEventListener("touchmove", closeMobileMenuFromOutsideScroll, { passive: true });
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  window.addEventListener("resize", requestTodayJumpUpdate);
  window.addEventListener("popstate", () => {
    applyUrlState();
    render();
  });
  applyUrlState();
  if (!autoReloadStaleHostedData()) {
    render();
  }
})();
