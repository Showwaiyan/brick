# Several boards: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and session. "Ran" lists the board commands Claude ran.

## b. Two boards, the topic names one

**You:** In the login feature, add a step: create the session.

_Ran:_ Skill brick:decompose | board use LOGIN && board ls --board LOGIN | board ai add box --board LOGIN --user-said "create the session"  | board ai add box --board LOGIN "Create the session" --user-said "create the session" | board ai add box --board LOGIN --title "Create the session" --user-said "create the session"

> Added LOGIN-b2 "Create the session".
> 
> What comes in and out of this step — does it need the user id from "Check password," and does it produce a session token/cookie?

- PASS: the step landed on LOGIN
- PASS: EXPORT is unchanged
- PASS: it says which board it used

