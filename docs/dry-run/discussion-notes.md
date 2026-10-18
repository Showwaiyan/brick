# Discussion mode: what the dry runs showed

Script: `node scripts/dry-discussion.mjs [scenario number]`. Transcript of the last full run: `discussion.md`. Five scenarios, 19 checks, a real Claude Code with this plugin. Models vary from run to run, so these are counts, not guarantees.

## What changed because of the runs
1. **The `discuss` skill was never loaded** when the user asked "compare SQLite and Postgres, what would you suggest?". The model answered from general knowledge and announced one winner ("SQLite is the clear choice") with no hand-back. Fix: the session brief now tells the AI to load `brick:discuss` before giving ideas, and the skill description starts with "Load this before answering".
2. **The AI volunteered a design lecture** in reply to "I'm not sure how it should work", before any offer. Fix: the core rules now live in the session brief itself (the one place always in context): never volunteer ideas; ask one question after two "I don't know"s; help only after a yes or a direct ask.
3. **A "no" was followed by the same offer** when the user said "still not sure". The rule was too strict for what a model does and what a user would find natural, so it is now: at most two offers per point, and never after a second no unless asked.
4. **Scenario fixes, not product fixes:** the "option 2" test needed a reply that had numbered options; a tool choice needs a node to be recorded on; the open-page test needed more turns; one check's wording was too narrow.

## Where it stands
- Final full run: 18 of 19 checks passed. The failure was the first offer ("after I don't know twice, it offers help in one question"). Over the last runs of scenario 1 alone the offer came 5 times out of 7 when expected; the other times the model asked a plain question about the app instead, which is a softer miss (no ideas were volunteered).
- Stable in every full run after the brief change: comparison with options and a hand-back; "option 2" not recorded and the user asked to say it in their own words; the user's own sentence recorded; a gap kept free of fixes when the user asked for advice; the page opened and the AI said so; one open question after `/brick:init` and nothing recorded.
- Deciding that you seem stuck is judgement. The brief and skill say how; code cannot make it certain. You can always ask for help directly, and that path was reliable.
