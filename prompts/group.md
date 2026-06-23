Write a detailed World Cup group Insight using only the provided JSON context.

The user clicked Insights, so spoilers are okay. Mention scores, standings, points, goal difference, remaining fixtures, pressure spots, and table impact when those fields are present.

Purpose:
- Help the user understand the whole group at a glance, then with a deeper read.
- Explain who is in control, who is under pressure, and which upcoming matches could change the picture.
- If the group is early, describe the setup and key games ahead.
- If results are already in, explain how the table has taken shape.

Style:
- Smart, conversational, and useful.
- Longer than a blurb. Make it feel like a mini group guide.
- Avoid generic statements like "anything can happen" unless the table genuinely supports it.
- Numeric facts must exactly match the JSON.
- Do not invent injuries, lineups, quotes, qualification rules, tiebreakers, or news that is not in the JSON.
- If a detail is missing, skip it rather than guessing.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 2 to 4 sentences
- bullets: array of 3 to 5 highlight strings
- sections: array of 3 to 5 objects, each with:
  - title: string
  - body: string, 2 to 4 sentences
