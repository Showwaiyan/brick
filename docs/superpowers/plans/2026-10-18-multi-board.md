# Multi-board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one repo hold several boards (each a full brick board), with keyed nested ids (`LOGIN-p3.1.g2`), an active-board pointer, board resolution rules for the AI and for typed commands, and an overview page.

**Architecture:** `.board/` becomes a data root holding `boards/<KEY>/tree.json` (+ `tree.html`), `active`, `config.json` and `index.html`. `execute(boardDir, argv)` keeps taking a board folder, so the rules and most tests do not change; a new resolution layer in `run()` and `runSlash()` picks the board folder. Ids are stored short (`p3.1`); the key is added when printed (`fid`) and stripped when read. A legacy `.board/tree.json` is moved into `boards/<KEY>/` on first use.

**Tech Stack:** Node.js 20+, ESM `.mjs`, `node:test`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-18-brick-multi-board-design.md`

## Global Constraints

- Key: 2 to 6 characters, upper-case letters and digits, starting with a letter (`/^[A-Z][A-Z0-9]{1,5}$/`); unique in the repo; never changes.
- Stored ids are short and never rewritten; full id = `KEY-` + stored id. Existing flat ids (`b1`, `p3`, `g2`) stay valid.
- Id grammar: box `b<n>`; problem under a box `p<n>` (flat counter); any deeper node `<parentId>.<n>`; gap on node `X` is `X.g<n>`; legacy flat `g<n>` still valid.
- The number of a new child is one more than the highest existing child suffix (superseded included); a gap number is one more than the highest gap number on that node (open, resolved and dismissed all count). Numbers are never reused.
- Typed `/brick:` commands never guess by topic across boards: a full id, the active board, or the only board; otherwise they stop and ask.
- `--board` goes after the command, never before it (the guard reads the first word after `board`).
- The page stays one offline file per board; the overview page has no script and no network.
- Nothing is deleted. `execute(dir, argv)` signature is unchanged. Tests: `npm test` must stay green at the end of every task.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Args that name two different boards (`LOGIN-p1` and `EXPORT-p2`) must be an error, not a pick of one.
- A title or quote that merely contains text like `LOGIN-p3` must not be rewritten (only a whole token is a full id; result lines are decorated, user text never).
- `.board/active` naming a board that does not exist, or missing with several boards: typed commands stop and ask; nothing is written.
- Legacy migration: run twice, run after a crash between steps, a corrupt `tree.json` (left untouched, reported), a key clash with an existing board.
- Dotted ids in places that assumed `[bp]\d+`: Mermaid node ids, the page URL hash, natural sort (`p3.2` before `p3.10`), the slash-command id matchers, `--by`.

---

### Task 1: Ids, keys and nested numbering

**Files:**
- Create: `src/ids.mjs`, `test/ids.test.mjs`
- Modify: `src/store.mjs` (`emptyData`, `validate`, new `newNodeId`, `newGapId`), `src/commands.mjs` (`addNode`), `src/rules.mjs` (`raiseGap`), `src/model.mjs` (sorts, `nextCommands`), `src/render.mjs` (gap sort), `test/model.test.mjs`, `test/store.test.mjs`, `test/rules.test.mjs`

**Interfaces:**
- Produces in `src/ids.mjs` (pure, no imports):
  `KEY_RE`; `deriveKey(name: string, taken: string[] = []): string`; `fullId(key: string|null, id: string): string`; `parseId(text: string): { key: string|null, short: string } | null`; `compareIds(a: string, b: string): number`; `parentOf(id: string): string|null`; `fid(data, id: string): string` (uses `data.project.key`); `decorateIds(text: string, key: string|null): string`.
- Produces in `src/store.mjs`: `emptyData(name, input, output, now, key = null)` (sets `project.key` when given); `newNodeId(data, kind, parent: string|null): string`; `newGapId(data, nodeId: string): string`.

- [ ] **Step 1: Write the failing tests** in `test/ids.test.mjs` (names and assertions):
  - `deriveKey`: `'Login'`→`LOGIN`; `'Export report'`→`EXPORT`; `'I want to build a login system'`→`LOGIN`; `'Checkout flow v2'`→`CHECKO`; `'42'` and `'x'`→`BOARD`; `('Login',['LOGIN'])`→`LOGIN2`; `('Login',['LOGIN','LOGIN2'])`→`LOGIN3`; `('Checkout',['CHECKO'])`→`CHECK2` (never over 6 characters).
  - `parseId`: `'LOGIN-p3.1'`→`{key:'LOGIN',short:'p3.1'}`; `'login-p3'`→key `LOGIN`; `'p3.1.g2'`→`{key:null,short:'p3.1.g2'}`; `'g2'`, `'b1'` ok; `'hello'`, `'LOGIN-'`, `'p3.'`, `'p3..1'`→`null`.
  - `compareIds` sorts `['p3.10','p3.2','p3','p2','b1','p3.1.g1','p3.1']` to `['b1','p2','p3','p3.1','p3.1.g1','p3.2','p3.10']`.
  - `parentOf`: `'p3.1.2'`→`'p3.1'`; `'p3'`→`null`; `'p3.1.g2'`→`'p3.1'`.
  - `fid`: with and without `project.key`.
  - `decorateIds('added p3.1 under p3','LOGIN')`→`'added LOGIN-p3.1 under LOGIN-p3'`; `'raised p3.g1 on p3.'`→`'raised LOGIN-p3.g1 on LOGIN-p3.'`; `'restored b1, p2 (as drafting)'` decorated; an already keyed `LOGIN-p3` unchanged; `key=null` unchanged.
  In `test/store.test.mjs` add: nested numbering through `execute` on `newBoard()` (box→`b1`; problem under it→`p1`; under `p1`→`p1.1`,`p1.2`; under `p1.1`→`p1.1.1`; after `supersede p1.1` a new child of `p1` is `p1.3`; `--after p1.1` still gives the next number); gaps (`ai gap p1.1` twice→`p1.1.g1`,`p1.1.g2`; after dismissing `p1.1.g1` the next is `p1.1.g3`); `validate` rejects node `p1.1` whose parent is `b1` (`/does not match its parent/`) and gap `p2.g1` on node `p1` (`/does not match its node/`); `sample()` (legacy flat ids) still validates.
- [ ] **Step 2: Run** `node --test test/ids.test.mjs test/store.test.mjs`. Expected: FAIL (module/function not found).
- [ ] **Step 3: Implement `src/ids.mjs`.** Segments are `letters?digits`; `compareIds` compares segment by segment (number first, then letter, a numeric-only segment before a `g` segment, shorter prefix first). `deriveKey`: first word of the name with 3+ letters/digits that is not in a small stoplist (`the and for want build make create new add how what with our my to`), upper-cased, non-alphanumerics removed, cut to 6, leading digits dropped; fall back to the joined alphanumerics, then `BOARD`; on a clash append a number, cutting the base so the total is at most 6.
- [ ] **Step 4: Implement the store and rules changes.** `newNodeId`: box→`nextId(data,'b')`; parent is a box→`nextId(data,'p')`; otherwise `<parent>.<max child suffix + 1>` counted over all children of that parent. `newGapId`: `<node>.g<max + 1>` over all gaps with that `node`. `addNode` and `raiseGap` call them. `validate`: a dotted node id must equal `<parent>.<n>` (`parentOf(id) === n.parent`, else `${key}: id does not match its parent`); the counter check applies to flat ids only; a nested gap id must equal `<g.node>.g<n>` (else `${key}: id does not match its node`), a flat `g<n>` keeps the counter check. Use `compareIds` in `model.openGaps`, `render.pageData` gap sort and `children` ties. `model.nextCommands` prints `fid(data, id)`.
- [ ] **Step 5: Run** `npm test`. Expected: all pass (existing tests untouched except sorts).
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: keyed nested ids (p3.1, p3.1.g2) and key derivation"`.

