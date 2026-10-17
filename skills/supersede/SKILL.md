---
name: supersede
description: Human-only. Drop a node and everything below it, with a reason: /brick:supersede <id> --why "<reason>" [--by <id>].
argument-hint: <id> --why "<reason>" [--by <id>]
disable-model-invocation: true
---
The plugin hook already ran this command when the user typed it. Report the line that starts with `[brick]` to the user in one or two plain sentences. If there is no such line, say the hook did not run, and stop. Do not run any command yourself.
