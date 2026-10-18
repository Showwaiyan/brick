# brick: drawing the board with pele, on a pan-and-zoom canvas

Status: draft v2 for review (v1 covered only the Flow view). Branch `feat/pele-flow`. Spike results: `docs/dry-run/pele-spike.md`.

## 1. Why

The Flow and Tree views are laid out by our own code (a CSS grid and nested lists), and the page scrolls. That is fine for 4 boxes and bad for 30. The roadmap adds more drawings (planned against actual flowcharts, a Kanban). We want to describe a diagram and let a library place it, and we want a surface the user can pan and zoom instead of scrolling.

[pele](https://github.com/obsidianmd/pele) (MIT, no runtime dependencies, v1.6.0) renders Mermaid text to SVG, and colours and fonts come from `--pele-*` CSS variables.

## 2. What the spike showed

- `render(text)` is synchronous and runs in plain Node, 1-8 ms per diagram, 3-19 KB of SVG. So `board render` draws the diagrams and embeds the SVG. The 677 KB library does not go into `tree.html`.
- Every node is `<g class="pele-node <classes>" data-id="b1">`. One delegated listener reads the id. State classes land on the node group, so colours, dashes and the selected border are our CSS.
- Light and dark work through variables. Hostile titles are shown as text.
- Wide flows are the problem: 12 boxes are 2689 px wide, 30 are 6890 px. Fitted to the panel they are unreadable. This is what the canvas fixes.
- Pele ships its own `enableZoom`, but it needs the library in the page. We write our own small pan and zoom instead.

## 3. Scope

In: the Flow and Tree views drawn by pele on a shared pan-and-zoom canvas, and a node's details moved from a side panel to its own page that also draws the node's own flowchart. The "Next commands" section is removed.

Out: any change to `tree.json`, commands, guards or hooks. The build-pipeline "actual" flowchart is only reserved a place (section 4.4). If the result looks worse than today, we do not merge the branch.

## 4. Design

### 4.1 Diagram text (our code, Node side)

New `src/flow.mjs` (under 150 lines), working only from the page data the page already gets:

- `boardMermaid(pd)`: `flowchart LR`, project input and output as stadium shapes (only when set), live top-level boxes in order joined by arrows, dropped boxes in a `subgraph "Dropped"` with the `superseded` class and not chained.
- `treeMermaid(pd)`: `flowchart TD`, every live node with an arrow from its parent, dropped nodes dashed. Same state classes.
- `nodeMermaid(pd, id)`: `flowchart LR` of that node's active children in order, or `null` when it has none.
- Labels are two lines: title, then state, id and counts. Titles are untrusted: quoted form, with `"`, `[`, `]`, `<`, `>`, `&` and `\` written as Mermaid entity codes. A test feeds each of them plus a 300-character title and a newline.
- `drawSvg(text)` runs pele and returns the SVG string, or `null` if pele throws or the text is too large. The page keeps working, with a plain "could not draw" notice and the details pages intact.

`renderHtml()` adds `board_svg`, `tree_svg` and a `flow_svg` on each node that has one to the embedded data. About 20 KB each at most.

### 4.2 The canvas (page side, our code)

One small component in `src/canvas.js` (inlined with the page, about 80 lines) that takes an SVG and gives:

- drag to pan, wheel and trackpad pinch to zoom around the pointer, `+` `-` `Fit` buttons, arrow keys and `+`/`-` when focused;
- the SVG keeps its natural size (pele's `max-width:100%` is turned off), and the component sets the SVG `viewBox` for pan and zoom, so text stays sharp;
- it starts on "fit", then never zooms out below a readable level by itself: when fitting would make text smaller than about 9 px, it starts at the left, zoomed to a readable level, and the user pans;
- clicks and drags are told apart, so a drag does not open a node.

This is an SVG on a pannable surface, **not** an HTML `<canvas>` element. A real canvas would be a bitmap: we would lose per-node clicks, keyboard access, text selection and CSS styling, which are what made the spike work.

### 4.3 Board view

`Flow` and `Tree` tabs stay. Each shows its SVG in the canvas, full width, no side panel. Clicking a node goes to its details page. Each node group gets `tabindex="0"`, `role="link"` and Enter/Space handling, so keyboard use still works. Light and dark come from the `--pele-*` variables and four state rules in `page.css`, set once.

### 4.4 Details page

Route: `#node=b3` (the hash scheme the page already uses). The page replaces the board view; a "Back to board" link returns to the view that was open. Single readable column:

1. Title, id, kind, state badge.
2. **Flow** (new): the node's own flowchart from `nodeMermaid`, in the same canvas at a smaller height. Children are clickable and open their pages. A node with no children shows "No sub-steps yet." This section is titled **Planned flow**, so the build pipeline can later add an **Actual flow** beside it without reshaping the page.
3. Who wrote it, Description, Contract, Gaps, Superseded, History: the same content as today.

### 4.5 Removing "Next commands"

Removed from the details page and from the data (`next_commands` in `pageData`, `nextCommands` in `model.mjs`, and their tests). The reasoning:

- You type commands in plain words now (`/brick:approve check password`), so the exact string is not needed.
- The list also repeated the gap commands, which the Gaps section already shows by gap id.
- What the section did add was knowing which actions are valid right now. If that is wanted, a one-line "Why it can't be approved yet" using the existing approval check is a better answer than a list of commands. Not part of this work; say if you want it.

The gap command chips (`/brick:resolve g1 <note>`) are removed for the same reason; the gap id and status stay.

### 4.6 The library

Vendored as `vendor/pele/pele.js` with its LICENSE and a `VERSION` file; exact version pinned, no `npm install` for users, no dependency in `package.json`. Loaded with a dynamic `import()` inside `drawSvg`, so the CLI and hooks start as fast as before.

## 5. Tasks

1. **Browser spike (done).** See `docs/dry-run/pele-spike.md`.
2. **`src/flow.mjs` and tests** (`test/flow.test.mjs`): the three Mermaid builders for no boxes, one box, input and output, dropped boxes, deep trees, hostile titles; `drawSvg` returns `null` instead of throwing.
3. **Canvas component and details page.** Vendor pele; add the SVG fields to `renderHtml`; `src/canvas.js` with a test of its pan and zoom arithmetic in Node; replace `renderFlow`/`renderTree`/`renderDetail` in `page.js`; remove `next_commands` and the gap chips; page CSS. Update the render and model tests.
4. **Check in a real browser** (served over localhost, since the browser pane does not run scripts from `file://`): board with every state, 30 boxes, a node with children and one without, a hostile title, light and dark, keyboard only, a drag that must not open a node. Report with screenshots.

## 6. Risks

- **Pan and zoom feels bad.** It is our code, so it is tunable, and task 4 tests it by hand. The fallback is pele's own `enableZoom`, at the cost of the library in the page.
- **Looks no better.** Not merged.
- **Estimated text widths in Node.** Boxes may clip text slightly. Mitigated with a wider minimum; checked in task 4.
- **Young library.** Pinned and vendored.
- **Page-inserted markup.** The SVG is inserted as markup instead of built with `createElement`. It comes from our build step, pele escapes diagram text, and the hostile-title test covers it.

## 7. Not decided here

Whether the Tree canvas reads well as a top-down flowchart for deep trees (task 4 will show it; a mindmap is the alternative). The "actual" flowchart after implementation, which belongs to the build-pipeline work.
