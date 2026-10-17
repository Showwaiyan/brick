# brick as a Claude Code plugin (design)

Status: approved in conversation, awaiting written-spec review. Builds on `2026-10-17-brick-mvp-design.md` (the engine). Nothing here is implemented yet.

## 1. Purpose

Humans will not type CLI commands to use this. The tool becomes a Claude Code plugin (like superpowers): the human works in chat and with slash commands, the AI works through a small fixed command set, and the rules from the MVP still hold:

- The human decides how the problem is broken down. The AI is critic and scribe.
- The AI names what is missing, never how to fill it, and records only what the human said.
- Nothing is deleted; dropped nodes are superseded with a reason.

Names: plugin and package `brick`; slash commands `/brick:<action>`; the AI-facing command `board`; data folder `.board/`. (`board` stays the everyday word for the thing being managed.)

## 2. Decisions made

| Question | Decision |
|---|---|
| How do humans decide (approve, supersede, ...) without a CLI? | Both: slash commands (strict) and, for light actions, confirmation in chat. |
| Which decisions are slash-only? | `init`, `approve`, `reopen`, `supersede`, `restore`. |
| Which may also be confirmed in chat? | `gap resolve`, `gap dismiss`. |
| What happens to the existing code? | Kept as the engine. Humans never type `board ...`; the AI still needs a command interface, so `board ai ...` stays. |
| MCP server? | No. Not needed now. |
| Where does it live? | This repo is restructured into the plugin and is its own marketplace. |
| Human-only mechanism | A `UserPromptExpansion` hook runs the action when the human types the slash command (approach "B"). |

## 3. Spike results (2026-10-17, `claude -p`, throwaway plugin)

1. Typing `/spike:approve p3` fires `UserPromptExpansion` with `expansion_type: slash_command`, `command_name: spike:approve`, `command_args: "p3"`, `command_source: plugin`. Hook stdout reached the model.
2. A skill with `disable-model-invocation: true` cannot be called by the model: the Skill tool refuses it ("cannot be used with Skill tool due to disable-model-invocation") and no `UserPromptExpansion` fires.
3. Shell injection in a skill (`` !`cmd` ``) ran and did not trigger our `PreToolUse` Bash hook. Not used by this design.

Not verified: interactive mode (spike used `-p`), the single-repo plugin-and-marketplace layout, and whether a `PostToolUse` hook on `AskUserQuestion` sees the chosen answer.

## 4. Layout

```
.claude-plugin/plugin.json       name "brick"
.claude-plugin/marketplace.json  this repo as its own marketplace (source "./")
skills/decompose/SKILL.md        AI working rules (model-invocable, auto-loads)
skills/<action>/SKILL.md         human-only stubs: init, approve, reopen, supersede,
                                 restore, resolve, dismiss (disable-model-invocation: true)
skills/open/SKILL.md             /brick:open (anyone may run it)
hooks/hooks.json                 UserPromptExpansion, PreToolUse (Bash, Write), SessionStart
bin/board                        shim; on the model's Bash PATH while the plugin is enabled
src/  test/  docs/               existing engine, tests, docs
```

Hook commands use `${CLAUDE_PLUGIN_ROOT}`. State is never written under the plugin folder (it changes per version); all state stays in the project's `.board/`.

## 5. The human-decision flow

1. The human types `/brick:approve p3`.
2. The `UserPromptExpansion` hook (`board guard prompt`) receives `command_name` and `command_args` as data. It ignores any command that is not `brick:*`.
3. It splits `command_args` with its own tokenizer (double and single quotes, backslash escapes; never a shell), maps the command to the engine action, runs it against the project's `.board/`, and prints the result as plain text.
4. The stub skill body tells the AI to report the hook's result in one or two lines and not to run anything.
5. A refused action (open gaps, unapproved child, missing `--why`) prints the engine's reason and exits 0. The hook never blocks a prompt and never crashes a session.

