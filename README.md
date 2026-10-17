# brick (command: `board`)

A small tool that keeps the breakdown of a project in a file **you** own, shows it as a static page, and keeps the AI in the role of **critic and scribe**.

When you build something with AI, the chat is linear text and the AI tends to decide everything. Here the human decides how the problem is broken down. The AI asks questions, **names what is missing (never how to fix it)**, and records what you decided, in your words. Nothing is ever deleted: a dropped node is marked superseded, with a reason, and stays on the page dimmed.

The package is called `brick`. The command is `board`. The data folder is `.board/`. No dependencies, Node.js 20 or newer.

## Install

```bash
cd /path/to/brick
npm link          # puts `board` on your PATH
board help
```

`board` must be on your PATH. The hooks call it by name; if it is not found, they silently do nothing and the guards are off. `board init` checks and warns.

## Use in a project

```bash
cd your-project            # a git repo is best; the main checkout, not a linked worktree
board init "User login" --input "username + password" --output "logged in"
board open                 # opens .board/tree.html
```

Try the demo first with `board init "User login" --demo`.

`board init` does four things, each safe to repeat:

1. Creates `.board/` (`tree.json`, `config.json`, `tree.html`).
2. Adds `.board/` to `.gitignore`.
3. Merges three hook entries into `.claude/settings.json` (`board guard bash`, `board guard write`, `board guard session-start`). Existing settings and hooks are never removed or reordered. If the file is not valid JSON, init stops and changes nothing.
4. Copies the `decompose` skill to `.claude/skills/decompose/SKILL.md` (kept if you changed it; `board init --update` replaces it and re-merges the hooks, and never touches `tree.json`).

In an interactive Claude Code session, project hooks run only after you accept the workspace-trust dialog for the folder.

## Commands

**Human commands** (the AI is blocked from these). In Claude Code, run them with the `!` prefix, for example `!board approve p3`, or use a separate terminal.

| Command | Does |
|---|---|
| `board init "<name>" [--input ..] [--output ..] [--demo]` | create the board and set up the project |
| `board init --update` | re-merge hooks, replace the skill |
| `board add box\|problem "<title>" [--parent <id>] [--after <id>] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]` | add a node |
| `board edit <id> [--title ..] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]` | edit a drafting node |
| `board project [--name ..] [--input ..] [--output ..]` | edit the project |
| `board approve <id>` | approve (see rules below) |
| `board reopen <id> --why ".."` | approved back to drafting |
| `board supersede <id> --why ".." [--by <id>]` | drop a node and everything below it |
| `board restore <id>` | undo a direct supersede |
| `board gap resolve <gapId> --note ".."` | you handled the gap |
| `board gap dismiss <gapId> --why ".."` | the gap is not real |

**AI commands** (the only writes the AI may run; each needs your own words in `--user-said`):

| Command | Does |
|---|---|
| `board ai add box\|problem --title ".." --user-said ".." [...]` | record a node you described |
| `board ai edit <id> --user-said ".." [...]` | edit a drafting node |
| `board ai project --user-said ".." [--input ..] [--output ..]` | set the overall input/output |
| `board ai gap <nodeId> --missing ".." [--where ".."]` | name something missing |

**Read-only** (anyone): `board ls`, `board show <id>`, `board log [--last N]`, `board brief`, `board render`, `board open [--quiet]`, `board help`.

## Rules the code enforces

- Only you approve, reopen, supersede, restore, resolve or dismiss. The `ai` namespace has none of these.
- **approve** needs: the node is drafting, has a title, has no open gaps, all active children are approved, and a leaf problem has `input`, `output` and `check`.
- **supersede** needs `--why`, marks all descendants too, dismisses their open gaps, and reopens an approved parent. It prints: `Nothing built from these has been undone. This command only changes the record.`
- **restore** only works for a node you superseded directly, and brings nodes back as drafting, never approved.
- The AI cannot raise a gap on a node until you have written something for it (the ask-first gate).
- A gap states what is missing, not how to fill it (see the lint below).
- The page is read-only and is rebuilt after every change. Data is saved first; if rendering fails you get a warning and your data is safe.

## The page

`.board/tree.html` is one file. It works from `file://`, offline, with no network requests. **Flow** shows input, boxes in order and output, with dropped boxes in a separate row. **Tree** shows the full outline. Selecting a node opens its details and the exact commands you can run next. The page never acts; you decide in the terminal. The view is kept in the URL hash, and the page refreshes only when you reload it.

## Honest limits

- **The guards are not a security boundary.** They stop accidents and drift. A determined model could obfuscate a command. They do not run for commands you type yourself, which is intended.
- **If `board` is not on the PATH the hooks silently do nothing.** A hook whose command is not found does not block anything.
- **The Bash guard is blunt.** It looks for `board <word>` anywhere in a command, so a shell command that merely contains that text (for example a commit message "update the board view") is blocked too. It also blocks any command that mentions `.board/`.
- **The gap lint is a heuristic.** It catches obvious slips such as "you should add...", not every way of smuggling in a fix.
- **Rule "the AI never says ready, approved, complete or looks good" is not enforced by code.** It lives in the skill text only. Read what the AI says.
- **`.board/` is gitignored and is not backed up by git.** Its event log is the only history. Back it up if you care about it.
- `MultiEdit` is a legacy tool; the write guard covers it and `NotebookEdit` by name, but those two were not exercised in a real session.

## Git worktrees

All worktrees of a repo share the main checkout's `.board/`. A `.board/` found inside a linked worktree is ignored with a warning, and `board init` refuses to run in a linked worktree.

## Not built (on purpose)

Kanban view, approaches, per-leaf flowcharts, tickets, agent roles (test writer, implementer, reviewer, gap-finder, UI profile), per-role model configuration, git worktree automation, parallel agents, token logging, stale flags, input/output mismatch checks, hardware nodes, a local web server, buttons on the page that act, auto-refresh, any framework, Docker, a plugin or marketplace package. See `docs/superpowers/specs/2026-10-17-brick-mvp-design.md` for the design and the planned direction.

## Tests

```bash
npm test
```
