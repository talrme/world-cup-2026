"use client";

import rawData from "@/data/world-cup-2026.json";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "timeline" | "groups" | "bracket" | "video" | "constellation";
type MatchState = "completed" | "live" | "needs-result" | "scheduled";

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
  { id: "timeline", label: "Timeline" },
  { id: "groups", label: "Groups" },
  { id: "bracket", label: "Bracket" },
  { id: "video", label: "Video Desk" },
  { id: "constellation", label: "Constellation" },
];
const modeIds = modes.map((mode) => mode.id);

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

  return (
    <span className={className}>
      {flag ? <span aria-hidden="true" className="team-flag">{flag}</span> : null}
      <span className="team-label">{team}</span>
    </span>
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
  cutoff.setDate(cutoff.getDate() - 1);
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

function hasDirectVideo(match: Match) {
  return Boolean(match.videos?.extended?.url || match.videos?.short?.url);
}

function videoStatus(match: Match, state: MatchState) {
  if (hasDirectVideo(match)) return "Highlights";
  if (state === "completed" || state === "needs-result") return "No saved link";
  if (state === "live") return "Match live";
  return "Upcoming";
}

function videoDuration(kind: "extended" | "short", video?: VideoLink | null) {
  if (video?.durationText) return video.durationText;
  return kind === "extended" ? "~20 min" : "~4 min";
}

function youtubeSearchUrl(match: Match) {
  const query = `Fox Sports ${match.home} vs ${match.away} Highlights`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function canSearchVideo(state: MatchState) {
  return state === "completed" || state === "needs-result" || state === "live";
}

function statusLabel(state: MatchState) {
  if (state === "completed") return "Final";
  if (state === "live") return "Live window";
  if (state === "needs-result") return "Past kickoff";
  return "Scheduled";
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
  const [mode, setMode] = useState<ViewMode>("timeline");
  const [countryMode, setCountryMode] = useState<"all" | "custom">("all");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(() => new Set());
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [showAllScores, setShowAllScores] = useState(false);
  const [scoreCutoffEnabled, setScoreCutoffEnabled] = useState(false);
  const [scoreCutoffDate, setScoreCutoffDate] = useState(defaultScoreCutoffDate);
  const [revealedScoreIds, setRevealedScoreIds] = useState<Set<number>>(() => new Set());
  const [revealedGroups, setRevealedGroups] = useState<Set<string>>(() => new Set());
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(() => new Set());
  const [mapVenueId, setMapVenueId] = useState<string | null>(null);
  const [timelineAutoScrolled, setTimelineAutoScrolled] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const urlStateLoaded = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapVenueId && !countryPickerOpen) return undefined;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMapVenueId(null);
        setCountryPickerOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mapVenueId, countryPickerOpen]);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    const countrySet = new Set(countryOptions);

    setMode(view && modeIds.includes(view as ViewMode) ? (view as ViewMode) : "timeline");
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
  }, [countryOptions]);

  useEffect(() => {
    if (!urlStateLoaded.current) return;

    const params = new URLSearchParams();
    if (mode !== "timeline") params.set("view", mode);
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
  }, [mode, countryMode, selectedCountries, countryOptions]);

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
    return typeof match.homeScore === "number" && typeof match.awayScore === "number";
  }

  function scoreCutoffReveals(match: Match) {
    return Boolean(scoreCutoffEnabled && scoreCutoffDate && localDateKey(match) <= scoreCutoffDate);
  }

  function isScoreVisible(match: Match, forceVisible = false, forceHidden = false) {
    return hasScore(match) && !forceHidden && (forceVisible || showAllScores || scoreCutoffReveals(match) || revealedScoreIds.has(match.id));
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

  function toggleScore(matchId: number) {
    setRevealedScoreIds((current) => {
      const next = new Set(current);
      if (next.has(matchId)) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  }

  function renderScorePill(match: Match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match)) return <span className="score-pill score-empty">vs</span>;
    const visible = isScoreVisible(match, forceVisible, forceHidden);

    if (visible && (forceVisible || showAllScores || scoreCutoffReveals(match))) {
      return <span className="score-pill score-revealed">{scoreText(match)}</span>;
    }

    return (
      <button
        aria-label={visible ? "Hide score" : "Reveal score"}
        className={`score-pill ${visible ? "score-revealed" : "score-hidden"}`}
        onClick={(event) => {
          event.stopPropagation();
          toggleScore(match.id);
        }}
        type="button"
      >
        {spoilerText(match, forceVisible, forceHidden)}
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

  function selectedAllCountries() {
    return countryMode === "all" || Boolean(countryOptions.length && selectedCountries.size === countryOptions.length);
  }

  function countryIsSelected(country: string) {
    return countryMode === "all" || selectedCountries.has(country);
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
    return showAllScores ? !hiddenGroups.has(group) : revealedGroups.has(group);
  }

  function hiddenStat() {
    return <span aria-label="Hidden until revealed" className="hidden-stat">??</span>;
  }

  function renderVideoLink(kind: "extended" | "short", video: VideoLink, label: string) {
    return (
      <a
        href={video.url}
        key={`${label}-${video.url}`}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
      >
        {label} <small>{videoDuration(kind, video)}</small>
      </a>
    );
  }

  function renderInlineVideoLinks(match: Match) {
    const short = match.videos?.short ?? null;
    const extended = match.videos?.extended ?? null;
    const links = [
      short?.url ? renderVideoLink("short", short, "Highlights") : null,
      extended?.url ? renderVideoLink("extended", extended, "Extended") : null,
    ].filter(Boolean);

    if (!links.length && canSearchVideo(matchState(match, now))) {
      return (
        <span className="video-links video-search-links">
          <a href={youtubeSearchUrl(match)} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank">
            YouTube Search <small>Fox Sports</small>
          </a>
        </span>
      );
    }

    if (!links.length) {
      return <span className="video-status">{videoStatus(match, matchState(match, now))}</span>;
    }

    return <span className="video-links">{links}</span>;
  }

  function renderMatchCard(match: Match, variant = "match-card") {
    const state = matchState(match, now);

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
          <span className="card-footer">
            <span>{statusLabel(state)}</span>
            <span className={hasDirectVideo(match) ? "video-ready" : ""}>{renderInlineVideoLinks(match)}</span>
          </span>
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
      actions.push(renderVideoLink("short", short, "Highlights"));
    }

    if (extended?.url) {
      actions.push(renderVideoLink("extended", extended, "Extended highlights"));
    }

    return (
      <div className="video-actions">
        {actions.length ? actions : canSearchVideo(state) ? (
          <a href={youtubeSearchUrl(match)} rel="noreferrer" target="_blank">
            YouTube Search <small>Fox Sports</small>
          </a>
        ) : (
          <span>{state === "scheduled" ? "Highlights pending" : videoStatus(match, state)}</span>
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
          const groupForceHidden = showAllScores && hiddenGroups.has(group);

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
                    if (showAllScores) {
                      setHiddenGroups((current) => {
                        const next = new Set(current);
                        if (next.has(group)) {
                          next.delete(group);
                        } else {
                          next.add(group);
                        }
                        return next;
                      });
                    } else {
                      setRevealedGroups((current) => {
                        const next = new Set(current);
                        if (next.has(group)) {
                          next.delete(group);
                        } else {
                          next.add(group);
                        }
                        return next;
                      });
                    }
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
                          {renderTeamName(match.home, `fixture-team fixture-home ${teamResultClass(match, "home", revealed, groupForceHidden)}`)}
                          {renderScorePill(match, revealed, groupForceHidden)}
                          {renderTeamName(match.away, `fixture-team fixture-away ${teamResultClass(match, "away", revealed, groupForceHidden)}`)}
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
          <span>Adjust the country filter or switch to the timeline.</span>
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

  function renderVideoDesk() {
    const videoMatches = filteredMatches.filter((match) => {
      const state = matchState(match, now);
      return state === "completed" || state === "needs-result" || state === "live" || hasDirectVideo(match);
    });

    return (
      <div className="video-layout">
        {(videoMatches.length ? videoMatches : filteredMatches.slice(0, 18)).map((match) => {
          const state = matchState(match, now);
          return (
            <article className={`video-tile is-${state}`} key={match.id}>
              <div
                className="video-select"
                onClick={() => {
                  setSelectedId(match.id);
                  setDetailOpen(true);
                }}
                role="button"
                tabIndex={0}
              >
                <span>{match.group ? `Group ${match.group}` : match.stage}</span>
                <strong className="video-title-teams">
                  {renderTeamName(match.home, `video-team-name ${teamResultClass(match, "home")}`)}
                  <span>vs</span>
                  {renderTeamName(match.away, `video-team-name ${teamResultClass(match, "away")}`)}
                </strong>
                {renderScorePill(match)}
              </div>
              <div className="availability">
                <span>{videoStatus(match, state)}</span>
                {renderVideoActions(match)}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function renderConstellation() {
    return (
      <div className="constellation-layout">
        {filteredMatches.map((match, index) => {
          const state = matchState(match, now);
          return (
            <article
              className={`star-node is-${state}`}
              key={match.id}
              style={{ "--node": index % 24 } as CSSProperties}
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
                <span>{match.id}</span>
                <strong>{renderTeamName(match.home, `star-team-name ${teamResultClass(match, "home")}`)}</strong>
                {renderScorePill(match)}
                <strong>{renderTeamName(match.away, `star-team-name ${teamResultClass(match, "away")}`)}</strong>
              </div>
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
          <span className="eyebrow">Selected match</span>
          <button
            aria-label="Minimize selected match"
            className="icon-button"
            onClick={() => setDetailOpen(false)}
            title="Minimize selected match"
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
          <div>
            <dt>Stage</dt>
            <dd>{match.group ? `Group ${match.group}` : match.stage}</dd>
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
          <div>
            <dt>Status</dt>
            <dd>{statusLabel(state)}</dd>
          </div>
        </dl>
        <div className="detail-video-state">{videoStatus(match, state)}</div>
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
        aria-label="Show selected match"
        className="detail-mini"
        onClick={() => setDetailOpen(true)}
        title="Show selected match"
        type="button"
      >
        <span>Selected</span>
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
    if (mode === "video") return renderVideoDesk();
    if (mode === "constellation") return renderConstellation();
    return renderTimeline();
  }

  return (
    <main className="app-shell" data-view={mode}>
      <div className="hero-texture" aria-hidden="true" />
      <div className="page-chrome">
        <header className="topbar">
          <div>
            <span className="eyebrow">2026</span>
            <h1><a aria-label="World Cup Snapshot" className="home-title" href={typeof window === "undefined" ? "/" : window.location.pathname}>W<span aria-hidden="true" className="title-ball">⚽</span>rld Cup Snapsh<span aria-hidden="true" className="title-ball">⚽</span>t</a></h1>
          </div>
        </header>

        <section className="control-deck" aria-label="Schedule controls">
          <div className="view-toggle" aria-label="Viewing option">
            {modes.map((item) => (
              <button
                aria-pressed={mode === item.id}
                key={item.id}
                onClick={() => setMode(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            className="spoiler-control"
            onClick={() => {
              setShowAllScores((value) => !value);
              setRevealedScoreIds(new Set());
              setRevealedGroups(new Set());
              setHiddenGroups(new Set());
            }}
            type="button"
          >
            {showAllScores ? "Hide all scores" : "Show all scores"}
          </button>

          <div
            className="score-date-control"
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.matches('input[type="checkbox"]')) return;

              if (!scoreCutoffEnabled) {
                setScoreCutoffEnabled(true);
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
                onChange={(event) => setScoreCutoffEnabled(event.target.checked)}
                type="checkbox"
              />
              <span>Show scores before</span>
            </label>
            <input
              aria-label="Show scores before date"
              onChange={(event) => {
                setScoreCutoffDate(event.target.value);
                setScoreCutoffEnabled(Boolean(event.target.value));
              }}
              type="date"
              value={scoreCutoffDate}
            />
          </div>

          <div className="filters">
            <label>
              <span>Country</span>
              <button className="country-filter-trigger" onClick={() => setCountryPickerOpen(true)} type="button">
                <strong>{countryFilterLabel()}</strong>
                <em>{countryMode === "all" ? "All" : "Filtered"}</em>
              </button>
            </label>
          </div>
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
        <div className={`floating-detail ${detailOpen ? "" : "is-minimized"}`}>
          {detailOpen ? renderDetailPanel(selectedMatch) : renderDetailHandle(selectedMatch)}
        </div>
      ) : null}

      {renderCountryPicker()}
      {renderStadiumMap()}

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
