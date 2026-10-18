# Several boards: dry-run notes

Real Claude Code, `claude -p` with the plugin from this checkout, six scenarios (`scripts/dry-multiboard.mjs`).

## What the runs found, and what changed

1. **The "(active)" mark was read as permission.** On "Add a step: send the confirmation email" (no board named, fits neither) Claude recorded on the active board. Fix: the board rules moved to sit right after the `Boards:` line of the brief, in blunter words ("record nothing until you know which board", "the active mark means nothing for you"), and the same in the decompose skill.
2. **Claude read one board and decided.** With the same box title in both boards it only looked at the active one. Fix: `board ls --all` prints every board in one command, and the rules say to use it before matching by topic.
3. **Claude still sometimes picked the active board.** Fix in code, not wording: with several boards, every `board ai ...` command must carry `--board <KEY>` (or a full id), otherwise it fails with a message that says to ask the user. This stops a stale pointer from being used by accident; it cannot stop Claude naming the wrong board.
4. **Scenario fixes.** b was ambiguous (it edited an existing box); e's check was too narrow for "which one is b1 on, EXPORT or LOGIN?".

## Final numbers (after the last fix)

| Scenario | Result |
|---|---|
| a. one board, no talk about boards | pass |
| b. topic names one board | pass |
| c. no clue which board | 2 of 3 |
| d. topic fits both boards | 3 of 3 |
| e. typed approve, no active board | pass (decided in code) |
| f. second board made in the chat | pass |

The typed-command case (e) is decided by code, so it is reliable. The AI's own choices (b, c, d) are model judgement: expect it to ask when it should about two times in three, and to say which board it used so you can catch a wrong guess. `--board` being required on its writes means it can never use the pointer by accident.

Not re-run for this change: `scripts/dry-discussion.mjs` and `scripts/dry-decomposition.mjs` (only their file paths were updated; the single-board behaviour they test is unchanged).
