// Scripted dry run of discussion mode with a real Claude Code (needs the `claude` CLI). Not part of `npm test`.
// Run: node scripts/dry-discussion.mjs   (takes several minutes; writes docs/dry-run/discussion.md)
// A fake `open` command sits first on PATH, so no real browser window is opened.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BIN = path.join(ROOT, 'bin/board.mjs');
const OUT = path.join(ROOT, 'docs/dry-run/discussion.md');
const transcript = ['# Discussion mode: scripted dry run', '', `Run on ${new Date().toISOString().slice(0, 10)} with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and a fresh session.`, ''];
let failed = 0;
const only = process.argv[2]; // optional: run just one scenario, e.g. `node scripts/dry-discussion.mjs 1`

// A fake `open` that records its calls instead of launching a browser.
const fakeBin = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brick-fake-')));
const openLog = path.join(fakeBin, 'open.log');
fs.writeFileSync(path.join(fakeBin, 'open'), `#!/bin/sh\necho "$@" >> "${openLog}"\n`, { mode: 0o755 });
const env = { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` };

// One scenario: a project folder, a session, and helpers to talk and look at the board.
function scenario(title, setup) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brick-dry-')));
  const session = crypto.randomUUID();
  let turns = 0;
  const sh = (cmd, args) => spawnSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  sh('git', ['init', '-q']);
  const board = (...args) => sh('node', [BIN, ...args]);
  const data = () => JSON.parse(fs.readFileSync(path.join(cwd, '.board/boards/LOGIN/tree.json'), 'utf8'));
  transcript.push(`## ${title}`, '');
  const s = {
    cwd, board, data,
    nodes: () => Object.keys(data().nodes).length,
    says(prompt) {
      const args = ['-p', prompt, '--plugin-dir', ROOT, '--allowedTools', 'Bash,Skill', '--max-turns', '14',
        ...(turns === 0 ? ['--session-id', session] : ['--resume', session])];
      turns += 1;
      const r = spawnSync('claude', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
      const reply = (r.stdout || '').trim() || `(no output) ${r.stderr}`;
      transcript.push(`**You:** ${prompt}`, '', ...reply.split('\n').map((l) => `> ${l}`), '');
      return reply;
    },
    check(label, ok, detail = '') {
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : `\n     ${String(detail).slice(0, 400)}`}`);
      transcript.push(`- ${ok ? 'PASS' : 'FAIL'}: ${label}`);
      if (!ok) failed += 1;
    },
    end() { transcript.push(''); fs.rmSync(cwd, { recursive: true, force: true }); },
  };
  setup(s);
  return s;
}
const initBoard = (s, name) => {
  s.board('init', name);
  fs.writeFileSync(path.join(s.cwd, '.board/config.json'), '{"openBrowserOnSessionStart": false}');
};
const offersHelp = /(want|like) (me to|my (suggestions|help|ideas|thoughts))|my (suggestions|ideas) on/i;
const hasList = /^\s*(\d+[.)]|[-*•])\s/m;

// 1. Stuck: the AI asks one question and stops. Declined: it does not ask again.
if (!only || only === '1') {
  const s = scenario('1. You are stuck, then you say no', (x) => initBoard(x, 'Notifications'));
  s.says("I want to build a notification feature for my app, but I don't know how it should work.");
  const r2 = s.says("I really don't know. I'm not sure at all. Maybe email? I have no idea.");
  s.check('after "I don\'t know" twice, it offers help in one question', offersHelp.test(r2), r2);
  s.check('that message has no ideas or option lists in it', !hasList.test(r2), r2);
  s.check('nothing was written to the board', s.nodes() === 0, JSON.stringify(s.data().nodes));
  const r3 = s.says("No, let me think it through myself. I'll start with email only.");
  s.check('after you said no, it does not offer again', !offersHelp.test(r3), r3);
  s.end();
}

// 2. You ask for a comparison; "option 2" is not recorded; your own sentence is.
if (!only || only === '2') {
  const s = scenario('2. You ask for a comparison, then choose', (x) => { initBoard(x, 'Notes app'); x.board('add', 'box', 'Store the notes'); });
  const r1 = s.says('Compare SQLite, Postgres and plain JSON files for storing notes in a single-user desktop notes app, as three numbered options. What would you suggest?');
  s.check('it compares the options', /sqlite/i.test(r1) && /postgres/i.test(r1) && /json/i.test(r1), r1);
  s.check('it hands the decision back', /own words|\?\s*$/.test(r1.trim()), r1);
  s.check('it does not call anything ready, approved or good', !/\b(looks good|is ready|approved|complete)\b/i.test(r1), r1);
  s.check('nothing was written to the board', s.nodes() === 1 && !JSON.stringify(s.data()).match(/sqlite|postgres/i), JSON.stringify(s.data()));
  const r2 = s.says('option 2');
  s.check('"option 2" is not recorded, and it asks for your own words', !/"option 2"/i.test(JSON.stringify(s.data())) && /own words|your words|in a sentence|say it/i.test(r2), r2);
  s.says("I'll use SQLite because the app is single-user and needs no server.");
  s.check('your own sentence is recorded', JSON.stringify(s.data()).includes('needs no server'), JSON.stringify(s.data()).slice(0, 500));
  s.check('the pointer was never recorded', !/"option 2"/i.test(JSON.stringify(s.data())));
  s.end();
}

// 3. You ask what to do about a gap: a labelled suggestion, and the gap text keeps no fix.
if (!only || only === '3') {
  const s = scenario('3. You ask what to do about a gap', (x) => {
    initBoard(x, 'Login');
    x.board('add', 'box', 'Check password');
    x.board('ai', 'gap', 'b1', '--missing', 'Nothing says what happens when the username does not exist.');
  });
  const before = JSON.stringify(s.data().gaps);
  const r = s.says('What would you do about g1? Give me your suggestion.');
  s.check('it answers as a suggestion or opinion', /suggest|my (opinion|take)|I('d| would)|lean/i.test(r), r);
  s.check('the gap on the board is unchanged', JSON.stringify(s.data().gaps) === before, JSON.stringify(s.data().gaps));
  s.end();
}

// 4. The AI may open the page, and says so.
if (!only || only === '4') {
  const s = scenario('4. The AI opens the page', (x) => initBoard(x, 'Login'));
  const r = s.says('My flow is: first it validates the input, then it looks up the user. Record that, and show me the board.');
  s.check('the steps were recorded', s.nodes() >= 2, JSON.stringify(s.data().nodes));
  s.check('the page was opened', fs.existsSync(openLog), r);
  s.check('it says it opened the page', /open/i.test(r), r);
  s.end();
}

// 5. After /brick:init, one open question.
if (!only || only === '5') {
  const s = scenario('5. After /brick:init', () => {});
  const r = s.says('/brick:init login feature for my app');
  s.check('the board was created', fs.existsSync(path.join(s.cwd, '.board/boards')) && fs.readdirSync(path.join(s.cwd, '.board/boards')).length === 1, r);
  s.check('it asks what you want to solve and how', /what do you want to solve/i.test(r) && /how do you want/i.test(r), r);
  s.check('nothing was recorded yet', s.nodes() === 0, JSON.stringify(s.data().nodes));
  s.end();
}

fs.writeFileSync(only ? OUT.replace('.md', `-${only}.md`) : OUT, `${transcript.join('\n')}\n`);
fs.rmSync(fakeBin, { recursive: true, force: true });
console.log(failed ? `${failed} check(s) failed. Transcript: ${OUT}` : `All checks passed. Transcript: ${OUT}`);
process.exit(failed ? 1 : 0);