---

### Task 2: Board layout, active pointer and migration

**Files:**
- Modify: `src/store.mjs` (`findProject`, new `listBoards`, `createBoard`, `activeKey`, `setActive`, `migrateLegacy`; export `acquireLock`)
- Create: `test/boards.test.mjs`

**Interfaces:**
- Produces: `listBoards(dataDir): Array<{ key: string, dir: string }>` (sorted by key; only folders with a `tree.json`); `createBoard(dataDir, data): string` (needs `data.project.key`; throws `/already exists/` for a taken key; returns the board folder); `activeKey(dataDir): string|null` (null when the file is missing or names a board that does not exist); `setActive(dataDir, key): void`; `migrateLegacy(dataDir): string|null` (the key moved, or null when there is nothing to move). `findProject(...).exists` is true when a legacy `tree.json` or any board exists.
- Consumes: `deriveKey`, `KEY_RE` from Task 1; `create`, `load`, `validate`, `acquireLock` (existing).

- [ ] **Step 1: Write the failing tests** in `test/boards.test.mjs`: `createBoard` writes `boards/LOGIN/tree.json`; a second `createBoard` with key `LOGIN` throws `/already exists/`; `listBoards` returns keys sorted; `setActive`/`activeKey` round-trip and `activeKey` is null when `active` names a missing board; `migrateLegacy` on a legacy `.board/tree.json` (+ `tree.html`) moves both to `boards/<KEY>/`, key from the name, the file equal to the old content plus `project.key`, returns the key, and a second call returns null; a legacy file that already has `project.key:'LOGIN'` keeps it even if a board `LOGIN` is already there being the same file after an interrupted run (simulate: key written in the legacy file, nothing moved yet); a legacy `Login` with an existing board `LOGIN` gets `LOGIN2`; a corrupt legacy `tree.json` makes `migrateLegacy` throw `/not valid/` and leaves the file untouched; `config.json` stays at the root; `findProject(...).exists` is true for legacy-only and boards-only, false for a folder with only `config.json`.
- [ ] **Step 2: Run** `node --test test/boards.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** `migrateLegacy` takes the data-folder lock, re-checks the legacy file, validates it, writes `project.key` into the legacy file first (atomic), then renames it to `boards/<KEY>/tree.json` in one rename, then renames `tree.html` if present; idempotent on rerun. `findProject` keeps returning the data folder as `dir`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: boards folder layout, active pointer, legacy migration`.

