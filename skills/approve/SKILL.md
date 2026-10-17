---
name: approve
description: Human-only. Approve a node: /brick:approve <id>. Typed by the user, never run by the AI.
argument-hint: <id>
disable-model-invocation: true
---
The plugin hook already ran this command when the user typed it. Report the line that starts with `[brick]` to the user in one or two plain sentences. If there is no such line, say the hook did not run, and stop. Do not run any command yourself.
