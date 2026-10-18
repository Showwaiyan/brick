# Decomposition: what the dry runs showed

Script: `node scripts/dry-decomposition.mjs [scenario letter]`. Transcript of the last full run: `decomposition.md`. Seven scenarios (a to g), 22 checks, a real Claude Code with this plugin. Models vary from run to run, so these are counts, not guarantees.

## What changed because of the runs
1. **"Break down check password for me" was answered with a question** ("what goes in, what comes out?") instead of a draft: the older step "ask for their breakdown first" won over the new drafting rule, and the brief's "ask questions" line pushed the same way. Fixes: step 2 now says "unless they asked you to write it", the drafting section says not to ask first and to say what was assumed afterwards, and the session brief says the same.
2. **"Break down check password: comparing the hash, and rate-limiting attempts" recorded nothing** (the AI asked a different question). The brief now says: when the user states a step, sub-problem or contract, record it at once in their words, say the id, then ask one question.
3. **A duplicate box** was added when the user described an existing node ("Check password takes..."). The brief and skill now say to run `board ls` first and edit an existing node instead of adding a second one.

## Where it stands
- Each full run since the fixes passed 20 or 21 of 22 checks. The misses moved around between runs, which is what judgement-based behaviour looks like:
  - drafting on request: 4 of 4 clean runs of scenario a after the last change (earlier, 1 of 3 asked a question instead);
  - typed sub-problems recorded as the user's words, not as AI drafts: passed in every run after fix 2;
  - no draft without a request: 3 of 3 after fix 3;
  - gap sweep with at least three gaps and two kinds including an edge case, none with a fix: passed every run. One run's final message was a stray remark about a background lookup rather than a report, although the gaps were recorded;
  - `board check` run, and two-purpose node described as "could be split": passed every run;
  - a well-formed leaf described as "can stay whole": passed, but in one run the AI wrote "All checks pass ... small enough to stay whole as-is" and left out "your call", which the check for wording flagged;
  - drafting the flow: passed every run.
- The AI's wording ("by these checks", "your call") is the least reliable part. `board check` itself is deterministic and tested.
- Discussion-mode dry run after these changes: 21 of 22, with the known flaky first offer after two "I don't know"s.