| Slash command | Engine action |
|---|---|
| `/brick:init "<name>" [--input ..] [--output ..] [--demo]` | create `.board/`, `.gitignore` line, config |
| `/brick:approve <id>` | `approve` |
| `/brick:reopen <id> --why ".."` | `reopen` |
| `/brick:supersede <id> --why ".." [--by <id>]` | `supersede` |
| `/brick:restore <id>` | `restore` |
| `/brick:resolve <gapId> --note ".."` | `gap resolve` |
| `/brick:dismiss <gapId> --why ".."` | `gap dismiss` |
| `/brick:open` | render and open the page |

The AI cannot reach this path: its Skill call is refused, and the hook only fires for typed input.

## 6. The AI side

- Keeps `board ai add|edit|project|gap` (with `--user-said`, the ask-first gate and the gap lint) and the read commands `ls`, `show`, `log`, `brief`, `render`, `open`, `help`.
- The Bash guard stays as a second layer: human-only subcommands and any mention of `.board/` are blocked. The Write guard stays.
- The `decompose` skill ships in the plugin and is no longer copied into projects. Its text refers to `/brick:...` commands when a human decision is needed ("ask the user to run `/brick:approve p3`").

## 7. Install and setup

- Install: `/plugin marketplace add Showwaiyan/brick`, then `/plugin install brick@brick`. Update with `/plugin update`. The repo-as-its-own-marketplace layout is described but not shown as an example in the docs; verify with `claude plugin validate` and a real install.
- No per-project wiring. `board init`'s settings merge, skill copy, `--update` and PATH check are removed. `/brick:init` only creates `.board/`, adds it to `.gitignore`, and writes `config.json`.
- SessionStart: a board exists, print the brief and (if configured) open the page. With no `.board/`, print nothing (the plugin is enabled in every project); the `decompose` skill tells the AI to ask the user to run `/brick:init` when it finds no board.
- Plugin hooks run in every project where the plugin is enabled, so every hook must do nothing in a project without a board.

## 8. Chat confirmation for gap decisions (second step)

Shipped after the slash-only path works, and only if the answer is visible to hooks.

- The AI asks with `AskUserQuestion`; the question text must literally name the action, for example "Dismiss g2 as not a real gap?".
- A `PostToolUse` hook on `AskUserQuestion` records a Yes answer as a one-time grant for exactly that action on exactly that gap, expiring after about 10 minutes, stored in `.board/` (which the guards keep the AI from writing).
- The Bash guard lets `board gap resolve|dismiss <id> ...` pass once when a matching fresh grant exists, then deletes the grant. A grant for g2 cannot be used for g5.
- Weaker than a slash command: the AI writes the question text, and the human is the check because they read it before clicking. This is why only these two light actions qualify.
- Gate: before building, the user tries a logging `PostToolUse` hook once in a normal session to confirm the chosen answer is in the payload. If it is not, these two actions stay slash-only (`/brick:resolve`, `/brick:dismiss`) and nothing else changes.

## 9. Errors

- Hook scripts never throw or hang: any failure prints a short message for the AI and exits 0 (the `PreToolUse` guards keep exit code 2 for blocks).
- A slash command with no board (`/brick:approve p3` before init) prints `No .board/ here. Run: /brick:init "<name>"`.
- Any command that is not one of the human-only ones (including the model-facing `/brick:decompose`, other plugins' commands, and a bare `/approve`) is ignored silently. A stub skill whose hook did not run tells the user so and does nothing else.

## 10. Tests

- Unit: the tokenizer (quotes, empty values, escapes); each slash command's result and refusal messages; `brick:*` filtering (other commands ignored); hooks silent in a project with no board.
- Existing tests kept; settings-merge, skill-copy, `--update` and PATH-check tests removed.
- Scripted end to end with `claude -p --plugin-dir <repo>`: a typed `/brick:approve` changes the board; the AI's own attempt to invoke it is refused and the board is unchanged.
- Re-run the dry run in `docs/dry-run/` with the plugin installed and compare.
- Manual, by the user: one interactive session (hooks fire in interactive mode), `/reload-plugins` behaviour, and the `AskUserQuestion` payload check from section 8.

## 11. Out of scope

MCP server, buttons on the page, a local web server, agent roles and parallel agents, git worktree automation, other agent clients, and anything else listed as not built in the MVP spec. Fixing the dry-run slips (wrong-quote check, wrong command named) is separate work, though the new skill text should say "ask the user to run /brick:..." so the wrong-command slip is reduced.
