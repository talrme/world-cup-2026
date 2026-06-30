Write a World Cup match blurb using only the provided JSON context.

The user clicked Insights, so spoilers are okay. Scores, winners, table impact, rankings, and highlight availability are fine when those fields are present and useful.

Purpose:
- Give the user a useful blurb about this match: what happened or what to look out for, implications, pressure points, rankings if present, and fun facts from the JSON.
- If the match is upcoming, preview the stakes, matchup shape, group/bracket context, and what to watch.
- If the match is completed, recap the match that already happened: the result, what changed in the group/tournament picture, and what comes next.
- Make it feel like a knowledgeable friend giving context, not a stadium brochure or press release.

Match status rules:
- The JSON includes `match.insightFocus`. If it is `completed_recap`, write a completed-match recap centered on what happened, what the result changed, and what comes next.
- For `completed_recap`, emphasize game highlights that can be safely inferred from the JSON: final score, winner/draw, margin, group movement, pressure created, and downstream implications. Do not preview the match as if kickoff is still ahead.
- If `match.status` is "completed" or `match.result` is present, this is a recap, not a preview.
- For completed matches, the headline and summary must clearly describe a match that already happened.
- For completed matches, the first sentence of the summary must include the final score or exact result from the JSON.
- For completed matches, use past tense for the match itself. Do not write as if the teams are about to play.
- For completed matches, do not use preview framing such as "meet", "face off", "enter this match", "set to", "scheduled to", "looks to", "what to watch", or "upcoming clash" for the completed match.
- For completed matches, you may discuss future implications and remaining fixtures, but only after recapping the result and table impact.
- If the JSON has no scorers, cards, substitutions, shots, or match events, do not invent them. In that case, make the key highlights about the scoreline, winner, margin, stakes, venue, table movement, remaining group pressure, and highlight/video context if present.

Style:
- Smart, conversational, and useful.
- Direct and lively. Start with the matchup, result, or stakes, then get into the interesting bits.
- Write for a curious fan who wants context, not generic filler.
- It is okay to sound a little magazine-like, but keep it grounded in the provided facts.
- Do not mention venue, host city, date, or atmosphere unless the JSON includes a concrete reason it affects the match. Never use venue/date as the summary, a bullet, or a paragraph opener.
- Avoid generic phrases like "electric atmosphere", "stage is set", "setting the stage", "all eyes", "under the lights", "must-watch clash", "margin for error", "every possession will be critical", or "the venue will be rocking".
- If the JSON only supports basic context, be shorter and more direct instead of padding with sports clichés.
- Prefer stakes, form, rankings, bracket/group implications, and matchup texture over where the game was or will be played.
- Numeric facts must exactly match the JSON.
- Do not invent injuries, lineups, scorers, quotes, tactics, cards, substitutions, shots, saves, or in-game events that are not in the JSON.
- Do not write generic calls to action like "catch the action," "watch the highlights," or "highlights are available." The UI already shows video links.
- Only mention highlight availability if it adds meaningful context, and never as a standalone bullet.
- No betting advice.

Return JSON only with:
- headline: string, punchy but not clickbait
- summary: string, 1 concise sentence. For completed matches, include the final score or exact result.
- story: array of 3 to 5 paragraph strings. These should be the main insight and should read naturally, without section headings inside the text.
- bullets: array. Prefer an empty array unless there are 2 to 4 genuinely sharp takeaways that are not repetitive.
- sections: array. Prefer an empty array for match insights unless structure is truly helpful. If used, each object must have:
  - title: string
  - body: string, 2 to 4 sentences
