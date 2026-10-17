# brick: final-product roadmap

Status: draft for review. This is a map, not a design. Each subsystem below gets its own brainstorm, spec and plan. It exists so the core build leaves room for what comes later.

Naming (decided): plugin `brick`, slash commands `/brick:<action>`, AI command `board`, data folder `.board/`. The earlier overview used `brick` for the command and `.brick/`; that is superseded.

## 1. The product in one paragraph

A Claude Code plugin where the human is the architect and the AI is the inspector. The human breaks a problem into a flow of boxes and then into problems down to small leaves, each with a contract (input, output, check, limits). Leaves can have several approaches. A blind test writer, an implementer and a reviewer build and check each leaf. The state lives in `.board/tree.json`, written only by code. A read-only page shows it. Only the human approves; the AI never says "ready"; nothing is deleted.

## 2. Subsystems, in build order

| # | Subsystem | What it adds | Depends on | Status |
|---|---|---|---|---|
| 1 | Core plugin | Flow and tree, gaps, approve/supersede, the page (Flow, Tree, detail), guards, slash commands, `decompose` skill | engine (built) | spec and plan written |
| 2 | Roles and models | Five roles (main, gap-finder, test-writer, implementer, reviewer), per-project model per role, role isolation | 1 | not started |
| 3 | Approaches | Child branches under a leaf (the "how"), dropped ones dimmed with a reason | 1 | not started |
| 4 | Build pipeline | Statuses implementing, in review, done; Kanban view; tickets; one git worktree per leaf; reviewer report; mistake routing | 1, 2, 3 | not started |
| 5 | Flowcharts | Planned flow against the actual flow generated from the code, per leaf | 3, 4 | not started |
| 6 | Other agent clients | The same board used from other AI coding agents (for example Codex, Antigravity): their own instruction file and, where they have hooks, their own guards. Engine, `.board/` and page unchanged | 1+ | parked |

Why this order: roles come before the pipeline because the pipeline runs them; approaches come before the pipeline because an implementer builds one chosen approach; flowcharts need real code to read.

## 3. Roles (subsystem 2, decided so far)

| Role | Job | Default model |
|---|---|---|
| main | conversation and scribe, with the human | Sonnet |
| gap-finder (optional) | reads the tree with fresh context, names gaps | Opus |
| test-writer | writes tests from the contract, blind to the code | Sonnet |
| implementer | builds one leaf from its contract; optional UI profile | Sonnet (Haiku for simple leaves) |
| reviewer | compares code and plan to the contract; never approves | Opus |

- **Config:** a `models` section per project in `.board/config.json`, one entry per role. The user can change any of them. An unset role falls back to the default above.
- **`main` is advisory only:** the plugin cannot switch the session model; the user does that with `/model`.
- **How a model is applied:** the main AI passes the configured model when it starts a subagent. The subagent tool accepts `sonnet`, `opus` or `haiku`, so config values are limited to those unless that changes.
- **Black-box testing:** the test writer sees the contract only, never the implementation. The implementer builds without seeing the tests. Enforcement idea to verify: Claude Code hook payloads carry `agent_id` and `agent_type`, so a guard could refuse a role access to paths it must not read (for example the test writer reading `src/`, the implementer reading the tests folder). Not yet confirmed; needs a spike in subsystem 2.

## 4. Cross-cutting decisions the core must leave room for

1. **Node kinds and statuses are open lists.** Today: kinds `box`, `problem`; statuses `drafting`, `approved`, `superseded`. Later: kind `approach` under a leaf problem and possibly `ticket`; statuses `implementing`, `in_review`, `done` (already reserved by name). Keep the validator's lists in one place so adding one is a small change.
2. **The engine, `.board/` and the page stay client-neutral.** Only hooks, slash commands and the skill are Claude Code specific; another client adds its own wrapper (and may have weaker guards if it lacks hooks).
3. **The page is data-driven.** It renders what `pageData` gives it, with no rules inside, so new views (Kanban) and new detail sections are additive.
4. **The event log stays append-only,** and new actions are just new event names.
5. **Human-only vs AI commands.** Anything that approves or changes status is human-only (slash command). The pipeline moves statuses through code, never through the AI; the reviewer reports and never approves.
6. **Worktrees read the board through the main checkout** (already built) and cannot write it; the Write guard already blocks `.board/`.
7. **Per-role config lives in `.board/config.json`,** the one source; any agent files would be generated from it.
8. **Mistake routing** (where a mistake sends you back): bad flow to the parent box; bad breakdown or contract to the problem; bad approach to the same leaf with a new approach; bad code to a new attempt with the same approach. This implies an "attempt" record per approach, designed in subsystem 4.

None of these require changes to the core plan, except keeping decision 1 in mind when touching `validate` (the core already keeps the lists as constants in `src/store.mjs`).

## 5. Open questions (one per subsystem, to answer in each brainstorm)

- Roles: how exactly is blindness enforced, and does the gap-finder write gaps through `board ai gap` or only report?
- Approaches: can a leaf have several approaches built in parallel, or one at a time?
- Pipeline: what is a ticket, and who creates it? How are worktrees named and cleaned up? What does the Kanban "to do" mean for a leaf?
- Flowcharts: which languages can the "actual" chart be generated for, and how?
- Other clients: which clients have hooks, and what guard strength is possible without them?

## 6. What happens next

1. Review this roadmap.
2. Build subsystem 1 from `docs/superpowers/plans/2026-10-17-brick-plugin.md`.
3. Brainstorm subsystem 2 (roles and models), then 3, 4, 5, each as its own spec and plan.
