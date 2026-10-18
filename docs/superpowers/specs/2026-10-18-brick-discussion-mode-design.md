# brick: discussion mode (the AI helps you think, only when you want it)

Status: draft for review. Branch `feat/discussion-mode`. Builds on `2026-10-17-brick-plugin-design.md`.

## 1. Why

`/brick:init` is where you say what you want to solve, and often how. Sometimes you know. Sometimes you have half an idea, a few steps, or a worry, and you want to talk it over: compare tools, weigh alternatives, hear what others usually do. Today the skill only says "if they ask for your suggestion, say it is yours and keep it in chat". That is too thin: it does not say what good help looks like, it never notices that you are stuck, and nothing stops a pointing reply like "option 2" from being recorded as your words.

The rule underneath does not change: **you decide, the AI helps you think.** What changes is that the AI may bring ideas and comparisons, always on your invitation, and your decision still enters the board only in your words.

## 2. Which commands you type

No new command. All seven decision commands stay human-only: `/brick:init`, `/brick:approve`, `/brick:reopen`, `/brick:supersede`, `/brick:restore`, `/brick:resolve`, `/brick:dismiss`. Discussion happens in chat. You can ask for help at any moment, in any words.

`/brick:open` stays typeable, and the AI may also open the page for you (section 6). That needs no change in the guards: `board open` is already on the read-only list.

## 3. The behaviour

Discussion is **opt-in**, in one of two ways, and never starts by itself.

**You ask.** Any request for ideas counts: "what do you think", "any suggestions", "compare X and Y", "what are the alternatives", "how do people usually do this", "help me decide", "I'm not sure how to". The AI helps at once, without asking again.

**You seem stuck.** Signs: "I don't know" or "not sure" twice in a row on the same point; an answer that contradicts an earlier one and you say so; you answer a question with a question; you stop with a half-sentence. The AI then asks **one** plain question and stops:

> You sound unsure about <the point>. Do you want my suggestions on it, or would you rather think it through yourself first?

Rules for that question:
- It is asked once per point. If you say no, or ignore it, the AI does not raise that point again unless you ask.
- It is a question, never a lead-in: nothing else in that message, no ideas slipped in.
- If you say yes, discussion starts. If you answer the original question instead, the AI carries on as before.

**Where it applies.** Everywhere: the first conversation after `/brick:init` (what to build, how, what could go wrong), while listing the flow, while breaking a box down, and when you ask what to do about a gap. The topic can be anything that helps the decision: comparing tools or libraries, alternative designs, trade-offs, what to check, risks, how others solve it.

**What good help looks like.**
- Two or three options with the trade-offs of each, not one answer pushed as the answer. It can say which it would lean towards and why, marked as its opinion.
- It says what it knows and what it does not: whether a fact came from a lookup (with the source) or from memory, and what it cannot judge without your context.
- It ends with a question that hands the decision back: "Which of these, if any, do you want to go with? Say it in your own words."
- It does not call anything ready, approved, complete or good, and does not flatter.
- It keeps messages short, one topic at a time.

**What it never does**, discussion or not: write a suggestion onto the board, name a fix inside a gap, approve, resolve, dismiss, or choose for you.

## 4. Recording your decision: say it in your own words

A suggestion is not a decision until you make it yours.

- When you reply with a pointer to what the AI said ("option 2", "the first one", "that one", "yes", "go with your idea", "ok"), the AI records nothing. It asks you to say the choice in a sentence of your own, e.g. "In your own words: what are we going with, and why?", and records that.
- When you type the choice yourself, even if it matches the AI's text, it is yours, and the AI records your sentence with `--user-said`.
- The board's "Who wrote it" section keeps showing your quote.

**Code backs the wording.** `board ai add|edit|project` already require `--user-said`. A new check, `lintSaid(quote)` in `src/rules.mjs`, rejects a quote that is only a pointer, using fixed patterns (a bare yes/ok/sure/agreed; "option N"; "the first/second/last one"; "that/this one"; "go with it/that/your ...idea"; "as you said"). The error says what the user must do: "That only points at something Claude said. Ask the user to say it in their own words." Longer quotes that merely start with a pointer ("option 2, because it needs no server") pass. This is a heuristic, like the gap lint, and is documented as such.

## 5. Where it lives

- `skills/discuss/SKILL.md` (new, model-invocable): when it applies, the opt-in rules, what good help looks like, the restate rule. Loaded on demand, so the skill that runs all session stays short.
- `skills/decompose/SKILL.md`: the old "When the user asks for your suggestion" section becomes a pointer to `discuss`, step 4 ("do not propose boxes") says "unless the user asked for discussion", and the stuck-detection question is added to steps 1 and 2.
- `skills/init/SKILL.md`: after `[brick] created`, the follow-up question becomes open and invites everything: "What do you want to solve, and how do you want to go about it? Anything you are unsure about or already worried about is welcome too." The AI records what the user says, in their words, with `board ai project` and `board ai add`; it does not draft anything for them.
- `src/rules.mjs` and `src/commands.mjs`: `lintSaid` called where `--user-said` is read.
- The session brief gets one line: "Discussion: only when the user asks or says yes to your offer."

## 6. Opening the page

The AI may run `board open` itself, after it has recorded something the user will want to look at, or when the user asks to see the board. It says it did, and reminds that the page shows the state at the time it opened (it refreshes on reload). It does not open it after every change. `/brick:open` stays as the user's way to do the same.

## 7. Tasks

1. **`lintSaid`** with tests: pointers rejected (every pattern above, with casing and punctuation), real sentences accepted including ones that begin with a pointer, empty and very short real answers ("validate the input") accepted. Wire into `ai add`, `ai edit`, `ai project`.
2. **Skills:** write `discuss`, edit `decompose` and `init`, add the brief line. Extend `test/skills.test.mjs` to check that `discuss` exists, is model-invocable, and mentions the restate rule, and that no decision command became model-invocable.
3. **Dry runs** with a real Claude (`claude -p`, scripted like `docs/dry-run/drive-plugin.py`), recorded in `docs/dry-run/discussion.md`:
   a. stuck twice, then the AI asks the one question and stops;
   b. you answer no, the AI does not ask again on that point;
   c. you ask for a comparison of two tools, the AI gives options with trade-offs and hands the decision back, and the board is unchanged;
   d. you reply "option 2", the AI records nothing and asks you to restate;
   e. you restate, and the board holds your sentence;
   f. a gap exists and you ask what to do about it, the answer is a labelled suggestion and the gap text has no fix;
   g. the AI opens the page after a recording.
4. **README:** a short "Talking it over" section and the limits below.

## 8. Risks and honest limits

- **When to ask is judgement.** "Seems stuck" is a model's read of the conversation, not a rule in code. It may ask too early or too late. The dry runs will show how often, and the skill text is the only fix. You can always ask directly.
- **Anchoring.** A suggestion can steer you even when offered gently. Mitigations: options with trade-offs, the AI's opinion marked as opinion, the decision handed back, your words recorded. None of that removes the pull.
- **The restate check is a heuristic.** A pointer phrased in a way the patterns do not know gets through. The skill rule is the main defence; the lint catches the common slips.
- **Wording cannot be enforced in code**, as before: "never says ready" and "marks suggestions as suggestions" live in the skill text. Read what the AI says.
- **Lookups.** If the AI has a web tool, it may use it for comparisons and should say so. If the tool is off, it says its facts come from memory.

## 9. Not in this design

The roadmap's **approaches** work (recording the options compared and the one chosen, on the board itself) comes later. Until then a discussion lives in chat, and only your decision reaches the board, in your words. Model roles and the build pipeline are untouched.
