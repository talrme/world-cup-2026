"use client";

import rawData from "@/data/world-cup-2026.json";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "timeline" | "groups" | "bracket" | "constellation";
type MatchState = "completed" | "live" | "needs-result" | "scheduled";
type TodayJumpDirection = "up" | "down" | null;
type DisplaySettings = {
  theme: "match" | "midnight" | "daylight" | "electric";
  density: "comfortable" | "compact";
  videoStyle: "compact" | "full";
  timelineStart: "yesterday" | "today" | "top";
  scoreStartupMode: "previous" | "hidden" | "shown";
  showBracketViewOption: boolean;
};

type SpoilerState = {
  showAllScores: boolean;
  scoreCutoffEnabled: boolean;
  scoreCutoffDate: string;
  revealedScoreIds: Set<number>;
  hiddenScoreIds: Set<number>;
  revealedGroups: Set<string>;
  hiddenGroups: Set<string>;
  hiddenScoresStored: boolean;
};

type VideoLink = {
  title?: string;
  url?: string;
  channel?: string;
  source?: string;
  searchUrl?: string;
  lastCheckedAt?: string;
  durationText?: string;
};

type Match = {
  id: number;
  stage: string;
  round: string;
  group?: string;
  date: string;
  time?: string | null;
  offset?: string | null;
  timezoneLabel?: string;
  home: string;
  away: string;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string;
  network?: string | null;
  notes?: string;
  venueId?: string;
  videos?: {
    extended?: VideoLink | null;
    short?: VideoLink | null;
    lastCheckedAt?: string;
  };
};

type Venue = {
  id: string;
  fifaName: string;
  stadium: string;
  city: string;
  region?: string;
  country?: string;
  mapX: number;
  mapY: number;
};

type Dataset = {
  generatedAt: string;
  sources: { label: string; url: string }[];
  matches: Match[];
  venues?: Venue[];
};

type Standing = {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

const data = rawData as unknown as Dataset;

const modes: { id: ViewMode; label: string }[] = [
  { id: "timeline", label: "Schedule" },
  { id: "bracket", label: "Bracket" },
  { id: "groups", label: "Groups" },
  { id: "constellation", label: "Tiles" },
];
const modeIds = modes.map((mode) => mode.id);
const settingsKey = "worldCup2026Settings";
const spoilerStateKey = "worldCup2026Spoilers";
const feedbackFormUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?usp=sharing&ouid=104982845318929976228";
const feedbackEmbedUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSdpDQ8Dyp-vIZziQwJT4PmU4F6UI1_olhzUMCXzPFRnYzS-QQ/viewform?embedded=true";
const defaultSettings: DisplaySettings = {
  theme: "match",
  density: "comfortable",
  videoStyle: "compact",
  timelineStart: "today",
  scoreStartupMode: "previous",
  showBracketViewOption: true,
};
type SegmentedSettingKey = Exclude<keyof DisplaySettings, "showBracketViewOption">;
const settingGroups: {
  key: SegmentedSettingKey;
  label: string;
  options: { value: DisplaySettings[SegmentedSettingKey]; label: string }[];
}[] = [
  {
    key: "theme",
    label: "Color theme",
    options: [
      { value: "match", label: "Stadium" },
      { value: "midnight", label: "Midnight" },
      { value: "daylight", label: "Daylight" },
      { value: "electric", label: "Electric" },
    ],
  },
  {
    key: "density",
    label: "Card density",
    options: [
      { value: "comfortable", label: "Comfortable" },
      { value: "compact", label: "Compact" },
    ],
  },
  {
    key: "videoStyle",
    label: "Video buttons",
    options: [
      { value: "compact", label: "Compact" },
      { value: "full", label: "Full labels" },
    ],
  },
  {
    key: "scoreStartupMode",
    label: "Scores open as",
    options: [
      { value: "previous", label: "Show previously revealed" },
      { value: "hidden", label: "Always hidden" },
      { value: "shown", label: "Always showing" },
    ],
  },
];

function readStoredSettings(): DisplaySettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const stored = JSON.parse(window.localStorage.getItem(settingsKey) || "{}") as Partial<DisplaySettings>;
    return { ...defaultSettings, ...stored };
  } catch {
    return defaultSettings;
  }
}

function baseSpoilerState(scoreCutoffDate = defaultScoreCutoffDate()): SpoilerState {
  return {
    showAllScores: false,
    scoreCutoffEnabled: false,
    scoreCutoffDate,
    revealedScoreIds: new Set(),
    hiddenScoreIds: new Set(),
    revealedGroups: new Set(),
    hiddenGroups: new Set(),
    hiddenScoresStored: true,
  };
}

function applyScoreStartupMode(spoilers: SpoilerState, startupMode: DisplaySettings["scoreStartupMode"]): SpoilerState {
  if (startupMode === "hidden") {
    return baseSpoilerState(spoilers.scoreCutoffDate);
  }

  if (startupMode === "shown") {
    return { ...baseSpoilerState(spoilers.scoreCutoffDate), showAllScores: true };
  }

  return spoilers;
}

function readStoredSpoilerState(startupMode: DisplaySettings["scoreStartupMode"] = "previous"): SpoilerState {
  if (typeof window === "undefined") {
    return applyScoreStartupMode(baseSpoilerState(), startupMode);
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(spoilerStateKey) || "{}") as {
      showAllScores?: unknown;
      scoreCutoffEnabled?: unknown;
      scoreCutoffDate?: unknown;
      revealedScores?: unknown;
      revealedScoreIds?: unknown;
      hiddenScores?: unknown;
      hiddenScoreIds?: unknown;
      revealedGroups?: unknown;
      hiddenGroups?: unknown;
    };
    const rawScores = Array.isArray(stored.revealedScoreIds)
      ? stored.revealedScoreIds
      : Array.isArray(stored.revealedScores)
        ? stored.revealedScores
        : [];
    const rawHiddenScores = Array.isArray(stored.hiddenScoreIds)
      ? stored.hiddenScoreIds
      : Array.isArray(stored.hiddenScores)
        ? stored.hiddenScores
        : [];
    const hiddenScoresStored = Array.isArray(stored.hiddenScoreIds) || Array.isArray(stored.hiddenScores);

    return applyScoreStartupMode({
      showAllScores: Boolean(stored.showAllScores),
      scoreCutoffEnabled: Boolean(stored.scoreCutoffEnabled),
      scoreCutoffDate: typeof stored.scoreCutoffDate === "string" && stored.scoreCutoffDate ? stored.scoreCutoffDate : defaultScoreCutoffDate(),
      revealedScoreIds: new Set(rawScores.map(Number).filter(Number.isFinite)),
      hiddenScoreIds: new Set(rawHiddenScores.map(Number).filter(Number.isFinite)),
      revealedGroups: new Set(Array.isArray(stored.revealedGroups) ? stored.revealedGroups.filter((item): item is string => typeof item === "string") : []),
      hiddenGroups: new Set(Array.isArray(stored.hiddenGroups) ? stored.hiddenGroups.filter((item): item is string => typeof item === "string") : []),
      hiddenScoresStored,
    }, startupMode);
  } catch {
    return applyScoreStartupMode(baseSpoilerState(), startupMode);
  }
}