---

### Task 3: Board resolution in commands, init, typed commands and guard

**Files:**
- Create: `src/boards.mjs`, `test/resolve.test.mjs`
- Modify: `src/commands.mjs` (`run`), `src/init.mjs`, `src/slash.mjs`, `src/refer.mjs`, `src/guard.mjs`, `src/text.mjs` (HELP, `boardsText`, `fid` use in `ls`, `show`, `log`, `nextStep`), `src/signals.mjs` (`fid`), `test/init.test.mjs`, `test/guard.test.mjs`, `test/slash.test.mjs`, `test/refer.test.mjs`, `test/plugin.test.mjs`, `scripts/e2e-plugin.mjs`

**Interfaces:**
- Produces in `src/boards.mjs`: `resolveBoard(dataDir: string, argv: string[]): { key: string, dir: string, argv: string[], explicit: boolean }`: strips `--board K`/`--board=K`; strips `KEY-` from whole tokens (including `--flag=KEY-id`) when `KEY` is a known board; throws if two different boards are named, if `--board` names an unknown board, or if nothing resolves with several boards (message lists the keys and says how to name one). Order: `--board`, a full id, `activeKey`, the only board. `resolveForText(dataDir, text): { key, dir, text, explicit } | { needs: string }` is the same for typed commands (no `--board`), returning NEEDS text instead of throwing.
- Produces CLI: `board boards` (read-only, one line per board: key, name, counts, open gaps, `*` for active); `board use <KEY>`; `board init "<name>" [--key K]`.
- Result lines of mutating commands are passed through `decorateIds(result, key)`; read commands use `fid` inside `text.mjs`/`signals.mjs`.

