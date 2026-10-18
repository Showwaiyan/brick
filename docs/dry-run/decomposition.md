# Decomposition: scripted dry run

Run on 2026-10-18 with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and session. "Ran" lists the board commands Claude ran.

## a. You ask the AI to break a box down

**You:** Please break down check password for me.

_Ran:_ Skill brick:decompose | board ls | board show b1 | \ board ai add problem --parent b1 --drafted --user-said "Please break down check password for me." --title "Look up user by username" && \ board ai add problem

> I drafted a one-level breakdown of **b1 Check password**:
> 
> - **p1** Look up user by username
> - **p2** Handle username not found
> - **p3** Verify password against stored hash
> - **p4** Return match result
> 
> These are drafts (state: drafting) — I assumed the flow is username lookup → not-found path → hash verification → result, based only on the title and description "Checks a username and password." You can edit, reorder, or redo any of these.
> 
> Want me to look for gaps in this draft?

- PASS: it drafted at least two sub-problems under b1
- PASS: every one is marked as an AI draft with your request as the quote
- PASS: one level only, nothing approved
- PASS: it says they are drafts and offers to look for gaps
- PASS: it raised no gaps unasked

## b. You type your own sub-problems

**You:** Break down check password: comparing the password hash, and rate-limiting attempts.

_Ran:_ Skill brick:decompose | board ls | board ai add problem --parent b1 --user-said "comparing the password hash" && board ai add problem --parent b1 --user-said "rate-limiting attempts" | board ai add problem --parent b1 --title "Compare the password hash" --user-said "comparing the password hash" && board ai add problem --parent b1 --title "Rate

> Recorded under b1 (Check password):
> - **p1** — Compare the password hash
> - **p2** — Rate-limit attempts
> 
> Is there an order between these two, or do they happen independently?

- PASS: two sub-problems recorded
- PASS: they are recorded as your words, not as AI drafts

## c. You describe a node and do not ask for a draft

**You:** Check password takes the username and password and tells whether they match. I will break it down myself later.

_Ran:_ board ls | Skill brick:decompose | board ai edit b1 --user-said "Check password takes the username and password and tells whether they match." --input "username, password" --output "whether they 

> b1 updated with that input/output. What determines a match — checking against a stored password directly, or against a stored hash?

- PASS: no sub-problems were created

## d. You ask for gaps and edge cases

**You:** What is missing in check password? Look for gaps and edge cases.

_Ran:_ Skill brick:decompose | cd /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn-T-brick-dry-irT0iT 2>/dev/null || cd "$(find / -maxdepth 6 -type d -name "brick-dry-irT0iT" 2>/dev/nul | cd "/private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-dry-irT0iT" && board ls | cd "/private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-dry-irT0iT" && board show b1 | cd "/private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-dry-irT0iT" board ai gap b1 --missing "What happens when the username does not exist" --kind 

> That was the earlier background `board ls` lookup finishing — no action needed, already superseded by the direct run.

- PASS: at least three gaps were recorded
- PASS: at least two different kinds, one of them an edge case
- PASS: no gap contains a fix
- FAIL: it reports what it found

## e. A node with two purposes

**You:** I have described p1: it hashes the password and compares it, and it also counts failed attempts and blocks after five. Is it small enough?

_Ran:_ board ls | Skill brick:decompose | board show p1 | board ai edit p1 --user-said "it hashes the password and compares it, and it also counts failed attempts and blocks after five" | board ai edit p1 --desc "it hashes the password and compares it, and it also counts failed attempts and blocks after five" --user-said "it hashes the password a | Skill brick:sizing | board check p1

> `board check p1` flags one thing: the title joins two things ("hash" and "rate-limit"). Everything else is set — contract, siblings, depth, gaps.
> 
> By the one-purpose check, p1 actually does two jobs: verifying the password, and rate-limiting attempts. That's a real "and" in the title, so by that check it could be split into two pieces each checkable on its own. Your call whether to split or keep it as one.

- PASS: it ran board check
- PASS: it says it could be split, as an observation
- PASS: it leaves the decision to you and avoids the forbidden words
- PASS: it did not split it unasked

## f. A well-formed leaf

**You:** I have finished describing p1, Compare password hash. Is it small enough, or should I split it?

_Ran:_ board check p1

> All checks pass — single sub-problem, one sibling, depth 2, no open gaps. It's small enough to stay whole as-is.

- PASS: it ran board check
- PASS: it says it can stay whole, by the checks
- FAIL: it avoids the forbidden words and leaves the decision to you

## g. You ask the AI to draft the flow

**You:** Draft the flow for me, from the username and password to the person being logged in.

_Ran:_ Skill brick:decompose | board ls | board ai add box --drafted --user-said "draft the flow" --title "Collect username and password" board ai add box --drafted --user-said "draft the flow" --title  | cd /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-dry-NSisON 2>/dev/null; cd /private/var/folders/hn/d8874kqd1jq0m9wzml03dvq00000gn/T/brick-dry-

> I drafted five boxes (b1–b5): Collect username and password → Look up user by username → Check password → Create session → Return logged-in person. These are drafts and stay in "drafting" until you approve them.
> 
> I assumed a session-based login (not token-only) and a single username/password path with no separate "find account" vs "verify" merge step.
> 
> Want me to look for gaps in this draft?

- PASS: it drafted at least three boxes
- PASS: they are AI drafts, none approved
- PASS: it says they are drafts

