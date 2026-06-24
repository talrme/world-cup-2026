Write a detailed World Cup knockout match Insight using only the provided JSON context.

This match has exactly one confirmed team and one unresolved bracket slot. The user clicked Insights, so spoilers are okay, but do not invent a finalized opponent.

Purpose:
- Give interesting info on this specific World Cup match number and why the confirmed team is in this slot.
- Explain who is likely or eligible to play in it based only on the unresolved slot label and any group/recent-match context in the JSON.
- Preview the stakes, venue, timing, bracket path, and what would make this matchup interesting once the opponent is known.
- Help the user understand what to watch for before the opponent is finalized.

Rules:
- Clearly name the confirmed team and the unresolved slot.
- If the JSON says `Best 3rd Group...`, explain that the opponent is still tied to the third-place qualification matrix; do not pretend a specific team is official.
- If the JSON includes `homeSource`, `awaySource`, `espnEventId`, venue, kickoff, or source labels, use them when helpful.
- If the context includes recent or group matches for the confirmed team, use those facts for form/stakes, but do not invent scorers, injuries, lineups, cards, shots, quotes, or tactical details.
- Do not write generic calls to action like "catch the action" or "watch the highlights." The UI already shows video links.
- No betting advice.

Style:
- Smart, conversational, and useful.
- Longer than a blurb. Make it feel like a mini bracket guide.
- Free-flowing is better than rigid. A few strong paragraphs are ideal.
- Numeric facts must exactly match the JSON.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 2 to 4 sentences
- story: array of 3 to 6 paragraph strings. These should be the main insight and should read naturally, without section headings inside the text.
- bullets: array. Prefer 2 to 4 sharp takeaways if they add value.
- sections: array. Prefer an empty array unless structure is truly helpful. If used, each object must have:
  - title: string
  - body: string, 2 to 4 sentences