const teamFlagCodes: Record<string, string> = {
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

const teamFifaRanks: Record<string, number> = {
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

function kickoffDate(match: Match) {
  if (!match.time || !match.offset) {
    return new Date(`${match.date}T12:00:00-04:00`);
  }

  return new Date(`${match.date}T${match.time}:00${match.offset}`);
}

function formatDate(match: Match) {
  return kickoffDate(match).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(match: Match) {
  if (!match.time) return "Time TBD";

  return kickoffDate(match).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCompactDateTime(match: Match) {
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

function localDateKey(match: Match) {
  const date = kickoffDate(match);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function flagEmojiForCode(code?: string) {
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

function flagForTeam(team: string) {
  return flagEmojiForCode(teamFlagCodes[team]);
}

function isRealTeam(team: string) {
  return !/^(Winner|Runner-up|Best|Loser|3rd)\b/.test(team);
}

function renderTeamName(team: string, className = "team-name") {
  const flag = flagForTeam(team);
  const classes = `${className}${isRealTeam(team) ? "" : " is-team-placeholder"}`;

  return (
    <span className={classes}>
      {flag ? <span aria-hidden="true" className="team-flag">{flag}</span> : null}
      <span className="team-label">{team}</span>
    </span>
  );
}

function teamRank(team: string) {
  return teamFifaRanks[team] ?? null;
}

function renderRankingRow(match: Match) {
  const homeRank = teamRank(match.home);
  const awayRank = teamRank(match.away);

  if (!homeRank || !awayRank) {
    return null;
  }

  const rankings = [
    { team: match.home, rank: homeRank, order: 0 },
    { team: match.away, rank: awayRank, order: 1 },
  ].sort((a, b) => a.rank - b.rank || a.order - b.order);

  return (
    <div>
      <dt>Rankings</dt>
      <dd>
        <span aria-label="FIFA rankings" className="detail-rankings">
          {rankings.map((item, index) => (
            <span className={`detail-ranking ${index === 0 ? "is-top-ranked" : ""}`} key={item.team}>
              {renderTeamName(item.team, "detail-ranking-team")}
              <span className="detail-ranking-number">#{item.rank}</span>
            </span>
          ))}
        </span>
      </dd>
    </div>
  );
}

function inputDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function defaultScoreCutoffDate() {
  const date = new Date();
  date.setDate(date.getDate() - 5);
  return inputDateValue(date);
}

function timelineLandingCutoffKey(now: Date) {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  return inputDateValue(cutoff);
}

function matchState(match: Match, now: Date): MatchState {
  if (match.status === "completed") return "completed";
  if (!match.time) return "scheduled";

  const start = kickoffDate(match).getTime();
  const elapsed = now.getTime() - start;
  const liveWindow = 1000 * 60 * 150;

  if (elapsed >= 0 && elapsed <= liveWindow) return "live";
  if (elapsed > liveWindow) return "needs-result";
  return "scheduled";
}

function scoreText(match: Match) {
  if (typeof match.homeScore === "number" && typeof match.awayScore === "number") {
    return `${match.homeScore} - ${match.awayScore}`;
  }

  return "vs";
}

function hasMatchScore(match: Match) {
  return typeof match.homeScore === "number" && typeof match.awayScore === "number";
}

function hasDirectVideo(match: Match) {
  return Boolean(match.videos?.extended?.url || match.videos?.short?.url);
}

function isScorePending(match: Match, state: MatchState) {
  return !hasMatchScore(match) && (state === "live" || state === "needs-result" || state === "completed" || hasDirectVideo(match));
}

function videoStatus(match: Match, state: MatchState) {
  if (hasDirectVideo(match)) return "";
  if (state === "live") return "Game In Progress";
  if (state === "completed" || state === "needs-result") return "Game Completed, highlights not ready yet";
  return "";
}

function videoDuration(kind: "extended" | "short", video?: VideoLink | null) {
  const duration = video?.durationText || (kind === "extended" ? "20 min" : "4 min");
  return duration.replace(/^~\s*/, "");
}

function videoDurationChip(kind: "extended" | "short", video?: VideoLink | null) {
  const match = videoDuration(kind, video).match(/\d+/);
  const minutes = match?.[0] ?? (kind === "extended" ? "20" : "4");
  return `${minutes} min`;
}

function youtubeSearchUrl(match: Match) {
  const query = `Fox Sports ${match.home} vs ${match.away} Highlights`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function canSearchVideo(state: MatchState) {
  return state === "completed" || state === "needs-result" || state === "live";
}

function matchNotice(match: Match, state: MatchState) {
  if (state === "live") return "Game In Progress";
  if ((state === "completed" || state === "needs-result") && !hasDirectVideo(match)) {
    return "Game Completed, highlights not ready yet";
  }
  return "";
}

function groupByDate(matches: Match[]) {
  return matches.reduce<Record<string, Match[]>>((acc, match) => {
    const key = localDateKey(match);
    acc[key] = acc[key] ?? [];
    acc[key].push(match);
    return acc;
  }, {});
}

function standingsFor(matches: Match[]) {
  const rows = new Map<string, Standing>();

  function ensure(team: string) {
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

    return rows.get(team)!;
  }

  for (const match of matches) {
    ensure(match.home);
    ensure(match.away);

    if (
      match.status !== "completed" ||
      typeof match.homeScore !== "number" ||
      typeof match.awayScore !== "number"
    ) {
      continue;
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
  }

  return [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });
}

export default function WorldCupDashboard() {
  const initialSettings = useMemo(readStoredSettings, []);
  const initialSpoilers = useMemo(() => readStoredSpoilerState(initialSettings.scoreStartupMode), [initialSettings]);
  const [mode, setMode] = useState<ViewMode>("timeline");
  const [countryMode, setCountryMode] = useState<"all" | "custom">("all");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(() => new Set());
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settings, setSettings] = useState<DisplaySettings>(initialSettings);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [showAllScores, setShowAllScores] = useState(initialSpoilers.showAllScores);
  const [scoreCutoffEnabled, setScoreCutoffEnabled] = useState(initialSpoilers.scoreCutoffEnabled);
  const [scoreCutoffDate, setScoreCutoffDate] = useState(initialSpoilers.scoreCutoffDate);
  const [revealedScoreIds, setRevealedScoreIds] = useState<Set<number>>(() => new Set(initialSpoilers.revealedScoreIds));
  const [hiddenScoreIds, setHiddenScoreIds] = useState<Set<number>>(() => new Set(initialSpoilers.hiddenScoreIds));
  const [revealedGroups, setRevealedGroups] = useState<Set<string>>(() => new Set(initialSpoilers.revealedGroups));
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(() => new Set(initialSpoilers.hiddenGroups));
  const [mapVenueId, setMapVenueId] = useState<string | null>(null);
  const [timelineAutoScrolled, setTimelineAutoScrolled] = useState(false);
  const [todayJumpDirection, setTodayJumpDirection] = useState<TodayJumpDirection>(null);
  const [todayJumpTop, setTodayJumpTop] = useState(132);
  const [now, setNow] = useState(() => new Date());
  const urlStateLoaded = useRef(false);
  const spoilerSaveReady = useRef(false);
  const todayPulseTimer = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch {
      // Settings are optional device preferences.
    }
  }, [settings]);

  useEffect(() => {
    if (!spoilerSaveReady.current) {
      spoilerSaveReady.current = true;
      return;
    }

    try {
      window.localStorage.setItem(
        spoilerStateKey,
        JSON.stringify({
          showAllScores,
          scoreCutoffEnabled,
          scoreCutoffDate,
          revealedScores: [...revealedScoreIds],
          hiddenScores: [...hiddenScoreIds],
          revealedGroups: [...revealedGroups],
          hiddenGroups: [...hiddenGroups],
        }),
      );
    } catch {
      // Spoiler reveal state is a best-effort device preference.
    }
  }, [showAllScores, scoreCutoffEnabled, scoreCutoffDate, revealedScoreIds, hiddenScoreIds, revealedGroups, hiddenGroups]);

  useEffect(() => {
    if (!mapVenueId && !countryPickerOpen && !mobileMenuOpen && !settingsOpen && !feedbackOpen) return undefined;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMapVenueId(null);
        setCountryPickerOpen(false);
        setMobileMenuOpen(false);
        setSettingsOpen(false);
        setFeedbackOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapVenueId, countryPickerOpen, mobileMenuOpen, settingsOpen, feedbackOpen]);

  const matches = useMemo(
    () =>
      [...data.matches].sort(
        (a, b) => kickoffDate(a).getTime() - kickoffDate(b).getTime() || a.id - b.id,
      ),
    [],
  );
  const venues = data.venues ?? [];
  const countryOptions = useMemo(() => {
    const teams = [...new Set(matches.flatMap((match) => [match.home, match.away]).filter(isRealTeam))].sort();
    const priority = ["United States", "Argentina"].filter((team) => teams.includes(team));
    const rest = teams.filter((team) => !priority.includes(team));
    return [...priority, ...rest];
  }, [matches]);
  const visibleModes = useMemo(
    () => modes.filter((item) => item.id !== "bracket" || settings.showBracketViewOption),
    [settings.showBracketViewOption],
  );

  useEffect(() => {
    const visibleIds = new Set<number>();
    const hiddenIds = new Set<number>();

    if (initialSpoilers.showAllScores) {
      scoredMatchIds().forEach((id) => visibleIds.add(id));
    }

    initialSpoilers.revealedGroups.forEach((group) => {
      groupScoreIds(group).forEach((id) => visibleIds.add(id));
    });

    initialSpoilers.hiddenGroups.forEach((group) => {
      groupScoreIds(group).forEach((id) => {
        visibleIds.delete(id);
        hiddenIds.add(id);
      });
    });

    const hasGroupState = initialSpoilers.revealedGroups.size > 0 || initialSpoilers.hiddenGroups.size > 0;
    if (initialSpoilers.hiddenScoresStored && !initialSpoilers.showAllScores && !hasGroupState) return;

    setRevealedScoreIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => next.add(id));
      hiddenIds.forEach((id) => next.delete(id));
      return next;
    });
    setHiddenScoreIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => next.delete(id));
      hiddenIds.forEach((id) => next.add(id));
      return next;
    });
    setRevealedGroups(new Set());
    setHiddenGroups(new Set());
  }, [initialSpoilers, matches]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const countrySet = new Set(countryOptions);

    setMode(
      view && modeIds.includes(view as ViewMode) && (view !== "bracket" || settings.showBracketViewOption)
        ? (view as ViewMode)
        : "timeline",
    );
    if (params.get("countries") === "none") {
      setCountryMode("custom");
      setSelectedCountries(new Set());
    } else {
      const nextCountries = new Set(params.getAll("country").filter((country) => countrySet.has(country)));
      if (nextCountries.size > 0 && nextCountries.size !== countrySet.size) {
        setCountryMode("custom");
        setSelectedCountries(nextCountries);
      } else {
        setCountryMode("all");
        setSelectedCountries(new Set());
      }
    }
    urlStateLoaded.current = true;
  }, [countryOptions, settings.showBracketViewOption]);

  useEffect(() => {
    if (!settings.showBracketViewOption && mode === "bracket") {
      setMode("timeline");
      setTimelineAutoScrolled(false);
    }
  }, [mode, settings.showBracketViewOption]);

  useEffect(() => {
    if (!urlStateLoaded.current) return;

    const params = new URLSearchParams();
    if (mode !== "timeline" && (mode !== "bracket" || settings.showBracketViewOption)) params.set("view", mode);
    if (countryMode === "custom" && selectedCountries.size === 0) {
      params.set("countries", "none");
    } else if (countryMode === "custom" && !selectedAllCountries()) {
      [...selectedCountries].sort().forEach((country) => params.append("country", country));
    }

    const queryString = params.toString();
    const next = `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next !== current) {
      window.history.replaceState(null, "", next);
    }
  }, [mode, countryMode, selectedCountries, countryOptions, settings.showBracketViewOption]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const countryMatches =
        countryMode === "all" ||
        selectedCountries.has(match.home) ||
        selectedCountries.has(match.away);

      if (!countryMatches) return false;
      return true;
    });
  }, [matches, countryMode, selectedCountries]);

  useEffect(() => {
    if (timelineAutoScrolled || mode !== "timeline") return undefined;

    const frame = window.requestAnimationFrame(() => {
      const dayBands = [...document.querySelectorAll<HTMLElement>("[data-day-key]")];
      if (!dayBands.length) return;

      const cutoffKey = timelineLandingCutoffKey(now);
      const target = dayBands.find((band) => (band.dataset.dayKey ?? "") >= cutoffKey) ?? dayBands[dayBands.length - 1];
      const chrome = document.querySelector<HTMLElement>(".page-chrome");
      const offset = chrome ? Math.ceil(chrome.getBoundingClientRect().height + 14) : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      setTimelineAutoScrolled(true);
      window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [filteredMatches, mode, now, timelineAutoScrolled]);

  useEffect(() => {
    let frame = 0;

    function stickyOffset() {
      const chrome = document.querySelector<HTMLElement>(".page-chrome");
      return chrome ? Math.ceil(chrome.getBoundingClientRect().height + 14) : 0;
    }

    function updateTodayJump() {
      frame = 0;
      if (mode !== "timeline") {
        setTodayJumpDirection(null);
        return;
      }

      const target = document.querySelector<HTMLElement>(`[data-day-key="${inputDateValue(now)}"]`);
      if (!target) {
        setTodayJumpDirection(null);
        return;
      }

      const offset = stickyOffset();
      const rect = target.getBoundingClientRect();
      const anchoredAtTop = Math.abs(rect.top - offset) <= 18;
      const nextDirection: TodayJumpDirection = anchoredAtTop ? null : rect.top < offset ? "up" : "down";

      setTodayJumpTop(Math.max(12, offset + 8));
      setTodayJumpDirection((current) => current === nextDirection ? current : nextDirection);
    }

    function requestUpdate() {
      if (frame) return;
      frame = window.requestAnimationFrame(updateTodayJump);
    }

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [filteredMatches, mode, now]);

  const selectedMatch = selectedId === null ? null : matches.find((match) => match.id === selectedId) ?? null;

  const groupMatches = useMemo(
    () =>
      matches
        .filter((match) => match.stage === "Group")
        .reduce<Record<string, Match[]>>((acc, match) => {
          const group = match.group ?? "Other";
          acc[group] = acc[group] ?? [];
          acc[group].push(match);
          return acc;
        }, {}),
    [matches],
  );

  const knockoutMatches = filteredMatches.filter((match) => match.stage !== "Group");

  function hasScore(match: Match) {
    return hasMatchScore(match);
  }

  function scoreCutoffReveals(match: Match) {
    return Boolean(scoreCutoffEnabled && scoreCutoffDate && localDateKey(match) <= scoreCutoffDate);
  }

  function isScoreVisible(match: Match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match) || hiddenScoreIds.has(match.id)) return false;
    if (revealedScoreIds.has(match.id)) return true;
    if (forceHidden) return false;
    return Boolean(forceVisible || showAllScores || scoreCutoffReveals(match));
  }

  function teamResultClass(match: Match, side: "home" | "away", forceVisible = false, forceHidden = false) {
    if (
      typeof match.homeScore !== "number" ||
      typeof match.awayScore !== "number" ||
      !isScoreVisible(match, forceVisible, forceHidden) ||
      match.homeScore === match.awayScore
    ) {
      return "";
    }

    const homeWon = match.homeScore > match.awayScore;
    return (side === "home" && homeWon) || (side === "away" && !homeWon) ? "is-winner" : "is-loser";
  }

  function spoilerText(match: Match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match)) return "vs";
    return isScoreVisible(match, forceVisible, forceHidden) ? scoreText(match) : "?? - ??";
  }

  function toggleScore(match: Match) {
    const matchId = match.id;
    const visible = isScoreVisible(match);
    setRevealedScoreIds((current) => {
      const next = new Set(current);
      if (visible) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
    setHiddenScoreIds((current) => {
      const next = new Set(current);
      if (visible) {
        next.add(matchId);
      } else {
        next.delete(matchId);
      }
      return next;
    });
  }

  function scoredMatchIds(filter: (match: Match) => boolean = () => true) {
    return matches.filter((match) => hasScore(match) && filter(match)).map((match) => match.id);
  }

  function groupScoreIds(group: string) {
    return scoredMatchIds((match) => match.stage === "Group" && match.group === group);
  }

  function setScoreIdsVisible(ids: number[], visible: boolean) {
    setRevealedScoreIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (visible) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
    setHiddenScoreIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (visible) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  }

  function revealScoresThroughCutoff(cutoffDate = scoreCutoffDate) {
    if (!cutoffDate) return;

    setRevealedGroups(new Set());
    setHiddenGroups(new Set());
    setScoreIdsVisible(scoredMatchIds((match) => localDateKey(match) <= cutoffDate), true);
  }

  function renderScorePill(match: Match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match)) {
      return isScorePending(match, matchState(match, now))
        ? <span className="score-pill score-pending">Score pending</span>
        : <span className="score-pill score-empty">vs</span>;
    }
    const visible = isScoreVisible(match, forceVisible, forceHidden);

    return (
      <button
        aria-label={visible ? "Hide score" : "Reveal score"}
        className={`score-pill ${visible ? "score-revealed" : "score-hidden"}`}
        data-score-tooltip={visible ? "Click to hide" : "Click to reveal"}
        onClick={(event) => {
          event.stopPropagation();
          toggleScore(match);
        }}
        type="button"
      >
        <span className="score-hidden-text">{spoilerText(match, forceVisible, forceHidden)}</span>
      </button>
    );
  }

  function countryFilterLabel() {
    if (countryMode === "all") return "All countries";
    if (selectedCountries.size === 0) return "No countries";
    if (selectedAllCountries()) return "All countries";
    if (selectedCountries.size === 1) return [...selectedCountries][0];
    return `${selectedCountries.size} countries`;
  }

  function selectedCountryList() {
    if (selectedAllCountries()) return [];
    return countryOptions.filter((country) => selectedCountries.has(country));
  }

  function countryFilterTitle(countries = selectedCountryList()) {
    if (countryMode === "all" || selectedAllCountries()) return "All countries";
    if (countries.length === 0) return "No countries selected";
    return countries.join(", ");
  }

  function renderCountryFlagStrip(countries = selectedCountryList(), limit = 5) {
    if (!countries.length) return null;

    const visible = countries.slice(0, limit);
    const overflow = countries.length - visible.length;

    return (
      <>
        <span className="country-filter-flags" aria-hidden="true">
          {visible.map((country) => {
            const flag = flagForTeam(country);
            if (!flag) return null;
            return (
              <span className="country-filter-flag" key={country} title={country}>
                {flag}
              </span>
            );
          })}
          {overflow > 0 ? (
            <span className="country-filter-more" title={countryFilterTitle(countries)}>
              +{overflow}
            </span>
          ) : null}
        </span>
        {overflow > 0 ? (
          <span className="sr-only">{overflow} more {overflow === 1 ? "country" : "countries"}</span>
        ) : null}
      </>
    );
  }

  function renderCountryFilterContent({ compact = false } = {}) {
    const countries = selectedCountryList();
    return (
      <span className="country-filter-main">
        <strong className="country-filter-text">{countryFilterLabel()}</strong>
        {renderCountryFlagStrip(countries, compact ? 3 : 5)}
      </span>
    );
  }

  function currentModeLabel() {
    return modes.find((item) => item.id === mode)?.label ?? "Schedule";
  }

  function selectedAllCountries() {
    return countryMode === "all" || Boolean(countryOptions.length && selectedCountries.size === countryOptions.length);
  }

  function countryIsSelected(country: string) {
    return countryMode === "all" || selectedCountries.has(country);
  }

  function changeMode(nextMode: ViewMode) {
    setMode((current) => {
      if (current !== nextMode) {
        setTimelineAutoScrolled(false);
        if (nextMode !== "timeline") {
          window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
        }
      }
      return nextMode;
    });
    setMobileMenuOpen(false);
  }

  function changeSetting(key: keyof DisplaySettings, value: DisplaySettings[keyof DisplaySettings]) {
    setSettings((current) => ({ ...current, [key]: value }) as DisplaySettings);
    if (key === "timelineStart") {
      setTimelineAutoScrolled(false);
      if (mode !== "timeline") {
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      }
    }
    if (key === "showBracketViewOption" && !value && mode === "bracket") {
      setMode("timeline");
      setTimelineAutoScrolled(false);
    }
    if (key === "scoreStartupMode") {
      const nextSpoilers = readStoredSpoilerState(value as DisplaySettings["scoreStartupMode"]);
      setShowAllScores(nextSpoilers.showAllScores);
      setScoreCutoffEnabled(nextSpoilers.scoreCutoffEnabled);
      setScoreCutoffDate(nextSpoilers.scoreCutoffDate);
      setRevealedScoreIds(new Set(nextSpoilers.revealedScoreIds));
      setHiddenScoreIds(new Set(nextSpoilers.hiddenScoreIds));
      setRevealedGroups(new Set(nextSpoilers.revealedGroups));
      setHiddenGroups(new Set(nextSpoilers.hiddenGroups));
      if (nextSpoilers.showAllScores) {
        setScoreIdsVisible(scoredMatchIds(), true);
      }
      nextSpoilers.revealedGroups.forEach((group) => setScoreIdsVisible(groupScoreIds(group), true));
      nextSpoilers.hiddenGroups.forEach((group) => setScoreIdsVisible(groupScoreIds(group), false));
      setRevealedGroups(new Set());
      setHiddenGroups(new Set());
    }
  }

  function toggleCountry(country: string) {
    const next = countryMode === "all"
      ? new Set(countryOptions.filter((team) => team !== country))
      : new Set(selectedCountries);

    if (countryMode !== "all") {
      if (next.has(country)) {
        next.delete(country);
      } else {
        next.add(country);
      }
    }

    if (next.size === countryOptions.length) {
      setCountryMode("all");
      setSelectedCountries(new Set());
    } else {
      setCountryMode("custom");
      setSelectedCountries(next);
    }
  }

  function venueFor(match: Match) {
    if (!match.venueId) return null;
    return venues.find((venue) => venue.id === match.venueId) ?? null;
  }

  function venueLocation(venue?: Venue | null) {
    if (!venue) return "Venue TBD";
    return [venue.city, venue.region ?? venue.country].filter(Boolean).join(", ");
  }

  function venueDisplayName(venue?: Venue | null) {
    if (!venue) return "Venue TBD";
    return `${venueLocation(venue)} - ${venue.stadium || venue.fifaName}`;
  }

  function renderVenueButton(match: Match) {
    const venue = venueFor(match);

    if (!venue) return <span className="venue-empty">Venue TBD</span>;

    return (
      <button
        className="venue-link"
        onClick={(event) => {
          event.stopPropagation();
          setMapVenueId(venue.id);
        }}
        type="button"
      >
        <span>{venueLocation(venue)}</span>
        <small>{venue.stadium || venue.fifaName}</small>
      </button>
    );
  }

  function isGroupRevealed(group: string) {
    if (completedGroupScoresVisible(group)) return true;
    return false;
  }

  function completedGroupScoresVisible(group: string) {
    const completed = (groupMatches[group] ?? []).filter((match) => match.status === "completed" && hasScore(match));
    return completed.length > 0 && completed.every((match) => isScoreVisible(match));
  }

  function hiddenStat() {
    return <span aria-label="Hidden until revealed" className="hidden-stat">??</span>;
  }

  function renderVideoLink(kind: "extended" | "short", video: VideoLink) {
    const visibleLabel = "Highlights";

    return (
      <a
        aria-label={`Open ${videoDuration(kind, video)} ${visibleLabel} on YouTube`}
        className={`video-link video-link-${kind}`}
        href={video.url}
        key={`${kind}-${video.url}`}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
        title="Open Highlights on YouTube"
      >
        <span aria-hidden="true" className="yt-mark" />
        <small>{videoDuration(kind, video)}</small>
        <span className="video-link-label">{visibleLabel}</span>
      </a>
    );
  }

  function renderTileVideoLink(kind: "extended" | "short", video: VideoLink) {
    const label = "Highlights";

    return (
      <a
        aria-label={`Open ${label} on YouTube`}
        className={`tile-video-link tile-video-link-${kind}`}
        href={video.url}
        key={`tile-${kind}-${video.url}`}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
        title={`Open ${label} on YouTube`}
      >
        <span aria-hidden="true" className="yt-mark" />
        <span>{videoDurationChip(kind, video)}</span>
      </a>
    );
  }

  function renderTileVideoLinks(match: Match) {
    const short = match.videos?.short ?? null;
    const extended = match.videos?.extended ?? null;
    const links = [
      short?.url ? renderTileVideoLink("short", short) : null,
      extended?.url ? renderTileVideoLink("extended", extended) : null,
    ].filter(Boolean);

    return links.length ? <div className="tile-video-links">{links}</div> : null;
  }

  function renderVideoSearchLink(match: Match) {
    return (
      <a
        aria-label="Search YouTube"
        className="video-link video-link-search"
        href={youtubeSearchUrl(match)}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
        title="Search YouTube"
      >
        <span aria-hidden="true" className="yt-mark" />
        <small>YouTube</small>
        <span className="video-link-label">{settings.videoStyle === "full" ? "YouTube Search" : "Search"}</span>
      </a>
    );
  }

  function renderInlineVideoLinks(match: Match) {
    const short = match.videos?.short ?? null;
    const extended = match.videos?.extended ?? null;
    const links = [
      short?.url ? renderVideoLink("short", short) : null,
      extended?.url ? renderVideoLink("extended", extended) : null,
    ].filter(Boolean);

    if (!links.length && canSearchVideo(matchState(match, now))) {
      return (
        <span className="video-links video-search-links">
          {renderVideoSearchLink(match)}
        </span>
      );
    }

    if (!links.length) {
      return null;
    }

    return <span className="video-links">{links}</span>;
  }

  function renderMatchCard(match: Match, variant = "match-card") {
    const state = matchState(match, now);
    const notice = matchNotice(match, state);
    const videoLinks = renderInlineVideoLinks(match);

    return (
      <article className={`${variant} is-${state}`} key={match.id}>
        <div
          className="match-select"
          onClick={() => {
            setSelectedId(match.id);
            setDetailOpen(true);
          }}
          role="button"
          tabIndex={0}
        >
          <span className="card-meta">
            <span>{match.group ? `Group ${match.group}` : match.stage}</span>
            <span>{formatTime(match)}</span>
          </span>
          <span className="teams">
            {renderTeamName(match.home, `team-name ${teamResultClass(match, "home")}`)}
            {renderScorePill(match)}
            {renderTeamName(match.away, `team-name team-away ${teamResultClass(match, "away")}`)}
          </span>
          {notice || videoLinks ? (
            <span className="card-footer">
              {notice ? <span className="match-notice">{notice}</span> : <span />}
              {videoLinks ? <span className={hasDirectVideo(match) ? "video-ready" : ""}>{videoLinks}</span> : <span />}
            </span>
          ) : null}
        </div>
      </article>
    );
  }

  function renderVideoActions(match: Match) {
    const state = matchState(match, now);
    const extended = match.videos?.extended ?? null;
    const short = match.videos?.short ?? null;
    const actions: ReactNode[] = [];

    if (short?.url) {
      actions.push(renderVideoLink("short", short));
    }

    if (extended?.url) {
      actions.push(renderVideoLink("extended", extended));
    }

    return (
      <div className="video-actions">
        {actions.length ? actions : canSearchVideo(state) ? (
          renderVideoSearchLink(match)
        ) : (
          matchNotice(match, state) ? <span>{matchNotice(match, state)}</span> : null
        )}
      </div>
    );
  }

  function renderTimeline() {
    const byDate = groupByDate(filteredMatches);
    const todayKey = inputDateValue(now);

    return (
      <div className="timeline-layout">
        <div className="date-stream">
          {Object.entries(byDate).map(([date, dayMatches]) => (
            <section className={`day-band ${date === todayKey ? "is-today" : ""}`} data-day-key={date} key={date}>
              <div className="day-label">
                <strong>{formatDate(dayMatches[0])}</strong>
                {date === todayKey ? <span className="today-badge">Today</span> : null}
                <em>{dayMatches.length} {dayMatches.length === 1 ? "match" : "matches"}</em>
              </div>
              <div className="day-matches">{dayMatches.map((match) => renderMatchCard(match))}</div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  function renderGroups() {
    const groups = Object.keys(groupMatches).sort();

    return (
      <div className="groups-layout">
        {groups.map((group) => {
          const sortedGroupMatches = [...groupMatches[group]].sort(
            (a, b) => kickoffDate(a).getTime() - kickoffDate(b).getTime() || a.id - b.id,
          );
          const visibleGroupMatches = countryMode === "all"
            ? sortedGroupMatches
            : sortedGroupMatches.filter((match) => selectedCountries.has(match.home) || selectedCountries.has(match.away));

          if (countryMode !== "all" && visibleGroupMatches.length === 0) {
            return null;
          }

          const standings = standingsFor(groupMatches[group]);
          const teams = [...new Set(groupMatches[group].flatMap((match) => [match.home, match.away]))].sort();
          const revealed = isGroupRevealed(group);

          return (
            <section className="group-board" key={group}>
              <header>
                <div>
                  <span>Group {group}</span>
                  <strong>{visibleGroupMatches.length} {visibleGroupMatches.length === 1 ? "match" : "matches"}</strong>
                </div>
                <button
                  aria-pressed={revealed}
                  className="group-reveal"
                  onClick={() => {
                    const ids = groupScoreIds(group);
                    if (revealed) {
                      setScoreIdsVisible(ids, false);
                    } else {
                      setScoreIdsVisible(ids, true);
                    }
                    setRevealedGroups((current) => {
                      const next = new Set(current);
                      next.delete(group);
                      return next;
                    });
                    setHiddenGroups((current) => {
                      const next = new Set(current);
                      next.delete(group);
                      return next;
                    });
                  }}
                  type="button"
                >
                  {revealed ? "Hide scores" : "Show scores"}
                </button>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Pts</th>
                    <th><span className="stat-help" title="Goal difference: goals scored minus goals conceded">GD</span></th>
                    <th><span className="stat-help" title="Games played">GP</span></th>
                  </tr>
                </thead>
                <tbody>
                  {revealed
                    ? standings.map((row) => (
                        <tr key={row.team}>
                          <td>{renderTeamName(row.team, "standing-team-name")}</td>
                          <td>{row.points}</td>
                          <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                          <td>{row.played}</td>
                        </tr>
                      ))
                    : teams.map((team) => (
                        <tr key={team}>
                          <td>{renderTeamName(team, "standing-team-name")}</td>
                          <td>{hiddenStat()}</td>
                          <td>{hiddenStat()}</td>
                          <td>{hiddenStat()}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
              <div className="group-fixtures">
                {visibleGroupMatches.map((match) => {
                  const state = matchState(match, now);
                  return (
                    <article className={`fixture-row is-${state}`} key={match.id}>
                      <div
                        className="fixture-select"
                        onClick={() => {
                          setSelectedId(match.id);
                          setDetailOpen(true);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="fixture-time">{formatCompactDateTime(match)}</span>
                        <span className="fixture-teams">
                          {renderTeamName(match.home, `fixture-team fixture-home ${teamResultClass(match, "home")}`)}
                          {renderScorePill(match)}
                          {renderTeamName(match.away, `fixture-team fixture-away ${teamResultClass(match, "away")}`)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  function renderBracket() {
    const rounds = ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Third Place", "Final"];
    if (knockoutMatches.length === 0) {
      return (
        <div className="empty-state">
          <strong>No knockout matches found</strong>
          <span>Adjust the country filter or switch to the schedule.</span>
        </div>
      );
    }

    return (
      <div className="bracket-layout">
        {rounds.map((round) => {
          const roundMatches = knockoutMatches.filter((match) => match.stage === round);
          if (roundMatches.length === 0) return null;

          return (
            <section className="bracket-round" key={round}>
              <header>{round}</header>
              <div className="bracket-stack">
                {roundMatches.map((match) => renderMatchCard(match, "bracket-slot"))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  function renderConstellation() {
    return (
      <div className="constellation-layout">
        {filteredMatches.map((match) => {
          const state = matchState(match, now);
          return (
            <article
              className={`star-node is-${state}`}
              key={match.id}
            >
              <div
                className="star-select"
                onClick={() => {
                  setSelectedId(match.id);
                  setDetailOpen(true);
                }}
                role="button"
                tabIndex={0}
              >
                <span className="tile-time">{formatCompactDateTime(match)}</span>
                <div className="tile-teams">
                  <strong>{renderTeamName(match.home, `star-team-name ${teamResultClass(match, "home")}`)}</strong>
                  <span className="tile-score">{renderScorePill(match)}</span>
                  <strong>{renderTeamName(match.away, `star-team-name ${teamResultClass(match, "away")}`)}</strong>
                </div>
              </div>
              {renderTileVideoLinks(match)}
            </article>
          );
        })}
      </div>
    );
  }

  function renderDetailPanel(match: Match) {
    const state = matchState(match, now);

    return (
      <aside className={`detail-panel is-${state}`}>
        <div className="detail-panel-header">
          <span className="eyebrow">Match details</span>
          <button
            aria-label="Minimize match details"
            className="icon-button"
            onClick={() => setDetailOpen(false)}
            title="Minimize match details"
            type="button"
          >
            ×
          </button>
        </div>
        <h2 className="detail-title-teams">
          {renderTeamName(match.home, `detail-team-name ${teamResultClass(match, "home")}`)}
          <span className="detail-vs">vs</span>
          {renderTeamName(match.away, `detail-team-name ${teamResultClass(match, "away")}`)}
        </h2>
        <div className="detail-score">{renderScorePill(match)}</div>
        <dl>
          {renderRankingRow(match)}
          <div>
            <dt>Stage</dt>
            <dd>{match.group ? `Group ${match.group}` : match.stage}</dd>
          </div>
          <div>
            <dt>Match #</dt>
            <dd>{match.id}</dd>
          </div>
          <div>
            <dt>Kickoff</dt>
            <dd>{formatDate(match)} at {formatTime(match)}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{renderVenueButton(match)}</dd>
          </div>
          <div>
            <dt>Broadcast</dt>
            <dd>{match.network ?? "TBD"}</dd>
          </div>
          {matchNotice(match, state) ? (
            <div>
              <dt>Status</dt>
              <dd>{matchNotice(match, state)}</dd>
            </div>
          ) : null}
        </dl>
        {videoStatus(match, state) ? <div className="detail-video-state">{videoStatus(match, state)}</div> : null}
        {renderVideoActions(match)}
        {match.videos?.lastCheckedAt ? (
          <p className="last-checked">Checked {new Date(match.videos.lastCheckedAt).toLocaleString()}</p>
        ) : null}
      </aside>
    );
  }

  function renderDetailHandle(match: Match) {
    return (
      <button
        aria-label="Show match details"
        className="detail-mini"
        onClick={() => setDetailOpen(true)}
        title="Show match details"
        type="button"
      >
        <span>Match details</span>
        <strong>{renderTeamName(match.home, "mini-team-name")} vs {renderTeamName(match.away, "mini-team-name")}</strong>
      </button>
    );
  }

  function renderCountryPicker() {
    if (!countryPickerOpen) return null;

    return (
      <div
        aria-label="Country filter"
        aria-modal="true"
        className="country-picker-modal"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setCountryPickerOpen(false);
          }
        }}
        role="dialog"
      >
        <section className="country-picker-panel">
          <header className="country-picker-header">
            <div>
              <span className="eyebrow">Country filter</span>
              <h2>{countryFilterLabel()}</h2>
            </div>
            <button
              aria-label="Close country filter"
              className="icon-button"
              onClick={() => setCountryPickerOpen(false)}
              title="Close country filter"
              type="button"
            >
              ×
            </button>
          </header>
          <div className="country-picker-actions">
            <button
              aria-pressed={countryMode === "all"}
              className="country-option country-option-all"
              onClick={() => {
                setCountryMode((mode) => (mode === "all" ? "custom" : "all"));
                setSelectedCountries(new Set());
              }}
              type="button"
            >
              <span aria-hidden="true" className="country-check">{countryMode === "all" ? "✓" : ""}</span>
              <span className="country-option-name"><span className="team-label">All countries</span></span>
            </button>
            <button
              className="country-clear"
              onClick={() => {
                setCountryMode("custom");
                setSelectedCountries(new Set());
              }}
              type="button"
            >
              Clear selected
            </button>
          </div>
          <div className="country-options">
            {countryOptions.map((country) => {
              const selected = countryIsSelected(country);
              const priority = country === "United States" || country === "Argentina" ? "is-priority" : "";
              return (
                <button
                  aria-pressed={selected}
                  className={`country-option ${priority}`}
                  key={country}
                  onClick={() => toggleCountry(country)}
                  type="button"
                >
                  <span aria-hidden="true" className="country-check">{selected ? "✓" : ""}</span>
                  {renderTeamName(country, "country-option-name")}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderSettingsModal() {
    if (!settingsOpen) return null;

    return (
      <div
        aria-label="Display settings"
        aria-modal="true"
        className="settings-modal"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSettingsOpen(false);
          }
        }}
        role="dialog"
      >
        <section className="settings-panel">
          <header className="settings-header">
            <div>
              <span className="eyebrow">Settings</span>
              <h2>Display</h2>
            </div>
            <button
              aria-label="Close settings"
              className="icon-button settings-close"
              onClick={() => setSettingsOpen(false)}
              title="Close settings"
              type="button"
            >
              ×
            </button>
          </header>
          {settingGroups.map((group) => (
            <section className="settings-section" key={group.key}>
              <span>{group.label}</span>
              <div className="settings-options">
                {group.options.map((option) => (
                  <button
                    aria-pressed={settings[group.key] === option.value}
                    key={`${group.key}-${option.value}`}
                    onClick={() => changeSetting(group.key, option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <section className="settings-section settings-view-section">
            <span>Views</span>
            <label className="settings-toggle">
              <input
                checked={settings.showBracketViewOption}
                onChange={(event) => changeSetting("showBracketViewOption", event.target.checked)}
                type="checkbox"
              />
              <span>Show Bracket View Option</span>
            </label>
          </section>
          <section className="settings-section settings-score-section">
            <span>Score reveal</span>
            <div
              className="settings-score-card score-date-control"
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.matches('input[type="checkbox"]')) return;

                if (!scoreCutoffEnabled) {
                  setScoreCutoffEnabled(true);
                  revealScoresThroughCutoff();
                }

                const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="date"]');
                if (input) {
                  input.focus();
                  const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
                  try {
                    pickerInput.showPicker?.();
                  } catch {
                    // Some browsers open the picker from the native input click first.
                  }
                }
              }}
            >
              <label className="score-date-toggle">
                <input
                  checked={scoreCutoffEnabled}
                  onChange={(event) => {
                    setScoreCutoffEnabled(event.target.checked);
                    if (event.target.checked) {
                      revealScoresThroughCutoff();
                    }
                  }}
                  type="checkbox"
                />
                <span>Show scores before</span>
              </label>
              <input
                aria-label="Show scores before date"
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setScoreCutoffDate(nextDate);
                  setScoreCutoffEnabled(Boolean(nextDate));
                  if (nextDate) {
                    revealScoresThroughCutoff(nextDate);
                  }
                }}
                type="date"
                value={scoreCutoffDate}
              />
            </div>
          </section>
          <footer className="settings-footer">
            <button
              onClick={() => {
                setSettings(defaultSettings);
                setTimelineAutoScrolled(false);
              }}
              type="button"
            >
              Reset defaults
            </button>
            <span>Saved on this device</span>
          </footer>
        </section>
      </div>
    );
  }

  function renderFeedbackModal() {
    if (!feedbackOpen) return null;

    return (
      <div
        aria-label="Feedback and suggestions"
        aria-modal="true"
        className="feedback-modal"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setFeedbackOpen(false);
          }
        }}
        role="dialog"
      >
        <section className="feedback-panel">
          <header className="feedback-header">
            <div>
              <span className="eyebrow">Feedback</span>
              <h2>Suggestions</h2>
              <p>Share ideas, bugs, or anything that would make this better.</p>
            </div>
            <button
              aria-label="Close feedback"
              className="icon-button feedback-close"
              onClick={() => setFeedbackOpen(false)}
              title="Close feedback"
              type="button"
            >
              ×
            </button>
          </header>
          <div className="feedback-frame-wrap">
            <iframe
              className="feedback-frame"
              loading="lazy"
              src={feedbackEmbedUrl}
              title="World Cup Highlights feedback form"
            >
              Loading feedback form
            </iframe>
          </div>
          <footer className="feedback-footer">
            <a href={feedbackFormUrl} rel="noreferrer" target="_blank">
              Open in Google Forms
            </a>
          </footer>
        </section>
      </div>
    );
  }

  function renderStadiumMap() {
    const selectedVenue = mapVenueId ? venues.find((venue) => venue.id === mapVenueId) ?? null : null;
    if (!selectedVenue) return null;

    return (
      <div
        aria-label="World Cup stadium map"
        aria-modal="true"
        className="stadium-map-modal"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setMapVenueId(null);
          }
        }}
        role="dialog"
      >
        <section className="stadium-map-panel">
          <header className="stadium-map-header">
            <div>
              <span className="eyebrow">Stadium map</span>
              <h2>{selectedVenue.fifaName || selectedVenue.stadium}</h2>
              <p>{venueDisplayName(selectedVenue)}</p>
            </div>
            <button
              aria-label="Close stadium map"
              className="icon-button"
              onClick={() => setMapVenueId(null)}
              title="Close stadium map"
              type="button"
            >
              ×
            </button>
          </header>
          <div aria-label="Host cities map" className="stadium-map-art">
            {venues.map((venue) => (
              <button
                aria-label={venueDisplayName(venue)}
                className={`stadium-dot ${venue.id === selectedVenue.id ? "is-selected" : ""}`}
                key={venue.id}
                onClick={() => setMapVenueId(venue.id)}
                style={{ "--x": venue.mapX, "--y": venue.mapY } as CSSProperties}
                title={venueDisplayName(venue)}
                type="button"
              >
                <span>{venue.city}</span>
              </button>
            ))}
          </div>
          <div className="stadium-list">
            {venues.map((venue) => (
              <button
                className={`stadium-list-item ${venue.id === selectedVenue.id ? "is-selected" : ""}`}
                key={venue.id}
                onClick={() => setMapVenueId(venue.id)}
                type="button"
              >
                <strong>{venue.city}</strong>
                <span>{venue.stadium || venue.fifaName}</span>
                <em>{venue.region ?? venue.country ?? ""}</em>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderActiveView() {
    if (mode === "groups") return renderGroups();
    if (mode === "bracket") return renderBracket();
    if (mode === "constellation") return renderConstellation();
    return renderTimeline();
  }

  function scrollToToday() {
    const target = document.querySelector<HTMLElement>(`[data-day-key="${inputDateValue(now)}"]`);
    if (!target) return;

    const chrome = document.querySelector<HTMLElement>(".page-chrome");
    const offset = chrome ? Math.ceil(chrome.getBoundingClientRect().height + 14) : 0;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

    if (todayPulseTimer.current) {
      window.clearTimeout(todayPulseTimer.current);
    }
    target.classList.remove("is-jump-target");
    void target.offsetWidth;
    target.classList.add("is-jump-target");
    todayPulseTimer.current = window.setTimeout(() => target.classList.remove("is-jump-target"), 1200);
  }

  return (
    <main className="app-shell" data-density={settings.density} data-theme={settings.theme} data-video-style={settings.videoStyle} data-view={mode}>
      <div className="hero-texture" aria-hidden="true" />
      <div className="page-chrome">
        <header className="topbar">
          <div>
            <span className="eyebrow">2026</span>
            <h1><a aria-label="World Cup Highlights" className="home-title" href={typeof window === "undefined" ? "/" : window.location.pathname}>W<span aria-hidden="true" className="title-ball"><span className="title-ball-icon">⚽</span><span className="title-ball-letter">o</span></span>rld Cup Highlights</a></h1>
          </div>
        </header>

        <button
          aria-controls="schedule-controls"
          aria-expanded={mobileMenuOpen}
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen((value) => !value)}
          type="button"
        >
          <span aria-hidden="true" className="hamburger-icon"><i /><i /><i /></span>
          <span className="sr-only">{mobileMenuOpen ? "Close menu" : "Open menu"}</span>
          <strong>{currentModeLabel()}</strong>
        </button>

        <section className={`control-deck ${mobileMenuOpen ? "is-open" : ""}`} id="schedule-controls" aria-label="Schedule controls">
          <div className="view-toggle" aria-label="Viewing option">
            {visibleModes.map((item) => (
              <button
                aria-pressed={mode === item.id}
                key={item.id}
                onClick={() => changeMode(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          {mode === "timeline" ? (
            <button aria-label="Go to today" className="top-today-control" onClick={scrollToToday} type="button">
              <span aria-hidden="true" className="top-today-mark">↓</span>
              <strong>Today</strong>
            </button>
          ) : null}
          <button
            className="spoiler-control"
            onClick={() => {
              const nextShowAll = !showAllScores;
              setShowAllScores(nextShowAll);
              setRevealedGroups(new Set());
              setHiddenGroups(new Set());
              if (nextShowAll) {
                setScoreIdsVisible(scoredMatchIds(), true);
              } else {
                setScoreCutoffEnabled(false);
                setScoreIdsVisible(scoredMatchIds(), false);
              }
            }}
            type="button"
          >
            {showAllScores ? "Hide all scores" : "Show all scores"}
          </button>

          <div className="filters">
            <button
              aria-label={`Country filter: ${countryFilterTitle()}`}
              className="country-filter-trigger"
              onClick={() => {
                setCountryPickerOpen(true);
                setMobileMenuOpen(false);
              }}
              title={countryFilterTitle()}
              type="button"
            >
              <span className="country-filter-desktop-content">{renderCountryFilterContent()}</span>
              <span className="country-filter-mobile-content">{renderCountryFilterContent({ compact: true })}</span>
            </button>
          </div>
          <button
            aria-label="Settings"
            className="settings-trigger"
            onClick={() => {
              setSettingsOpen(true);
              setMobileMenuOpen(false);
            }}
            title="Settings"
            type="button"
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <button
            aria-label="Feedback"
            className="feedback-trigger"
            onClick={() => {
              setFeedbackOpen(true);
              setMobileMenuOpen(false);
            }}
            title="Feedback"
            type="button"
          >
            <span aria-hidden="true">?</span>
            <strong>Feedback</strong>
          </button>
        </section>
      </div>

      <section className="active-view" aria-live="polite">
        {filteredMatches.length ? renderActiveView() : (
          <div className="empty-state">
            <strong>No matches found</strong>
            <span>Adjust the country filter or switch views.</span>
          </div>
        )}
      </section>

      {selectedMatch ? (
        <div
          className={`floating-detail ${detailOpen ? "" : "is-minimized"}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setDetailOpen(false);
            }
          }}
        >
          {detailOpen ? renderDetailPanel(selectedMatch) : renderDetailHandle(selectedMatch)}
        </div>
      ) : null}

      {renderCountryPicker()}
      {renderSettingsModal()}
      {renderFeedbackModal()}
      {renderStadiumMap()}
      {mode === "timeline" ? (
        <button
          aria-hidden={todayJumpDirection ? "false" : "true"}
          aria-label={`Go to today. Today is ${todayJumpDirection === "up" ? "above" : "below"}.`}
          className={`today-jump ${todayJumpDirection ? "is-visible" : ""}`}
          data-direction={todayJumpDirection ?? "down"}
          onClick={scrollToToday}
          style={{ "--today-jump-top": `${todayJumpTop}px` } as CSSProperties}
          type="button"
        >
          <span aria-hidden="true" className="today-jump-arrow">{todayJumpDirection === "up" ? "↑" : "↓"}</span>
          <span className="today-jump-text">Today</span>
        </button>
      ) : null}

      <footer className="source-strip">
        <span>Data refreshed {data.generatedAt}</span>
        {data.sources.map((source) => (
          <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
            {source.label}
          </a>
        ))}
      </footer>
    </main>
  );
}
