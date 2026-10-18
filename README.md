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

Plugin hooks load after a reload or a new session. Needs Node.js 20 or newer on your PATH (the hooks run `node`) and `npm`, which Claude Code uses to install pele with the plugin.

## Use

In your project, in Claude Code, say what you want to build:

```
/brick:init login feature for my app
/brick:open
```

Then talk to Claude about it. The `decompose` skill loads on its own: the AI asks, you answer, and it records your words as boxes and sub-problems, including what goes in and what comes out. Open the page any time with `/brick:open`.

`/brick:init` creates `.board/` (gitignored) and adds the `.gitignore` line.

## Several boards

One project can hold several boards, one for each problem or feature. `/brick:init <what you want to build>` makes a new board each time you run it. Each board is a full board of its own, with its own approvals, gaps and history, and it shares nothing with the others.

- **Keys.** A board's key is 2 to 6 capital letters or digits, made from its name ("Export report" gives `EXPORT`). It is shown when the board is made. Choose your own with `!board init "Export report" --key EXP`. It cannot be changed later.
- **Ids.** `LOGIN-b1` is a box, `LOGIN-p3` a problem under it, `LOGIN-p3.1` a sub-problem of that and `LOGIN-p3.1.2` one level further down. `LOGIN-p3.1.g2` is the second gap on `p3.1`. A number is never reused. Inside the board you are using, `p3.1` is enough. Ids from before this change keep working.
- **Which board.** Typed commands use the board named by a full id, else the active board, else the only board, else they stop and ask which board. They never guess from the topic. Claude does guess from the topic, but only for recording what you said: it says "Using board LOGIN." when it does, asks when two boards fit or none does, and never for approve, supersede, resolve, dismiss, reopen or restore.
- **The active board** is the one you last made, switched to (`!board use LOGIN`) or named in a command that changed something. It is kept in `.board/active`, one per project, not one per chat, so two Claude sessions in the same project share it.
- **The overview.** `/brick:open all` opens `.board/index.html`: one card per board with its counts, each linking to that board's page. Every board page has an "All boards" link.
- **Layout.** Boards live in `.board/boards/<KEY>/`. A `.board/tree.json` from before this change is moved there the first time any command runs, with a key added; nothing else in it changes.

## Talking it over

You can ask Claude to help you think at any point: "any suggestions?", "compare X and Y", "what are the alternatives?", "I'm not sure how to explain this". It gives two or three options with the trade-offs, says what it knows and what it does not, and hands the decision back to you.

If you seem stuck (for example "I don't know" twice about the same thing), Claude asks once whether you want its suggestions. Say no and it leaves that point alone. It never starts suggesting on its own.

A suggestion is not a decision. Nothing from the discussion goes on the board until you say your choice in your own words. If you only reply "option 2" or "yes", Claude asks you to say it in a sentence, and the board refuses a quote that only points at what Claude said. Claude may also open the page for you after recording something, and tells you when it does.

## Drafting, gaps and "is it enough?"

**Writing the breakdown for you.** The AI drafts only when you ask, in your own words: "break down check password for me", "draft the flow", "write the contract for it". It drafts one level under that one node and says so. Drafted nodes are marked **AI draft** on the page (and in `board ls`) and stay drafting until you approve them; the page's "Who wrote it" shows your request. It does not go deeper unless you ask again, and it offers once to look for gaps in its draft. It is a weak critic of its own work, so read drafts yourself. If you type your own sub-problems, they are recorded as yours.

**Gaps, edge cases and more.** When you ask what is missing, the AI sweeps for missing pieces, edge cases (empty, duplicate and maximum input, concurrency, retries, partial failure, timeouts, permissions, ordering), architecture gaps across boxes (shared state with no owner, an unowned dependency, a failure path with no box), assumptions, and order. Each finding is its own gap with a kind, shown on the page. A gap still only says what is missing.

**Knowing when a breakdown is enough.** When you finish describing a node, or ask whether to split further, the AI runs `board check <id>` and tells you what the checks show: "by these checks it can stay whole" or "it has two purposes, so it could be split". Your call. The checks: one purpose; input, output and check stated; testable from the contract alone; reviewable in about 15 minutes; understandable by a newcomer; no hidden shared state with a sibling; and, for flow boxes, a clear boundary, no orphan inputs or outputs, an owner for failure cases, and an observable check. Soft limits: about 3 to 9 boxes at the top, about 4 levels deep. `board check` with no id summarises the whole board.

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

