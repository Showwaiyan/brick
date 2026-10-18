# brick: drawing the Flow view with pele

Status: draft for review. Branch `feat/pele-flow`.

## 1. Why

The Flow view is laid out by our own code: a CSS grid in `src/page.css` and card placement in `renderFlow()` in `src/page.js`. Every change to spacing, arrows or wrapping is more of that code, and the style is not good enough today. The roadmap adds more drawings (planned against actual flowcharts, a Kanban). We would rather describe the diagram and let a library place it.

[pele](https://github.com/obsidianmd/pele) (MIT, no runtime dependencies, v1.6.0) renders Mermaid text to SVG. Colours and fonts come from `--pele-*` CSS variables.

## 2. What the spike showed (2026-10-18)

Done with `pele@1.6.0` in plain Node, nothing in the repo changed.

- `render(text)` is synchronous and returns `{ svg }` with no browser. So `board render` can draw the diagram and embed the SVG. The 677 KB library does **not** go into `tree.html`.
- Each node is `<g class="pele-node <classes>" data-id="b1">`. Classes set with `:::name` land on that group. One delegated click listener on the SVG can read `data-id`.
- Text width is estimated in Node, not measured with the real font. Boxes may be a little off.
- The package also has `kanban` and `mindmap` diagram types, which match later roadmap items. Not used here.

Still unproven (the first task checks them): a real click in a browser, how it looks in light and dark, long flows, and a title with odd characters.

## 3. Scope

In: the Flow view only, one drawing path, and the branch is a trial. If it looks worse than today, we do not merge it.

Out: the Tree view (the user will redo Flow and Tree styling later), the details panel, any change to `tree.json`, commands or guards.

## 4. Design

**Where the SVG is made.** `src/flow.mjs` (new, under 100 lines) exports `flowMermaid(pageData)` and `flowSvg(pageData)`. `renderHtml()` adds `flow_svg` to the embedded page data. If pele throws or the source is too large, `flow_svg` is `null` and the page uses the existing grid flow, so the page never goes blank.

**Mermaid text, built from page data only** (the same data the page already gets, so no rule is repeated):

- `flowchart LR`.
- Project input and output are the first and last boxes, drawn as stadium shapes (`id(["..."])`), only when set.
- Each live root box, in order, is a node `b1["Title"]` joined to the next by an arrow.
- Dropped roots are not chained. They sit in a `subgraph` titled "Dropped" with the class `superseded`.
- Each node gets a class from its display state: `approved`, `has_gaps`, `drafting`, `superseded`. Gap and sub-problem counts go on a second line of the label.
- Titles are untrusted text. Each label is written in quoted form with `"` and the characters Mermaid treats as markup replaced by their entity codes. A test feeds `"`, `]`, `<b>`, `\`, newlines and a very long title.

**Page side.** `renderFlow()` creates a container, sets its content from `DATA.flow_svg`, and attaches one click listener: `e.target.closest('.pele-node')`, then `go({ node: id })`, the same toggle the cards use today. The selected node gets the class `selected`, restored on every `draw()`. This is the one place the page inserts markup instead of using `createElement`; the string comes from our own build step, pele escapes diagram text, and the safe-embedding rule (`safeJson`) already covers the data copy.

**Styling.** `page.css` sets the `--pele-*` variables from the page's existing colour variables for both colour schemes, and four rules for the state classes plus `selected`. No spacing code.

**Keyboard.** Each `.pele-node` gets `tabindex="0"`, `role="button"` and Enter/Space handling in the page script, so the view stays usable without a mouse. The cards had this for free.

**The library.** Vendored as `vendor/pele/pele.js` with its LICENSE and a `VERSION` file, imported by `src/flow.mjs`. Exact version pinned, no `npm install` for users, no `package.json` dependency. Loaded lazily inside `flowSvg` so the CLI and the hooks start as fast as before.

## 5. Tasks

1. **Browser spike (decides go or no-go).** Render the demo board's flow to a standalone HTML file, open it in the browser, and confirm: clicking a node reads its id, the state colours apply in light and dark, the size of the file, and the look at 4, 12 and 30 boxes. Output: a short note in `docs/dry-run/pele-spike.md`. If clicks or readability fail, stop and report.
2. **`src/flow.mjs` with tests** (`test/flow.test.mjs`): Mermaid text for no boxes, one box, boxes with input and output, dropped boxes, and hostile titles; `flowSvg` returns `null` instead of throwing.
3. **Embed and draw.** Vendor the library, add `flow_svg` to `renderHtml`, replace the body of `renderFlow()` (old grid kept as the fallback), add the click, selected and keyboard handling, and the CSS variables. Update the render tests.
4. **Check in a real browser** with `/brick:open` on a board with every state, and compare with the old Flow. Report.

## 6. Risks

- **Looks no better.** Mitigated by task 1 coming first and the branch not being merged on a bad result.
- **Text widths off in Node.** If boxes clip text, fall back to a wider minimum or let the page re-render with `mount()` (needs the 677 KB library in the page, which we want to avoid).
- **Young library.** Pinned and vendored, so an upstream change cannot break an existing install.
- **Page-inserted markup.** Limited to pele's output for text we have already escaped; covered by the hostile-title test.

## 7. Not decided here

How to restyle the Tree view (maybe pele's `mindmap`, maybe a plain outline). Left for after the Flow trial.
