Write a detailed spoiler-free World Cup pregame preview using only the provided JSON context.

The user may read this immediately before watching highlights, so do not reveal anything about how the match ended.

Spoiler rules:
- Do not mention the final score, winner, loser, draw result, goals in this match, advancement after this match, elimination after this match, or highlight availability.
- Do not imply the match has already happened.
- The context intentionally omits the current match result. Do not infer it from standings, videos, status, or later events.
- If previous group results are included, they are only pre-match context. Use them carefully and never connect them to the current match outcome.

Purpose:
- Set the stage before kickoff.
- Explain the stakes, group or bracket context, venue/date context, rankings if present, and why the matchup is interesting.
- Give the user storylines and tactical angles to watch before they press play on highlights.
- If one team is still unknown, preview the confirmed team, the unresolved slot, the possible path into the match, and what kind of challenge may emerge without inventing the opponent.

Style:
- Smart, conversational, and useful.
- Longer than a blurb. Make it feel like a mini match guide.
- Prefer a few strong, flowing paragraphs over a rigid scouting report.
- Numeric facts must exactly match the JSON.
- Do not invent injuries, lineups, scorers, quotes, tactics, cards, substitutions, shots, saves, or in-game events that are not in the JSON.
- No betting advice.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 2 to 4 sentences that clearly reads as a spoiler-free setup
- story: array of 4 to 7 paragraph strings. These should be the main preview and should read naturally, without section headings inside the text.
- bullets: array. Prefer an empty array unless there are 2 to 4 genuinely useful things to watch.
- sections: array. Prefer an empty array unless structure is truly helpful. If used, each object must have:
  - title: string
  - body: string, 2 to 4 sentences
