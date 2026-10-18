# UI labels check

Checked on 2026-10-18 with a sample board (`USER`, 8 boxes of which 7 AI drafts, a sub-problem with a dotted id `p1.1`, two gaps, one superseded box, short title "User query feature"), served from localhost and opened in the browser pane.

## What was checked

| Check | Result |
|---|---|
| Root of the tree shows the short title with a `USER` tag, not the full sentence | yes |
| Page heading is the short title; "You said: ..." shows the full sentence under it | yes |
| Each box: bold title, then tags (id, state, `AI draft`, `N sub`, `N gaps`), wrapped to a second row when needed | yes |
| No tag crosses its box edge, and no tag text is wider than its pill (measured with `getBBox` on all 10 boxes and 29 tags) | none found |
| Superseded box in the Dropped group has its tags | yes |
| Node page (`#node=p1`) shows the same tags as HTML pills, with kind and parent link after them | yes |
| Phone width (375): no horizontal page scroll, tags still inside boxes | yes |
| Console errors | none |

## Limits seen

- At the Fit zoom level on a wide board the tag text is small (about 7 px on screen at 0.6 zoom). The same is true of the title text; zoom in with the mouse wheel to read it.
- Tag widths are estimated from the text length (no font is measured in Node). With this font the estimate was wide enough for every tag; a font with wider glyphs, or CJK text in a custom title, could still overflow a pill. The page was checked only in one browser (the Claude browser pane).
- Clicking a box with a dotted id was not clicked by hand; `diagramNodeId` is covered by a unit test and the node page for `p1` opened from its hash.
