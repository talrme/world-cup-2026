(() => {
  const data = window.WORLD_CUP_DATA;
  const playerStatsData = window.WORLD_CUP_PLAYER_STATS || null;
  const aiInsightsData = window.WORLD_CUP_AI_INSIGHTS || { matches: {}, groups: {}, players: {} };
  const matchOddsData = window.WORLD_CUP_MATCH_ODDS || { matches: {} };
  const app = document.getElementById("app");

  if (!data || !app) {
    return;
  }

  const modes = [
    ["timeline", "Schedule"],
    ["bracket", "Bracket"],
    ["players", "Players"],
    ["groups", "Groups"],
    ["constellation", "Tiles"],
  ];
  const modeIds = modes.map(([id]) => id);
  const legacyDefaultVisibleViewIds = ["timeline", "groups", "players"];
  const defaultVisibleViewIds = ["timeline", "bracket", "players", "groups"];
  const settingsKey = "worldCup2026Settings";
  const spoilerStateKey = "worldCup2026Spoilers";
  const staleDataReloadKey = "worldCup2026LastStaleReloadAt";
  const refreshToTodayKey = "worldCup2026RefreshToToday";
  const staleDataReloadMs = 60 * 60 * 1000;
  const feedbackFormUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?usp=sharing&ouid=104982845318929976228";
  const feedbackEmbedUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?embedded=true";

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }
  const defaultSettings = {
    theme: "match",
    density: "comfortable",
    videoStyle: "compact",
    timelineStart: "today",
    scoreStartupMode: "previous",
    visibleViews: [...defaultVisibleViewIds],
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
      const visibleViews = Array.isArray(stored.visibleViews)
        ? stored.visibleViews.map(normalizeViewId).filter((id) => modeIds.includes(id))
        : [];

      if (!visibleViews.length) {
        visibleViews.push(...defaultVisibleViewIds);
        if (stored.showBracketViewOption) visibleViews.push("bracket");
      } else if (
        legacyDefaultVisibleViewIds.every((id) => visibleViews.includes(id)) &&
        visibleViews.every((id) => legacyDefaultVisibleViewIds.includes(id))
      ) {
        visibleViews.push("bracket");
      }

      return { ...defaultSettings, ...stored, visibleViews: [...new Set(visibleViews)] };
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

  const leaderboardFields = [
    { id: "points", label: "Points", short: "Pts", priority: "critical" },
    { id: "goals", label: "Goals", short: "G", priority: "critical" },
    { id: "assists", label: "Assists", short: "A", priority: "critical" },
    { id: "matches", label: "Games played", short: "GP", priority: "critical" },
    { id: "minutes", label: "Minutes", short: "Min", priority: "critical" },
    { id: "goalsPer90", label: "Goals per 90", short: "G/90", priority: "subtle" },
    { id: "pointsPer90", label: "Points per 90", short: "Pts/90", priority: "subtle" },
  ];
  const guardianGoldenBootUrl = "https://mobile.guardianapis.com/sport/football/competitions/700/golden-boot";
  const leaderboardFallbackPlayers = [
    { rank: 1, player: "Lionel Messi", team: "Argentina", position: "FW", goals: 3, assists: 0, matches: 1, minutes: 83 },
    { rank: 2, player: "Jonathan David", team: "Canada", position: "FW", goals: 3, assists: 0, matches: 2, minutes: 170 },
    { rank: 3, player: "Johan Manzambi", team: "Switzerland", position: "MID", goals: 2, assists: 0, matches: 2, minutes: 59 },
    { rank: 4, player: "Folarin Balogun", team: "United States", position: "FW", goals: 2, assists: 0, matches: 1, minutes: 77 },
    { rank: 5, player: "Kai Havertz", team: "Germany", position: "FW", goals: 2, assists: 0, matches: 1, minutes: 100 },
    { rank: 6, player: "Yasin Ayari", team: "Sweden", position: "MID", goals: 2, assists: 0, matches: 1, minutes: 101 },
    { rank: 6, player: "Elijah Just", team: "New Zealand", position: "MID", goals: 2, assists: 0, matches: 1, minutes: 101 },
    { rank: 7, player: "Harry Kane", team: "England", position: "FW", goals: 2, assists: 0, matches: 1, minutes: 102 },
    { rank: 8, player: "Erling Braut Haaland", team: "Norway", position: "FW", goals: 2, assists: 0, matches: 1, minutes: 103 },
    { rank: 9, player: "Kylian Mbappe", team: "France", position: "FW", goals: 2, assists: 0, matches: 1, minutes: 106 },
    { rank: 10, player: "Cyle Larin", team: "Canada", position: "FW", goals: 2, assists: 0, matches: 2, minutes: 126 },
    { rank: 11, player: "Deniz Undav", team: "Germany", position: "FW", goals: 1, assists: 2, matches: 1, minutes: 31 },
    { rank: 12, player: "Nathan-Dylan Saliba", team: "Canada", position: "MID", goals: 1, assists: 1, matches: 2, minutes: 43 },
    { rank: 13, player: "Nathaniel Brown", team: "Germany", position: "DEF", goals: 1, assists: 1, matches: 1, minutes: 78 },
    { rank: 14, player: "Alexander Isak", team: "Sweden", position: "FW", goals: 1, assists: 1, matches: 1, minutes: 94 },
    { rank: 15, player: "Luis Diaz", team: "Colombia", position: "FW", goals: 1, assists: 1, matches: 1, minutes: 98 },
    { rank: 16, player: "Viktor Gyokeres", team: "Sweden", position: "FW", goals: 1, assists: 1, matches: 1, minutes: 101 },
    { rank: 16, player: "Ramin Rezaeian", team: "Iran", position: "DEF", goals: 1, assists: 1, matches: 1, minutes: 101 },
    { rank: 17, player: "Ruben Vargas", team: "Switzerland", position: "MID", goals: 1, assists: 1, matches: 2, minutes: 111 },
    { rank: 18, player: "In-Beom Hwang", team: "South Korea", position: "MID", goals: 1, assists: 1, matches: 2, minutes: 187 },
  ];
  const leaderboardSnapshotPlayers = normalizeLeaderboardSnapshot(playerStatsData?.players || leaderboardFallbackPlayers);
  let leaderboardPlayers = [...leaderboardSnapshotPlayers];

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
    statsInfoOpen: false,
    playerDetailsKey: null,
    groupDetailsKey: null,
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
    bracketStartStage: "Round of 32",
    leaderboardSort: "points",
    leaderboardStatus: "snapshot",
    leaderboardLoadedAt: null,
    mapVenueId: null,
    timelineAutoScrolled: false,
    now: new Date(),
  };

  const matches = [...data.matches].sort((a, b) => {
    return kickoffDate(a).getTime() - kickoffDate(b).getTime() || a.id - b.id;
  });
  const venues = Array.isArray(data.venues) ? data.venues : [];
  let todayJumpFrame = null;
  let bracketLineFrame = null;
  let todayJumpPulseTimer = null;
  let shareCopyTimer = null;
  let activeInsightKey = null;
  const bracketStages = [
    { stage: "Round of 32", label: "Round of 32", shortLabel: "R32", className: "r32" },
    { stage: "Round of 16", label: "Round of 16", shortLabel: "R16", className: "r16" },
    { stage: "Quarterfinals", label: "Quarterfinals", shortLabel: "Quarters", className: "qf" },
    { stage: "Semifinals", label: "Semifinals", shortLabel: "Semis", className: "sf" },
    { stage: "Finals", label: "Finals", shortLabel: "Finals", className: "finals" },
  ];

  function normalizeBracketStageValue(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function bracketStageParam(stageName) {
    return bracketStages.find((stage) => stage.stage === stageName)?.className || "r32";
  }

  function bracketStageFromParam(value) {
    const normalized = normalizeBracketStageValue(value);
    if (!normalized) return null;
    const stage = bracketStages.find((item) => {
      return [item.stage, item.label, item.shortLabel, item.className].some(
        (candidate) => normalizeBracketStageValue(candidate) === normalized,
      );
    });
    return stage?.stage || null;
  }

  function stageMatchNames(stage) {
    return stage === "Finals" ? ["Third Place", "Final"] : [stage];
  }

  function defaultBracketStartStage(now = state.now) {
    const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
    const validNow = Number.isFinite(nowTime) ? nowTime : Date.now();
    const startedStages = bracketStages
      .map((stage) => {
        const firstKickoff = matches
          .filter((match) => stageMatchNames(stage.stage).includes(match.stage))
          .map((match) => kickoffDate(match).getTime())
          .filter(Number.isFinite)
          .sort((a, b) => a - b)[0];
        return { stage: stage.stage, firstKickoff };
      })
      .filter((item) => Number.isFinite(item.firstKickoff) && item.firstKickoff <= validNow)
      .sort((a, b) => a.firstKickoff - b.firstKickoff);

    return startedStages[startedStages.length - 1]?.stage || bracketStages[0].stage;
  }

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

  function formatDataTimestamp(value) {
    if (!value) return "unknown";

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
        year: "numeric",
      });
    }

    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;

    const date = new Date(parsed);
    const hasTime = /T\d{2}:\d{2}/.test(value);
    if (!hasTime) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      year: "numeric",
    });
  }

  function dataTimestampMs(value) {
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return Date.UTC(year, month - 1, day);
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function latestDataTimestamp() {
    const candidates = [data.generatedAt, data.scheduleUpdatedAt, data.videosUpdatedAt, playerStatsData?.generatedAt, aiInsightsData?.generatedAt]
      .map((value) => ({ value, timestamp: dataTimestampMs(value) }))
      .filter((candidate) => candidate.value && candidate.timestamp !== null)
      .sort((a, b) => b.timestamp - a.timestamp);

    return candidates[0]?.value || data.generatedAt;
  }

  function aiInsightKey(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function playerInsightKey(player) {
    return aiInsightKey(`${player.player}|${player.team}`);
  }

  function insightFor(kind, id) {
    const buckets = {
      match: aiInsightsData?.matches || {},
      matchPreview: aiInsightsData?.matchPreviews || {},
      group: aiInsightsData?.groups || {},
      player: aiInsightsData?.players || {},
    };
    return buckets[kind]?.[String(id)] || null;
  }

  function matchPreviewFor(match) {
    return insightFor("matchPreview", match.id);
  }

  function matchRecapFor(match) {
    const status = String(match.status || "").toLowerCase();
    if (!hasScore(match) && !["completed", "final", "live", "in_progress", "in-progress"].includes(status)) return null;
    return insightFor("match", match.id);
  }

  function renderAiInsight(kind, id, label = "Insights", options = {}) {
    const insight = insightFor(kind, id);
    if (!insight?.headline || !insight?.summary) return "";
    const key = `${kind}:${String(id)}`;
    const allowActiveOpen = options.allowActiveOpen !== false;
    const open = options.open || (allowActiveOpen && activeInsightKey === key) ? " open" : "";
    const actionClosed = options.actionClosed || "Read insight";
    const actionOpen = options.actionOpen || "Hide insight";
    const skipIntro = options.skipIntro === true;

    const bullets = Array.isArray(insight.bullets)
      ? insight.bullets
          .filter(Boolean)
          .slice(0, 6)
          .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
          .join("")
      : "";
    const story = Array.isArray(insight.story)
      ? insight.story
          .filter(Boolean)
          .slice(0, 8)
          .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
          .join("")
      : "";
    const sections = Array.isArray(insight.sections)
      ? insight.sections
          .filter((section) => section && section.title && section.body)
          .slice(0, 5)
          .map(
            (section) => `
              <article class="ai-insight-section">
                <h3>${escapeHtml(section.title)}</h3>
                <p>${escapeHtml(section.body)}</p>
              </article>
            `,
          )
          .join("")
      : "";
    const updated = insight.updatedAt ? formatDataTimestamp(insight.updatedAt) : "";
    const hasMainBody = Boolean(story || bullets || sections);
    const showIntro = !skipIntro || !hasMainBody;

    return `
      <details class="ai-insight ai-insight-${escapeHtml(kind)}"${open}>
        <summary>
          <span class="ai-insight-label">${escapeHtml(label)}</span>
          <span class="ai-insight-summary-meta">
            <b class="ai-insight-action"><span class="ai-insight-action-closed">${escapeHtml(actionClosed)}</span><span class="ai-insight-action-open">${escapeHtml(actionOpen)}</span></b>
            <i class="ai-insight-chevron" aria-hidden="true"></i>
          </span>
        </summary>
        <div>
          ${showIntro ? `<strong>${escapeHtml(insight.headline)}</strong>` : ""}
          ${showIntro ? `<p>${escapeHtml(insight.summary)}</p>` : ""}
          ${story ? `<div class="ai-insight-story">${story}</div>` : ""}
          ${bullets && !story ? `<ul>${bullets}</ul>` : ""}
          ${sections && !story ? `<div class="ai-insight-sections">${sections}</div>` : ""}
          ${updated ? `<footer class="ai-insight-updated">Updated ${escapeHtml(updated)}</footer>` : ""}
        </div>
      </details>
    `;
  }

  function renderRecapPendingNote() {
    return `
      <div class="ai-insight ai-insight-note">
        <div class="ai-insight-note-header">
          <span class="ai-insight-label">Match Recap</span>
          <span class="ai-insight-note-pill">Not ready yet</span>
        </div>
        <p>The spoiler recap should appear after the next insights refresh.</p>
      </div>
    `;
  }

  function renderInsightsButton(match, compact = false) {
    if (matchHasHiddenDependentTeam(match)) return "";
    if (!matchPreviewFor(match) && !matchRecapFor(match)) return "";
    return `
      <button class="${compact ? "tile-insights-button" : "insights-button"}" data-match-insights="${match.id}" type="button" title="Open match insights">
        <span class="insights-mark" aria-hidden="true"></span>
        <em>Insights</em>
      </button>
    `;
  }

  function renderGroupInsightsButton(group) {
    if (!insightFor("group", group)) return "";
    return `
      <button class="group-insights-button insights-button" data-group-insights="${escapeHtml(group)}" type="button" title="Open group insights">
        <span class="insights-mark" aria-hidden="true"></span>
        <em>Insights</em>
      </button>
    `;
  }

  function isRealTeam(team) {
    return !/^(Winner|Runner-up|Best|Loser|3rd|TBD)\b/i.test(team);
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

  function selectedCountryList() {
    if (selectedAllCountries()) return [];
    return allCountries().filter((country) => state.selectedCountries.has(country));
  }

  function countryFilterTitle(countries = selectedCountryList()) {
    if (state.countryMode === "all" || selectedAllCountries()) return "All countries";
    if (!countries.length) return "No countries selected";
    return countries.join(", ");
  }

  function renderCountryFlagStrip(countries = selectedCountryList(), limit = 5) {
    if (!countries.length) return "";

    const visible = countries.slice(0, limit);
    const flags = visible
      .map((country) => {
        const flag = flagForTeam(country);
        if (!flag) return "";
        return `<span class="country-filter-flag" title="${escapeHtml(country)}">${flag}</span>`;
      })
      .join("");
    const overflow = countries.length - visible.length;
    const overflowLabel = `${overflow} more ${overflow === 1 ? "country" : "countries"}`;

    return `
      <span class="country-filter-flags" aria-hidden="true">
        ${flags}
        ${overflow > 0 ? `<span class="country-filter-more" title="${escapeHtml(countryFilterTitle(countries))}">+${overflow}</span>` : ""}
      </span>
      ${overflow > 0 ? `<span class="sr-only">${escapeHtml(overflowLabel)}</span>` : ""}
    `;
  }

  function renderCountryFilterContent(options = {}) {
    const countries = selectedCountryList();
    const limit = options.compact ? 3 : 5;
    return `
      <span class="country-filter-main">
        <strong class="country-filter-text">${escapeHtml(countryFilterLabel())}</strong>
        ${renderCountryFlagStrip(countries, limit)}
      </span>
    `;
  }

  function currentModeLabel() {
    return modes.find(([id]) => id === state.mode)?.[1] || "Schedule";
  }

  function normalizeViewId(id) {
    return id === "leaderboard" ? "players" : id;
  }

  function modeIsVisible(id) {
    const visibleViews = Array.isArray(state.settings.visibleViews)
      ? state.settings.visibleViews.map(normalizeViewId)
      : defaultVisibleViewIds;
    return visibleViews.includes(id);
  }

  function visibleModes() {
    return modes.filter(([id]) => modeIsVisible(id));
  }

  function firstVisibleMode() {
    return visibleModes()[0]?.[0] || "timeline";
  }

  function normalizedVisibleViews() {
    const views = Array.isArray(state.settings.visibleViews)
      ? state.settings.visibleViews.map(normalizeViewId).filter((id) => modeIds.includes(id))
      : [...defaultVisibleViewIds];
    return [...new Set(views.length ? views : defaultVisibleViewIds)];
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
    const view = normalizeViewId(params.get("view"));
    const bracketStage = bracketStageFromParam(params.get("round"));
    const countries = params.getAll("country");
    const countrySet = new Set(allCountries());

    state.mode = "timeline";
    state.countryMode = "all";
    state.selectedCountries = new Set();
    state.bracketStartStage = bracketStage || defaultBracketStartStage();

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
    if (state.mode === "bracket" && state.bracketStartStage !== defaultBracketStartStage()) {
      params.set("round", bracketStageParam(state.bracketStartStage));
    }
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

  function requestTodayAfterReload() {
    try {
      window.sessionStorage.setItem(refreshToTodayKey, "true");
    } catch {
      // Session storage is optional; normal Today startup still applies.
    }
  }

  function takeTodayAfterReloadRequest() {
    try {
      const requested = window.sessionStorage.getItem(refreshToTodayKey) === "true";
      if (requested) {
        window.sessionStorage.removeItem(refreshToTodayKey);
      }
      return requested;
    } catch {
      return false;
    }
  }

  function reloadPage(options = {}) {
    noteRefreshAttempt();
    if (options.today) {
      requestTodayAfterReload();
    }
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
    const placeholderClass = isRealTeam(team) ? "" : " is-team-placeholder";
    const flag = flagForTeam(team);
    const flagHtml = flag ? `<span class="team-flag" aria-hidden="true">${escapeHtml(flag)}</span>` : "";
    return `<span class="${escapeHtml(`${className}${placeholderClass}`)}">${flagHtml}<span class="team-label">${escapeHtml(team)}</span></span>`;
  }

  function sourceForDisplaySide(match, side, context = "event") {
    return context === "bracket"
      ? match[`${side}Source`]
      : match[`${side}RevealSource`] || match[`${side}Source`];
  }

  function bracketSlotTeam(match, side) {
    return match[`bracket${side[0].toUpperCase()}${side.slice(1)}Team`] || "";
  }

  function visibleTeamForMatch(match, side, context = "event") {
    const source = sourceForDisplaySide(match, side, context);
    if (source && !bracketSourceVisible(source)) {
      return shouldUseBracketTbd(match, source) ? "TBD" : source;
    }

    if (context === "bracket") {
      const slotTeam = bracketSlotTeam(match, side);
      if (slotTeam) return slotTeam;
    }

    const team = match[side];
    return shouldUseBracketTbd(match, team) ? "TBD" : team;
  }

  function matchHasHiddenDependentTeam(match, context = "event") {
    return ["home", "away"].some((side) => {
      const source = sourceForDisplaySide(match, side, context);
      return Boolean(source && /^(Winner|Loser) Match \d+$/i.test(String(source)) && !bracketSourceVisible(source));
    });
  }

  function teamRank(team) {
    return teamFifaRanks[team] || null;
  }

  function renderRankingRow(match) {
    const homeTeam = visibleTeamForMatch(match, "home");
    const awayTeam = visibleTeamForMatch(match, "away");
    if (!isRealTeam(homeTeam) || !isRealTeam(awayTeam)) {
      return "";
    }

    const homeRank = teamRank(homeTeam);
    const awayRank = teamRank(awayTeam);

    if (!homeRank || !awayRank) {
      return "";
    }

    const rankings = [
      { team: homeTeam, rank: homeRank, order: 0 },
      { team: awayTeam, rank: awayRank, order: 1 },
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

  function oddsForMatch(match) {
    return matchOddsData?.matches?.[String(match.id)] || null;
  }

  function americanOddsLabel(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "";
    return numeric > 0 ? `+${numeric}` : String(numeric);
  }

  function americanToRawImpliedProbability(value) {
    const odds = Number(value);
    if (!Number.isFinite(odds) || odds === 0) return null;
    return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
  }

  function percentLabel(value, digits = 0) {
    if (!Number.isFinite(value)) return "";
    return `${(value * 100).toFixed(digits)}%`;
  }

  function oddsProbabilities(odds) {
    const outcomes = Array.isArray(odds?.outcomes) ? odds.outcomes : [];
    const raw = outcomes
      .map((outcome) => ({
        ...outcome,
        rawProbability: americanToRawImpliedProbability(outcome.american),
      }))
      .filter((outcome) => outcome.label && Number.isFinite(outcome.rawProbability));
    const overround = raw.reduce((sum, outcome) => sum + outcome.rawProbability, 0);
    if (!raw.length || !overround) return null;
    return {
      overround,
      vig: Math.max(0, overround - 1),
      outcomes: raw.map((outcome) => ({
        ...outcome,
        fairProbability: outcome.rawProbability / overround,
      })),
    };
  }

  function renderOddsProbability(match) {
    if (matchHasHiddenDependentTeam(match)) return "";

    const odds = oddsForMatch(match);
    const probabilities = oddsProbabilities(odds);
    if (!odds || !probabilities) return "";

    const teamOutcomes = probabilities.outcomes.filter((outcome) => outcome.key !== "draw");
    const drawOutcome = probabilities.outcomes.find((outcome) => outcome.key === "draw");
    const favorite = [...teamOutcomes].sort((a, b) => b.fairProbability - a.fairProbability)[0];
    const sourceLabel = odds.sourceLabel || odds.book || matchOddsData.source?.label || "Odds source";
    const sourceUrl = odds.sourceUrl || matchOddsData.source?.url || "";
    const sourceMarkup = sourceUrl
      ? `<a href="${escapeHtml(sourceUrl)}" rel="noreferrer" target="_blank">${escapeHtml(sourceLabel)}</a>`
      : escapeHtml(sourceLabel);
    const asOf = odds.asOf ? formatDataTimestamp(odds.asOf) : "";
    const mathRows = probabilities.outcomes
      .map(
        (outcome) => `
          <tr>
            <th scope="row">${escapeHtml(outcome.label)}</th>
            <td>${escapeHtml(americanOddsLabel(outcome.american))}</td>
            <td>${escapeHtml(percentLabel(outcome.rawProbability, 1))}</td>
            <td>${escapeHtml(percentLabel(outcome.fairProbability, 1))}</td>
          </tr>
        `,
      )
      .join("");

    return `
      <section class="odds-card" aria-label="Betting odds implied probabilities">
        <div class="odds-card-header">
          <span>
            <b>Win chance</b>
            <small>${escapeHtml(odds.market || "Moneyline")}</small>
          </span>
          ${favorite ? `<strong>${escapeHtml(favorite.label)} ${escapeHtml(percentLabel(favorite.fairProbability))}</strong>` : ""}
        </div>
        <div class="odds-probabilities">
          ${teamOutcomes
            .map(
              (outcome) => `
                <span class="odds-probability">
                  <em>${escapeHtml(outcome.label)}</em>
                  <b>${escapeHtml(percentLabel(outcome.fairProbability))}</b>
                </span>
              `,
            )
            .join("")}
          ${
            drawOutcome
              ? `<span class="odds-probability odds-probability-draw"><em>Draw</em><b>${escapeHtml(percentLabel(drawOutcome.fairProbability))}</b></span>`
              : ""
          }
        </div>
        <details class="odds-math">
          <summary>Show math</summary>
          <p>
            American odds become raw implied probabilities, then each raw probability is divided by the total market probability to remove the sportsbook margin.
          </p>
          <div class="odds-math-grid">
            <span>Raw market total</span>
            <b>${escapeHtml(percentLabel(probabilities.overround, 1))}</b>
            <span>Estimated margin</span>
            <b>${escapeHtml(percentLabel(probabilities.vig, 1))}</b>
          </div>
          <table>
            <thead>
              <tr><th>Outcome</th><th>Odds</th><th>Raw</th><th>No-vig</th></tr>
            </thead>
            <tbody>${mathRows}</tbody>
          </table>
          <p class="odds-source">${sourceMarkup}${asOf ? ` as of ${escapeHtml(asOf)}` : ""}. POC only, not betting advice.</p>
        </details>
      </section>
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
    const homeTeam = visibleTeamForMatch(match, "home");
    const awayTeam = visibleTeamForMatch(match, "away");
    const query = isRealTeam(homeTeam) && isRealTeam(awayTeam)
      ? `Fox Sports ${homeTeam} vs ${awayTeam} Highlights 2026 FIFA World Cup`
      : "Fox Sports 2026 FIFA World Cup Highlights";
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  function canSearchVideo(match) {
    const current = matchState(match);
    return current === "completed" || current === "needs-result" || current === "live";
  }

  function renderVideoLink(kind, video) {
    const duration = videoDuration(kind, video);
    const visibleLabel = "Highlights";
    const durationLabel = duration ? `${duration} ` : "";
    const durationMarkup = duration ? `<small>${escapeHtml(duration)}</small>` : "";
    return `<a aria-label="Open ${escapeHtml(durationLabel)}${escapeHtml(visibleLabel)} on YouTube" class="video-link video-link-${kind}" href="${escapeHtml(video.url)}" rel="noreferrer" target="_blank" title="Open Highlights on YouTube"><span class="yt-mark" aria-hidden="true"></span>${durationMarkup}<span class="video-link-label">${escapeHtml(visibleLabel)}</span></a>`;
  }

  function videoDurationChip(kind, video) {
    const match = videoDuration(kind, video).match(/\d+/);
    return match ? `${match[0]} min` : "";
  }

  function renderTileVideoLink(kind, video) {
    const chip = videoDurationChip(kind, video);
    const label = "Highlights";
    const chipMarkup = chip ? `<span>${escapeHtml(chip)}</span>` : "";
    return `<a aria-label="Open ${escapeHtml(label)} on YouTube" class="tile-video-link tile-video-link-${kind}" href="${escapeHtml(video.url)}" rel="noreferrer" target="_blank" title="Open ${escapeHtml(label)} on YouTube"><span class="yt-mark" aria-hidden="true"></span>${chipMarkup}</a>`;
  }

  function compactVideoLinksFor(match) {
    if (matchHasHiddenDependentTeam(match)) {
      return [];
    }

    const links = [];
    const short = match.videos?.short || null;
    const extended = match.videos?.extended || null;
    if (short?.url) links.push(renderTileVideoLink("short", short));
    if (extended?.url) links.push(renderTileVideoLink("extended", extended));
    return links;
  }

  function renderTileVideoLinks(match) {
    const links = compactVideoLinksFor(match);
    const insights = renderInsightsButton(match, true);
    if (insights) links.push(insights);
    return links.length ? `<div class="tile-video-links">${links.join("")}</div>` : "";
  }

  function renderBracketVideoLinks(match) {
    const links = compactVideoLinksFor(match);
    const insights = renderInsightsButton(match, true);
    if (insights) links.push(insights);
    return links.length ? `<div class="tile-video-links bracket-video-links">${links.join("")}</div>` : "";
  }

  function renderVideoSearchLink(match) {
    const visibleLabel = state.settings.videoStyle === "full" ? "YouTube Search" : "Search";
    return `<a aria-label="Search YouTube" class="video-link video-link-search" href="${escapeHtml(youtubeSearchUrl(match))}" rel="noreferrer" target="_blank" title="Search YouTube"><span class="yt-mark" aria-hidden="true"></span><small>YouTube</small><span class="video-link-label">${escapeHtml(visibleLabel)}</span></a>`;
  }

  function renderInlineVideoLinks(match) {
    const links = [];
    if (matchHasHiddenDependentTeam(match)) {
      return "";
    }

    const extended = match.videos?.extended || null;
    const short = match.videos?.short || null;

    if (short?.url) {
      links.push(renderVideoLink("short", short));
    }
    if (extended?.url) {
      links.push(renderVideoLink("extended", extended));
    }

    if (!links.length && canSearchVideo(match)) {
      links.push(renderVideoSearchLink(match));
    }

    const insights = renderInsightsButton(match);
    if (insights) links.push(insights);

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
      const homeTeam = visibleTeamForMatch(match, "home");
      const awayTeam = visibleTeamForMatch(match, "away");
      const countryMatches =
        state.countryMode === "all" ||
        state.selectedCountries.has(homeTeam) ||
        state.selectedCountries.has(awayTeam);

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
    if (matchHasHiddenDependentTeam(match)) {
      return "";
    }

    const extended = match.videos?.extended || null;
    const short = match.videos?.short || null;
    const actions = [];

    if (state.mode === "bracket" && (short?.url || extended?.url)) {
      return `<div class="video-actions video-actions-compact">${compactVideoLinksFor(match).join("")}</div>`;
    }

    if (short?.url) {
      actions.push(renderVideoLink("short", short));
    }

    if (extended?.url) {
      actions.push(renderVideoLink("extended", extended));
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
    const homeTeam = visibleTeamForMatch(match, "home");
    const awayTeam = visibleTeamForMatch(match, "away");
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
            ${renderTeamName(homeTeam, `team-name ${teamResultClass(match, "home")}`)}
            ${renderScorePill(match)}
            ${renderTeamName(awayTeam, `team-name team-away ${teamResultClass(match, "away")}`)}
          </span>
          ${footer}
        </div>
      </article>
    `;
  }

  function renderDetailPanel(match) {
    const current = matchState(match);
    const homeTeam = visibleTeamForMatch(match, "home");
    const awayTeam = visibleTeamForMatch(match, "away");
    const hiddenDependentTeam = matchHasHiddenDependentTeam(match);
    const checked = match.videos?.lastCheckedAt
      ? `<p class="last-checked">Checked ${escapeHtml(new Date(match.videos.lastCheckedAt).toLocaleString())}</p>`
      : "";
    const recapEligible = Boolean(
      hasScore(match) || ["completed", "final", "live", "in_progress", "in-progress"].includes(String(match.status || "").toLowerCase())
    );
    const scoreRevealed = hasScore(match) && isScoreVisible(match);
    const preview = hiddenDependentTeam ? null : matchPreviewFor(match);
    const recap = hiddenDependentTeam ? null : matchRecapFor(match);
    const previewOpen = Boolean(preview && (!recap || !scoreRevealed));
    const recapOpen = Boolean(recap && scoreRevealed);

    return `
      <aside class="detail-panel is-${current}">
        <div class="detail-panel-header">
          <span class="eyebrow">Match details</span>
          <button aria-label="Minimize match details" class="icon-button" data-detail-close title="Minimize match details" type="button">×</button>
        </div>
        <h2 class="detail-title-teams">
          ${renderTeamName(homeTeam, `detail-team-name ${teamResultClass(match, "home")}`)}
          <span class="detail-vs">vs</span>
          ${renderTeamName(awayTeam, `detail-team-name ${teamResultClass(match, "away")}`)}
        </h2>
        <div class="detail-score">${renderScorePill(match)}</div>
        ${videoStatus(match) ? `<div class="detail-video-state">${escapeHtml(videoStatus(match))}</div>` : ""}
        ${renderVideoActions(match)}
        ${renderOddsProbability(match)}
        <dl>
          ${renderRankingRow(match)}
          <div><dt>Stage</dt><dd>${escapeHtml(match.group ? `Group ${match.group}` : match.stage)}</dd></div>
          <div><dt>Match #</dt><dd>${escapeHtml(String(match.id))}</dd></div>
          <div><dt>Kickoff</dt><dd>${escapeHtml(formatDate(match))} at ${escapeHtml(formatTime(match))}</dd></div>
          <div><dt>Location</dt><dd>${renderVenueButton(match)}</dd></div>
          <div><dt>Broadcast</dt><dd>${escapeHtml(match.network || "TBD")}</dd></div>
          ${matchNotice(match, current) ? `<div><dt>Status</dt><dd>${escapeHtml(matchNotice(match, current))}</dd></div>` : ""}
        </dl>
        ${renderAiInsight("matchPreview", match.id, "Pregame Preview", {
          open: previewOpen,
          actionClosed: "Read preview",
          actionOpen: "Hide preview",
          skipIntro: true,
        })}
        ${recap
          ? renderAiInsight("match", match.id, "Match Recap", {
              open: recapOpen,
              actionClosed: "Read recap",
              actionOpen: "Hide recap",
              skipIntro: true,
            })
          : recapEligible
            ? renderRecapPendingNote()
            : ""}
        ${checked}
      </aside>
    `;
  }

  function renderDetailHandle(match) {
    const homeTeam = visibleTeamForMatch(match, "home");
    const awayTeam = visibleTeamForMatch(match, "away");
    return `
      <button aria-label="Show match details" class="detail-mini" data-detail-open title="Show match details" type="button">
        <span>Match details</span>
        <strong>${renderTeamName(homeTeam, "mini-team-name")} vs ${renderTeamName(awayTeam, "mini-team-name")}</strong>
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
            const homeTeam = visibleTeamForMatch(match, "home");
            const awayTeam = visibleTeamForMatch(match, "away");
            return `
              <article class="fixture-row is-${current}">
                <div class="fixture-select" data-match-id="${match.id}" role="button" tabindex="0">
                  <span class="fixture-time">${escapeHtml(formatCompactDateTime(match))}</span>
                  <span class="fixture-teams">
                    ${renderTeamName(homeTeam, `fixture-team fixture-home ${teamResultClass(match, "home")}`)}
                    ${renderScorePill(match)}
                    ${renderTeamName(awayTeam, `fixture-team fixture-away ${teamResultClass(match, "away")}`)}
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
              <div class="group-actions">
                ${renderGroupInsightsButton(group)}
                <button aria-pressed="${revealed ? "true" : "false"}" class="group-reveal" data-group-reveal="${escapeHtml(group)}" type="button">
                  ${revealed ? "Hide scores" : "Show scores"}
                </button>
              </div>
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

  function referencedMatchIds(match) {
    return ["home", "away", "homeSource", "awaySource"]
      .flatMap((side) => [...String(match[side] || "").matchAll(/Match\s+(\d+)/gi)].map((item) => Number(item[1])))
      .filter(Boolean);
  }

  function groupMatchesFor(group) {
    return matches.filter((match) => match.stage === "Group" && match.group === group);
  }

  function groupScoresVisible(groupMatches) {
    const scored = groupMatches.filter(hasScore);
    return Boolean(scored.length && scored.every((match) => isScoreVisible(match)));
  }

  function groupSlotClinchedTeam(slot, group) {
    const groupMatches = groupMatchesFor(group);
    if (groupMatches.length !== 6 || !groupScoresVisible(groupMatches)) return null;

    const standings = standingsFor(groupMatches);
    const teams = standings.map((row) => row.team);
    const remaining = groupMatches.filter((match) => !hasScore(match));
    const basePoints = Object.fromEntries(standings.map((row) => [row.team, row.points]));

    if (!remaining.length) {
      return slot === "Winner" ? standings[0]?.team || null : standings[1]?.team || null;
    }

    const scenarioPoints = [];
    function walk(index, points) {
      if (index >= remaining.length) {
        scenarioPoints.push(points);
        return;
      }

      const match = remaining[index];
      [
        [3, 0],
        [1, 1],
        [0, 3],
      ].forEach(([homePoints, awayPoints]) => {
        walk(index + 1, {
          ...points,
          [match.home]: (points[match.home] || 0) + homePoints,
          [match.away]: (points[match.away] || 0) + awayPoints,
        });
      });
    }

    walk(0, basePoints);

    return (
      teams.find((team) =>
        scenarioPoints.every((points) => {
          const teamPoints = points[team] || 0;
          const higher = teams.filter((other) => other !== team && (points[other] || 0) > teamPoints).length;
          const tiedOrHigher = teams.filter((other) => other !== team && (points[other] || 0) >= teamPoints).length;
          return slot === "Winner" ? tiedOrHigher === 0 : higher === 1 && tiedOrHigher === 1;
        }),
      ) || null
    );
  }

  function bracketSourceVisible(sourceLabel) {
    const source = String(sourceLabel || "");
    const matchSource = source.match(/^(Winner|Loser) Match (\d+)$/i);
    if (matchSource) {
      const sourceMatch = matches.find((match) => match.id === Number(matchSource[2]));
      return Boolean(sourceMatch && isScoreVisible(sourceMatch));
    }

    const groupSource = source.match(/^(Winner|Runner-up) Group ([A-L])$/i);
    if (groupSource) {
      return true;
    }

    return true;
  }

  function shouldUseBracketTbd(match, label) {
    const tbdStages = new Set(["Round of 16", "Quarterfinals", "Semifinals", "Third Place", "Final"]);
    return tbdStages.has(match.stage) && !isRealTeam(label);
  }

  function bracketDisplayTeam(match, side) {
    return visibleTeamForMatch(match, side, "bracket");
  }

  function renderBracketClinchedHints(label) {
    const source = String(label || "");
    const groupSource = source.match(/^(Winner|Runner-up) Group ([A-L])$/i);
    if (!groupSource) return "";

    const slot = groupSource[1];
    const group = groupSource[2].toUpperCase();
    const team = groupSlotClinchedTeam(slot, group);
    if (!team) return "";

    return `
      <div class="bracket-clinched-list" aria-label="Clinched bracket slot">
        <span class="bracket-clinched-chip" title="${escapeHtml(`${team} has clinched ${slot.toLowerCase()} Group ${group}`)}">
          ${renderTeamName(team, "bracket-clinched-team")}
          <em>clinched</em>
        </span>
      </div>
    `;
  }

  function collectBracketTree(match, knockoutById, seen = new Set()) {
    if (!match || seen.has(match.id)) return [];
    seen.add(match.id);
    const children = referencedMatchIds(match)
      .map((id) => knockoutById.get(id))
      .filter(Boolean)
      .flatMap((child) => collectBracketTree(child, knockoutById, seen));
    return [...children, match];
  }

  function bracketOrderMap(knockout) {
    const byId = new Map(knockout.map((match) => [match.id, match]));
    const seen = new Set();
    const ordered = [];

    function visit(match) {
      if (!match || seen.has(match.id)) return;
      seen.add(match.id);
      referencedMatchIds(match).forEach((id) => visit(byId.get(id)));
      ordered.push(match);
    }

    knockout
      .filter((match) => match.stage === "Final")
      .sort((a, b) => a.id - b.id)
      .forEach(visit);

    knockout
      .filter((match) => match.stage === "Third Place")
      .sort((a, b) => a.id - b.id)
      .forEach(visit);

    knockout
      .filter((match) => !seen.has(match.id))
      .sort((a, b) => a.id - b.id)
      .forEach(visit);

    return new Map(ordered.map((match, index) => [match.id, index]));
  }

  function compareBracketOrder(orderMap) {
    return (a, b) => {
      const aOrder = orderMap.get(a.id);
      const bOrder = orderMap.get(b.id);
      return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
    };
  }

  function bracketSlotLayout(knockout, visibleStages, orderMap) {
    const slotMap = new Map();
    const firstStage = visibleStages[0]?.stage || "Round of 32";
    const firstMatches = bracketStageMatches(firstStage, knockout, orderMap);

    firstMatches.forEach((match, index) => {
      slotMap.set(match.id, { start: index, span: 1 });
    });

    visibleStages.slice(1).forEach((stage) => {
      bracketStageMatches(stage.stage, knockout, orderMap).forEach((match, index) => {
        const childSlots = referencedMatchIds(match)
          .map((id) => slotMap.get(id))
          .filter(Boolean);

        if (childSlots.length) {
          const start = Math.min(...childSlots.map((slot) => slot.start));
          const end = Math.max(...childSlots.map((slot) => slot.start + slot.span));
          slotMap.set(match.id, { start, span: Math.max(1, end - start) });
          return;
        }

        if (!slotMap.has(match.id)) {
          slotMap.set(match.id, { start: index, span: 1 });
        }
      });
    });

    return { leafCount: Math.max(1, firstMatches.length), slotMap };
  }

  function bracketSlotStyle(match, slotMap) {
    const slot = slotMap?.get(match.id);
    if (!slot) return "";
    return ` style="grid-row: ${slot.start + 1} / span ${Math.max(1, slot.span)}"`;
  }

  function bracketScoreCell(match, side) {
    if (!hasScore(match)) return `<span class="bracket-score-cell">${isScorePending(match) ? "--" : ""}</span>`;
    const visible = isScoreVisible(match);
    const value = visible ? String(side === "home" ? match.homeScore : match.awayScore) : "??";
    const label = visible ? "Hide score" : "Reveal score";
    return `<button aria-label="${label}" class="bracket-score-cell ${visible ? "is-revealed" : "is-hidden"}" data-score-id="${match.id}" type="button"><span class="${visible ? "" : "score-hidden-text"}">${escapeHtml(value)}</span></button>`;
  }

  function renderBracketTeam(match, side) {
    const team = bracketDisplayTeam(match, side);
    return `
      <div class="bracket-team-row ${teamResultClass(match, side)}">
        ${renderTeamName(team, "bracket-team-name")}
        ${bracketScoreCell(match, side)}
        ${renderBracketClinchedHints(team)}
      </div>
    `;
  }

  function renderBracketMatch(match, tone = "", slotMap = null) {
    const current = matchState(match);
    const roundTone = match.stage === "Final" ? "is-final" : match.stage === "Third Place" ? "is-third" : "";
    const matchLabel = match.stage === "Final" || match.stage === "Third Place" ? match.stage : formatCompactDateTime(match);
    const matchTime = match.stage === "Final" || match.stage === "Third Place" ? formatCompactDateTime(match) : "";
    const homeTeam = visibleTeamForMatch(match, "home", "bracket");
    const awayTeam = visibleTeamForMatch(match, "away", "bracket");
    const actions = renderBracketVideoLinks(match);
    return `
      <article class="bracket-match ${tone} ${roundTone} is-${current}" data-match-id="${match.id}" role="button" tabindex="0" aria-label="Open match details for ${escapeHtml(homeTeam)} vs ${escapeHtml(awayTeam)}"${bracketSlotStyle(match, slotMap)}>
        <div class="bracket-match-meta">
          <span>${escapeHtml(matchLabel)}</span>
          ${matchTime ? `<em>${escapeHtml(matchTime)}</em>` : ""}
        </div>
        <div class="bracket-team-list">
          ${renderBracketTeam(match, "home")}
          ${renderBracketTeam(match, "away")}
        </div>
        ${actions ? `<div class="bracket-match-actions">${actions}</div>` : ""}
      </article>
    `;
  }

  function bracketStartIndex() {
    const index = bracketStages.findIndex((stage) => stage.stage === state.bracketStartStage);
    return index >= 0 ? index : 0;
  }

  function renderBracketRoundPicker() {
    return `
      <div class="bracket-round-picker" aria-label="Bracket rounds">
        ${bracketStages
          .map((stage) => {
            const active = state.bracketStartStage === stage.stage;
            return `
              <button aria-pressed="${active ? "true" : "false"}" data-bracket-stage="${escapeHtml(stage.stage)}" type="button">
                <span class="bracket-round-label-long">${escapeHtml(stage.label)}</span>
                <span class="bracket-round-label-short">${escapeHtml(stage.shortLabel)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderBracketRound(label, roundMatches, stageClass, slotMap = null) {
    if (stageClass === "finals") {
      const finalMatch = roundMatches.find((match) => match.stage === "Final");
      const thirdPlaceMatch = roundMatches.find((match) => match.stage === "Third Place");
      return `
        <section class="bracket-round-column bracket-round-finals" style="--bracket-count: ${roundMatches.length || 1}">
          <div class="bracket-column-stack bracket-finals-stack">
            ${
              finalMatch
                ? `<div class="bracket-final-main">
                    <img alt="World Cup trophy" class="bracket-trophy" src="./public/assets/world-cup-trophy.png" />
                    ${renderBracketMatch(finalMatch, "is-finals")}
                  </div>`
                : ""
            }
            ${
              thirdPlaceMatch
                ? `<div class="bracket-third-place-block">
                    <span>Third place</span>
                    ${renderBracketMatch(thirdPlaceMatch, "is-finals")}
                  </div>`
                : ""
            }
          </div>
        </section>
      `;
    }

    return `
      <section class="bracket-round-column bracket-round-${stageClass}" style="--bracket-count: ${roundMatches.length || 1}">
        <div class="bracket-column-stack">
          ${
            roundMatches.length
              ? roundMatches.map((match) => renderBracketMatch(match, `is-${stageClass}`, slotMap)).join("")
              : `<div class="bracket-empty-round">Not announced yet</div>`
          }
        </div>
      </section>
    `;
  }

  function bracketStageMatches(stage, knockout, orderMap) {
    if (stage === "Finals") {
      return knockout
        .filter((match) => match.stage === "Final" || match.stage === "Third Place")
        .sort((a, b) => {
          const stageRank = (match) => (match.stage === "Final" ? 0 : 1);
          return stageRank(a) - stageRank(b) || a.id - b.id;
        });
    }

    return knockout.filter((match) => match.stage === stage).sort(compareBracketOrder(orderMap));
  }

  function scrollBracket(direction) {
    const scroller = document.querySelector(".bracket-scroll");
    if (!scroller) return;
    const amount = Math.max(scroller.clientWidth * 0.82, 320);
    scroller.scrollBy({ left: direction * amount });
  }

  function renderBracket() {
    const knockout = matches.filter((match) => match.stage !== "Group").sort((a, b) => a.id - b.id);

    if (!knockout.length) {
      return `<div class="empty-state"><strong>No knockout matches found</strong><span>Switch back once the bracket is published.</span></div>`;
    }

    const visibleStages = bracketStages.slice(bracketStartIndex());
    const bracketMinWidth = visibleStages.length * 230 + Math.max(0, visibleStages.length - 1) * 18;
    const firstStage = visibleStages[0] || bracketStages[0];
    const orderMap = bracketOrderMap(knockout);
    const layout = bracketSlotLayout(knockout, visibleStages, orderMap);
    const columns = visibleStages
      .map((stage) => renderBracketRound(stage.label, bracketStageMatches(stage.stage, knockout, orderMap), stage.className, layout.slotMap))
      .join("");

    return `
      <section class="bracket-view bracket-view-clean">
        ${renderBracketRoundPicker()}
        <div class="bracket-frame">
          <div class="bracket-scroll" aria-label="World Cup knockout bracket">
            <div class="bracket-board bracket-board-linear is-full is-start-${escapeHtml(firstStage.className)} ${visibleStages.length === 1 ? "is-single-round" : ""}" style="--bracket-rounds: ${visibleStages.length}; --bracket-min-width: ${bracketMinWidth}px; --bracket-leaf-count: ${layout.leafCount}" data-bracket-window="full">
              <svg class="bracket-line-layer" data-bracket-line-layer aria-hidden="true"></svg>
              ${columns}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function updateBracketLineLayer() {
    const board = app.querySelector(".bracket-board-linear");
    const layer = board?.querySelector("[data-bracket-line-layer]");
    if (!board || !layer) return;

    const boardRect = board.getBoundingClientRect();
    const visibleIds = new Set(
      [...board.querySelectorAll(".bracket-match[data-match-id]")].map((element) => Number(element.dataset.matchId))
    );
    const connectorsByTarget = new Map();

    matches
      .filter((match) => match.stage !== "Group")
      .forEach((target) => {
        if (target.stage === "Third Place") return;
        const targetElement = board.querySelector(`.bracket-match[data-match-id="${target.id}"]`);
        if (!targetElement) return;
        const targetRect = targetElement.getBoundingClientRect();
        const targetConnector = {
          endX: targetRect.left - boardRect.left,
          targetY: targetRect.top + targetRect.height / 2 - boardRect.top,
          sourceIds: [],
          sources: [],
          targetId: target.id,
        };

        referencedMatchIds(target).forEach((sourceId) => {
          if (!visibleIds.has(sourceId)) return;
          const sourceElement = board.querySelector(`.bracket-match[data-match-id="${sourceId}"]`);
          if (!sourceElement) return;

          const sourceRect = sourceElement.getBoundingClientRect();
          targetConnector.sourceIds.push(sourceId);
          targetConnector.sources.push({
            startX: sourceRect.right - boardRect.left,
            startY: sourceRect.top + sourceRect.height / 2 - boardRect.top,
          });
        });

        if (targetConnector.sources.length) {
          connectorsByTarget.set(target.id, targetConnector);
        }
      });

    const paths = [...connectorsByTarget.values()].map((connector) => {
      const maxStartX = Math.max(...connector.sources.map((source) => source.startX));
      const columnGap = connector.endX - maxStartX;
      const trunkX = maxStartX + (columnGap > 0 ? Math.max(4, columnGap / 2) : columnGap / 2);
      const ys = [...connector.sources.map((source) => source.startY), connector.targetY];
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const d = [
        ...connector.sources.map((source) => `M ${source.startX.toFixed(1)} ${source.startY.toFixed(1)} H ${trunkX.toFixed(1)}`),
        `M ${trunkX.toFixed(1)} ${minY.toFixed(1)} V ${maxY.toFixed(1)}`,
        `M ${trunkX.toFixed(1)} ${connector.targetY.toFixed(1)} H ${connector.endX.toFixed(1)}`,
      ].join(" ");
      return {
        d,
        sourceIds: connector.sourceIds,
        targetId: connector.targetId,
      };
    });

    layer.setAttribute("viewBox", `0 0 ${boardRect.width.toFixed(1)} ${boardRect.height.toFixed(1)}`);
    layer.setAttribute("width", boardRect.width.toFixed(1));
    layer.setAttribute("height", boardRect.height.toFixed(1));
    layer.replaceChildren(
      ...paths.map((pathData) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData.d);
        path.dataset.sourceIds = pathData.sourceIds.join(",");
        path.dataset.targetId = String(pathData.targetId);
        return path;
      })
    );
  }

  function requestBracketLineUpdate() {
    if (state.mode !== "bracket") return;
    if (bracketLineFrame) {
      window.cancelAnimationFrame(bracketLineFrame);
    }
    bracketLineFrame = window.requestAnimationFrame(() => {
      updateBracketLineLayer();
      bracketLineFrame = window.requestAnimationFrame(() => {
        bracketLineFrame = null;
        updateBracketLineLayer();
      });
    });
  }
  function renderConstellation(list) {
    return `
      <div class="constellation-layout">
        ${list
          .map((match) => {
            const current = matchState(match);
            const homeTeam = visibleTeamForMatch(match, "home");
            const awayTeam = visibleTeamForMatch(match, "away");
            return `
              <article class="star-node is-${current}">
                <div class="star-select" data-match-id="${match.id}" role="button" tabindex="0">
                  <span class="tile-time">${escapeHtml(formatCompactDateTime(match))}</span>
                  <div class="tile-teams">
                    <strong>${renderTeamName(homeTeam, `star-team-name ${teamResultClass(match, "home")}`)}</strong>
                    <span class="tile-score">${renderScorePill(match)}</span>
                    <strong>${renderTeamName(awayTeam, `star-team-name ${teamResultClass(match, "away")}`)}</strong>
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

  function normalizeLeaderboardCountry(country) {
    const countryMap = {
      "Bosnia-Herzegovina": "Bosnia and Herzegovina",
      "Congo DR": "DR Congo",
      "Czech Republic": "Czechia",
      USA: "United States",
    };
    return countryMap[country] || country;
  }

  function normalizeLeaderboardPosition(position) {
    const positionMap = {
      Defender: "DEF",
      Goalkeeper: "GK",
      Midfielder: "MID",
      Striker: "FW",
    };
    return positionMap[position] || position || "";
  }

  function enrichLeaderboardPlayer(player) {
    const goals = Number(player.goals || 0);
    const assists = Number(player.assists || 0);
    const minutes = Number(player.minutes || 0);
    const points = goals + assists;
    return {
      ...player,
      goals,
      assists,
      matches: Number(player.matches || 0),
      minutes,
      points,
      goalContributions: points,
      goalsPer90: Number(((goals * 90) / Math.max(1, minutes)).toFixed(1)),
      pointsPer90: Number(((points * 90) / Math.max(1, minutes)).toFixed(1)),
      per90: Number(((points * 90) / Math.max(1, minutes)).toFixed(1)),
    };
  }

  function normalizeLeaderboardSnapshot(players) {
    return (Array.isArray(players) ? players : [])
      .map((player) =>
        enrichLeaderboardPlayer({
          ...player,
          team: normalizeLeaderboardCountry(player.team || player.country || ""),
          position: normalizeLeaderboardPosition(player.position),
        }),
      )
      .filter((player) => player.player && player.team);
  }

  function mapGuardianLeaderboardPlayer(player) {
    return enrichLeaderboardPlayer({
      rank: Number(player.rank || 0),
      player: player.name || "Unknown player",
      team: normalizeLeaderboardCountry(player.country || ""),
      position: normalizeLeaderboardPosition(player.position),
      goals: player.goals,
      assists: player.assists,
      matches: Array.isArray(player.games) ? player.games.length : 0,
      minutes: player.minutesPlayed,
    });
  }

  async function loadLiveLeaderboard() {
    if (!window.fetch) return;

    try {
      const response = await fetch(guardianGoldenBootUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Leaderboard request failed: ${response.status}`);
      const players = await response.json();
      if (!Array.isArray(players) || !players.length) throw new Error("Leaderboard response was empty");
      leaderboardPlayers = players.map(mapGuardianLeaderboardPlayer);
      state.leaderboardStatus = "live";
      state.leaderboardLoadedAt = new Date();
    } catch {
      leaderboardPlayers = [...leaderboardSnapshotPlayers];
      state.leaderboardStatus = "snapshot";
      state.leaderboardLoadedAt = null;
    }

    if (state.mode === "players") render();
  }

  function leaderboardField(id) {
    return leaderboardFields.find((field) => field.id === id) || leaderboardFields[0];
  }

  function visibleLeaderboardFields() {
    return leaderboardFields;
  }

  function leaderboardValue(player, fieldId) {
    if (fieldId === "points") return Number(player.points || player.goalContributions || 0);
    if (fieldId === "goalsPer90") return Number(player.goalsPer90 || 0);
    if (fieldId === "pointsPer90" || fieldId === "per90") return Number(player.pointsPer90 || player.per90 || 0);
    return Number(player[fieldId] || 0);
  }

  function filteredLeaderboardPlayers() {
    const selected =
      state.countryMode === "all"
        ? leaderboardPlayers
        : leaderboardPlayers.filter((player) => state.selectedCountries.has(player.team));
    const sortField = leaderboardField(state.leaderboardSort);

    return [...selected].sort((a, b) => {
      const first = leaderboardValue(a, sortField.id);
      const second = leaderboardValue(b, sortField.id);
      if (second !== first) return second - first;
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (a.minutes !== b.minutes) return a.minutes - b.minutes;
      return a.player.localeCompare(b.player);
    });
  }

  function renderLeaderboardStat(player, field) {
    const value = leaderboardValue(player, field.id);
    if (field.id === "goalsPer90" || field.id === "pointsPer90") return value.toFixed(1);
    return String(value);
  }

  function selectedPlayerDetails() {
    if (!state.playerDetailsKey) return null;
    return leaderboardPlayers.find((player) => playerInsightKey(player) === state.playerDetailsKey) || null;
  }

  function playerInitials(player) {
    return String(player.player || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function renderPlayerPortrait(player) {
    const flag = flagForTeam(player.team);
    return `
      <div class="player-portrait" aria-hidden="true">
        <span>${escapeHtml(flag)}</span>
        <strong>${escapeHtml(playerInitials(player))}</strong>
      </div>
    `;
  }

  function renderPlayerDetailsModal() {
    const player = selectedPlayerDetails();
    if (!player) return "";
    const key = playerInsightKey(player);
    const insight = renderAiInsight("player", key, "Insights");

    return `
      <div class="player-details-modal" data-player-details-modal role="dialog" aria-modal="true" aria-label="Player details">
        <section class="player-details-panel">
          <header class="player-details-header">
            ${renderPlayerPortrait(player)}
            <div>
              <span class="eyebrow">Player details</span>
              <h2>${escapeHtml(player.player)}</h2>
              <p>${escapeHtml(player.team)} · ${escapeHtml(player.position || "Player")}</p>
            </div>
            <button aria-label="Close player details" class="icon-button player-details-close" data-player-details-close title="Close player details" type="button">×</button>
          </header>
          <div class="player-details-body">
            ${insight || `<div class="ai-insight-empty">Insights will appear here after the next AI refresh.</div>`}
          </div>
        </section>
      </div>
    `;
  }

  function renderGroupDetailsModal() {
    const group = state.groupDetailsKey;
    if (!group) return "";

    const groupMatches = groupMatchesFor(group);
    const insight = renderAiInsight("group", group, "Insights", { open: true });

    return `
      <div class="group-details-modal" data-group-details-modal role="dialog" aria-modal="true" aria-label="Group insights">
        <section class="group-details-panel">
          <header class="group-details-header">
            <div>
              <span class="eyebrow">Group insights</span>
              <h2>Group ${escapeHtml(group)}</h2>
              <p>${groupMatches.length} ${groupMatches.length === 1 ? "match" : "matches"}</p>
            </div>
            <button aria-label="Close group insights" class="icon-button group-details-close" data-group-details-close title="Close group insights" type="button">×</button>
          </header>
          <div class="group-details-body">
            ${insight || `<div class="ai-insight-empty">Insights will appear here after the next AI refresh.</div>`}
          </div>
        </section>
      </div>
    `;
  }

  function renderStatsInfoModal() {
    if (!state.statsInfoOpen) return "";

    const definitions = leaderboardFields
      .map((field) => {
        const descriptions = {
          points: "Goals plus assists. This is the default sort.",
          goals: "Total goals scored.",
          assists: "Total assists credited by the source.",
          matches: "Games in the source feed for that player.",
          minutes: "Minutes played.",
          goalsPer90: "Goals scaled to a 90-minute rate.",
          pointsPer90: "Points scaled to a 90-minute rate.",
        };
        return `
          <article class="stats-definition-card ${field.priority === "subtle" ? "is-subtle" : ""}">
            <strong>${escapeHtml(field.label)}</strong>
            <span>${escapeHtml(descriptions[field.id] || "")}</span>
          </article>
        `;
      })
      .join("");

    return `
      <div class="stats-info-modal" data-stats-info-modal role="dialog" aria-modal="true" aria-label="Player stat definitions">
        <section class="stats-info-panel">
          <header class="stats-info-header">
            <div class="stats-info-ball" aria-hidden="true">
              <img alt="" src="./public/assets/soccer-ball-192.png" />
            </div>
            <div>
              <span class="eyebrow">Player data</span>
              <h2>Stat Definitions</h2>
            </div>
            <button aria-label="Close stats guide" class="icon-button stats-info-close" data-stats-info-close title="Close stats guide" type="button">×</button>
          </header>
          <div class="stats-info-body">
            <section>
              <span class="stats-info-section-title">Available now</span>
              <div class="stats-definition-grid">${definitions}</div>
            </section>
          </div>
        </section>
      </div>
    `;
  }

  function renderLeaderboard() {
    const players = filteredLeaderboardPlayers();
    const fields = visibleLeaderboardFields();

    if (!players.length) {
      return `<div class="empty-state"><strong>No players found</strong><span>Adjust the country filter or switch views.</span></div>`;
    }

    const headerCells = fields
      .map((field) => {
        const active = state.leaderboardSort === field.id ? " is-active" : "";
        return `
          <th class="${field.priority === "subtle" ? "is-subtle-stat" : "is-critical-stat"}">
            <button class="leader-sort${active}" data-leader-sort="${escapeHtml(field.id)}" title="Sort by ${escapeHtml(field.label)}" type="button">
              <span>${escapeHtml(field.short)}</span>
              ${active ? `<em>↓</em>` : ""}
            </button>
          </th>
        `;
      })
      .join("");

    const rows = players
      .map((player) => {
        const cells = fields
          .map(
            (field) =>
              `<td class="${field.priority === "subtle" ? "is-subtle-stat" : "is-critical-stat"}" data-label="${escapeHtml(field.label)}">${escapeHtml(renderLeaderboardStat(player, field))}</td>`,
          )
          .join("");
        const detailKey = playerInsightKey(player);
        return `
          <tr class="player-detail-trigger" data-player-detail="${escapeHtml(detailKey)}" tabindex="0" role="button" aria-label="Open insights for ${escapeHtml(player.player)}">
            <td class="leader-player-cell" data-label="Player">
              ${renderTeamName(player.team, "leader-team-flag")}
              <span class="leader-player-meta">
                <strong>${escapeHtml(player.player)}</strong>
                <em>${escapeHtml(player.position)} · ${escapeHtml(player.team)}</em>
              </span>
            </td>
            ${cells}
          </tr>
        `;
      })
      .join("");

    return `
      <section class="leaderboard-view">
        <div class="leaderboard-table-wrap">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>
                  <span class="player-header-cell">
                    <span>Player</span>
                    <button class="stats-info-trigger" data-stats-info-open title="Stat definitions" type="button" aria-label="Open player stat definitions">
                      <span class="stats-info-full">Stat definitions</span>
                      <span class="stats-info-short" aria-hidden="true">i</span>
                    </button>
                  </span>
                </th>
                ${headerCells}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderActiveView(list) {
    if (state.mode === "players") return renderLeaderboard();

    if (state.mode === "groups") return renderGroups(list);
    if (state.mode === "bracket") return renderBracket();

    if (!list.length) {
      return `<div class="empty-state"><strong>No matches found</strong><span>Adjust the country filter or switch views.</span></div>`;
    }

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
    const primaryMobileModeIds = ["timeline", "bracket", "players"];
    const mobileModes = visibleModes().filter(([id]) => primaryMobileModeIds.includes(id));
    if (!primaryMobileModeIds.includes(state.mode) && modeIsVisible(state.mode)) {
      const currentMode = modes.find(([id]) => id === state.mode);
      if (currentMode) mobileModes.push(currentMode);
    }
    const mobileActiveIndex = Math.max(0, mobileModes.findIndex(([id]) => id === state.mode));
    const mobileViewSwitcher =
      mobileModes.length > 1
        ? `<nav class="mobile-view-switcher" aria-label="Primary views" style="--mobile-view-count: ${mobileModes.length}; --mobile-view-index: ${mobileActiveIndex}">
            ${mobileModes
              .map(([id, label]) => {
                const pressed = state.mode === id ? "true" : "false";
                return `<button aria-pressed="${pressed}" data-mode="${id}" type="button">${escapeHtml(label)}</button>`;
              })
              .join("")}
          </nav>`
        : "";
    const topTodayButton =
      state.mode === "timeline"
        ? `<button class="top-today-control" data-today-jump type="button" aria-label="Go to today">
            <span class="top-today-mark" aria-hidden="true">↓</span>
            <strong>Today</strong>
          </button>`
        : "";

    return `
      <div class="mobile-nav-row">
        <button class="mobile-menu-toggle" aria-controls="schedule-controls" aria-expanded="${state.mobileMenuOpen ? "true" : "false"}" data-mobile-menu-toggle type="button">
          <span class="hamburger-icon" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="sr-only">${state.mobileMenuOpen ? "Close menu" : "Open menu"}</span>
        </button>
        ${mobileViewSwitcher}
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
        ${topTodayButton}
        <div class="control-section control-section-scores">
          <span class="control-section-title">Scores</span>
          <button class="spoiler-control" data-show-all-scores type="button">
            ${allScoredMatchesVisible() ? "Hide all scores" : "Show all scores"}
          </button>
        </div>
        <div class="control-section filters">
          <button class="country-filter-trigger" data-country-picker-toggle type="button" title="${escapeHtml(countryFilterTitle())}" aria-label="Country filter: ${escapeHtml(countryFilterTitle())}">
            <span class="country-filter-desktop-content">${renderCountryFilterContent()}</span>
            <span class="country-filter-mobile-content">${renderCountryFilterContent({ compact: true })}</span>
          </button>
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

    const visibleViewSet = new Set(normalizedVisibleViews());
    const viewOptions = modes
      .map(([id, label]) => {
        const checked = visibleViewSet.has(id);
        const isDefault = defaultVisibleViewIds.includes(id);
        const isLastVisible = checked && visibleViewSet.size === 1;
        return `
          <label class="settings-view-toggle ${checked ? "is-checked" : ""}">
            <input data-view-visibility="${escapeHtml(id)}" type="checkbox" ${checked ? "checked" : ""} ${isLastVisible ? "disabled" : ""} />
            <span>
              <strong>${escapeHtml(label)}</strong>
              <em>${isDefault ? "Default" : "Optional"}</em>
            </span>
          </label>
        `;
      })
      .join("");

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
            <span>Views Available in Menu</span>
            <div class="settings-view-grid">${viewOptions}</div>
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
            <section class="share-qr-card">
              <img src="./public/assets/share-qr.png" alt="QR code for the World Cup Highlights website" />
              <div>
                <span>Scan QR</span>
              </div>
            </section>
            <section class="share-phone-card">
              <span class="share-app-icon" aria-hidden="true">
                <img src="./public/assets/action-app.png" alt="" />
              </span>
              <div>
                <span>Save as app</span>
                <button data-share-install-open type="button">How</button>
              </div>
            </section>
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
    return inputDateValue(cutoff);
  }

  function stickyChromeOffset() {
    const chrome = app.querySelector(".page-chrome");
    return chrome ? Math.ceil(chrome.getBoundingClientRect().height + 14) : 0;
  }

  function syncStickyChromeHeight() {
    const chrome = app.querySelector(".page-chrome");
    const height = chrome ? Math.ceil(chrome.getBoundingClientRect().height) : 0;
    app.style.setProperty("--sticky-chrome-height", `${height}px`);
  }

  function todayKey() {
    return inputDateValue(state.now);
  }

  function todayBand() {
    return app.querySelector(`[data-day-key="${todayKey()}"]`);
  }

  function updateTodayJumpButton() {
    const button = app.querySelector(".today-jump[data-today-jump]");
    if (!button) return;

    const target = todayBand();
    if (state.mode !== "timeline" || !target) {
      button.classList.remove("is-visible");
      button.setAttribute("aria-hidden", "true");
      return;
    }

    const offset = stickyChromeOffset();
    const rect = target.getBoundingClientRect();
    const anchoredAtTop = Math.abs(rect.top - offset) <= 18;

    if (anchoredAtTop) {
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
            <h1><a aria-label="World Cup Highlights" class="home-title" href="${escapeHtml(window.location.pathname)}">W<span class="title-ball" aria-hidden="true"><img class="title-ball-icon" src="./public/assets/soccer-ball-source.png" alt="" /><span class="title-ball-letter">o</span></span>rld Cup H<span class="title-trophy" aria-hidden="true"><img class="title-trophy-icon" src="./public/assets/world-cup-trophy.png" alt="" /><span class="title-trophy-letter">i</span></span>ghl<span class="title-trophy" aria-hidden="true"><img class="title-trophy-icon" src="./public/assets/world-cup-trophy.png" alt="" /><span class="title-trophy-letter">i</span></span>ghts</a></h1>
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
      ${renderGroupDetailsModal()}
      ${renderPlayerDetailsModal()}
      ${renderStatsInfoModal()}
      ${renderStadiumMap()}
      ${renderTodayJumpButton()}
      <footer class="source-strip">
        <span>Last updated ${escapeHtml(formatDataTimestamp(latestDataTimestamp()))}</span>
        ${data.sources
          .map((source) => `<a href="${escapeHtml(source.url)}" rel="noreferrer" target="_blank">${escapeHtml(source.label)}</a>`)
          .join("")}
      </footer>
    `;

    syncUrlState();
    syncStickyChromeHeight();
    syncMobileMenuDom();
    settleViewScroll();
    requestTodayJumpUpdate();
    requestBracketLineUpdate();
  }

  function readerSurfaceOpen() {
    return Boolean(
      (state.selectedId !== null && state.detailOpen) ||
        state.countryPickerOpen ||
        state.settingsOpen ||
        state.feedbackOpen ||
        state.shareOpen ||
        state.installOpen ||
        state.statsInfoOpen ||
        state.playerDetailsKey ||
        state.groupDetailsKey ||
        state.mapVenueId,
    );
  }

  function renderFromTimer() {
    state.now = new Date();
    if (readerSurfaceOpen()) {
      return;
    }
    render();
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
    syncStickyChromeHeight();
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
      reloadPage({ today: true });
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

    const shareInstallOpen = event.target.closest("[data-share-install-open]");
    if (shareInstallOpen) {
      state.shareOpen = false;
      state.installOpen = true;
      state.shareCopied = false;
      render();
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

    const statsInfoClose = event.target.closest("[data-stats-info-close]");
    if (statsInfoClose) {
      state.statsInfoOpen = false;
      render();
      return;
    }

    const statsInfoBackdrop = event.target.closest("[data-stats-info-modal]");
    if (statsInfoBackdrop && event.target === statsInfoBackdrop) {
      state.statsInfoOpen = false;
      render();
      return;
    }

    const playerDetailsClose = event.target.closest("[data-player-details-close]");
    if (playerDetailsClose) {
      state.playerDetailsKey = null;
      render();
      return;
    }

    const playerDetailsBackdrop = event.target.closest("[data-player-details-modal]");
    if (playerDetailsBackdrop && event.target === playerDetailsBackdrop) {
      state.playerDetailsKey = null;
      render();
      return;
    }

    const groupDetailsClose = event.target.closest("[data-group-details-close]");
    if (groupDetailsClose) {
      state.groupDetailsKey = null;
      render();
      return;
    }

    const groupDetailsBackdrop = event.target.closest("[data-group-details-modal]");
    if (groupDetailsBackdrop && event.target === groupDetailsBackdrop) {
      state.groupDetailsKey = null;
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

    const statsInfoOpen = event.target.closest("[data-stats-info-open]");
    if (statsInfoOpen) {
      state.statsInfoOpen = true;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const playerDetail = event.target.closest("[data-player-detail]");
    if (playerDetail) {
      state.playerDetailsKey = playerDetail.dataset.playerDetail;
      activeInsightKey = `player:${state.playerDetailsKey}`;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const settingsReset = event.target.closest("[data-settings-reset]");
    if (settingsReset) {
      state.settings = { ...defaultSettings };
      if (!modeIsVisible(state.mode)) state.mode = firstVisibleMode();
      state.timelineAutoScrolled = false;
      state.pendingViewScroll = state.mode;
      saveSettings();
      render();
      return;
    }

    const viewVisibility = event.target.closest("[data-view-visibility]");
    if (viewVisibility) {
      const viewId = viewVisibility.dataset.viewVisibility;
      const nextViews = new Set(normalizedVisibleViews());
      if (viewVisibility.checked) {
        nextViews.add(viewId);
      } else if (nextViews.size > 1) {
        nextViews.delete(viewId);
      } else {
        viewVisibility.checked = true;
      }

      state.settings = {
        ...state.settings,
        visibleViews: modes.map(([id]) => id).filter((id) => nextViews.has(id)),
      };
      if (!modeIsVisible(state.mode)) {
        state.mode = firstVisibleMode();
        state.timelineAutoScrolled = false;
        state.pendingViewScroll = state.mode;
      }
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

    const bracketStageButton = event.target.closest("[data-bracket-stage]");
    if (bracketStageButton) {
      state.bracketStartStage = bracketStageButton.dataset.bracketStage;
      state.pendingViewScroll = "bracket";
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

    const matchInsights = event.target.closest("[data-match-insights]");
    if (matchInsights) {
      state.selectedId = Number(matchInsights.dataset.matchInsights);
      state.detailOpen = true;
      const match = matches.find((item) => item.id === state.selectedId);
      if (match && matchRecapFor(match) && hasScore(match) && isScoreVisible(match)) {
        activeInsightKey = `match:${state.selectedId}`;
      } else if (match && matchPreviewFor(match)) {
        activeInsightKey = `matchPreview:${state.selectedId}`;
      } else if (match && matchRecapFor(match)) {
        activeInsightKey = `match:${state.selectedId}`;
      } else {
        activeInsightKey = null;
      }
      render();
      return;
    }

    const groupInsights = event.target.closest("[data-group-insights]");
    if (groupInsights) {
      state.groupDetailsKey = groupInsights.dataset.groupInsights;
      activeInsightKey = `group:${state.groupDetailsKey}`;
      state.mobileMenuOpen = false;
      render();
      return;
    }

    const leaderSort = event.target.closest("[data-leader-sort]");
    if (leaderSort) {
      state.leaderboardSort = leaderSort.dataset.leaderSort;
      render();
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
        activeInsightKey = match && matchPreviewFor(match) ? `matchPreview:${matchId}` : null;
      } else {
        state.hiddenScores.delete(matchId);
        state.revealedScores.add(matchId);
        activeInsightKey = match && matchRecapFor(match) ? `match:${matchId}` : null;
      }
      saveSpoilerState();
      render();
      return;
    }

    const matchButton = event.target.closest("[data-match-id]");
    if (matchButton) {
      if (event.target.closest("a, button, input, select, textarea, summary")) return;
      state.selectedId = Number(matchButton.dataset.matchId);
      state.detailOpen = true;
      activeInsightKey = null;
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
  });

  document.addEventListener("keydown", (event) => {
    if (
      state.mode === "bracket" &&
      !event.target.closest?.("input, textarea, select") &&
      (event.key === "ArrowRight" || event.key === "ArrowLeft")
    ) {
      event.preventDefault();
      scrollBracket(event.key === "ArrowRight" ? 1 : -1);
      return;
    }

    const playerDetail = event.target.closest?.("[data-player-detail]");
    if (playerDetail && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      state.playerDetailsKey = playerDetail.dataset.playerDetail;
      activeInsightKey = `player:${state.playerDetailsKey}`;
      state.mobileMenuOpen = false;
      render();
      return;
    }

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
    if (event.key === "Escape" && state.statsInfoOpen) {
      state.statsInfoOpen = false;
      render();
    }
    if (event.key === "Escape" && state.playerDetailsKey) {
      state.playerDetailsKey = null;
      render();
    }
    if (event.key === "Escape" && state.groupDetailsKey) {
      state.groupDetailsKey = null;
      render();
    }
    if (event.key === "Escape" && state.mobileMenuOpen) {
      closeMobileMenu();
    }
  });

  function handleWindowScroll() {
    requestTodayJumpUpdate();
  }

  window.setInterval(renderFromTimer, 60_000);
  document.addEventListener("wheel", closeMobileMenuFromOutsideScroll, { passive: true });
  document.addEventListener("touchmove", closeMobileMenuFromOutsideScroll, { passive: true });
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  window.addEventListener("resize", () => {
    syncStickyChromeHeight();
    requestTodayJumpUpdate();
    requestBracketLineUpdate();
  });
  document.fonts?.ready?.then(requestBracketLineUpdate).catch(() => {});
  window.addEventListener("popstate", () => {
    applyUrlState();
    render();
  });
  applyUrlState();
  if (takeTodayAfterReloadRequest()) {
    state.mode = "timeline";
    state.timelineAutoScrolled = false;
    state.pendingViewScroll = "timeline";
  }
  if (!autoReloadStaleHostedData()) {
    render();
  }
})();