- [ ] **Step 1: Write the failing tests** in `test/resolve.test.mjs` (spawn `bin/board.mjs` in temp dirs like `init.test.mjs`): one board and no hint resolves silently; two boards, `--board EXPORT ls` shows EXPORT; a full id in `show LOGIN-b1` resolves and prints `LOGIN-b1`; `--board=EXPORT`; unknown `--board` errors listing keys; two boards, no active file, `ls` errors with `/Several boards: EXPORT, LOGIN/` and writes nothing; `active` naming a missing board behaves the same; `show LOGIN-b1 --board EXPORT` errors; a title `"LOGIN-b1 notes"` is stored unchanged; mutating result lines are decorated (`added LOGIN-b1`, `raised LOGIN-p1.g1 on LOGIN-p1`) and `ls`/`show`/`check`/`brief` print full ids while a user quote containing `b1` is not rewritten; a mutating command with an explicit board sets `active`, a read command does not (**Ruling:** the spec says "any command"; reads stay side-effect free); `board --board X ls` (flag before the command) errors `/after the command/`; `board use EXPORT` then `ls` shows EXPORT; `board use NOPE` errors; `board boards` lists both with the active marker; the first init after a legacy `.board/tree.json` migrates it, and then a second init `init "Export report"` creates `EXPORT` and makes it active; `init X --key LOGIN` twice errors `/already exists/`; `init X --key bad key` errors; `init` output names the key; init in a linked worktree still refuses.
  In `test/slash.test.mjs`: with two boards and active `EXPORT`, `/brick:approve p1` acts on `EXPORT-p1` and the reply says `EXPORT-p1`; `LOGIN-p1` acts on LOGIN and makes it active; no active file and two boards→`NEEDS: which board?` and nothing changes; ids `p3.1` and `LOGIN-p3.1.g2` are matched; `by p3.1` in supersede; a title match works inside the resolved board only. In `test/guard.test.mjs`: `board boards` and `board use X` are allowed for the AI; `board --board X approve p1` is still blocked (the second word is `X`... verify and, if it slips, make `run()` reject it as in the test above and note it); session start with two boards and an active one prints the active board's brief plus a boards line; with two boards and none active it prints the boards line and the ask-which-board rule.
- [ ] **Step 2: Run** `node --test test/resolve.test.mjs test/slash.test.mjs test/guard.test.mjs test/init.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** `run()`: `help`→HELP; `init`→`initProject`; find project; migrate legacy; `boards`/`use` handled directly; otherwise `resolveBoard`, then `execute(dir, argv)`; decorate mutating results; set active after a mutating command when the board was explicit. `initProject`: derive or validate the key, refuse a taken key, `createBoard`, write `config.json` only if absent, `setActive`, demo/render as before, gitignore as before. `runSlash`: use `resolveForText`, pass the stripped text to `parseRequest`, decorate the result, `open` opens the active board. `refer.mjs`: node id pattern `[bp]\d+(?:\.\d+)*`, gap id pattern `(?:[bp]\d+(?:\.\d+)*\.)?g\d+`, the `by` pattern likewise; ids in NEEDS lines through `fid`. Guard: `READ_ONLY` gains `boards` and `use` (comment that `use` only moves the pointer); `sessionStart` uses `listBoards`/`activeKey`; `runGuard` unchanged otherwise. `text.mjs` HELP lists `init --key`, `boards`, `use`, `--board`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. Run `node scripts/e2e-plugin.mjs` after editing its path reads (`.board/boards/E2E/tree.json`); Expected: all OK.
- [ ] **Step 5: Commit** `feat: board resolution, init/use/boards, typed commands and guard for several boards`.

---

### Task 4: Overview page and keyed ids on the pages

**Files:**
- Create: `src/overview.mjs`, `test/overview.test.mjs`
- Modify: `src/render.mjs` (`renderHtml(data, now, { overview })`, `renderFile`, `renderQuiet`, `pageData` adds `overview`), `src/flow.mjs` (`mid`, keyed labels), `src/page.js` (`fid`, back link, id map), `src/commands.mjs` (`open --all`), `test/render.test.mjs`, `test/flow.test.mjs`

**Interfaces:**
- Produces: `renderOverview(dataDir): string` (writes `index.html` by temp file + rename, returns its path); `overviewHtml(boards)` pure; `renderQuiet(boardDir)` also refreshes the overview when the board folder is `<data>/boards/<KEY>`. `open` with no `--all` opens the active board; `open --all` opens `index.html`; with several boards and no active board `open` opens the overview.
- Produces in `flow.mjs`: Mermaid node ids use `mid(id) = id.replace(/\./g, '_')`; labels show `fid`. `page.js` maps a clicked `data-id` back with `DATA.nodes[id] ? id : id.replace(/_/g, '.')`.

- [ ] **Step 1: Write the failing tests.** Overview: one card per board with key, name, state counts and open gaps; links `boards/KEY/tree.html`; the active board marked; names with `<` escaped; no `<script`, no `http` outside the xmlns; empty set shows a message. Board page data: `pageData` carries `project.key` and `overview` (`../../index.html` only when under `boards/`); page text includes `All boards`. Flow: nested ids give Mermaid ids without dots (`p3_1`) and edges use them; labels carry `LOGIN-p3.1` when a key is set and plain ids when not (existing tests stay valid); a click target `p3_1` resolves to `p3.1` (test the pure mapping function in `canvas.js`/`page.js` the way `canvas.test.mjs` loads it).
- [ ] **Step 2: Run** `node --test test/overview.test.mjs test/render.test.mjs test/flow.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** as above; overview is a static HTML string with the board page's CSS variables inlined; the page header shows the key and the back link.
- [ ] **Step 4: Run** `npm test`, then open a two-board temp project in the browser pane and check both pages and a nested node click (screenshot). Expected: tests pass; click opens the node page.
- [ ] **Step 5: Commit** `feat: overview page, keyed ids and back link on the board page`.

