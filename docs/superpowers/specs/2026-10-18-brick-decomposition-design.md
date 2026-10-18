# brick: drafting on request, finding gaps and edge cases, and knowing when a breakdown is enough

Status: draft for review. Branch `feat/decomposition`. Builds on the plugin design and the discussion-mode design.

## 1. Why

The flow is what the user wants to build. Two things are missing around it.

1. **Who writes the breakdown.** Today the AI only records what the user says. A user should be able to say "break down check password for me" or "draft the flow from what I described", and the AI should do it, at the flow level and at every level below. It must stay clear on the page who wrote what, and nothing the AI drafts may count as decided until the user approves it.
2. **When to stop.** Neither the user nor the AI has a way to tell that a breakdown is enough, or that it has gone too far. And when the user asks about gaps, the AI should look beyond "what is missing" to edge cases, architecture gaps, assumptions and ordering.

## 2. Decisions already made

- The AI drafts only when asked, never on its own initiative. A draft is one request, one node.
- Drafted nodes start as drafting and need the user's `/brick:approve`, like any other.
- When asked for gaps, the AI sweeps for gaps, edge cases and other situations, and states each one. It still never gives the fix.
- Criteria for "enough" are the ones in section 5, delivered as **skill text plus mechanical signals from a read-only `board check` command** (option B). There is no hard gate on approve.
- Soft limits, as nudges only: about 3 to 9 boxes at the top level, about 4 levels deep.

## 3. Drafting on request

**What counts as a request.** The user says so in their own words: "break this down for me", "you do it", "draft the flow", "come up with the steps". Anything weaker (a question, "what do you think", being stuck) is a discussion, not a request; the discuss skill applies.

