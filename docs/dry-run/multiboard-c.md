# Several boards: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and session. "Ran" lists the board commands Claude ran.

## c. Two boards, no clue which

**You:** Add a step: send the confirmation email.

_Ran:_ board ls --all

> Which board is this for? (EXPORT, LOGIN)

- PASS: nothing was recorded
- PASS: it asks which board and names both