- `board ai add|edit|project` to record what you said, each with `--user-said "<your words>"`. With `--drafted` (only when you asked it to write the breakdown for you) the node is marked as an AI draft.
- `board ai gap <id> --missing ".." [--kind edge-case|architecture|assumption|order|other]` to name what is missing. The AI cannot raise a gap on a node until you have written something for it, and a gap that sounds like a fix is rejected.
- `board ls`, `show`, `log`, `brief`, `check`, `render`, `open`, `help` to look.

It cannot approve, reopen, supersede, restore, resolve or dismiss, and it cannot read or write `.board/` directly.

## The page

Each board has one page, `.board/boards/<KEY>/tree.html`. It works from `file://`, offline, with no network requests. **Flow** shows input, boxes in order and output, with dropped boxes in a group of their own. **Tree** shows every node from the project down. Both are drawn on a surface you can pan and zoom: drag to move, scroll or pinch to zoom, `+` `-` `Fit` buttons, arrow keys when focused. Click a box to open its page: its planned flow of sub-steps, who wrote it, description, contract, gaps and history. Each box shows a bold title and, under it, tags: the id (`LOGIN-p3`), the state, `AI draft` while an AI draft is not yet approved, and counts of sub-steps and open gaps. The root of the tree and the page heading show a short title (`board ai project --title "..."`, up to 40 characters, which Claude sets after init); your full sentence stays on the page as "You said: ...". The page never acts, and it refreshes only when you reload it.

The diagrams are drawn by [pele](https://github.com/obsidianmd/pele) when the board is saved, not in the page. Claude Code installs pele with the plugin (it is listed in `package.json`). If it is missing, the page falls back to a plain list; run `npm install` in the plugin folder.

## Code seen

Claude drafts from your words, so a draft can miss what the repo already has. To make the basis visible, Claude records what it read: `board ai seen --path src/db/users.js --note "users table exists"`, at the project level right after `/brick:init` and on a node while drafting it. Each note keeps its path and a hash of the file. The page and `board show` mark every note `ok`, `changed` (the file differs from when it was seen) or `gone` (the path no longer exists), computed when you look. A gap can point at the note that raised it (`--seen`). If a drafted step is added to a board with no notes, Claude gets one reminder line to read the repo. The notes show what a draft was based on; they do not prove Claude read the file or understood it, and a stale or wrong note is corrected with a new one, never deleted.

## Honest limits

- **The guards are not a security boundary.** They stop accidents and drift. A determined model could obfuscate a command. They do not apply to what you type yourself, which is intended.
- **A hook that cannot run does not block anything.** If `node` is missing, the hooks fail without stopping the AI.
- **The Bash guard is a speed bump, not a lock.** It blocks `board approve|reopen|supersede|restore|init|add|edit|project|gap` and any bare `.board` path, and only in a project that has a board (with none, only `board init` is blocked). Words that are not subcommands, such as "the board is red" in a commit message, pass. It can be fooled by obfuscation: a quoted command name, a variable (`B=board; $B approve`), a pipe into `xargs`, or `cd .board`-style tricks that avoid the path word. Symlinks into `.board/` are caught by the write guard only.
- **"Enough" is partly judgement.** `board check` computes what code can (contract set, title joining two things, siblings, depth, open gaps, AI drafts not approved). Whether a node has one purpose or can be tested alone is the model's reading, with the same imperfect reliability as the rest of the AI's judgement.
- **Choosing the board is partly judgement.** Claude matches your topic to a board by its own reading (it can see all boards with `board ls --all`), and says which board it used so you can catch a wrong guess. In the dry runs it asked when it should about two times in three. With several boards its writes must name the board (`--board KEY`), so it cannot use the active pointer by accident, but code cannot tell whether it named the right one. The active board is per project, not per chat.
- **The gap lint is a heuristic.** It catches obvious slips such as "you should add...".
- **"The AI never says ready, approved, complete or looks good" lives in the skill text only.** Code cannot enforce wording. Read what the AI says. The same goes for discussion mode: deciding that you seem stuck, marking suggestions as suggestions, and not steering you are the model's judgement, not code. The check that rejects a pointer quote ("option 2", "yes") is a heuristic and misses unusual phrasings.
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
npm install                      # once, so the diagrams draw (pele)
claude --plugin-dir .            # try the plugin from a checkout
```

Design: `docs/superpowers/specs/`. Plans: `docs/superpowers/plans/`.