**What the AI does.** It creates the nodes for that one node (or the top-level flow), one level, with `board ai add ... --drafted --user-said "<the user's request>"`. The quote is the request, not a pointer to an earlier suggestion. Then it says what it created, that these are its draft and still need review, and offers one thing: "Want me to look for gaps in this draft?" It does not go deeper unless asked again ("all the way down" in the user's words counts, once).

**Data.**
- A drafted node has `source: "ai-draft"` (existing values are `human` and `ai-scribe`). Its `said` holds the request.
- `board ai edit <id> --drafted --user-said "<request>"` is for "write the contract for me" on an existing node. It records the event with `drafted: true` and adds the request to `said`. Provenance is per node when created and per edit in the history; per-field provenance is out of scope.
- The event actor stays `ai`. `board ai add` without `--drafted` is unchanged.
- No store migration: `validate` does not restrict `source`, and old files have none of the new values.

**On the page.**
- The node page's "Who wrote it" shows "Drafted by Claude because you asked:" and the quote. History marks drafted edits.
- A drafted node that is not yet approved shows "AI draft" on its second label line in the Flow, Tree and node-flow diagrams, so you can see what you have not reviewed. The marker goes away on approval.

**A weakness we accept.** The AI will name gaps in a draft it wrote, which makes it a weak critic of its own work. The README says so. A separate reviewer role, later, is the real answer.

## 4. Finding gaps, edge cases and other situations

When the user asks what is missing, how robust something is, or for "gaps", the AI sweeps with this checklist and records each distinct finding as its own gap with `board ai gap`, one sentence each, naming what is missing and not the fix:

- **Missing pieces:** an input nothing produces, an output nothing uses, an empty step.
- **Edge cases:** empty, maximum and duplicate input; concurrent use; retries and idempotence; partial failure; timeouts; permission and ownership; time and ordering.
- **Architecture, across boxes:** state shared by two boxes with no owner; an external dependency nobody owns; a failure path with no box; steps whose order matters but is not stated; data that changes shape between boxes.
- **Assumptions:** a step that assumes something no other step guarantees.

It reports what it found grouped by kind, and when it finds nothing says exactly: "I found no gaps in this." It does not praise the plan.

**Code.** `board ai gap` gets an optional `--kind edge-case|architecture|assumption|order|other` (optional; a gap without one shows none), stored on the gap and shown on the page as a small label. The existing lint that rejects fix-sounding text stays. Old gaps have no kind and show none.

## 5. When is a breakdown enough? (criteria)

These are what `board check` reports and what the skill tells the AI to weigh. They are signals and observations, never verdicts.

**A leaf** (a piece of work to build):
1. One purpose, sayable in a sentence without "and".
2. Input, output and check are stated (already enforced on approve).
3. Checkable alone: someone who sees only the input, output and check could write the test.
4. Reviewable in one sitting: a guide of about 15 minutes to read the result.
5. Understandable: a newcomer can explain it back in two sentences from title and description.
6. No hidden shared state with a sibling; if two leaves cannot be checked without each other they are one leaf.
7. Stop splitting when the pieces could not be checked on their own.

**A flow or architecture box** (no code, itself a problem):
1. Boundary: input, output, what it owns and what it depends on fit in a few lines.
2. No orphans: every input has a producer and every output a consumer or is the project output.
3. Failure has an owner: its error, empty and limit cases are covered by it or a named other box, or the user said "not handled" on purpose.
4. Observable check: you could say how you would tell it worked without reading code.
5. Explainable in a minute from its title and contract; "and also" means split.
6. Splittable or a leaf: its children can be named, or it already meets the leaf checks.

**Soft limits:** top level about 3 to 9 boxes; depth about 4.

### `board check [id]` (new, read-only, in `src/signals.mjs`)

Computes the part code can know, as lines of fact:

- for a node: whether input, output and check are set; whether the title joins two things (" and ", " & ", " + "); active children and their states; number of siblings; depth; open gaps by id; whether it is an AI draft not yet approved.
- for the board (no id): top-level count against the soft range; deepest level; leaves with no contract; nodes with open gaps; AI drafts not yet approved.

Each line says `flag` or `ok` and the wording is neutral ("title joins two things", "contract: output not set"). Limits are constants in one place. The command never says ready, approved or complete. The AI may run it (it is on the read-only list the guard allows).

### What the AI does with it

When the user has finished describing a node, or asks whether to split further or whether something is small enough, the AI runs `board check <id>`, adds its own judgement of the criteria that code cannot see (purpose, checkable alone, understandable, failure owner), and states an observation in both directions:

- "By these checks, check password can stay whole: one purpose, input, output and check stated, testable from the contract alone. Splitting further would give pieces you could not test separately. Your call."
- "This one has two purposes, hashing and rate-limiting. By the one-purpose check it could be split. Your call."

Once per node, at the moment the user stops describing it, not after every message. It never uses ready, approved, complete, done or looks good, and the user decides.

## 6. Where it lives

- `src/signals.mjs` (new): `signals(data, id)`, `boardSignals(data)`, limits constants.
- `src/commands.mjs`: `--drafted` on `ai add` and `ai edit`; `--kind` on `ai gap`; `check` in `READING`. `src/guard.mjs`: `check` on the read-only list. `src/rules.mjs`: `kind` validated in `raiseGapChecked`.
- `src/render.mjs`, `src/flow.mjs`, `src/page.js`: provenance line, "AI draft" marker, gap kind label.
- `skills/decompose/SKILL.md`: drafting on request; the gap sweep; pointer to sizing. `skills/sizing/SKILL.md` (new, model-invocable): the criteria and wording above. The session brief gets one line telling the AI to run `board check <id>` and load `brick:sizing` when a node has been described or the user asks about size (the dry runs showed that skills load reliably only when the brief says so).

## 7. Tasks

1. **Signals and `board check`**, with tests: each signal, the board summary, neutral wording, never the forbidden words, guard allows it.
2. **Drafting**, with tests: `--drafted` on add and edit sets `ai-draft` or the edit flag; the request must pass `lintSaid`; the node starts drafting; approve still refuses to be run by the AI; `board ls` and `show` mark drafts; render and page show provenance and the "AI draft" label.
3. **Gap kinds**, with tests: `--kind` accepted, rejected when unknown, optional, shown on the page; fix-sounding text still rejected.
4. **Skills and brief**: edit `decompose`, write `sizing`, extend the brief, extend `test/skills.test.mjs`.
5. **Dry runs** with a real Claude, `scripts/dry-decomposition.mjs`, results in `docs/dry-run/decomposition.md`:
   a. "break down check password for me" creates drafted children, one level only, none approved, and offers a gap look;
   b. the user types own sub-problems: source stays `ai-scribe`;
   c. the user describes a node but does not ask for a draft: no children are created;
   d. "what is missing in check password?" yields at least three gaps of at least two kinds, one an edge case, none containing a fix;
   e. a two-purpose node: the AI says it could be split, as an observation;
   f. a well-formed leaf: the AI says it can stay whole by these checks, without "ready" or "done";
   g. "draft the flow from what I described" at the top level.
6. **README**: how to ask the AI to draft, what "AI draft" means, the gap kinds, `board check`, and the limits below.

## 8. Risks and honest limits

- **Judgement again.** "Enough" is partly the model's reading; `board check` makes the mechanical half checkable, not the rest. Expect the same 2-in-3 reliability on subtle calls as in the discussion dry runs, and say so in the README.
- **Drafts can be mistaken for decisions.** The label and the approve gate are the mitigation; nothing stops a user approving without reading.
- **The AI critiques its own draft.** Documented weakness, section 3.
- **Gap sweeps can flood.** A long checklist could produce many weak gaps. The skill tells the AI to record only findings that apply to this node, and the user can dismiss any.
- **Heuristics.** The " and " title signal has false positives ("Sign in and out" is one purpose to some); it is a flag, not a refusal.

## 9. Not in this design

A hard gate on approve; a separate reviewer role; per-field provenance; project-level gaps that belong to no node; counting lines of code. Per-role models and the build pipeline are unchanged.
