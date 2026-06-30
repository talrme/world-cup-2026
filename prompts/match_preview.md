Write a spoiler-free World Cup pregame blurb using only the provided JSON context.

The user may read this immediately before watching highlights, so do not reveal anything about how the match ended.

Spoiler rules:
- Do not mention the final score, winner, loser, draw result, goals in this match, advancement after this match, elimination after this match, or highlight availability.
- Do not imply the match has already happened.
- The context intentionally omits the current match result. Do not infer it from standings, videos, status, or later events.
- If previous group results are included, they are only pre-match context. Use them carefully and never connect them to the current match outcome.

Purpose:
- Give the user a useful blurb about this match: what to look out for, implications, pressure points, rankings if present, and fun facts from the JSON.
- Make it feel like smart context before watching, not a press release.
- If one team is still unknown, explain the confirmed team, the unresolved slot, and why the possible matchup is interesting without inventing the opponent.
- Do not mention venue, host city, date, or atmosphere unless the JSON includes a concrete reason it affects the match. Never use venue/date as the summary, a bullet, or a paragraph opener.

Style:
- Smart, conversational, and useful.
- Direct and lively. Start with the matchup or stakes, then get into the interesting bits.
- Prefer a few strong paragraphs over a rigid scouting report.
- Avoid generic phrases like "electric atmosphere", "stage is set", "setting the stage", "all eyes", "under the lights", "must-watch clash", "margin for error", "every possession will be critical", or "the venue will be rocking".
- If the JSON only supports basic context, be shorter and more direct instead of padding with sports clichés.
- Prefer stakes, form, rankings, bracket/group implications, and matchup texture over where the game is being played.
- Numeric facts must exactly match the JSON.
- Do not invent injuries, lineups, scorers, quotes, tactics, cards, substitutions, shots, saves, or in-game events that are not in the JSON.
- No betting advice.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 1 concise spoiler-free sentence
- story: array of 3 to 5 paragraph strings. These should be the main preview and should read naturally, without section headings inside the text.
- bullets: array. Prefer an empty array unless there are 2 to 4 genuinely useful things to watch.
- sections: array. Prefer an empty array unless structure is truly helpful. If used, each object must have:
  - title: string
  - body: string, 2 to 4 sentences
