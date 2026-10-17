# M1 data flow (how the pieces fit)

Files: `src/store.mjs` (disk), `src/model.mjs` (derived values). No CLI yet.

## 1. Which project am I in? `findProject(cwd)`
- In a git repo: `git rev-parse --git-common-dir` -> its parent folder is the
  MAIN checkout. Data lives in `<main checkout>/.board/`. Every worktree of the
  repo therefore reads and writes the same folder.
- If cwd is a linked worktree that has its own `.board/`, that copy is ignored
  and one warning is returned.
- Not a git repo (or no git): walk up from cwd until a `.board/` is found.
- Returns `{ root, dir, exists, warnings }`. `exists` means `tree.json` is there.
- `isLinkedWorktree(cwd)` compares `--git-dir` with `--git-common-dir`
  (`board init` will use it to refuse, in M2).

## 2. The data: `.board/tree.json`
`{ version, project, counters, nodes, gaps, events }`.
- `nodes`: boxes (`b1`) and problems (`p1`); problems point at a `parent`.
- `gaps`: what is missing on a node (`g1`).
- `events`: append-only log, `seq` = 1, 2, 3 ...
- `counters` only go up, so an id is never reused, even after a supersede.
- Status is stored (`drafting|approved|superseded`). Everything else
  (children, leaf, open gaps, display state, next commands) is computed.

## 3. Reading: `load(dir)`
Read JSON, run `validate()` on the whole file, return the data or throw.
`validate` checks: ids, parents, cycles, box-has-no-parent, sibling `order`
unique, gaps point at real nodes, event `seq`, status vs `superseded` agree,
counters not behind any existing id.

## 4. Writing: `mutate(dir, fn)` (and `create` for init)
1. Take `.board/.lock` (exclusive create; 5 tries over ~1s; a lock older
   than 10s is stale and taken over).
2. `load` fresh data, run `fn(data)` (this is where a command changes things
   and calls `addEvent`).
3. `validate` the result. If invalid: throw, nothing is written.
4. Write `tree.json.<pid>.tmp`, fsync, rename over `tree.json`.
5. Always release the lock.
Later milestones add: render `tree.html` AFTER the save; a render failure
only warns.

## 5. Derived values: `model.mjs`
`children`, `activeChildren`, `isLeaf`, `openGaps`, `displayState`
(superseded > has_gaps > approved > drafting), `nextCommands` (exact commands
for the human; the page will just display these).

## 6. Name
`TOOL_NAME` in `store.mjs` is the only place "board" is spelled. The data
folder is `.${TOOL_NAME}` and `nextCommands` reads the same constant.
