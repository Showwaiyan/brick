# pele spike (task 1), 2026-10-18

Setup: `pele@1.6.0`, demo board from `board init --demo`, Mermaid text built from `pageData()`, SVG made in Node, shown in a plain HTML page over `http://127.0.0.1` in the app's browser pane. Dark and light themes, four diagrams.

## Results

| Check | Result |
|---|---|
| Click on a node gives its id | Pass. Clicking "Check password" gave `b3`, with `pele-node pele-shape-rect has_gaps`. One delegated listener (`closest('.pele-node')`) is enough. |
| State colours | Pass. `:::approved` etc. become classes on the node group; CSS on `.pele-node.approved rect` applied in both themes. |
| `selected` class | Pass. Added on click, shown as a thick accent border. |
| Dark and light | Pass. `--pele-*` variables set from page variables; no re-render needed to switch. |
| Dropped boxes | Pass. A `subgraph "Dropped"` with a dashed, dimmed box reads clearly. |
| Hostile title (`"`, `[x]`, `<b>`, `\`, `&`) | Pass. Shown literally, nothing injected. Escape was `#quot;`, `#91;` style codes. |
| Very long title | Pass. Wraps inside the box. |
| Render speed | 1-8 ms per diagram in Node. SVG size 3-19 KB. |
| 4 boxes | Good. 866x88 px left to right. |
| 12 and 30 boxes | **Problem.** Left to right is 2689 and 6890 px wide. Fitted to a 755 px panel (pele's default `max-width:100%`) the text is unreadable; at natural size it needs sideways scrolling. Top to bottom is 202 px wide but 1408 and 3568 px tall. |

## Findings

- Clicks, colours, themes and escaping all work. The library can replace the grid code.
- Long flows are the open design question, not a blocker: boards are usually under 10 top-level boxes (children live in the Tree view), so natural size plus horizontal scroll is workable. A top-to-bottom option for big boards is available by changing one word.
- The page needs `svg { max-width: none }` to keep text readable, inside a scrolling container.
- The browser pane shows `file://` pages as static snapshots (no scripts), so tests of the real page need a local server or the user's own browser.
