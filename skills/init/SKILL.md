---
name: init
description: Human-only. Create the board for this project: /brick:init "<name>" [--input ..] [--output ..] [--demo].
argument-hint: "<name>" [--input ".."] [--output ".."] [--demo]
disable-model-invocation: true
---
The plugin hook already ran this command when the user typed it. Report the line that starts with `[brick]` to the user in one or two plain sentences. If there is no such line, say the hook did not run, and stop. Do not run any command yourself.
