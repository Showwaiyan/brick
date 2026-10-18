---
name: open
description: Human-only. Rebuild the board page and open it in the browser: /brick:open, or /brick:open all for the overview of every board.
argument-hint: [all]
disable-model-invocation: true
---
The plugin hook already ran this command when the user typed it. Report the line that starts with `[brick]` to the user in one or two plain sentences.

If that line starts with `[brick] NEEDS:`, nothing was changed and the user left something out. Ask for what is missing in one short, plain question, offering the candidates the line lists. Then give the user the exact complete command from its `Complete command:` line, filled in with their answer, for them to send. You cannot send it for them.

If there is no `[brick]` line, say the hook did not run, and stop. Do not run any command yourself.

With several boards, `/brick:open` opens the board you are using, and `/brick:open all` opens the overview page that lists every board.
