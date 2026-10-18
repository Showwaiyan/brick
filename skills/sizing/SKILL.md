---
name: sizing
description: Load this when the user has finished describing a node, or asks whether to split something further, whether a piece is small enough, or whether a breakdown is enough. It says how to run `board check` and how to state, as an observation, whether a node can stay whole or could be split. The user decides.
---

# Is this broken down enough?

Run `board check <id>` first. It prints facts and flags (contract set or not, title joining two things, siblings, depth, open gaps, AI drafts not approved). Then add your own reading of what code cannot see, and state an observation. The user decides; you never say it is done.

## When
Once per node, at the moment the user stops describing it, or when they ask. Not after every message. For the whole board, run `board check` with no id.

## The checks

**A leaf (a piece of work to build):**
1. One purpose, sayable in a sentence without "and".
2. Input, output and check are stated.
3. Checkable alone: someone who sees only the input, output and check could write the test.
4. Reviewable in one sitting: about 15 minutes to read the result.
5. Understandable: a newcomer could explain it back in two sentences from the title and description.
6. No hidden shared state with a sibling. If two pieces cannot be checked without each other, they are one piece.
7. Stop splitting when the pieces could not be checked on their own. Splitting too far is a failure too.

**A flow or architecture box (no code, a problem in itself):**
1. Boundary: its input, output, what it owns and what it depends on fit in a few lines.
2. No orphans: every input has a producer, and every output has a consumer or is the project output.
3. Failure has an owner: its error, empty and limit cases are covered by it or by a named other box, or the user said "not handled" on purpose.
4. Observable check: the user could say how they would tell it worked without reading code.
5. Explainable in a minute from its title and contract. "And also" means split.
6. Splittable or a leaf: its children can be named, or it already meets the leaf checks.

Soft limits, as nudges only: about 3 to 9 boxes at the top level, about 4 levels deep.

## What you say
State what the checks show, in both directions, and hand it back:
- "By these checks, <title> can stay whole: <which checks it meets>. Splitting further would give pieces you could not test separately. Your call."
- "<Title> has two purposes: <a> and <b>. By the one-purpose check it could be split. Your call."
- If the check output flags something (a missing output, a title joining two things, an open gap, an AI draft not yet approved), say it plainly.
Say which checks you judged yourself and which `board check` computed.

## Never
Say ready, approved, complete, done, or looks good. Do not split a node for the user unless they ask you to (see drafting in the decompose skill). Do not decide for them. Do not raise it again after they have chosen.
