# M6 dry run: User login, 8 scripted turns in a real Claude Code session

Driven by `drive.py` (`claude -p`, resumed each turn, `Bash` and `Skill` allowed, hooks active, fresh git repo,
`board init "User login"`). Full conversation: `transcript.txt`. One run, one model; treat as a smoke test, not proof.

## Where the AI stayed in role
- Turn 1: asked what goes in and out. Proposed no boxes.
- Turn 2: recorded the four boxes you named, in your words (`said` holds your fragments), then asked one question.
- Turn 4 ("approve it"): did not approve; gave `board approve b3` and left the decision to the user.
- Turn 5: gaps were phrased as what is missing ("Nothing says whether...", "Nothing covers..."). No lint rejection was visible, so no fix-phrasing got through.
- Turn 6: said "this is my suggestion, not a decision" and recorded nothing until the user chose.
- Turn 7: recorded the user's choice with the user's words as the quote.
- Turn 8: refused to say "ready" or "looks good" and listed the real state. No guard fired, and no human-only command was run.

## Where it slipped
1. **Wrong quote on `ai project`.** It set the project input/output ("username and password" / "logged-in session") but cited the turn-2 sentence as `--user-said`. That sentence does not say what comes out; the words came from turn 1, and "logged-in session" is the AI's paraphrase of "ends up logged in". The tool cannot check that a quote supports a value.
2. **Wrong command named.** Turn 7 told the user to run `board resolve g4`. The real command is `board gap resolve g4 --note "..."`. The guard only blocks commands the AI runs, not ones it recommends.
3. **Unasked gaps.** On "please approve it" it raised four gaps (g1-g4) and then asked a steering question. Naming gaps is its job, but the user had not asked for a critique at that moment. g1 (rate-limit order) was the AI's own idea, not something the user wrote.
4. **Steering.** Turn 6's suggestion was long and confident (a full design pattern plus a security argument), then it nudged toward the next gap. It was labelled as a suggestion and not recorded, which the skill allows, but it is the closest it came to deciding.
5. **Word use.** Turn 8 used "approved" ("none approved", "Nothing... is approved yet") to report state, not to claim anything. Borderline for the banned-word rule. No "ready", "done" or "looks good" claims.
6. **Mixed levels.** It put the user's turn-7 decision on `b3` as the description, then noted it also touches `b2`. Reasonable, but the user did not ask where it should go.

## Not covered
Only the happy path of the lint and gate was seen in conversation (they have their own tests). Not tried: reopen/supersede flows, a second session picking the board up from the session-start brief, interactive (non-`-p`) mode with the workspace-trust dialog, and the page being refreshed during the conversation.
