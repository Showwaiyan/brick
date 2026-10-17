# brick plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `board` engine into a Claude Code plugin named `brick`, where the human decides through `/brick:*` slash commands and the AI works through `board ai ...`.

**Architecture:** A `UserPromptExpansion` hook runs `board guard prompt`, which maps a typed `/brick:<action>` to an engine call and prints the result. Human-only stub skills (`disable-model-invocation: true`) only tell the AI to report that result. The existing engine, guards and page are kept; per-project setup (settings merge, skill copy) is removed because the plugin carries hooks and skills.

**Tech Stack:** Node.js 20+, ES modules (`.mjs`), `node:test`, no dependencies. Claude Code plugin format.

**Spec:** `docs/superpowers/specs/2026-10-17-brick-plugin-design.md` (engine rules: `docs/superpowers/specs/2026-10-17-brick-mvp-design.md`)

## Global Constraints

- No runtime or test dependencies; Node >= 20; files stay near 250 lines; one short comment above each function.
- Plugin and package name `brick`; slash commands `/brick:<action>`; AI command `board`; data folder `.board/` (all from `TOOL_NAME` in `src/store.mjs`).
- Slash-only (human-only) actions: `init`, `approve`, `reopen`, `supersede`, `restore`, `resolve`, `dismiss`; plus `open`. All eight stubs have `disable-model-invocation: true`.
- Hook scripts never throw or hang; they print a short message and exit 0. The `PreToolUse` guards still use exit code 2 to block.
- Hook commands use `${CLAUDE_PLUGIN_ROOT}`; plugin state is never written under the plugin folder.
- Every hook is silent in a project with no `.board/`.
- Result lines from the slash hook start with `[brick] `.
- Run `npm test` at the end of every task; it must pass with 0 failures and 0 skipped.

## Review Focus

- A quoted reason containing `$(...)`, backticks or `;` is treated as literal text, never run (Task 1).
- `/approve p3` (no prefix), `/other:approve p3` and `/brick:decompose` are ignored silently (Task 3).
- `/brick:approve` with no id prints a usage line and does not crash (Task 1).
- Any `/brick:*` action in a project with no board says to run `/brick:init`; hooks print nothing there (Tasks 1, 3).
- A corrupt `tree.json` gives a readable `[brick]` error and exit code 0, not a stack trace (Task 1).

---

### Task 1: Slash-command runner

**Files:**
- Create: `src/slash.mjs`
- Test: `test/slash.test.mjs`

**Interfaces:**
- Consumes: `execute(dir, argv)` from `src/commands.mjs`; `initProject(cwd, argv)` from `src/init.mjs`; `findProject(cwd)`, `TOOL_NAME`, `DATA_DIR` from `src/store.mjs`.
- Produces: `tokenize(text: string): string[]` (throws `Error` on an unterminated quote); `runSlash(commandName: string, argsText: string, cwd: string): string` (returns `''` for names it does not handle; otherwise one string starting with `[brick] `; never throws).

