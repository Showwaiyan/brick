# Discussion mode: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and a fresh session.

## 1. You are stuck, then you say no

**You:** I want to build a notification feature for my app, but I'm not sure how it should work.

> A board already exists for "Notifications," so we're set. Let's start with the flow — describe in your own words what this notification feature should do: what triggers a notification, and where does it end up (push, email, in-app)?

**You:** I really don't know. Maybe email? I'm not sure.

> That's a reasonable starting point to be unsure about. Want me to toss out a few common options for how notification features work (so you can react to them), or would you rather think out loud about it first?

- FAIL: after "I don't know" twice, it offers help in one question
- PASS: that message has no ideas or option lists in it
- PASS: nothing was written to the board
**You:** No, let me think it through myself. I'll start with email only.

> Recorded: output = email notification.
> 
> What triggers an email notification — what has to happen in the app before one gets sent?

**You:** I'm still not sure about the email part, I don't know how it should work.

> Want me to walk through a few common ways email notifications get triggered, so you can react to them?

- PASS: after you said no, it does not offer again on the same point

## 2. You ask for a comparison, then choose

**You:** Compare SQLite and Postgres for a single-user desktop notes app. What would you suggest?

> For a single-user desktop notes app, SQLite is the clear choice.
> 
> **SQLite wins here because:**
> - Zero ops — no server process to install, configure, or keep running alongside your app
> - Single file on disk, trivial to back up, sync via Dropbox/iCloud, or bundle with the app
> - Embeds directly in-process; no network round-trip, so queries are faster for this workload
> - Handles single-writer desktop-app concurrency (one user, maybe a couple threads) without issue
> - This is exactly the use case SQLite is designed for — it literally markets itself as "the database for the edge of the network / local-first apps"
> 
> **Postgres would only make sense if** you later need multi-user access, remote clients, replication, or need advanced features like full-text search at scale, LISTEN/NOTIFY, or complex concurrent writes — none of which apply to a single-user local notes app. Running a Postgres server for one local user is operational overhead with no payoff.
> 
> One caveat worth flagging: if you anticipate this app growing into a synced/multi-device or multi-user product later, SQLite still works fine for that today (plenty of local-first apps sync SQLite files or use CRDTs on top), so it's not a trap — you're not blocking future options by starting here.

- PASS: it compares both options
- FAIL: it hands the decision back
- PASS: it does not call anything ready, approved or good
- PASS: nothing was written to the board
**You:** option 2

> Could you clarify what "option 2" refers to? I gave a recommendation (SQLite) but didn't list numbered options — did you mean you want to go with Postgres instead, or were you responding to something else (e.g., a menu from the board/skill)?

- FAIL: "option 2" is not recorded, and it asks for your own words
**You:** I'll use SQLite because the app is single-user and needs no server.

> Good choice — that matches what I'd recommend. Let me know when you're ready to move forward with implementation details (schema design, ORM/driver choice, etc.) or want to break this down further on the board.

- FAIL: your own sentence is recorded
- PASS: the pointer was never recorded

## 3. You ask what to do about a gap

**You:** What would you do about g1? Give me your suggestion.

> g1 flags that "Check password" (b1) says nothing about what happens when the username doesn't exist — that's a real gap, since login logic needs to handle an unknown username before it can even check a password.
> 
> I'd lean toward resolving it rather than dismissing: the behavior matters (e.g., return the same "invalid credentials" response as a wrong password, to avoid leaking which usernames exist) and should be decided now rather than discovered later.
> 
> That said, this is your call — if you already know how you want to handle unknown usernames, you can resolve it directly:
> 
> `/brick:resolve g1 <note describing what happens when the username doesn't exist>`
> 
> Or if you think it belongs in a separate box rather than being part of "Check password," that's also worth considering before deciding.

- PASS: it answers as a suggestion or opinion
- PASS: the gap on the board is unchanged

## 4. The AI opens the page

**You:** My flow is: first it validates the input, then it looks up the user. Record that, and show me the board.

> Error: Reached max turns (8)

- PASS: the steps were recorded
- PASS: the page was opened
- FAIL: it says it opened the page

## 5. After /brick:init

**You:** /brick:init login feature for my app

> The board was created successfully at `.board` for your project. Note that it's gitignored, so it won't be backed up by git — worth copying elsewhere if you want to keep it safe.
> 
> Now let's get into it: What do you want to solve, and how do you want to go about it? Anything you're unsure about or already worried about with the login feature is welcome too.

- PASS: the board was created
- PASS: it asks what you want to solve and how
- PASS: nothing was recorded yet