---

### Task 5: Brief, skills, README

**Files:**
- Modify: `src/text.mjs` (`brief`), `skills/decompose/SKILL.md`, `skills/init/SKILL.md`, `skills/open/SKILL.md`, `README.md`, `test/skills.test.mjs`, `test/guard.test.mjs`, `.claude-plugin/plugin.json` (version 0.4.0)

**Interfaces:** `brief(data, ctx = { boards: [{ key, name }], active: string|null })`; with one board the output is the current brief plus the key in the Project line; with several boards a `Boards:` line and one rule line are added. `briefNoActive(ctx)` when several boards and none is active.

- [ ] **Step 1: Write the failing tests:** the brief with two boards contains `Boards: EXPORT (active), LOGIN` and the rule line (named board wins; the chat's board stays active; topic match only for the AI's own recording and says "Using board KEY."; never for approve, supersede, resolve, dismiss, reopen, restore; otherwise ask); with one board there is no `Boards:` line; skills tests: `decompose` mentions `--board`, `board use` and full ids; the `init` skill asks for what to solve and says the key is shown after init; every stub still has `disable-model-invocation: true`.
- [ ] **Step 2: Run** `node --test test/skills.test.mjs test/guard.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the brief, skill text and README section ("Several boards": layout, keys, ids and nesting, active board per repo not per chat, overview page, resolution rules, the migration note, the limits in spec section 10).
- [ ] **Step 4: Run** `npm test` and `claude plugin validate .`. Expected: pass.
- [ ] **Step 5: Commit** `feat: brief, skills and README for several boards`.

---

### Task 6: Dry runs with a real Claude

**Files:**
- Create: `scripts/dry-multiboard.mjs`, `docs/dry-run/multiboard.md`, `docs/dry-run/multiboard-notes.md`
- Modify: `src/text.mjs` brief and `skills/*` only as the findings require

- [ ] **Step 1: Write `scripts/dry-multiboard.mjs`** from `scripts/dry-decomposition.mjs` (same harness): scenarios (a) one board, short ids, the AI says nothing about boards; (b) two boards, "add a step to login: check the password hash" records under LOGIN and the reply says `Using board LOGIN.`; (c) two boards, "add a step: send the email" with no clue, the AI asks which board and records nothing; (d) a topic that matches two boards, the AI asks; (e) `/brick:approve p1` typed with two boards and no active file, nothing changes; (f) after the chat creates a second board with `board init`, a plain "add a step to read the file" lands on the new board.
- [ ] **Step 2: Run** `node scripts/dry-multiboard.mjs` (several minutes, in the background), read `docs/dry-run/multiboard.md`.
- [ ] **Step 3: Fix** brief or skill wording for failed checks (at most two rounds), rerun the failed scenarios by letter, record every finding and the final pass count in `multiboard-notes.md`, keeping flaky model behaviour honest in the README limits.
- [ ] **Step 4: Run** `npm test`, `node scripts/e2e-plugin.mjs`, `claude plugin validate .`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: multi-board dry runs, brief and skill fixes`.