- [ ] **Step 1: Write the failing tests** in `test/slash.test.mjs`:
  - `tokenize`: `'p3'` -> `['p3']`; `'p3 --why "not needed, sorry"'` -> `['p3','--why','not needed, sorry']`; single quotes work; `'--why ""'` -> `['--why','']`; backslash escapes a quote inside double quotes; newlines and runs of spaces split like spaces; `'--why "oops'` throws `/unterminated/i`.
  - `runSlash('brick:approve', 'b1', cwd)` on a temp board (use `newBoard()` helper; its dir's parent is `cwd`) with a complete box returns `'[brick] approved b1'`; the board's `tree.json` shows `approved`.
  - Each mapping works: `reopen b1 --why "x"`, `supersede b1 --why "x" --by b2`, `restore b1`, `resolve g1 --note "ok"`, `dismiss g1 --why "no"` (result strings start `[brick] `, state changes verified via `load`).
  - `brick:init "My project" --input a` in an empty temp dir creates `.board/tree.json` with name `My project`; result starts `[brick] created`.
  - Refusal: approving a node with an open gap returns a `[brick]` string containing `open gaps`, no throw.
  - Review Focus: `--why "$(touch /tmp/x) ; \`id\`"` is stored verbatim in the event and creates no file; `brick:approve` with `''` returns a string containing `Usage: board approve <id>`; with no `.board/` returns a string containing `/brick:init`; with `tree.json` overwritten by `{ broken` returns a `[brick]` string and does not throw.
  - Ignored: `runSlash('approve', 'p3', cwd)`, `runSlash('other:approve', ...)`, `runSlash('brick:decompose', '', cwd)` and `runSlash('brick:open-ish', ...)` all return `''`.
- [ ] **Step 2: Run** `node --test test/slash.test.mjs` -> FAIL (module not found).
- [ ] **Step 3: Implement `src/slash.mjs`.** A `HUMAN` table maps `brick:<action>` to an engine argv prefix: approve/reopen/supersede/restore -> `[action]`; resolve -> `['gap','resolve']`; dismiss -> `['gap','dismiss']`; open -> `['open']`; init is routed to `initProject`. `tokenize` is a small state machine (quotes `"` and `'`, backslash escape inside double quotes, whitespace separators) with no shell involved. `runSlash` finds the project with `findProject(cwd)`, runs the engine, and wraps both results and caught errors as `[brick] <message>`; the no-board message is `[brick] No .board/ here. Run: /brick:init "<name>"`.
- [ ] **Step 4: Run** `node --test test/slash.test.mjs` -> PASS; then `npm test` -> all pass.
- [ ] **Step 5: Commit** `git add src/slash.mjs test/slash.test.mjs && git commit -m "feat: slash-command runner for human decisions"`

### Task 2: Slim init

**Files:**
- Modify: `src/init.mjs` (remove `HOOKS`, `mergeHooks`, `setupHooks`, `setupSkill`, `checkPath`, `--update`, settings reading; keep name/flags parsing, worktree refusal, exists check, demo, render)
- Modify: `test/init.test.mjs` (delete the settings, hooks, skill, PATH and `--update` tests; keep none that import `mergeHooks`/`HOOKS`)
- Test: `test/init.test.mjs`, `test/commands.test.mjs`

**Interfaces:**
- Consumes: `findProject`, `isLinkedWorktree`, `create`, `emptyData` (`src/store.mjs`).
- Produces: `initProject(cwd: string, argv: string[]): string` (unchanged signature). Creates `.board/` with `tree.json` and `config.json` (`{ "openBrowserOnSessionStart": true }`), appends `.board/` once to the project root's `.gitignore` (create the file if needed, keep existing lines and a trailing newline), seeds the demo with `--demo`, renders, and returns lines `created <dir>` and `.gitignore: added .board/` (or `.gitignore: already has .board/`) and the existing backup note.

- [ ] **Step 1: Rewrite `test/init.test.mjs`** with: `.gitignore` gets `.board/` once and keeps an existing line without trailing newline (`'node_modules'` -> `'node_modules\n.board/\n'`), including after a second init attempt fails; a second init in the same folder errors `already exists`; init refuses in a linked worktree with `Run board init in the main checkout: <path>`; no `.claude/` folder is created; `--update` is now rejected (`/Unknown option/`); `--demo` works.
- [ ] **Step 2: Run** `node --test test/init.test.mjs` -> FAIL (still writes `.claude/`, accepts `--update`).
- [ ] **Step 3: Slim `src/init.mjs`** as described above; remove the `fileURLToPath`/`execFileSync` imports it no longer needs.
- [ ] **Step 4: Run** `npm test` -> PASS.
- [ ] **Step 5: Commit** `git commit -am "refactor: init only creates .board and .gitignore line"`

### Task 3: Prompt guard and updated guard messages

**Files:**
- Modify: `src/guard.mjs` (`runGuard` gains `'prompt'`; `checkBash` messages updated)
- Test: `test/guard.test.mjs`

**Interfaces:**
- Consumes: `runSlash(commandName, argsText, cwd): string` (Task 1).
- Produces: `board guard prompt` (stdin = a `UserPromptExpansion` payload with `command_name`, `command_args`, `cwd`): prints `runSlash(...)` to stdout, exit 0, prints nothing for unhandled names, malformed JSON, or missing fields. `runGuard('prompt', stdinText, cwd)` returns `{ code: 0, out, err: '' }`.

- [ ] **Step 1: Add failing tests** to `test/guard.test.mjs`:
  - `guard('prompt', {hook_event_name:'UserPromptExpansion', command_name:'brick:approve', command_args:'b1', cwd})` on a board with a complete box prints `[brick] approved b1`, exit 0.
  - Silent (empty stdout, exit 0): `command_name` `approve`, `other:approve`, `brick:decompose`; payload `not json`; empty payload; project with no board and an unhandled name.
  - A handled name with no board prints a line containing `/brick:init`, exit 0.
  - Updated Bash messages (replace the old `human-only command. Ask the user to run: board approve` assertions): `board approve p1` -> stderr matches `/human-only command\. Ask the user to run: \/brick:approve/`; `board gap dismiss g1` -> `/brick:dismiss`; `board gap resolve g1` -> `/brick:resolve`; `board reopen p1`, `supersede`, `restore`, `init x` -> their `/brick:` forms; `board edit p1 --title x` and `board add box x` and `board project` -> stderr contains `board ai edit` / `board ai add` / `board ai project` and `--user-said`. All still exit 2. The allowed-command list and `.board/` block are unchanged.
- [ ] **Step 2: Run** `node --test test/guard.test.mjs` -> FAIL.
- [ ] **Step 3: Implement.** In `runGuard`, `sub === 'prompt'` -> `{ code: 0, out: runSlash(input.command_name || '', input.command_args || '', input.cwd || cwd), err: '' }`. In `checkBash`, replace the message with a lookup from the blocked first/second word to the slash command (`gap resolve`->`resolve`, `gap dismiss`->`dismiss`, others by their own name) and the `board ai ...` hint for `add`/`edit`/`project`.
- [ ] **Step 4: Run** `npm test` -> PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: board guard prompt and slash-aware guard messages"`

### Task 4: Skills (stubs and decompose)

**Files:**
- Create: `skills/{init,approve,reopen,supersede,restore,resolve,dismiss,open}/SKILL.md`, `skills/decompose/SKILL.md`
- Delete: `templates/SKILL.md` (and the `templates/` folder)
- Test: `test/skills.test.mjs`

**Interfaces:**
- Produces: nine skill folders. Each stub has frontmatter `name: <action>`, a one-line `description` starting `Human-only.`, `argument-hint`, and `disable-model-invocation: true`; the body (identical across stubs) says: the plugin hook already ran this; report the line starting `[brick]` in one or two plain sentences; if there is none, say the hook did not run and stop; run nothing. `decompose` keeps the MVP skill text (copy from `templates/SKILL.md`) with these changes: the "no `.board/`" step says ask the user to run `/brick:init "<name>"`; the human-decision lines name the slash commands (`/brick:approve`, `/brick:reopen`, `/brick:supersede`, `/brick:restore`, `/brick:resolve`, `/brick:dismiss`); the sentence "give the exact command and stop" says "give the exact slash command and stop"; no `disable-model-invocation`.

- [ ] **Step 1: Write `test/skills.test.mjs`:** reads every `skills/*/SKILL.md`, parses the `---` frontmatter (key: value lines), and asserts: folder name equals `name`; the eight stub names are exactly `init approve reopen supersede restore resolve dismiss open` and each has `disable-model-invocation: true` and a body containing `[brick]`; `decompose` has no `disable-model-invocation`, its text contains each of the seven `/brick:` commands and `/brick:init`, contains none of the words `board approve`, `board init`, and its `description` is under 1,000 characters; `templates/` does not exist.
- [ ] **Step 2: Run** `node --test test/skills.test.mjs` -> FAIL.
- [ ] **Step 3: Create the files** per the Interfaces block; `git rm -r templates`.
- [ ] **Step 4: Run** `npm test` -> PASS.
- [ ] **Step 5: Commit** `git add -A skills templates test/skills.test.mjs && git commit -m "feat: plugin skills (human-only stubs and decompose)"`

### Task 5: Plugin manifest, hooks and marketplace

**Files:**
- Create: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`
- Test: `test/plugin.test.mjs`

**Interfaces:**
- Produces: `plugin.json` with `name: "brick"`, `version`, `description`, `author` (`Show Wai Yan`), `repository`, `license`. `marketplace.json` with `name: "brick"`, `owner: { name: "Show Wai Yan" }`, `plugins: [{ name: "brick", source: "./", description }]`. `hooks.json`: `{"hooks": {...}}` with `UserPromptExpansion` -> `board guard prompt`; `PreToolUse` matcher `Bash` -> `board guard bash`, matcher `Write|Edit|MultiEdit|NotebookEdit` -> `board guard write`; `SessionStart` (no matcher) -> `board guard session-start`. Each command is `node "${CLAUDE_PLUGIN_ROOT}/bin/board.mjs" guard <sub>`, `type: "command"`.

- [ ] **Step 1: Write `test/plugin.test.mjs`:** all three JSON files parse; `plugin.json` name is `brick`; `marketplace.json` lists one plugin named `brick` with source `./`; `hooks.json` has exactly those four hook entries, each command contains `${CLAUDE_PLUGIN_ROOT}` and ends with the right `guard <sub>`; running each hook command's script path (`bin/board.mjs`) with the substitution applied works: pipe `{}` into `guard prompt` in a temp dir, expect exit 0 and empty stdout.
- [ ] **Step 2: Run** `node --test test/plugin.test.mjs` -> FAIL.
- [ ] **Step 3: Create the three files.**
- [ ] **Step 4: Run** `npm test` -> PASS; then `claude plugin validate .` -> "Validation passed" (warnings about optional fields are fine).
- [ ] **Step 5: Commit** `git add -A .claude-plugin hooks test/plugin.test.mjs && git commit -m "feat: plugin manifest, hooks and marketplace"`

### Task 6: AI-facing `board` on the plugin PATH

**Files:**
- Create: `bin/board` (executable, `#!/bin/sh`, `exec node "$(dirname "$0")/board.mjs" "$@"`)
- Test: `test/plugin.test.mjs` (add cases)

**Interfaces:**
- Produces: `bin/board`, tracked with the executable bit, so the plugin's `bin/` directory puts a bare `board` command on the model's Bash PATH.

- [ ] **Step 1: Add tests:** `bin/board` exists and is executable (`fs.accessSync(..., X_OK)`); running `bin/board help` exits 0 and prints the AI section; running it through a symlink in a temp folder also works.
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Create it** and `chmod +x bin/board`.
- [ ] **Step 4: Run** `npm test` -> PASS. If the symlink case fails, resolve the script's real path in the shim and keep the test.
- [ ] **Step 5: Commit** `git add bin/board test && git commit -m "feat: bin/board shim for the plugin PATH"`

### Task 7: End-to-end script, README, dry run

**Files:**
- Create: `scripts/e2e-plugin.mjs`
- Modify: `README.md`, `docs/dry-run/notes.md` (append results)

**Interfaces:**
- Produces: `node scripts/e2e-plugin.mjs` (not part of `npm test`; needs the `claude` CLI). In a temp git repo it runs `board init`, then `claude -p "/brick:approve b1" --plugin-dir <repo root>` with `--allowedTools Bash,Skill`, and checks: b1 is `approved` in `tree.json`; then a second prompt asks the model to run the Skill tool for `brick:approve` on `b2` and checks b2 is still `drafting`. Exits 1 with a message on any failed check.

- [ ] **Step 1: Write `scripts/e2e-plugin.mjs`** as described; a temp repo with `.board/config.json` set to `openBrowserOnSessionStart: false` so no browser opens.
- [ ] **Step 2: Run** it: `node scripts/e2e-plugin.mjs` -> prints `OK` for both checks. If the typed command did not act in `-p` mode, stop and report instead of working around it.
- [ ] **Step 3: Rewrite `README.md`** for the plugin: what it is, install (`/plugin marketplace add Showwaiyan/brick`, `/plugin install brick@brick`, `/reload-plugins`), first use (`/brick:init "name"`, `/brick:open`), the slash-command table from the spec, what the AI may run, the chat-confirm status (not built yet), honest limits (guards are not a security boundary; the AI cannot enforce its own wording rules; blunt Bash guard; plugin hooks need a reload; tested with `-p` only until the user tries interactive mode), `.board/` gitignored and not backed up, worktrees, out-of-scope list.
- [ ] **Step 4: Re-run the dry run** (`docs/dry-run/drive.py`, adapted: start with `claude -p --plugin-dir <repo root>` and `/brick:init "User login"`, use `/brick:approve` where the old script said "approve it") and append a short "With the plugin" section to `docs/dry-run/notes.md` comparing it to the first run.
- [ ] **Step 5: Run** `npm test` -> PASS; then commit `git add -A README.md scripts docs && git commit -m "docs: plugin README, e2e script, dry run with plugin"`.

### Manual, by the user (not tasks)

- One interactive session with the plugin installed: type `/brick:approve`, confirm the result appears, confirm hooks load after `/reload-plugins`.
- The `AskUserQuestion` payload check, a separate small follow-up plan if it succeeds (spec section 8).
