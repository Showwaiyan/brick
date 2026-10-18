# brick: several boards in one repo

Status: draft for review. Branch `feat/multi-board`. Builds on the plugin, discussion-mode and decomposition designs.

## 1. Why

Today `.board/tree.json` holds exactly one project, `/brick:init` refuses a second one, and every command, the page and the session brief assume one board per repo. A repo usually has several problems or features over its life ("login", "export report"), and each needs its own breakdown, approvals and history without being mixed with the others.

## 2. Decisions already made

- **Option C.** Each feature is a full board, the same as today's, and a thin layer above them lists the boards on an overview page. Boards share nothing.
- **Ids carry the board and the nesting.** `KEY-b1` (box), `KEY-p3` (a problem directly under a box, flat number as today), `KEY-p3.1`, `KEY-p3.1.2` (sub-problems: the parent's id, a dot, and a number), `KEY-p3.1.g2` (a gap: the node's id, a dot, `g`, and a number counted per node; on a box `KEY-b1.g1`). The new number is the creation order among siblings, not their position, so `--after` does not change ids.
- **The short form still works** (`p3`) when the board is known: the active board, or the only board.
- **The AI resolves which board** by the rules in section 4. Human-typed commands use a stricter subset.

## 3. Layout and ids

```
.board/
  active                 one line: the key of the active board
  index.html             overview page (built by render/open)
  boards/
    LOGIN/tree.json      a board, exactly today's format plus project.key
    LOGIN/tree.html
    EXPORT/tree.json
    EXPORT/tree.html
```

- **Key.** 2 to 6 characters, upper-case letters and digits, starting with a letter. Derived from the board name at init ("Export report" gives `EXPORT`, "Login" gives `LOGIN`; longer names are cut at 6) and shown back to the user. `board init "<name>" --key <KEY>` overrides it. A key is unique across the repo and never changes, because ids appear in quotes and history. Stored as `project.key`.
- **Nested ids.** `addNode` gives a child of node `X` the id `X.<n>` where `n` is one more than the highest existing child suffix of `X` (counted over all children, superseded included, so a number is never reused). Only problems directly under a box keep the flat `p<n>` counter. A node's parent never changes (there is no move command), so an id stays a true path; if a move command is ever added, a moved node keeps its old id, and the id then says where it was created. `store.validate`'s counter check applies to flat ids only; a dotted id is valid when its parent id exists and is the id with the last segment removed. `ids.mjs` sorts ids by segment numbers, not as text (`p3.2` before `p3.10`).
- **Nested gap ids.** A new gap on node `X` gets `X.g<n>`, `n` one more than the highest gap number on `X` (open, resolved and dismissed all count, so a number is never reused). A child node segment is always a plain number and a gap segment starts with `g`, so the two never clash. Old flat gaps (`g2`) stay valid and still resolve from the data; only new gaps get the nested form. Validation: a nested gap id is valid when its node exists and is the id minus the last segment.
- **Stored ids stay short** (without the key, for example `p3` or `p3.1`). The full id is `KEY-p3`, built on output. Nothing in an existing `tree.json` is rewritten except adding `project.key`. Input accepts either form, key case-insensitive. A full id also names its board, so `LOGIN-p3` needs no other board hint.
- **Legacy layout.** If `.board/tree.json` exists at the root (a board made before this change), the first command that loads it derives a key from `project.name`, writes it into the file, and moves the file and `tree.html` into `boards/<KEY>/` with an atomic rename. Key clashes get a number suffix. A bad `tree.json` is left where it is and reported, as today.

## 4. Which board a message means

The AI, in this order:

1. **Named.** The user names the board or uses a full id: that board.
2. **Created or opened in this chat.** That board is the active one until they name another.
3. **Matches by topic.** No board named, but the feature or problem named matches exactly one board's title, node titles or description: the AI uses it and says so in one line ("Using board LOGIN."). It never does this for `approve`, `supersede`, `resolve`, `dismiss`, `reopen` or `restore`.
4. **Otherwise it asks.** No match, a match in two or more boards, or several boards and no clue.

With one board, that board is implied and the AI says nothing.

**Typed commands (`/brick:...`).** Only the first two rules apply: a full id or `--board`, or the active board (or the only board). Otherwise the command stops and asks the user to name the board. No topic guessing, because ids repeat across boards and these are the user's decisions.

**The active board** is stored in `.board/active`. It is set by `init`, by `board use <KEY>`, and by any command given a board explicitly. It is per repo, not per chat: two Claude sessions on the same repo share it, and the README says so. The AI also states the board it is using, so a wrong assumption shows.

