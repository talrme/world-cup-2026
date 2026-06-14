(() => {
  const data = window.WORLD_CUP_DATA;
  const app = document.getElementById("app");

  if (!data || !app) {
    return;
  }

  const modes = [
    ["timeline", "Timeline"],
    ["groups", "Groups"],
    ["bracket", "Bracket"],
    ["video", "Video Desk"],
    ["constellation", "Constellation"],
  ];
  const modeIds = modes.map(([id]) => id);

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

  function inputDateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function defaultScoreCutoffDate() {
    const date = new Date();
    date.setDate(date.getDate() - 5);
    return inputDateValue(date);
  }

  const state = {
    mode: "timeline",
    countryMode: "all",
    selectedCountries: new Set(),
    countryPickerOpen: false,
    selectedId: null,
    detailOpen: true,
    showAllScores: false,
    scoreCutoffEnabled: false,
    scoreCutoffDate: defaultScoreCutoffDate(),
    revealedScores: new Set(),
    revealedGroups: new Set(),
    hiddenGroups: new Set(),
    mapVenueId: null,
    timelineAutoScrolled: false,
    now: new Date(),
  };

  const matches = [...data.matches].sort((a, b) => {
    return kickoffDate(a).getTime() - kickoffDate(b).getTime() || a.id - b.id;
  });
  const venues = Array.isArray(data.venues) ? data.venues : [];

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

    if (view && modeIds.includes(view)) {
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

    if (state.mode !== "timeline") params.set("view", state.mode);
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

  function statusLabel(value) {
    if (value === "completed") return "Final";
    if (value === "live") return "Live window";
    if (value === "needs-result") return "Past kickoff";
    return "Scheduled";
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

  function scoreCutoffReveals(match) {
    return Boolean(state.scoreCutoffEnabled && state.scoreCutoffDate && localDateKey(match) <= state.scoreCutoffDate);
  }

  function isScoreVisible(match, forceVisible = false, forceHidden = false) {
    return hasScore(match) && !forceHidden && (forceVisible || state.showAllScores || scoreCutoffReveals(match) || state.revealedScores.has(match.id));
  }

  function spoilerText(match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match)) return "vs";
    return isScoreVisible(match, forceVisible, forceHidden) ? scoreText(match) : "?? - ??";
  }

  function renderScorePill(match, forceVisible = false, forceHidden = false) {
    if (!hasScore(match)) return `<span class="score-pill score-empty">vs</span>`;
    const visible = isScoreVisible(match, forceVisible, forceHidden);
    if (visible && (forceVisible || state.showAllScores || scoreCutoffReveals(match))) {
      return `<span class="score-pill score-revealed">${escapeHtml(scoreText(match))}</span>`;
    }
    const label = visible ? "Hide score" : "Reveal score";
    return `<button aria-label="${label}" class="score-pill ${visible ? "score-revealed" : "score-hidden"}" data-score-id="${match.id}" type="button">${escapeHtml(spoilerText(match, forceVisible, forceHidden))}</button>`;
  }

  function hasDirectVideo(match) {
    return Boolean(match.videos && (match.videos.extended?.url || match.videos.short?.url));
  }

  function videoStatus(match) {
    const current = matchState(match);
    if (hasDirectVideo(match)) return "Highlights";
    if (current === "completed" || current === "needs-result") return "No saved link";
    if (current === "live") return "Match live";
    return "Upcoming";
  }

  function videoDuration(kind, video) {
    if (video?.durationText) return video.durationText;
    return kind === "extended" ? "~20 min" : "~4 min";
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
    return `<a href="${escapeHtml(video.url)}" rel="noreferrer" target="_blank">${escapeHtml(label)} <small>${escapeHtml(duration)}</small></a>`;
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
      return `<span class="video-links video-search-links"><a href="${escapeHtml(youtubeSearchUrl(match))}" rel="noreferrer" target="_blank">YouTube Search <small>Fox Sports</small></a></span>`;
    }

    if (!links.length) {
      return `<span class="video-status">${escapeHtml(videoStatus(match))}</span>`;
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
    return state.showAllScores ? !state.hiddenGroups.has(group) : state.revealedGroups.has(group);
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
      actions.push(`<a href="${escapeHtml(youtubeSearchUrl(match))}" rel="noreferrer" target="_blank">YouTube Search <small>Fox Sports</small></a>`);
    }

    if (!actions.length) {
      actions.push(`<span>${escapeHtml(current === "scheduled" ? "Highlights pending" : videoStatus(match))}</span>`);
    }

    return `<div class="video-actions">${actions.join("")}</div>`;
  }

  function renderMatchCard(match, variant = "match-card") {
    const current = matchState(match);
    const videoClass = hasDirectVideo(match) ? "video-ready" : "";

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
          <span class="card-footer">
            <span>${escapeHtml(statusLabel(current))}</span>
            <span class="${videoClass}">${renderInlineVideoLinks(match)}</span>
          </span>
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
          <span class="eyebrow">Selected match</span>
          <button aria-label="Minimize selected match" class="icon-button" data-detail-close title="Minimize selected match" type="button">×</button>
        </div>
        <h2 class="detail-title-teams">
          ${renderTeamName(match.home, `detail-team-name ${teamResultClass(match, "home")}`)}
          <span class="detail-vs">vs</span>
          ${renderTeamName(match.away, `detail-team-name ${teamResultClass(match, "away")}`)}
        </h2>
        <div class="detail-score">${renderScorePill(match)}</div>
        <dl>
          <div><dt>Stage</dt><dd>${escapeHtml(match.group ? `Group ${match.group}` : match.stage)}</dd></div>
          <div><dt>Kickoff</dt><dd>${escapeHtml(formatDate(match))} at ${escapeHtml(formatTime(match))}</dd></div>
          <div><dt>Location</dt><dd>${renderVenueButton(match)}</dd></div>
          <div><dt>Broadcast</dt><dd>${escapeHtml(match.network || "TBD")}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(statusLabel(current))}</dd></div>
        </dl>
        <div class="detail-video-state">${escapeHtml(videoStatus(match))}</div>
        ${renderVideoActions(match)}
        ${checked}
      </aside>
    `;
  }

  function renderDetailHandle(match) {
    return `
      <button aria-label="Show selected match" class="detail-mini" data-detail-open title="Show selected match" type="button">
        <span>Selected</span>
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
        const groupForceHidden = state.showAllScores && state.hiddenGroups.has(group);
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
                    ${renderTeamName(match.home, `fixture-team fixture-home ${teamResultClass(match, "home", revealed, groupForceHidden)}`)}
                    ${renderScorePill(match, revealed, groupForceHidden)}
                    ${renderTeamName(match.away, `fixture-team fixture-away ${teamResultClass(match, "away", revealed, groupForceHidden)}`)}
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
      return `<div class="empty-state"><strong>No knockout matches found</strong><span>Adjust the country filter or switch to the timeline.</span></div>`;
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

  function renderVideoDesk(list) {
    const videoMatches = list.filter((match) => {
      const current = matchState(match);
      return current === "completed" || current === "needs-result" || current === "live" || hasDirectVideo(match);
    });
    const visible = videoMatches.length ? videoMatches : list.slice(0, 18);

    return `
      <div class="video-layout">
        ${visible
          .map((match) => {
            const current = matchState(match);
            return `
              <article class="video-tile is-${current}">
                <div class="video-select" data-match-id="${match.id}" role="button" tabindex="0">
                  <span>${escapeHtml(match.group ? `Group ${match.group}` : match.stage)}</span>
                  <strong class="video-title-teams">
                    ${renderTeamName(match.home, `video-team-name ${teamResultClass(match, "home")}`)}
                    <span>vs</span>
                    ${renderTeamName(match.away, `video-team-name ${teamResultClass(match, "away")}`)}
                  </strong>
                  ${renderScorePill(match)}
                </div>
                <div class="availability">
                  <span>${escapeHtml(videoStatus(match))}</span>
                  ${renderVideoActions(match)}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderConstellation(list) {
    return `
      <div class="constellation-layout">
        ${list
          .map((match, index) => {
            const current = matchState(match);
            return `
              <article class="star-node is-${current}" style="--node: ${index % 24}">
                <div class="star-select" data-match-id="${match.id}" role="button" tabindex="0">
                  <span>${match.id}</span>
                  <strong>${renderTeamName(match.home, `star-team-name ${teamResultClass(match, "home")}`)}</strong>
                  ${renderScorePill(match)}
                  <strong>${renderTeamName(match.away, `star-team-name ${teamResultClass(match, "away")}`)}</strong>
                </div>
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
    if (state.mode === "video") return renderVideoDesk(list);
    if (state.mode === "constellation") return renderConstellation(list);
    return renderTimeline(list);
  }

  function renderControls() {
    const modeButtons = modes
      .map(([id, label]) => {
        const pressed = state.mode === id ? "true" : "false";
        return `<button aria-pressed="${pressed}" data-mode="${id}" type="button">${escapeHtml(label)}</button>`;
      })
      .join("");

    return `
      <section class="control-deck" aria-label="Schedule controls">
        <div class="view-toggle" aria-label="Viewing option">${modeButtons}</div>
        <button class="spoiler-control" data-show-all-scores type="button">
          ${state.showAllScores ? "Hide all scores" : "Show all scores"}
        </button>
        <div class="score-date-control" data-score-date-open>
          <label class="score-date-toggle">
            <input data-control="score-cutoff-enabled" type="checkbox" ${state.scoreCutoffEnabled ? "checked" : ""} />
            <span>Show scores before</span>
          </label>
          <input aria-label="Show scores before date" data-control="score-cutoff-date" type="date" value="${escapeHtml(state.scoreCutoffDate)}" />
        </div>
        <div class="filters">
          <label class="country-filter-wrap">
            <span>Country</span>
            <button class="country-filter-trigger" data-country-picker-toggle type="button">
              <strong>${escapeHtml(countryFilterLabel())}</strong>
              <em>${state.countryMode === "all" ? "All" : "Filtered"}</em>
            </button>
          </label>
        </div>
      </section>
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
    cutoff.setDate(cutoff.getDate() - 1);
    return inputDateValue(cutoff);
  }

  function stickyChromeOffset() {
    const chrome = app.querySelector(".page-chrome");
    return chrome ? Math.ceil(chrome.getBoundingClientRect().height + 14) : 0;
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
    });
  }

  function render() {
    state.now = new Date();
    const list = filteredMatches();
    const selected = selectedMatch();

    app.dataset.view = state.mode;
    app.innerHTML = `
      <div class="hero-texture" aria-hidden="true"></div>
      <div class="page-chrome">
        <header class="topbar">
          <div>
            <span class="eyebrow">2026</span>
            <h1><a aria-label="World Cup Snapshot" class="home-title" href="${escapeHtml(window.location.pathname)}">W<span class="title-ball" aria-hidden="true">⚽</span>rld Cup Snapsh<span class="title-ball" aria-hidden="true">⚽</span>t</a></h1>
          </div>
        </header>
        ${renderControls()}
      </div>
      <section class="active-view" aria-live="polite">${renderActiveView(list)}</section>
      ${
        selected
          ? `<div class="floating-detail ${state.detailOpen ? "" : "is-minimized"}">${
              state.detailOpen ? renderDetailPanel(selected) : renderDetailHandle(selected)
            }</div>`
          : ""
      }
      ${renderCountryPicker()}
      ${renderStadiumMap()}
      <footer class="source-strip">
        <span>Data refreshed ${escapeHtml(data.generatedAt)}</span>
        ${data.sources
          .map((source) => `<a href="${escapeHtml(source.url)}" rel="noreferrer" target="_blank">${escapeHtml(source.label)}</a>`)
          .join("")}
      </footer>
    `;

    syncUrlState();
    autoScrollTimelineOnce();
  }

  document.addEventListener("click", (event) => {
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

    const countryPickerToggle = event.target.closest("[data-country-picker-toggle]");
    if (countryPickerToggle) {
      state.countryPickerOpen = true;
      render();
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
        const checkbox = scoreDateOpen.querySelector('[data-control="score-cutoff-enabled"]');
        if (checkbox) {
          checkbox.checked = true;
        }
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

    const modeButton = event.target.closest("[data-mode]");
    if (modeButton) {
      state.mode = modeButton.dataset.mode;
      render();
      return;
    }

    const showAllButton = event.target.closest("[data-show-all-scores]");
    if (showAllButton) {
      state.showAllScores = !state.showAllScores;
      state.hiddenGroups.clear();
      if (!state.showAllScores) {
        state.revealedScores.clear();
        state.revealedGroups.clear();
      }
      render();
      return;
    }

    const groupReveal = event.target.closest("[data-group-reveal]");
    if (groupReveal) {
      const group = groupReveal.dataset.groupReveal;
      if (state.showAllScores) {
        if (state.hiddenGroups.has(group)) {
          state.hiddenGroups.delete(group);
        } else {
          state.hiddenGroups.add(group);
        }
      } else {
        if (state.revealedGroups.has(group)) {
          state.revealedGroups.delete(group);
        } else {
          state.revealedGroups.add(group);
        }
      }
      render();
      return;
    }

    const scoreButton = event.target.closest("[data-score-id]");
    if (scoreButton) {
      const matchId = Number(scoreButton.dataset.scoreId);
      if (state.revealedScores.has(matchId)) {
        state.revealedScores.delete(matchId);
      } else {
        state.revealedScores.add(matchId);
      }
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
      render();
    }
    if (event.target.dataset.control === "score-cutoff-date") {
      state.scoreCutoffDate = event.target.value;
      state.scoreCutoffEnabled = Boolean(event.target.value);
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
  });

  window.setInterval(render, 60_000);
  window.addEventListener("popstate", () => {
    applyUrlState();
    render();
  });
  applyUrlState();
  render();
})();
