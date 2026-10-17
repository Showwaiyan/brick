---
name: restore
description: Human-only. Undo a direct supersede: /brick:restore <id>.
argument-hint: <id>
disable-model-invocation: true
---
The plugin hook already ran this command when the user typed it. Report the line that starts with `[brick]` to the user in one or two plain sentences. If there is no such line, say the hook did not run, and stop. Do not run any command yourself.
