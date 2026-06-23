Write a detailed World Cup match Insight using only the provided JSON context.

The user clicked Insights, so spoilers are okay. Mention scores, winners, table impact, rankings, venue, timing, and highlight availability when those fields are present and useful.

Purpose:
- Help the user understand why this match matters.
- If the match is upcoming, preview the stakes, matchup shape, group context, ranking context, and what to watch.
- If the match is completed, write a recap of the match that already happened: the result, the key match highlights that can be safely inferred from the JSON, what changed in the group/tournament picture, and why the result is interesting.
- Let the writing breathe. Prefer a few strong, free-flowing paragraphs over a rigid report format.

Match status rules:
- If `match.status` is "completed" or `match.result` is present, this is a recap, not a preview.
- For completed matches, the headline and summary must clearly describe a match that already happened.
- For completed matches, the first sentence of the summary must include the final score or exact result from the JSON.
- For completed matches, use past tense for the match itself. Do not write as if the teams are about to play.
- For completed matches, do not use preview framing such as "meet", "face off", "enter this match", "set to", "scheduled to", "looks to", "what to watch", or "upcoming clash" for the completed match.
- For completed matches, you may discuss future implications and remaining fixtures, but only after recapping the result and table impact.
- If the JSON has no scorers, cards, substitutions, shots, or match events, do not invent them. In that case, make the key highlights about the scoreline, winner, margin, stakes, venue, table movement, remaining group pressure, and highlight/video context if present.

Style:
- Smart, conversational, and useful.
- Longer than a blurb. Make it feel like a mini match story or match guide.
- Write for a curious fan who wants context, not generic filler.
- It is okay to sound a little more magazine-like and less like a database summary.
- Numeric facts must exactly match the JSON.
- Do not invent injuries, lineups, scorers, quotes, tactics, cards, substitutions, shots, saves, or in-game events that are not in the JSON.
- Do not write generic calls to action like "catch the action," "watch the highlights," or "highlights are available." The UI already shows video links.
- Only mention highlight availability if it adds meaningful context, and never as a standalone bullet.
- No betting advice.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 2 to 4 sentences. For completed matches, open with the final score or exact result.
- story: array of 4 to 7 paragraph strings for completed matches, or 3 to 5 paragraph strings for upcoming matches. These should be the main insight and should read naturally, without section headings inside the text.
- bullets: array. Prefer an empty array unless there are 2 to 4 genuinely sharp takeaways that are not repetitive.
- sections: array. Prefer an empty array for match insights unless structure is truly helpful. If used, each object must have:
  - title: string
  - body: string, 2 to 4 sentences
