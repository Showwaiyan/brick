# Several boards: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and session. "Ran" lists the board commands Claude ran.

## d. Two boards, the topic fits both

**You:** Under validate input, add a step: trim the whitespace.

_Ran:_ board ls --all

> Both boards have a "Validate input" node, so this is ambiguous — I can't tell which one you mean.
> 
> Which board is this for? (EXPORT, LOGIN)

- PASS: nothing was recorded
- PASS: it asks which board

