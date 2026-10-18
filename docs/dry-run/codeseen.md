# Code seen: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout, 3 runs per scenario. Each run is a fresh repo and session. "Ran" lists the board commands Claude ran.

## a. After /brick:init, notes are recorded for the related code and the user is told

### Run 1

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | Glob **/* | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-bVWSUf/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-bVWSUf/src/db/users.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-bVWSUf/package.json | board ai seen --path src/routes/auth.js --note "Express router stub for auth, no handlers yet" && board ai seen --path src/db/users.js --note "In-memory users Map with findByEmail lookup, no password/

> Your board is **LOGIN**, titled "Login."
> 
> What I found in the repo: there's an Express app skeleton with an empty `auth` router (`src/routes/auth.js`) and an in-memory `users` Map with a `findByEmail` lookup (`src/db/users.js`) — no password field, hashing, sessions, or auth libraries installed yet. So login is essentially unbuilt — just the scaffolding is there.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: at least one project-level note, with a path that exists
- PASS: the reply says what it found (names the users module or the auth route)
- PASS: a short title was set

### Run 2

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | Glob **/*" | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-3hESW0/package.json | Glob src/**/* | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-3hESW0/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-3hESW0/src/db/users.js | board ai seen --path src/routes/auth.js --note "Express router for auth exists but has no handlers yet" board ai seen --path src/db/users.js --note "In-memory users Map with findByEmail lookup, no pas

> Found a small Express app with the scaffolding for this already in place: `src/routes/auth.js` has an empty auth router (no handlers yet), and `src/db/users.js` has an in-memory `users` Map with a `findByEmail` lookup, but nothing for creating users or checking passwords yet. So login would be built on top of this, not from scratch.
> 
> The board's title is set to "Login" — let me know if you'd like a different one.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: at least one project-level note, with a path that exists
- PASS: the reply says what it found (names the users module or the auth route)
- PASS: a short title was set

