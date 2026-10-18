# brick: a short title and tagged node boxes

Status: draft for review. Branch `feat/ui-labels`. Changes the page and one project field; no change to nodes, gaps, ids or approval rules.

## 1. Why

Two things on the page are hard to read (seen on a real board, `USER`):

1. The root node of the tree shows the whole sentence typed at init ("I want to build user query feature with express js in controller, services, repository pattern."), because that sentence is the board's name.
2. Every node box packs its id, state, source and counts into one grey line ("Drafting · USER-b1 · AI draft"). The separator dots do not make the parts easy to tell apart.

## 2. Decisions already made

- A short **title** for the board, used wherever a short label is needed. The user's sentence stays, shown as "You said: ...".
- **Tags** for the secondary facts in a node box: the id, the state, the source and the counts each get their own tag with its own style. The title stays the main text, in bold.
- Tags are drawn by the code when the page is built (no logic in the page, no network).

## 3. The short title

- New optional field `project.title`: one line, at most 40 characters, no markup restrictions beyond that (it is escaped everywhere). `project.name` is unchanged and still holds the user's sentence; the key, the overview and `board boards` text keep working from it as today.
- Set with `board ai project --title "<short title>"`. A title is a label, not a decision, so `--title` needs no `--user-said`; the other flags of `ai project` still do. Empty, multi-line or over-40-character titles are refused with a message that says so. It adds an event `title` (actor `ai`).
- **Fallback** when there is no title (every existing board): `shortName(name)`, a pure function: drop a leading "I want to / I'd like to / we want to / let's" followed by build, make, create, add, write or implement (case-insensitive), drop a leading "a / an / the", drop a trailing full stop, cut at the last word boundary at or before 40 characters and add "…" when cut, then upper-case the first letter. Never returns empty: it falls back to the name cut at 40.
- **Where it shows**: the tree's root node (short title, bold, with the key as a tag under it); the page heading (`h1`) and the tab title; the overview card heading; the node page's top bar. The full name is shown once, as a muted "You said: ..." line under the page heading, only when it differs from the shown title. `ls`, `brief` and `boards` keep the full name (they are plain text and the brief should carry the user's words).
- **Setting it.** `skills/init` tells Claude to run `board ai project --title` right after the board is created, with a 2 to 5 word label taken from the user's sentence, and to tell the user the label it chose in the same message that gives the key. The user can ask for another one and Claude runs the command again. A wrong title is replaced, not deleted: the old one stays in the event.

## 4. Node boxes

Each node box in the board, tree and sub-step diagrams has two parts:

- **Title**, bold, on the top lines, as now (cut at 100 characters).
- **A row of tags** at the bottom of the box, left to right, each shown only when it applies:

  | Tag | Text | Style |
  |---|---|---|
  | id | `USER-b1` | outlined, monospace, neutral grey |
  | state | `Drafting`, `Approved`, `Has gaps`, `Superseded` | filled, one colour per state (grey, teal, amber, pale grey) with the same dark text colours the page already uses |
  | source | `AI draft` | outlined, blue; only when an AI draft is not yet approved or superseded (the rule as today) |
  | sub-steps | `2 sub` | filled light grey |
  | open gaps | `1 gap`, `3 gaps` | outlined, amber |

- The border and dash of the box keep showing the state, as now. A tag always carries a word, so no meaning rests on colour alone.
- **Root node** (dark): the short title in white, bold; under it the key as a light tag (`USER`).
- The input and output nodes keep their plain text.
- **Node page** (the side panel): the same tags, as HTML spans, replace the current plain badge and `card-state` text, using the same CSS classes (`.tag`, `.tag-id`, `.tag-state-<state>`, `.tag-ai`, `.tag-count`, `.tag-gap`), so one definition styles both.

### How the tags are drawn

pele draws a label as bold, italic and plain text lines only, so a tag (a rounded box with text) cannot be part of the label. After pele returns the SVG, `addTags(svg, pd)` in `src/flow.mjs`:

1. The label sent to pele is the bold title plus blank lines that reserve the tag rows (`tagRows(pd, id)` rows of one blank line each, and a padding line wide enough for the widest tag row).
2. For each `.pele-node` it reads the box (`rect` x, y, width, height from the node's own attributes), and appends a `<g class="pele-tags">` inside the node group, with one `<rect class="tag ..." rx>` and one `<text>` per tag, laid out from the left padding at the bottom of the box. The group is inside the node, so the click, focus and keyboard handling that use `.pele-node` keep working unchanged.
3. Tag width is estimated from the text length (a fixed width per character for the page font size), plus padding. If the tags of one node do not fit on one row they wrap to a second row; the reserved rows are computed from the same estimate, so box height and tag layout agree.
4. A node whose tags cannot be added (unexpected SVG) is left as pele drew it, with the id and state in a plain second line, so the page always shows them.

Styles for the tags in the diagram live in `page.css` (the SVG is inline in the page, so classes apply). Fills and strokes are colours, not inline attributes, so a later dark theme only edits the CSS.

## 5. Where it lives

- `src/store.mjs`: `project.title` (optional) in `emptyData` input and in `validate` (string, one line, 1 to 40 characters when present).
- `src/commands.mjs`: `--title` on `AI.project` (no `--user-said` when it is the only flag; `setProject` keeps requiring it for input and output); `src/text.mjs` HELP.
- `src/title.mjs` (new, pure): `shortName(name)`, `shownTitle(project)` (title if set, else `shortName(name)`).
- `src/flow.mjs`: `tagsFor(pd, id)`, `tagRows`, `addTags`; labels built from the title and the reserved rows; the root label.
- `src/render.mjs` (`pageData` carries `project.shown`), `src/page.js`, `src/page.css`, `src/overview.mjs`: shown title, "You said" line, tag spans and classes.
- `skills/init`, README (the board page section and `ai project --title`).

## 6. Tasks

1. **Title.** Tests: `shortName` on the real sentence ("I want to build user query feature with express js in controller, services, repository pattern." gives "User query feature with express js in…"), on text without a filler start, on text under 40 characters, on an all-filler input; `ai project --title` sets it, refuses empty, two lines, 41 characters, and works without `--user-said`; `--input` without `--user-said` is still refused; the event is written; an old file with no title loads.
2. **Tags in the diagrams.** Tests: the tree, board and sub-step SVGs contain `pele-tags` in each node, one tag per applicable fact in the order id, state, source, sub-steps, gaps; each tag stays inside its box; a node with many tags wraps to a second row and the box is tall enough; a superseded node has no `AI draft` tag; the root shows the short title and a key tag; labels that contain markup or long titles are still escaped and cut; a node with `tags` missing falls back to the plain second line; clicking a node still resolves its id (`diagramNodeId`).
3. **Page.** Tests: heading, tab title and overview card use the shown title; "You said" appears only when it differs; the node page shows the tag spans with the right classes; nothing is rendered unescaped; the page still makes no requests.
4. **Skill and README.** Tests: the `init` skill runs `ai project --title` after creation and reports the label.
5. **Look at it.** Rebuild the `USER` board in `~/brick-test` and check in the browser at desktop and phone width: no tag overflows its box, the dark root reads well, tags are legible at the Fit zoom level. Screenshots in `docs/dry-run/ui-labels.md`.

## 7. Risks and honest limits

- **Width is estimated.** Without measuring text in a browser, tag widths use a per-character estimate; unusual fonts or very wide characters (CJK) can make a tag text slightly wider than its pill. The estimate errs wide, and the check in task 5 uses the real page.
- **A model sets the title.** If Claude forgets, the fallback trims the sentence, which is readable but not a real summary. The title can be set at any time.
- **Existing boards** show the fallback until a title is set; nothing is rewritten.
- **pele changes.** The tag code reads pele's SVG structure (`.pele-node`, its `rect`); a pele upgrade can change it. Case 4 in section 4 and the pinned pele version limit the damage.

## 8. Not in this design

A dark theme; changing colours of the box border; editing the title from the page (the page is read-only); a human-typed command for the title (the user asks Claude, or edits it with the existing project command if one is added later); changing how ids, states or counts are computed.
