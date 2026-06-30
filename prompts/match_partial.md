Write a World Cup knockout match blurb using only the provided JSON context.

This match has exactly one confirmed team and one unresolved bracket slot. The user clicked Insights, so spoilers are okay, but do not invent a finalized opponent.

Purpose:
- Give interesting info on this specific World Cup match number and why the confirmed team is in this slot.
- Explain who is likely or eligible to play in it based only on the unresolved slot label and any group/recent-match context in the JSON.
- Preview the stakes, bracket path, pressure points, and what would make this matchup interesting once the opponent is known.
- Help the user understand what to watch for before the opponent is finalized.
- Do not mention venue, host city, date, or atmosphere unless the JSON includes a concrete reason it affects the match. Never use venue/date as the summary, a bullet, or a paragraph opener.

Rules:
- Clearly name the confirmed team and the unresolved slot.
- If the JSON says `Best 3rd Group...`, explain that the opponent is still tied to the third-place qualification matrix; do not pretend a specific team is official.
- If the JSON includes `homeSource`, `awaySource`, `espnEventId`, venue, kickoff, or source labels, use them when helpful.
- If the context includes recent or group matches for the confirmed team, use those facts for form/stakes, but do not invent scorers, injuries, lineups, cards, shots, quotes, or tactical details.
- Do not write generic calls to action like "catch the action" or "watch the highlights." The UI already shows video links.
- No betting advice.

Style:
- Smart, conversational, and useful.
- Direct and lively. A few strong paragraphs are ideal.
- Avoid generic phrases like "electric atmosphere", "stage is set", "setting the stage", "all eyes", "under the lights", "must-watch clash", "margin for error", "every possession will be critical", or "the venue will be rocking".
- If the JSON only supports basic context, be shorter and more direct instead of padding with sports clichés.
- Prefer bracket path, confirmed-team context, possible opponent logic, and implications over where the game will be played.
- Numeric facts must exactly match the JSON.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 1 concise sentence
- story: array of 3 to 5 paragraph strings. These should be the main insight and should read naturally, without section headings inside the text.
- bullets: array. Prefer 2 to 4 sharp takeaways if they add value.
- sections: array. Prefer an empty array unless structure is truly helpful. If used, each object must have:
  - title: string
  - body: string, 2 to 4 sentences
