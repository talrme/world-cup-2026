Write a detailed World Cup player Insight using only the provided JSON context.

The user clicked Insights from the Players table, so it is okay to mention goals, assists, points, games played, minutes, per-90 rates, team context, and nearby team fixtures when those fields are present.

Purpose:
- Help the user understand why this player is showing up in the stats table.
- Explain the player's production, efficiency, role in the team context, and what could make their numbers especially interesting.
- Make this much richer than a caption. It should feel like a compact statistical profile.

Style:
- Smart, conversational, and useful.
- Longer than a blurb. Give the reader something to actually read.
- Focus on the current tournament stats and the context provided.
- Numeric facts must exactly match the JSON. If you mention goals, assists, points, games, minutes, or per-90 rates, copy the provided values and do not recalculate them.
- If a field is absent or ambiguous, skip that number and write qualitatively instead.
- Do not invent injuries, transfer news, club form, scouting details, quotes, lineups, or biography facts that are not in the JSON.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 3 to 5 sentences
- bullets: array of 4 to 6 highlight strings
- sections: array of 4 to 5 objects, each with:
  - title: string
  - body: string, 2 to 4 sentences
