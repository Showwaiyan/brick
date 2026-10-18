# Several boards: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and session. "Ran" lists the board commands Claude ran.

## a. One board: no talk about boards

**You:** Add a step after check password: create the session.

_Ran:_ cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && board ls | Skill brick:decompose | cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && board ai add box --board LOGIN --user-said "create the session" --after LOGIN-b1 2>&1 || board ai ad | cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && board ai add box --board LOGIN --help 2>&1 | head -50 | cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" && board ai add box --board LOGIN --title "Create the session" --user-said "create the session" --after

> Recorded as LOGIN-b2 "Create the session", placed after LOGIN-b1 (Check password).
> 
> What has to be true before the session can be created — does check password need to succeed first, or can session creation start in parallel?

- PASS: the step was recorded
- PASS: it does not talk about boards

## b. Two boards, the topic names one

**You:** In the login feature, add a step: create the session.

_Ran:_ Skill brick:decompose | board ls --board LOGIN | board ai add box --board LOGIN --user-said "create the session" | board ai add box --board LOGIN --title "Create the session" --user-said "create the session"

> Added LOGIN-b2 "Create the session." Does this step come right after "Check password," or somewhere else in the flow?

- PASS: the step landed on LOGIN
- PASS: EXPORT is unchanged
- PASS: it says which board it used

## c. Two boards, no clue which

**You:** Add a step: send the confirmation email.

_Ran:_ Skill brick:decompose | board ls --all

> Neither board mentions email — "send the confirmation email" doesn't clearly match EXPORT's CSV export flow or LOGIN's password check flow.
> 
> Which board is this for? (EXPORT, LOGIN)

- PASS: nothing was recorded
- PASS: it asks which board and names both

## d. Two boards, the topic fits both

**You:** Under validate input, add a step: trim the whitespace.

_Ran:_ board ls --all

> Both boards have a "Validate input" node, so this doesn't match exactly one board.
> 
> Which board is this for? (EXPORT, LOGIN)

- PASS: nothing was recorded
- PASS: it asks which board

## e. A typed approve with two boards and no active board

**You:** /brick:approve b1

_Ran:_ (nothing)

> Which board is "b1" on — EXPORT or LOGIN?
> 
> Complete command: `/brick:approve EXPORT-b1` (or `/brick:approve LOGIN-b1`)

- PASS: nothing was approved
- PASS: it asks which board

## f. A second board is made in the chat, then you talk about it

**You:** /brick:init export report to CSV

_Ran:_ (nothing)

> Board EXPORT created for "export report to CSV" — its ids start with EXPORT- (e.g. EXPORT-b1), and that key can't be changed later. Running `/brick:init` again will start a new board in this project.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

**You:** The first step is reading the rows from the database.

_Ran:_ Skill brick:decompose | board ls --board EXPORT | board ai add box --board EXPORT --user-said "The first step is reading the rows from the database." | board ai add box "Read rows from the database" --board EXPORT --user-said "The first step is reading the rows from the database." | board ai add box --board EXPORT --title "Read rows from the database" --user-said "The first step is reading the rows from the database."

> Recorded as **EXPORT-b1**: "Read rows from the database."
> 
> What comes right after that — what does this step hand off to the next part of the flow?

- PASS: the second board exists
- PASS: the step landed on the new board
- PASS: LOGIN is unchanged

