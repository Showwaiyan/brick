---
name: reopen
description: Human-only. Send an approved node back to drafting: /brick:reopen <id> --why "<reason>".
argument-hint: <id> --why "<reason>"
disable-model-invocation: true
---
The plugin hook already ran this command when the user typed it. Report the line that starts with `[brick]` to the user in one or two plain sentences. If there is no such line, say the hook did not run, and stop. Do not run any command yourself.