## 5. Commands

- `board init "<name>" [--key K] ...` makes a new board (it no longer refuses when other boards exist; it refuses a duplicate key) and makes it active. `--demo` unchanged.
- `board boards` (read-only): one line per board: key, name, node counts, open gaps, active marker.
- `board use <KEY>`: sets the active board. Allowed for the AI; it changes no board data.
- `--board <KEY>` on every command that works on a board. Everything else is as today.
- Output shows full ids (`LOGIN-p3`). `board ls` and `show` for the active board.
- Guard: `boards` goes on the read-only list, `use` on the AI-allowed list, and both on the known list. The AI-write rules (`--user-said`, no approve) are unchanged.

## 6. Page

- `.board/index.html`: one card per board with key, name, state counts, open gaps, and a link to that board's `tree.html`. Same renderer, same offline rules, no pele code in the page.
- A board page gets a "All boards" link back to the overview and shows its key in the header and full ids on nodes.
- `board open` opens the active board; `board open --all` opens the overview. With more than one board and no active board, it opens the overview.

## 7. Session brief

The brief gains the board list and the active board, and one rule line: resolve the board by the order in section 4, say which board you are using when it was not named, and ask when unsure. With a single board the brief is unchanged apart from the key.

## 8. Where it lives

- `src/store.mjs`: `findProject` returns the data root; new `listBoards`, `boardDir(key)`, `activeKey`, `setActive`, legacy move; load and save take a board dir. `src/ids.mjs` (new): `deriveKey`, `fullId`, `parseId` (returns `{ key?, short }`).
- `src/commands.mjs`: board resolution in one place before any command; `init`, `boards`, `use`, `--board`.
- `src/guard.mjs`, `src/text.mjs` (HELP, brief, ls, show), `src/render.mjs` and `src/page.js` (overview, back link, full ids), `src/flow.mjs` (labels use full ids).
- `skills/*` stubs and `decompose`: examples with full ids; `skills/init` asks for the board name and tells the key. README.

## 9. Tasks

1. **Ids and keys.** Tests: `deriveKey` cases (long names, spaces, digits, clashes), `fullId`/`parseId` both forms with dotted ids, case-insensitive key; `addNode` gives `p3.1`, `p3.2`, `p3.1.1`; a superseded child's number is not reused; `--after` does not change numbering; validation accepts dotted ids and rejects one whose parent id does not match; natural sort (`p3.2` before `p3.10`); gaps get `p3.1.g1`, `p3.1.g2`, numbering restarts per node and is not reused after resolve or dismiss; a flat legacy `g2` still resolves; `parseId` tells a gap from a child node.
2. **Store layout and migration.** Tests: new layout, `listBoards`, `activeKey`, legacy single board moved with a key and its content unchanged, clashing keys, corrupt `tree.json` left alone.
3. **Command resolution.** Tests: one board implied; `--board`; full id; active; two boards and none named stops; typed commands never guess; `use`, `boards`; `init` adds a second board and refuses a duplicate key; guard lists.
4. **Page.** Tests: overview contents, links, no network, board page back link and full ids, flow labels.
5. **Brief, skills, README.**
6. **Dry runs with a real Claude** (`scripts/dry-multiboard.mjs`, results in `docs/dry-run/multiboard.md`): (a) one board, short ids, no board talk; (b) two boards, "add a step to login" picks LOGIN and says so; (c) two boards, a message with no clue makes the AI ask; (d) a topic that matches two boards makes the AI ask; (e) "approve p1" typed with two boards and no active one stops and asks; (f) after `init` of a second board in the chat, `p1` means the new board.

## 10. Risks and honest limits

- **Judgement again.** Rule 3 (topic matching) and "say which board" are model behaviour, with the same roughly 2-in-3 to 9-in-10 reliability as the earlier dry runs. The saying-out-loud line is the safety net, plus the code refusing topic guesses for decisions.
- **Active is per repo.** Two parallel sessions can overwrite each other's active board. Typed commands that name a board are unaffected.
- **Migration moves files.** It is atomic per file and runs once; a crash between the two renames leaves the board loadable (the loader looks in both places) and the page stale until the next render.
- **Key stability.** A key cannot be changed. A mistake means making a new board; the old one is not deleted (nothing is), it stays listed.

## 11. Not in this design

Moving or copying nodes between boards; cross-board links or dependencies; renaming a key; deleting or archiving a board (can be added the same way as supersede later); per-chat active state; merging boards. Per-role models and the build pipeline are unchanged.
