---
name: supersede
description: Human-only. Drop a node and everything below it: /brick:supersede <node> <why>.
argument-hint: <node id or title> <why>
disable-model-invocation: true
---
The plugin hook already ran this command when the user typed it. Report the line that starts with `[brick]` to the user in one or two plain sentences.

If that line starts with `[brick] NEEDS:`, nothing was changed and the user left something out. Ask for what is missing in one short, plain question, offering the candidates the line lists. Then give the user the exact complete command from its `Complete command:` line, filled in with their answer, for them to send. You cannot send it for them.

If there is no `[brick]` line, say the hook did not run, and stop. Do not run any command yourself.
