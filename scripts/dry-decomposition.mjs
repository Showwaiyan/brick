// Scripted dry run of drafting, gap sweeps and sizing with a real Claude Code (needs the `claude` CLI). Not part of `npm test`.
// Run: node scripts/dry-decomposition.mjs [scenario letter]   (several minutes; writes docs/dry-run/decomposition.md)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BIN = path.join(ROOT, 'bin/board.mjs');
const OUT = path.join(ROOT, 'docs/dry-run/decomposition.md');
const only = process.argv[2];
const transcript = ['# Decomposition: scripted dry run', '', `Run on ${new Date().toISOString().slice(0, 10)} with a real Claude Code and the plugin from this checkout. Each scenario is a fresh project and session. "Ran" lists the board commands Claude ran.`, ''];
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
  board('init', 'Login');
  fs.writeFileSync(path.join(cwd, '.board/config.json'), '{"openBrowserOnSessionStart": false}');
  const data = () => JSON.parse(fs.readFileSync(path.join(cwd, '.board/boards/LOGIN/tree.json'), 'utf8'));
  transcript.push(`## ${title}`, '');
  const s = {
    cwd, board, data,
    nodes: () => Object.values(data().nodes),
    gaps: () => Object.values(data().gaps),
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
  return s;
}
const run = (letter) => !only || only === letter;
const ranCheck = (s) => s.ran.some((c) => /board check/.test(c));

if (run('a')) {
  const s = scenario('a. You ask the AI to break a box down', (x) => x.board('add', 'box', 'Check password', '--desc', 'Checks a username and password'));
  const r = s.says('Please break down check password for me.');
  const kids = s.nodes().filter((n) => n.parent === 'b1');
  s.check('it drafted at least two sub-problems under b1', kids.length >= 2, JSON.stringify(s.nodes().map((n) => [n.id, n.parent, n.source])));
  s.check('every one is marked as an AI draft with your request as the quote', kids.every((n) => n.source === 'ai-draft' && n.said.length), JSON.stringify(kids.map((n) => [n.source, n.said])));
  s.check('one level only, nothing approved', s.nodes().every((n) => (n.parent === null || n.parent === 'b1') && n.status !== 'approved'), JSON.stringify(s.nodes().map((n) => [n.id, n.parent, n.status])));
  s.check('it says they are drafts and offers to look for gaps', /draft/i.test(r) && /gaps/i.test(r), r);
  s.check('it raised no gaps unasked', s.gaps().length === 0, JSON.stringify(s.gaps()));
  s.end();
}
if (run('b')) {
  const s = scenario('b. You type your own sub-problems', (x) => x.board('add', 'box', 'Check password'));
  s.says('Break down check password: comparing the password hash, and rate-limiting attempts.');
  const kids = s.nodes().filter((n) => n.parent === 'b1');
  s.check('two sub-problems recorded', kids.length >= 2, JSON.stringify(kids));
  s.check('they are recorded as your words, not as AI drafts', kids.every((n) => n.source === 'ai-scribe'), JSON.stringify(kids.map((n) => n.source)));
  s.end();
}
if (run('c')) {
  const s = scenario('c. You describe a node and do not ask for a draft', (x) => x.board('add', 'box', 'Check password'));
  s.says('Check password takes the username and password and tells whether they match. I will break it down myself later.');
  s.check('no sub-problems were created', s.nodes().length === 1, JSON.stringify(s.nodes().map((n) => n.id)));
  s.end();
}
if (run('d')) {
  const s = scenario('d. You ask for gaps and edge cases', (x) => x.board('add', 'box', 'Check password', '--desc', 'Takes a username and password, compares the password with the stored hash, and starts a session if they match'));
  const r = s.says('What is missing in check password? Look for gaps and edge cases.');
  const gaps = s.gaps();
  const kinds = new Set(gaps.map((g) => g.kind).filter(Boolean));
  s.check('at least three gaps were recorded', gaps.length >= 3, JSON.stringify(gaps.map((g) => [g.kind, g.missing])));
  s.check('at least two different kinds, one of them an edge case', kinds.size >= 2 && kinds.has('edge-case'), JSON.stringify([...kinds]));
  s.check('no gap contains a fix', !gaps.some((g) => /you should|\bsuggest|\buse a\b|\badd a\b/i.test(g.missing)), JSON.stringify(gaps.map((g) => g.missing)));
  s.check('it reports what it found', gaps.length === 0 || /gap|missing|edge/i.test(r), r);
  s.end();
}
if (run('e')) {
  const s = scenario('e. A node with two purposes', (x) => {
    x.board('add', 'box', 'Check password');
    x.board('add', 'problem', 'Hash the password and rate-limit attempts', '--parent', 'b1', '--input', 'username and password', '--output', 'allowed or blocked', '--check', 'known pairs pass; six wrong tries are blocked');
  });
  const r = s.says('I have described p1: it hashes the password and compares it, and it also counts failed attempts and blocks after five. Is it small enough?');
  s.check('it ran board check', ranCheck(s), s.ran.join(' | '));
  s.check('it says it could be split, as an observation', /(two|2) (purposes|things|jobs|responsibilities)|could be split|split/i.test(r), r);
  s.check('it leaves the decision to you and avoids the forbidden words', /your call|up to you|you decide/i.test(r) && !FORBIDDEN.test(r), r);
  s.check('it did not split it unasked', s.nodes().length === 2, JSON.stringify(s.nodes().map((n) => n.id)));
  s.end();
}
if (run('f')) {
  const s = scenario('f. A well-formed leaf', (x) => {
    x.board('add', 'box', 'Check password');
    x.board('add', 'problem', 'Compare password hash', '--parent', 'b1', '--input', 'the stored hash and the password', '--output', 'yes or no', '--check', 'known matching and non-matching pairs');
  });
  const r = s.says('I have finished describing p1, Compare password hash. Is it small enough, or should I split it?');
  s.check('it ran board check', ranCheck(s), s.ran.join(' | '));
  s.check('it says it can stay whole, by the checks', /stay whole|can stay|no need to split|does not need/i.test(r), r);
  s.check('it avoids the forbidden words and leaves the decision to you', !FORBIDDEN.test(r) && /your call|up to you|you decide/i.test(r), r);
  s.end();
}
if (run('g')) {
  const s = scenario('g. You ask the AI to draft the flow', (x) => x.board('project', '--input', 'a username and password', '--output', 'the person is logged in'));
  const r = s.says('Draft the flow for me, from the username and password to the person being logged in.');
  const boxes = s.nodes().filter((n) => n.kind === 'box');
  s.check('it drafted at least three boxes', boxes.length >= 3, JSON.stringify(boxes.map((n) => [n.id, n.title, n.source])));
  s.check('they are AI drafts, none approved', boxes.every((n) => n.source === 'ai-draft' && n.status === 'drafting'), JSON.stringify(boxes.map((n) => [n.source, n.status])));
  s.check('it says they are drafts', /draft/i.test(r), r);
  s.end();
}

fs.writeFileSync(only ? OUT.replace('.md', `-${only}.md`) : OUT, `${transcript.join('\n')}\n`);
fs.rmSync(fakeBin, { recursive: true, force: true });
console.log(failed ? `${failed} check(s) failed. Transcript: ${OUT}` : `All checks passed. Transcript: ${OUT}`);
process.exit(failed ? 1 : 0);
