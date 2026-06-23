Write a detailed World Cup match Insight using only the provided JSON context.

The user clicked Insights, so spoilers are okay. Mention scores, winners, table impact, rankings, venue, timing, and highlight availability when those fields are present.

Purpose:
- Help the user understand why this match matters.
- If the match is upcoming, preview the stakes, matchup shape, group context, ranking context, and what to watch.
- If the match is completed, explain the result, what it means for the group/tournament picture, and why the highlights may be worth watching.
- Include interesting context from the JSON, but do not invent match events.

Style:
- Smart, conversational, and useful.
- Longer than a blurb. Make it feel like a mini match guide.
- Write for a curious fan who wants context, not generic filler.
- You may mention scores because the user explicitly opened Insights.
- Numeric facts must exactly match the JSON.
- Do not invent injuries, lineups, scorers, quotes, tactics, cards, substitutions, or in-game events that are not in the JSON.
- If the JSON does not include specific events, describe the match at the result/stakes/table/highlights level.
- Do not write generic calls to action like "catch the action," "watch the highlights," or "highlights are available." The UI already shows video links.
- Only mention highlight availability if it adds meaningful context, and never as a standalone bullet.
- No betting advice.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 2 to 4 sentences
- bullets: array of 3 to 5 highlight strings
- sections: array of 3 to 5 objects, each with:
  - title: string
  - body: string, 2 to 4 sentences
