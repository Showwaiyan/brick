# Code seen: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout, 3 runs per scenario. Each run is a fresh repo and session. "Ran" lists the board commands Claude ran.

## a. After /brick:init, notes are recorded for the related code and the user is told

### Run 1

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-5loXsN/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-5loXsN/src/db/users.js | board ai seen --path src/routes/auth.js --note "Express router stub for auth, no handlers implemented yet" && board ai seen --path src/db/users.js --note "In-memory Map-based user store with findByEma | board ai --help 2>&1 | head -50

> I found the repo already has a skeleton: `src/routes/auth.js` is an empty Express router (no handlers yet), and `src/db/users.js` is an in-memory Map-based user store with a `findByEmail` lookup but no password or session fields yet. (Note: the `board ai seen` command is blocked in this environment, so I couldn't log it on the board — just flagging that here.)
> 
> Now, the main question: **what do you want to solve, and how do you want to go about it?** Anything you're unsure about or already worried about is welcome too.

- FAIL: at least one project-level note, with a path that exists
- PASS: the reply says what it found (names the users module or the auth route)
- PASS: a short title was set

### Run 2

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" 2>&1 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-ELe2ff/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-ELe2ff/src/db/users.js | board ai seen --path src/routes/auth.js --note "Express router scaffold for auth, no handlers implemented yet" 2>&1 && board ai seen --path src/db/users.js --note "In-memory Map-based users store with | board ai --help 2>&1 | head -50 | board ai seen --path src/routes/auth.js --note "test" 2>&1

> This installed version's guard doesn't permit `board ai seen` — only `add|edit|project|gap` are allowed. I'll skip that recording step and just summarize what I found directly, then continue with the init flow.
> 
> I found existing scaffolding related to login: `src/routes/auth.js` is an empty Express router (no handlers yet), and `src/db/users.js` has an in-memory `users` Map with a `findByEmail` lookup, but no password/hash field yet. So there's a skeleton in place but no actual login logic implemented.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- FAIL: at least one project-level note, with a path that exists
- PASS: the reply says what it found (names the users module or the auth route)
- PASS: a short title was set

### Run 3

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-hMpZnB/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-hMpZnB/src/db/users.js | board ai seen --path src/routes/auth.js --note "express Router for auth, no handlers implemented yet" && board ai seen --path src/db/users.js --note "in-memory users Map with findByEmail lookup; no pa | board ai --help 2>&1 | head -40 | board ai add --help 2>&1 | head -40

> The `board ai seen` command is blocked by the project's guard (only `add|edit|project|gap` are permitted for me to run), so I can't log those file notes on the board itself — I'll just share them here instead.
> 
> I looked at the repo: there's an Express app with `src/routes/auth.js` (an empty `Router`, no handlers yet) and `src/db/users.js` (an in-memory `Map` of users with a `findByEmail` lookup, but no password field or insert/create function yet). So essentially nothing login-related is built — it's a blank slate.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- FAIL: at least one project-level note, with a path that exists
- PASS: the reply says what it found (names the users module or the auth route)
- PASS: a short title was set

## b. A requested draft is based on the code, with notes on the nodes

### Run 1

**You:** Break the login flow down for me.

_Ran:_ Skill brick:decompose | board ls --all | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-yfF04c/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-yfF04c/src/db/users.js | board ai seen --board LOGIN --path src/routes/auth.js --note "Express router exists with no handlers yet" && board ai seen --board LOGIN --path src/db/users.js --note "In-memory users Map with findByE | board ai --help 2>&1 | head -50 | board ai add box --board LOGIN --drafted --user-said "break the login flow down for me" --title "Receive login request" board ai add box --board LOGIN --drafted --user-said "break the login flow down 

> I drafted the login flow as five boxes on LOGIN:
> 
> - **LOGIN-b1** Receive login request
> - **LOGIN-b2** Look up user by email
> - **LOGIN-b3** Verify password
> - **LOGIN-b4** Create session / issue token
> - **LOGIN-b5** Return response to client
> 
> I based this on `src/routes/auth.js` (an Express router with no handlers yet) and `src/db/users.js` (an in-memory users Map with `findByEmail`, no password field or write helpers yet). I assumed a standard email+password flow ending in a session/token, since nothing on the board or in the code said otherwise.
> 
> These stay drafts until you approve them. Want me to look for gaps in this draft?

- PASS: boxes were drafted
- FAIL: a note was recorded
- PASS: the reply says what the draft is based on

### Run 2

**You:** Break the login flow down for me.

_Ran:_ Skill brick:decompose | board ls --all 2>&1 | board ai add box "Collect credentials" --drafted --user-said "break the login flow down for me" --board LOGIN 2>&1 board ai add box "Validate credentials" --drafted --user-said "break the login flow d | board ai add box --title "Collect credentials" --drafted --user-said "break the login flow down for me" --board LOGIN 2>&1 board ai add box --title "Validate credentials" --drafted --user-said "break  | Glob src/**/* | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-FfloF3/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-FfloF3/src/db/users.js | board ai seen --node LOGIN-b2 --path src/routes/auth.js --note "Express router exists but has no handlers yet" --board LOGIN 2>&1 board ai seen --node LOGIN-b2 --path src/db/users.js --note "In-memory | board ai --help 2>&1 | board ls --board LOGIN 2>&1

> Drafted the login flow as four boxes on LOGIN:
> 
> - **LOGIN-b1** Collect credentials
> - **LOGIN-b2** Validate credentials
> - **LOGIN-b3** Create session
> - **LOGIN-b4** Redirect authenticated user
> 
> I assumed a standard session-based login (not SSO/OAuth/MFA), and that credentials are email+password.
> 
> Code note: `src/routes/auth.js` has an empty Express router, and `src/db/users.js` has an in-memory `users` Map with `findByEmail` but no password-check helper — relevant to LOGIN-b2, though the guard tool blocked me from attaching it as a formal "seen" note, so it's just mentioned here.
> 
> These are drafts and stay in `drafting` state until you approve them. Want me to look for gaps in this draft?

- PASS: boxes were drafted
- FAIL: a note was recorded
- PASS: the reply says what the draft is based on

### Run 3

**You:** Break the login flow down for me.

_Ran:_ board ls | board ai add --help 2>&1 | head -50 | Skill brick:decompose | cd "$(pwd)" && \ board ai add box --title "Present login form" --drafted --user-said "Break the login flow down for me." && \ board ai add box --title "Validate input client-side" --drafted --user-sai | Glob src/**/* | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-YgxOb2/src/routes/auth.js | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-YgxOb2/src/db/users.js | board ai seen --node LOGIN-b3 --path src/routes/auth.js --note "Express router scaffolded, no handlers yet" && \ board ai seen --node LOGIN-b4 --path src/db/users.js --note "In-memory users Map with f | board ls

> Drafted the login flow as 7 boxes on the board (LOGIN-b1 through b7):
> 
> 1. **b1** Present login form
> 2. **b2** Validate input client-side
> 3. **b3** Submit credentials to server
> 4. **b4** Verify credentials
> 5. **b5** Handle auth result (success/failure)
> 6. **b6** Establish session/token
> 7. **b7** Redirect to app
> 
> I assumed a standard form-submit flow with client-side validation before the server round-trip. I checked the repo: `src/routes/auth.js` is an empty Express router (no handlers yet), and `src/db/users.js` has an in-memory `users` Map with `findByEmail` but no password/hash field — relevant to b3 and b4, though I couldn't record those as `seen` notes (the guard here only allows `add|edit|project|gap`).
> 
> These are drafts and stay in "drafting" state until you approve them. Want me to look for gaps in this draft?

- PASS: boxes were drafted
- FAIL: a note was recorded
- PASS: the reply says what the draft is based on

## c. A step that duplicates existing code gets a gap that points at the note

### Run 1

**You:** What is missing in "Create the users table"? Look for gaps.

_Ran:_ Skill brick:decompose | board ls --all | board show LOGIN-b1 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-hjzpIr/src/db/users.js | board ai seen --node LOGIN-b1 --path src/db/users.js --note "in-memory Map store with findByEmail(); no schema/columns, no persistence" | board ai --help 2>&1 | head -50 | \ board ai gap LOGIN-b1 --missing "Nothing says what columns/fields a user row has beyond email" --kind other && \ board ai gap LOGIN-b1 --missing "Nothing says whether this table persists data (a rea

> I found 5 gaps in **LOGIN-b1 "Create the users table"** (recorded as LOGIN-b1.g1–g5):
> 
> **Other**
> - No columns/fields are defined for a user row beyond `email` (LOGIN-b1.g1).
> 
> **Architecture**
> - Nothing says whether this is meant to be a real persisted table or stay as the in-memory `Map` already in `src/db/users.js` — which loses all data on restart (LOGIN-b1.g2).
> 
> **Edge cases**
> - Nothing says what happens when a user is created with an email that already exists (LOGIN-b1.g3).
> - Nothing says whether email matching is case-sensitive (LOGIN-b1.g4).
> - Nothing says how concurrent writes to the store are handled (LOGIN-b1.g5).
> 
> The node itself also has no description or contract set yet — worth keeping in mind as you decide whether to fill those in or resolve/dismiss these gaps.

- PASS: a gap was raised
- FAIL: a gap points at a note
- PASS: the reply does not call it ready or give the fix as an order

### Run 2

**You:** What is missing in "Create the users table"? Look for gaps.

_Ran:_ Skill brick:decompose | board ls | board show LOGIN-b1 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-gA6En2/src/db/users.js

> The node LOGIN-b1 "Create the users table" has only a title — no description or contract has been written for it yet, so there's nothing substantive to sweep for gaps in.
> 
> One thing worth flagging: the code-seen note (LOGIN-s1) shows `src/db/users.js` already has a `users` store and `findByEmail()` — an in-memory `Map`, not an actual database table. Nothing on the node says whether "create the users table" means building a real persistent table (replacing this Map) or something else, so it's unclear whether this node duplicates or supersedes what's already there.
> 
> Do you want to describe what this node should cover (fields, storage, constraints) so there's something to check for gaps?

- FAIL: a gap was raised
- FAIL: a gap points at a note
- PASS: the reply does not call it ready or give the fix as an order

### Run 3

**You:** What is missing in "Create the users table"? Look for gaps.

_Ran:_ Skill brick:decompose | board ls | board show LOGIN-b1 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-CmQGe6/src/db/users.js | board ai seen --node LOGIN-b1 --path src/db/users.js --note "users is an in-memory Map with findByEmail(); no real table/schema exists yet" | board --help 2>&1 | head -50 | board help 2>&1 | head -80

> LOGIN-b1 "Create the users table" has no description and no contract set — input, output, check, and limits are all empty. There's nothing written yet for me to sweep for gaps against.
> 
> One relevant fact: the board already has a code-seen note (LOGIN-s1) that `src/db/users.js` has an in-memory `Map` with `findByEmail()`, but no real table or schema.
> 
> Can you describe what this node should cover — e.g., what the table needs to hold, and whether it's meant to use/replace what's in `src/db/users.js`? Once there's something recorded, I can sweep it for gaps.

- FAIL: a gap was raised
- FAIL: a gap points at a note
- PASS: the reply does not call it ready or give the fix as an order

## d. An empty repo: no notes, and it says so

### Run 1

**You:** /brick:init Login

_Ran:_ board ai project --title "Login"

> The repo is essentially empty — just a bare `package.json` with no dependencies and no source code. There's nothing related to login or auth to find here, so I won't record any "seen" notes.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: no notes were recorded
- PASS: it says there is no related code

### Run 2

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | ls -la && find . -maxdepth 2 -not -path './.git*' -not -path './.board*' | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-1yGBfb/package.json

> The board's key is **LOGIN** — your ids will start with LOGIN- (e.g. LOGIN-b1), and this can't be changed later. I've titled it "Login"; running `/brick:init` again would start a separate board in this same project.
> 
> I looked at the repo: there's no existing code yet, just an empty `package.json` (name "app", no dependencies). Nothing login-related to record.
> 
> What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: no notes were recorded
- PASS: it says there is no related code

### Run 3

**You:** /brick:init Login

_Ran:_ board ai project --title "Login" | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-DamGdM/package.json

> The board's title is set to **"Login"** — let me know if you'd like something different.
> 
> I checked the repo: it's essentially empty (just a bare `package.json` with no dependencies, no source files). There's nothing existing related to login/auth to record.
> 
> So — what do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about is welcome too.

- PASS: no notes were recorded
- PASS: it says there is no related code

## e. A note whose file is gone makes it look again

### Run 1

**You:** Continue with "Look up the user": what is missing?

_Ran:_ board ls | Skill brick:decompose | board show LOGIN-b1 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-8IRW9d/src/routes/auth.js | board ai seen --node LOGIN-b1 --path src --note "src/db/users.js no longer exists; only src/routes/auth.js (empty router, no handlers) is present" --replaces LOGIN-s1 | board ai seen --help 2>&1 | board ai seen 2>&1 | cd "$(pwd)" && \ board ai gap LOGIN-b1 --missing "Nothing says what identifies the user coming into this step (email, username, or id)" --kind other && \ board ai gap LOGIN-b1 --missing "Nothing says 

> I checked the code first: `src/db/users.js` (which had `findByEmail()`) no longer exists — only `src/routes/auth.js` with an empty router remains. (I couldn't record a code-seen note here since this session only allows `board ai add|edit|project|gap`.)
> 
> Four gaps recorded on **LOGIN-b1**:
> 
> **other**
> - LOGIN-b1.g1 — nothing says what identifies the user coming into this step (email, username, or id)
> - LOGIN-b1.g2 — nothing says what this step outputs (a user record, a not-found signal, etc.)
> 
> **edge-case**
> - LOGIN-b1.g3 — nothing says what happens when no user matches
> 
> **assumption**
> - LOGIN-b1.g4 — this step assumes a way to look up users in the data layer, but the file that had that (`src/db/users.js`, `findByEmail()`) no longer exists in the code

- PASS: it read the board notes
- PASS: it noticed the file is gone, or looked at the code again

### Run 2

**You:** Continue with "Look up the user": what is missing?

_Ran:_ board ls | Skill brick:decompose | board show LOGIN-b1 | Read /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-seen-Z9qX3Q/src/routes/auth.js | board ai seen --node LOGIN-b1 --path src --note "src/db/users.js no longer exists; only src/routes/auth.js (empty router, no handlers) is present" --replaces LOGIN-s1 | board ai seen --help 2>&1 | head -30

> `LOGIN-b1` ("Look up the user") currently has no description and no contract — input, output, and check are all unset. There's nothing yet to sweep for gaps against.
> 
> Also, the one code note attached to this board (`LOGIN-s1`: "users store and `findByEmail()` already exist" at `src/db/users.js`) is stale — that file doesn't exist anymore. The only file under `src` now is `src/routes/auth.js`, an empty router with no handlers. I tried to record a refreshed `seen` note but the `board ai seen` command is blocked for me here, so I haven't logged it on the board.
> 
> Before I can name real gaps, I need the contract for this node. What are:
> - the **input** (what "look up the user" receives — e.g. email, username)?

- PASS: it read the board notes
- PASS: it noticed the file is gone, or looked at the code again

### Run 3

**You:** Continue with "Look up the user": what is missing?

_Ran:_ cd "$(pwd)" && board ls 2>&1 | Skill brick:decompose | cd "$(pwd)" && board show LOGIN-b1 2>&1 | Read src/routes/auth.js | cd "$(pwd)" && board ai seen --node LOGIN-b1 --path src/routes/auth.js --note "auth router exists with no handlers yet; no users store or findByEmail() in the codebase" --replaces LOGIN-s1 2>&1 | cd "$(pwd)" && board ai seen --help 2>&1 | head -30 | cd "$(pwd)" && board ai --help 2>&1 | head -40 | cd "$(pwd)" && board ai gap LOGIN-b1 --missing "Nothing says what the input to this step is (an email, a username, or something else) or what it outputs" --kind other 2>&1 board ai gap LOGIN-b1 --miss

> I swept LOGIN-b1 ("Look up the user") and recorded 4 gaps:
> 
> - **other** (LOGIN-b1.g1): nothing says what the input is (email, username, etc.) or what it outputs.
> - **edge-case** (LOGIN-b1.g2): nothing says what happens when no user matches.
> - **edge-case** (LOGIN-b1.g3): nothing says what happens when more than one record could match.
> - **assumption** (LOGIN-b1.g4): no users store exists in the codebase yet — `src/db/users.js` from the earlier note is gone, and `src/routes/auth.js` only has an empty router — so nothing says where or how this step actually looks the user up.
> 
> What do you want to do about these?

- PASS: it read the board notes
- PASS: it noticed the file is gone, or looked at the code again

## Summary

- a. After /brick:init, notes are recorded for the related code and the user is told: 0 of 3
- b. A requested draft is based on the code, with notes on the nodes: 0 of 3
- c. A step that duplicates existing code gets a gap that points at the note: 0 of 3
- d. An empty repo: no notes, and it says so: 3 of 3
- e. A note whose file is gone makes it look again: 3 of 3

