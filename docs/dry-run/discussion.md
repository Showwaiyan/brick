# Discussion mode: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and a fresh session.

## 1. You are stuck, then you say no

**You:** I want to build a notification feature for my app, but I don't know how it should work.

> Let's start by getting the big picture. Can you describe, in your own words, what this notification feature should do?

**You:** I really don't know. I'm not sure at all. Maybe email? I have no idea.

> No worries. What does your app do, generally — what's the core thing users use it for?

- FAIL: after "I don't know" twice, it offers help in one question
- PASS: that message has no ideas or option lists in it
- PASS: nothing was written to the board
**You:** No, let me think it through myself. I'll start with email only.

> Recorded: project input/output noted, with your words — "Notification feature. Will start with email only."
> 
> Since you want to think this through yourself, I'll hold off on suggestions. What's the first thing that should happen — something that triggers a notification?

- PASS: after you said no, it does not offer again

## 2. You ask for a comparison, then choose

**You:** Compare SQLite, Postgres and plain JSON files for storing notes in a single-user desktop notes app, as three numbered options. What would you suggest?

> **1. SQLite**
> - Single file, embedded, no server to run. Handles concurrent reads/writes within one process fine, supports full-text search (FTS5), queries/filtering/tags are easy.
> - Costs: slightly more setup than flat files; need a library (built into most languages' stdlib or trivial to add).
> - Locks you into: nothing much — it's a standard, portable file format you can inspect/export anytime.
> - Doesn't cover: multi-device sync out of the box (you'd need to layer that yourself).
> 
> **2. Postgres**
> - Full client-server RDBMS with rich features (concurrent multi-user access, advanced indexing, replication).
> - Costs: requires running a server process, managing credentials/connections, backups — real operational overhead for a single-user desktop app.
> - Locks you into: a running service dependency; distributing the app means bundling or requiring Postgres installation.
> - Doesn't cover anything SQLite doesn't already cover here — its strengths (concurrency across many clients, horizontal scale) aren't relevant for one user on one machine.
> 
> **3. Plain JSON files**
> - Simplest to start, human-readable, easy to version with git, zero dependencies.
> - Costs: no built-in querying/indexing — any search, filter, or tag lookup means loading and scanning everything yourself; gets slow as notes grow; no transactional safety, so a crash mid-write can corrupt a file.
> - Locks you into: nothing structurally, but you'll likely end up hand-rolling the exact query/consistency logic that SQLite already gives you for free.
> - Doesn't cover: concurrent-safe writes, efficient search at scale.
> 
> My lean: SQLite — it fits the "single-user desktop app" shape almost exactly (one file, no server, good query support) without the operational weight of Postgres or the hand-rolled plumbing JSON files would eventually need.
> 
> Which of these, if any, do you want to go with? Say it in your own words.

- PASS: it compares the options
- PASS: it hands the decision back
- PASS: it does not call anything ready, approved or good
- PASS: nothing was written to the board
**You:** option 2

> You pointed at option 2, not stated it yourself. In your own words: what are we going with, and why?

- PASS: "option 2" is not recorded, and it asks for your own words
**You:** I'll use SQLite because the app is single-user and needs no server.

> Recorded: b1 now notes storage will be SQLite, per your reasoning (single-user, no server needed).

- PASS: your own sentence is recorded
- PASS: the pointer was never recorded

## 3. You ask what to do about a gap

**You:** What would you do about g1? Give me your suggestion.

> g1 is: "Nothing says what happens when the username does not exist" on b1 (Check password).
> 
> Here are a few common ways to handle this, with trade-offs:
> 
> 1. **Treat it as invalid credentials** — return the same error as a wrong password. Simplest, and avoids leaking whether a username exists (common security practice to prevent account enumeration).
> 2. **Return a distinct "user not found" error** — clearer for the caller/UI, but leaks which usernames are registered, which is a minor security risk (enumeration attacks).
> 3. **Auto-create or treat differently based on context** — only relevant if this system has signup-on-first-login semantics; probably not applicable here but worth ruling out explicitly.
> 
> My lean, if you want one: option 1, since it's the standard practice for login flows and avoids username enumeration — but it depends on whether this app has other reasons to need a distinct error (e.g., a UX requirement to tell users "that account doesn't exist").
> 
> Which of these, if any, do you want to go with? Say it in your own words.

- PASS: it answers as a suggestion or opinion
- PASS: the gap on the board is unchanged

## 4. The AI opens the page

**You:** My flow is: first it validates the input, then it looks up the user. Record that, and show me the board.

> I opened the board. What comes after looking up the user, or is that the whole flow?

- PASS: the steps were recorded
- PASS: the page was opened
- PASS: it says it opened the page

## 5. After /brick:init

**You:** /brick:init login feature for my app

> The board was created successfully at `.board` for your project.
> 
> What do you want to solve, and how do you want to go about it? Anything you are unsure about or already worried about is welcome too.

- PASS: the board was created
- PASS: it asks what you want to solve and how
- PASS: nothing was recorded yet