### Run 3

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | Glob **/* | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-U36vGu/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-U36vGu/src/db/users.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-U36vGu/package.json | \ board ai seen --path src/routes/auth.js --note "Express router stub, no handlers defined yet" && \ board ai seen --path src/db/users.js --note "In-memory Map for users with findByEmail lookup, no pa

> The board's titled **Login**, you can ask for a different name any time.
> 
> I looked through the repo for anything login-related: there's an empty Express router at `src/routes/auth.js` with no handlers yet, an in-memory `users` Map in `src/db/users.js` with just email lookup (no password or session fields), and `package.json` only has Express installed — no auth, session, or password-hashing libraries. So this is a clean slate, nothing to build on yet.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: at least one project-level note, with a path that exists
- PASS: the reply says what it found (names the users module or the auth route)
- PASS: a short title was set

## b. A requested draft is based on the code, with notes on the nodes

### Run 1

**You:** Break the login flow down for me.

_Ran:_ Skill brick:decompose | board ls --all | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-wpT55l/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-wpT55l/src/db/users.js | \ board ai seen --board LOGIN --path src/routes/auth.js --note "Express router exists but has no handlers yet" && \ board ai seen --board LOGIN --path src/db/users.js --note "In-memory users Map with  | \ board ai add box --board LOGIN --drafted --user-said "break the login flow down for me" --title "Receive login request" && \ board ai add box --board LOGIN --drafted --user-said "break the login flo

> I drafted the login flow as five boxes on the LOGIN board:
> 
> - **LOGIN-b1** Receive login request
> - **LOGIN-b2** Look up user by email
> - **LOGIN-b3** Verify password
> - **LOGIN-b4** Create session/token
> - **LOGIN-b5** Return response to client
> 
> Based on: `src/routes/auth.js` (router exists, no handlers yet) and `src/db/users.js` (in-memory `users` Map with `findByEmail`, but no password field, and no session/token storage anywhere).
> 
> Assumed: the flow uses password-based login with a session or token issued on success — the code doesn't confirm this, since there's no password field or session mechanism yet.
> 
> These are drafts and stay drafting until you approve them. Want me to look for gaps in this draft?

- PASS: boxes were drafted
- PASS: a note was recorded
- PASS: the reply says what the draft is based on

### Run 2

**You:** Break the login flow down for me.

_Ran:_ cd "/private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-ouE4EV" && board ls | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-ouE4EV/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-ouE4EV/src/db/users.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-ouE4EV/package.json | Skill brick:decompose | cd "/private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-ouE4EV" && board ai seen --path "src/routes/auth.js" --note "Express router exists but has no handlers yet" && board ai seen --p | cd "/private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-ouE4EV" && \ board ai add box --drafted --user-said "break the login flow down for me" --title "Submit credentials" && \ board a

> Drafted the login flow as five boxes:
> 
> - **LOGIN-b1** Submit credentials
> - **LOGIN-b2** Look up user by email
> - **LOGIN-b3** Verify password
> - **LOGIN-b4** Create session
> - **LOGIN-b5** Return result to client
> 
> Based on: `src/routes/auth.js` (router exists, no handlers), `src/db/users.js` (in-memory `users` Map with `findByEmail`, no password or session fields), and `package.json` (only `express` installed — no session/hashing library yet).
> 
> Assumed: a standard email+password login with a server-side session, since that's the only shape the existing `findByEmail` lookup supports — nothing in the code suggests tokens/OAuth.
> 
> These are drafts and stay drafting until you approve them. Want me to look for gaps in this draft?

- PASS: boxes were drafted
- PASS: a note was recorded
- PASS: the reply says what the draft is based on

### Run 3

**You:** Break the login flow down for me.

_Ran:_ Skill brick:decompose | board ls --all && echo ---- && find src -type f | head -100 && echo ---- && cat package.json | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-YgeHd5/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-YgeHd5/src/db/users.js | board ai seen --help 2>&1 | head -30 && echo --- && board ai add --help 2>&1 | head -40 | \ board ai seen --path src/routes/auth.js --note "Router exists but has no handlers yet" --board LOGIN && \ board ai seen --path src/db/users.js --note "users Map with findByEmail only; no password fi | \ board ai add box --title "Submit credentials" --user-said "break the login flow down for me" --drafted --board LOGIN && \ board ai add box --title "Look up user by email" --user-said "break the logi

> Drafted the login flow as five boxes on board LOGIN:
> 
> - **LOGIN-b1** Submit credentials
> - **LOGIN-b2** Look up user by email
> - **LOGIN-b3** Check password
> - **LOGIN-b4** Create session or token
> - **LOGIN-b5** Return result to client
> 
> This is based on `src/routes/auth.js` (LOGIN-s1: router exists, no handlers yet) and `src/db/users.js` (LOGIN-s2: a `users` Map with only `findByEmail`, no password field, hashing, or session/token handling).
> 
> Assumptions I made: that login is email+password based (matching `findByEmail`), and that a session/token step is needed even though nothing in the code implements it yet.
> 
> These are drafts and stay in drafting state until you approve them. Want me to look for gaps in this draft?

- PASS: boxes were drafted
- PASS: a note was recorded
- PASS: the reply says what the draft is based on

## c. A step that duplicates existing code gets a gap that points at the note

### Run 1

**You:** What is missing in "Create the users table"? Look for gaps.

_Ran:_ Skill brick:decompose | board ls --board LOGIN | board show LOGIN-b1 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-P1SyUW/src/db/users.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-P1SyUW/src/routes/auth.js | board ai seen --board LOGIN --node LOGIN-b1 --path src/db/users.js --note "users is an in-memory Map with findByEmail(); no schema, columns, id, password field, or persistence" | \ board ai gap LOGIN-b1 --missing "Nothing says what columns the users table has (id, email, password, timestamps, etc.)" --kind other --seen LOGIN-s2 && \ board ai gap LOGIN-b1 --missing "Nothing say

> Based on `src/db/users.js` (recorded as LOGIN-s2 — it's an in-memory `Map` with only `findByEmail()`, no schema), I found 6 gaps in "Create the users table":
> 
> **other**
> - LOGIN-b1.g1 — Nothing says what columns the table has (id, email, password, timestamps, etc.)
> - LOGIN-b1.g3 — Nothing says how the password is stored (plain, hashed, which algorithm)
> - LOGIN-b1.g5 — Nothing says how or when the table is created (migration, schema file, startup script)
> 
> **edge-case**
> - LOGIN-b1.g2 — Nothing says what happens when a row is inserted with an email that already exists
> 
> **architecture**
> - LOGIN-b1.g4 — Nothing says what database or storage engine backs the table; the current code is an in-memory Map that is lost on restart
> 
> **assumption**
> - LOGIN-b1.g6 — Nothing says what validates the email format or required fields before a row is written

- PASS: a gap was raised
- PASS: a gap points at a note
- PASS: the reply does not call it ready or give the fix as an order

### Run 2

**You:** What is missing in "Create the users table"? Look for gaps.

_Ran:_ Skill brick:decompose | cd /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn-T-brick-seen-XKo2cB 2>/dev/null; board ls 2>&1 || true | board show LOGIN-b1 2>&1 | Read ./src/db/users.js | Read ./src/routes/auth.js | board ai seen --node LOGIN-b1 --path src/db/users.js --note "users store is an in-memory Map with findByEmail(); no schema, columns, or persistence defined" --board LOGIN 2>&1 |  board ai gap LOGIN-b1 --missing "Nothing says what columns/fields the users table has (e.g. id, email, password hash, timestamps)" --kind other --seen LOGIN-s2 --board LOGIN 2>&1 board ai gap LOGIN-b

> I checked `src/db/users.js` (the existing store) and recorded it as LOGIN-s2. Based on the node and that code, here's what's missing in **LOGIN-b1 "Create the users table"**:
> 
> **other**
> - LOGIN-b1.g1 — nothing says what columns/fields the table has (id, email, password hash, timestamps, etc.)
> - LOGIN-b1.g5 — the node has no description or contract (input/output/check/limits) set at all
> 
> **edge-case**
> - LOGIN-b1.g2 — nothing says whether email must be unique, or what happens on a duplicate insert
> 
> **assumption**
> - LOGIN-b1.g3 — the existing store is an in-memory `Map`, but nothing says whether this node means that in-memory store or a real persisted table
> 
> **architecture**
> - LOGIN-b1.g4 — nothing says how the table is created/migrated; no owner for that external dependency
> 
> Only you can approve it: `/brick:approve LOGIN-b1`.

- PASS: a gap was raised
- PASS: a gap points at a note
- PASS: the reply does not call it ready or give the fix as an order

### Run 3

**You:** What is missing in "Create the users table"? Look for gaps.

_Ran:_ Skill brick:decompose | board ls | board show LOGIN-b1 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-wfSO80/src/db/users.js | board ai seen --board LOGIN --node LOGIN-b1 --path src/db/users.js --note "in-memory Map with findByEmail(); no schema, no insert/add function, no unique constraint on email" | \ board ai gap LOGIN-b1 --missing "No columns or schema are stated for the users table" --kind other && \ board ai gap LOGIN-b1 --missing "Nothing says how a user gets added to the table; src/db/users

> I recorded 7 gaps on LOGIN-b1 based on the node's title/description and `src/db/users.js` (LOGIN-s2: in-memory Map with `findByEmail()`, no insert function, no unique constraint).
> 
> **other**
> - No columns or schema are stated for the users table.
> - Nothing says how a user gets added — the code has `findByEmail()` but no insert/add function.
> - The node has no description or contract, so its input/output/check are not stated.
> 
> **edge-case**
> - Nothing says what happens on a duplicate email.
> - Nothing says what happens on an empty or malformed email/password.
> - Nothing says what two concurrent signups with the same email should do.
> 
> **architecture**
> - The table is an in-memory `Map`; nothing says whether data must survive a restart, and no owner is named for persistence.
> 
> Only you can approve it: `/brick:approve LOGIN-b1`.

- PASS: a gap was raised
- PASS: a gap points at a note
- PASS: the reply does not call it ready or give the fix as an order

## d. An empty repo: no notes, and it says so

### Run 1

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-s1BpUw/package.json

> This repo is essentially empty — just a bare `package.json` with no dependencies, no code related to login yet. Nothing to record as "seen" here.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: no notes were recorded
- PASS: it says there is no related code

### Run 2

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | ls -la && find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.board/*' | head -50 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-KGMkgL/package.json

> There's nothing in this repo yet related to login (just a bare `package.json` with no dependencies) — this is a fresh project, so I won't record any "seen" notes.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: no notes were recorded
- PASS: it says there is no related code

### Run 3

**You:** /brick:init Login

_Ran:_ board ai project --title "Login"

> The board's title is **"Login"**, in case you want something different.
> 
> I checked the repo — it's essentially empty, just a bare `package.json` with no dependencies and no other code. There's nothing related to login/auth here yet, so I didn't record anything.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: no notes were recorded
- PASS: it says there is no related code

## e. A note whose file is gone makes it look again

### Run 1

**You:** Continue with "Look up the user": what is missing?

_Ran:_ board ls | Skill brick:decompose | board show LOGIN-b1

> LOGIN-b1 "Look up the user" has nothing recorded beyond the title — no description, and the contract (input/output/check/limits) is all unset. There's nothing yet to sweep for gaps.
> 
> What does this step take in, and what does it produce?

- PASS: it read the board notes
- FAIL: it noticed the file is gone, or looked at the code again

### Run 2

**You:** Continue with "Look up the user": what is missing?

_Ran:_ board ls | board show LOGIN-b1 2>&1 || board ai show LOGIN-b1 2>&1 || board --help 2>&1 | head -50 | board ls -v 2>&1 | head -80 | Skill brick:decompose | board show LOGIN-b1

> `LOGIN-b1 "Look up the user"` has no description and no contract set yet — input, output, check, and limits are all "not set." There's nothing written for this node yet to sweep for gaps.
> 
> What's the input to this step — what does it receive to look the user up with?

- PASS: it read the board notes
- FAIL: it noticed the file is gone, or looked at the code again

### Run 3

**You:** Continue with "Look up the user": what is missing?

_Ran:_ which board 2>/dev/null; board ls 2>&1 | head -50 | board show LOGIN-b1 2>&1

> Looking at `LOGIN-b1` ("Look up the user"):
> 
> - **description**: not set
> - **contract**: input, output, check, and limits are all not set
> - **code seen**: the note pointing to `src/db/users.js` (`findByEmail()`) is marked **gone** — that file/reference no longer resolves, so it needs re-checking
> 
> What's the input to this step — what do you look the user up by?

- PASS: it read the board notes
- PASS: it noticed the file is gone, or looked at the code again

## Summary

- a. After /brick:init, notes are recorded for the related code and the user is told: 3 of 3
- b. A requested draft is based on the code, with notes on the nodes: 3 of 3
- c. A step that duplicates existing code gets a gap that points at the note: 3 of 3
- d. An empty repo: no notes, and it says so: 3 of 3
- e. A note whose file is gone makes it look again: 1 of 3


## Notes

- The first full run found two real bugs (the guard blocked `board ai seen`, and Claude often drafted without reading the code); both were fixed and the scenarios re-run. Rates above are from the last full run.
- Scenario e (a note whose file is gone) is the weak spot at 1 of 3. After that run the brief gained a rule telling Claude to say so and read the file again; that rule was not re-run against real Claude.
