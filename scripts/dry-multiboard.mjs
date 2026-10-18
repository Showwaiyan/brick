// Scripted dry run of choosing between several boards with a real Claude Code (needs the `claude` CLI). Not part of `npm test`.
// Run: node scripts/dry-multiboard.mjs [scenario letter]   (several minutes; writes docs/dry-run/multiboard.md)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BIN = path.join(ROOT, 'bin/board.mjs');
const OUT = path.join(ROOT, 'docs/dry-run/multiboard.md');
const only = process.argv[2];
const transcript = ['# Several boards: scripted dry run', '', `Run on ${new Date().toISOString().slice(0, 10)} with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and session. "Ran" lists the board commands Claude ran.`, ''];
let failed = 0;

const fakeBin = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brick-fake-')));
fs.writeFileSync(path.join(fakeBin, 'open'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
const env = { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` };
const FORBIDDEN = /\b(ready|done|complete|completed|looks good)\b/i;

function scenario(title, setup) {
  const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brick-dry-')));
  const session = crypto.randomUUID();
  let turns = 0;
  const sh = (cmd, args) => spawnSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  sh('git', ['init', '-q']);
  const board = (...args) => sh('node', [BIN, ...args]);
  const data = (key = 'LOGIN') => JSON.parse(fs.readFileSync(path.join(cwd, `.board/boards/${key}/tree.json`), 'utf8'));
  transcript.push(`## ${title}`, '');
  const s = {
    cwd, board, data,
    nodes: (key = 'LOGIN') => Object.values(data(key).nodes),
    gaps: (key = 'LOGIN') => Object.values(data(key).gaps),
    ran: [],
    says(prompt) {
      const args = ['-p', prompt, '--plugin-dir', ROOT, '--allowedTools', 'Bash,Skill', '--max-turns', '14', '--output-format', 'stream-json', '--verbose',
        ...(turns === 0 ? ['--session-id', session] : ['--resume', session])];
      turns += 1;
      const r = spawnSync('claude', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
      let reply = '';
      s.ran = [];
      for (const line of (r.stdout || '').split('\n')) {
        let j; try { j = JSON.parse(line); } catch { continue; }
        for (const c of (Array.isArray(j.message?.content) ? j.message.content : [])) {
          if (c.type === 'tool_use' && c.name === 'Bash' && /\bboard\b/.test(c.input?.command || '')) s.ran.push(c.input.command.replace(/\s+/g, ' ').slice(0, 160));
          if (c.type === 'tool_use' && c.name === 'Skill') s.ran.push(`Skill ${c.input?.skill}`);
        }
        if (j.type === 'result') reply = String(j.result || '').trim();
      }
      reply = reply || `(no output) ${r.stderr}`;
      transcript.push(`**You:** ${prompt}`, '', `_Ran:_ ${s.ran.length ? s.ran.join(' | ') : '(nothing)'}`, '', ...reply.split('\n').map((l) => `> ${l}`), '');
      return reply;
    },
    check(label, ok, detail = '') {
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : `\n     ${String(detail).slice(0, 500)}`}`);
      transcript.push(`- ${ok ? 'PASS' : 'FAIL'}: ${label}`);
      if (!ok) failed += 1;
    },
    end() { transcript.push(''); fs.rmSync(cwd, { recursive: true, force: true }); },
  };
  setup(s);
  fs.writeFileSync(path.join(cwd, '.board/config.json'), '{"openBrowserOnSessionStart": false}');
  return s;
}
const run = (letter) => !only || only === letter;
const wrote = (s) => s.ran.some((c) => /board ai (add|edit|project|gap)/.test(c));
// Two boards: LOGIN (box b1 Check password) and EXPORT (box b1 Write CSV); EXPORT is active, as after the second init.
const twoBoards = (extra) => (x) => {
  x.board('init', 'Login');
  x.board('add', 'box', 'Check password');
  x.board('init', 'Export report');
  x.board('add', 'box', 'Write CSV');
  if (extra) extra(x);
};

if (run('a')) {
  const s = scenario('a. One board: no talk about boards', (x) => { x.board('init', 'Login'); x.board('add', 'box', 'Check password'); });
  const r = s.says('Add a step after check password: create the session.');
  s.check('the step was recorded', s.nodes().length === 2, JSON.stringify(s.nodes().map((n) => n.title)));
  s.check('it does not talk about boards', !/using board|which board/i.test(r), r);
  s.end();
}
if (run('b')) {
  const s = scenario('b. Two boards, the topic names one', twoBoards());
  const r = s.says('In the login feature, add a step: create the session.');
  s.check('the step landed on LOGIN', s.nodes('LOGIN').length >= 2, JSON.stringify(s.nodes('LOGIN').map((n) => n.title)));
  s.check('EXPORT is unchanged', s.nodes('EXPORT').length === 1, JSON.stringify(s.nodes('EXPORT').map((n) => n.title)));
  s.check('it says which board it used', /LOGIN/.test(r), r);
  s.end();
}
if (run('c')) {
  const s = scenario('c. Two boards, no clue which', twoBoards());
  const r = s.says('Add a step: send the confirmation email.');
  s.check('nothing was recorded', s.nodes('LOGIN').length === 1 && s.nodes('EXPORT').length === 1 && !wrote(s), s.ran.join(' | '));
  s.check('it asks which board and names both', /which board|which one/i.test(r) && /LOGIN/.test(r) && /EXPORT/.test(r), r);
  s.end();
}
if (run('d')) {
  const s = scenario('d. Two boards, the topic fits both', (x) => {
    x.board('init', 'Login');
    x.board('add', 'box', 'Validate input');
    x.board('init', 'Export report');
    x.board('add', 'box', 'Validate input');
  });
  const r = s.says('Under validate input, add a step: trim the whitespace.');
  s.check('nothing was recorded', s.nodes('LOGIN').length === 1 && s.nodes('EXPORT').length === 1 && !wrote(s), s.ran.join(' | '));
  s.check('it asks which board', /which board|which one|which of/i.test(r) && /LOGIN/.test(r) && /EXPORT/.test(r), r);
  s.end();
}
if (run('e')) {
  const s = scenario('e. A typed approve with two boards and no active board', twoBoards((x) => fs.rmSync(path.join(x.cwd, '.board/active'))));
  const r = s.says('/brick:approve b1');
  const states = [...s.nodes('LOGIN'), ...s.nodes('EXPORT')].map((n) => n.status);
  s.check('nothing was approved', states.every((t) => t === 'drafting'), JSON.stringify(states));
  s.check('it asks which board', /which (board|one)|board key|name the board|several|two boards/i.test(r), r);
  s.end();
}
if (run('f')) {
  const s = scenario('f. A second board is made in the chat, then you talk about it', (x) => { x.board('init', 'Login'); x.board('add', 'box', 'Check password'); });
  s.says('/brick:init export report to CSV');
  const r = s.says('The first step is reading the rows from the database.');
  s.check('the second board exists', fs.existsSync(path.join(s.cwd, '.board/boards/EXPORT/tree.json')), s.ran.join(' | '));
  s.check('the step landed on the new board', s.nodes('EXPORT').some((n) => /read/i.test(n.title)), JSON.stringify(s.nodes('EXPORT').map((n) => n.title)));
  s.check('LOGIN is unchanged', s.nodes('LOGIN').length === 1, JSON.stringify(s.nodes('LOGIN').map((n) => n.title)));
  s.end();
}

fs.writeFileSync(only ? OUT.replace('.md', `-${only}.md`) : OUT, `${transcript.join('\n')}\n`);
fs.rmSync(fakeBin, { recursive: true, force: true });
console.log(failed ? `${failed} check(s) failed. Transcript: ${OUT}` : `All checks passed. Transcript: ${OUT}`);
process.exit(failed ? 1 : 0);
