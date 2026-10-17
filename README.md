# brick

A Claude Code plugin. You break a problem down yourself; the AI acts as **critic and scribe**. The breakdown lives in a file you own, a read-only page shows it, and hooks keep every decision with you.

When you build with AI, the chat is linear text and the AI tends to decide everything. Here you decide how the problem is split. The AI asks questions, **names what is missing (never how to fix it)**, and records what you decided, in your words. Nothing is deleted: a dropped node is marked superseded, with a reason, and stays on the page, dimmed.

Names: the plugin is `brick`, your commands are `/brick:<action>`, the AI's own command is `board`, and the data lives in `.board/`.

## Install

In Claude Code:

```
/plugin marketplace add Showwaiyan/brick
/plugin install brick@brick
/reload-plugins
```

Plugin hooks load after a reload or a new session. Needs Node.js 20 or newer on your PATH (the hooks run `node`).

## Use

In your project, in Claude Code, say what you want to build:

```
/brick:init login feature for my app
/brick:open
```

Then talk to Claude about it. The `decompose` skill loads on its own: the AI asks, you answer, and it records your words as boxes and sub-problems, including what goes in and what comes out. Open the page any time with `/brick:open`.

`/brick:init` creates `.board/` (gitignored) and adds the `.gitignore` line.

## Your commands

You write them in plain words: no flags, no quotes. They only work when **you** type them; the AI cannot trigger them. A node is named by its **title or its id** (`b3`, `p2`); a gap by its id (`g1`) or by the title of a node that has one open gap. Ids are needed when two nodes share a title.

| You type | Does |
|---|---|
| `/brick:init <what you want to build>` | create the board, named in your words |
| `/brick:approve check password` | approve a node (or `/brick:approve b3`) |
| `/brick:reopen b3 I changed my mind about the order` | approved back to drafting, with your reason |
| `/brick:supersede sign in with google the client only needs a password` | drop a node and everything below it, with your reason |
| `/brick:supersede b5 replaced by b2, dropped OAuth` | same, naming the replacement |
| `/brick:restore b5` | undo a direct supersede |
| `/brick:resolve g1 handled in the hash step` | a gap is handled |
| `/brick:dismiss g1 covered by the username decision` | a gap is not real |
| `/brick:open` | rebuild the page and open it |

If you leave something out (which node, or your reason), nothing changes: the reply says what is missing and gives the full command to send, and Claude asks you for it. Claude cannot send it for you.

Rules: a node can be approved only when it is drafting, has a title, has no open gaps, all its active children are approved, and (for a leaf problem) it has an input, an output and a check. Superseding needs a reason, marks everything below too, and prints that nothing built from it has been undone.

## What the AI can do

Through its own `board` command (put on its PATH by the plugin), the AI may:

- `board ai add|edit|project` to record what you said, each with `--user-said "<your words>"`.
- `board ai gap <id> --missing ".."` to name what is missing. The AI cannot raise a gap on a node until you have written something for it, and a gap that sounds like a fix is rejected.
- `board ls`, `show`, `log`, `brief`, `render`, `open`, `help` to look.

It cannot approve, reopen, supersede, restore, resolve or dismiss, and it cannot read or write `.board/` directly.

## The page

`.board/tree.html` is one file. It works from `file://`, offline, with no network requests. **Flow** shows input, boxes in order and output, with dropped boxes in a separate row. **Tree** shows the full outline. Select a node for its details and the exact commands you can run next. The page never acts, and it refreshes only when you reload it.

## Honest limits

- **The guards are not a security boundary.** They stop accidents and drift. A determined model could obfuscate a command. They do not apply to what you type yourself, which is intended.
- **A hook that cannot run does not block anything.** If `node` is missing, the hooks fail without stopping the AI.
- **The Bash guard is a speed bump, not a lock.** It blocks `board approve|reopen|supersede|restore|init|add|edit|project|gap` and any bare `.board` path, and only in a project that has a board (with none, only `board init` is blocked). Words that are not subcommands, such as "the board is red" in a commit message, pass. It can be fooled by obfuscation: a quoted command name, a variable (`B=board; $B approve`), a pipe into `xargs`, or `cd .board`-style tricks that avoid the path word. Symlinks into `.board/` are caught by the write guard only.
- **The gap lint is a heuristic.** It catches obvious slips such as "you should add...".
- **"The AI never says ready, approved, complete or looks good" lives in the skill text only.** Code cannot enforce wording. Read what the AI says.
- **Tested headless (`claude -p`) with a scripted check (`node scripts/e2e-plugin.mjs`),** not yet in an interactive session. `MultiEdit` and `NotebookEdit` are covered by name in the write guard (unit-tested) but were not exercised in a real session.
- **`.board/` is gitignored and not backed up by git.** Its event log is the only history. Back it up if you care about it.

## Git worktrees

All worktrees of a repo share the main checkout's `.board/`. A `.board/` found inside a linked worktree is ignored with a warning, and `/brick:init` refuses to run in a linked worktree.

## Not built yet

Chat confirmation for resolving and dismissing gaps, approaches, the build pipeline (test writer, implementer, reviewer, Kanban, tickets, worktree automation), planned-against-actual flowcharts, per-role model settings, and other agent clients. See `docs/superpowers/specs/2026-10-17-brick-roadmap.md`.

## Develop

```bash
npm test                         # unit and integration tests, no dependencies
node scripts/e2e-plugin.mjs      # end to end with a real Claude Code (needs the claude CLI)
claude --plugin-dir .            # try the plugin from a checkout
```

Design: `docs/superpowers/specs/`. Plans: `docs/superpowers/plans/`.
