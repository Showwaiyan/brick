// Scripted dry run of "code seen" with a real Claude Code (needs the `claude` CLI). Not part of `npm test`.
// Run: node scripts/dry-codeseen.mjs [scenario letter]   (RUNS=3 by default; takes a long time; writes docs/dry-run/codeseen.md)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BIN = path.join(ROOT, 'bin/board.mjs');
const OUT = path.join(ROOT, 'docs/dry-run/codeseen.md');
const only = process.argv[2];
const RUNS = Number(process.env.RUNS || 3);
const transcript = ['# Code seen: scripted dry run', '', `Run on ${new Date().toISOString().slice(0, 10)} with a real Claude Code and the plugin from this checkout, ${RUNS} runs per scenario. Each run is a fresh repo and session. "Ran" lists the board commands Claude ran.`, ''];
const rates = {};

const fakeBin = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brick-fake-')));
fs.writeFileSync(path.join(fakeBin, 'open'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
const env = { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` };

// A repo with a small Express app: a users module, an auth route stub and a package.json.
function fixture(cwd, { empty = false } = {}) {
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'app', dependencies: empty ? {} : { express: '^4.19.0' } }, null, 2));
  if (empty) return;
  fs.mkdirSync(path.join(cwd, 'src/db'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'src/routes'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src/db/users.js'), '// users table access\nexport const users = new Map();\nexport const findByEmail = (email) => [...users.values()].find((u) => u.email === email) ?? null;\n');
  fs.writeFileSync(path.join(cwd, 'src/routes/auth.js'), "import { Router } from 'express';\nexport const auth = Router();\n// no handlers yet\n");
}

function scenario(letter, title, setup, body) {
  if (only && only !== letter) return;
  let passed = 0;
  transcript.push(`## ${title}`, '');
  for (let run = 1; run <= RUNS; run++) {
    const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brick-seen-')));
    const session = crypto.randomUUID();
    let turns = 0;
    let failed = 0;
    const sh = (cmd, args) => spawnSync(cmd, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    sh('git', ['init', '-q']);
    const s = {
      cwd,
      board: (...args) => sh('node', [BIN, ...args]),
      data: (key = 'LOGIN') => JSON.parse(fs.readFileSync(path.join(cwd, `.board/boards/${key}/tree.json`), 'utf8')),
      ran: [],
      says(prompt) {
        const args = ['-p', prompt, '--plugin-dir', ROOT, '--allowedTools', 'Bash,Skill,Read,Grep,Glob', '--max-turns', '24', '--output-format', 'stream-json', '--verbose',
          ...(turns === 0 ? ['--session-id', session] : ['--resume', session])];
        turns += 1;
        const r = spawnSync('claude', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
        let reply = '';
        s.ran = [];
        for (const line of (r.stdout || '').split('\n')) {
          let j; try { j = JSON.parse(line); } catch { continue; }
          for (const c of (Array.isArray(j.message?.content) ? j.message.content : [])) {
            if (c.type === 'tool_use' && c.name === 'Bash' && /\bboard\b/.test(c.input?.command || '')) s.ran.push(c.input.command.replace(/\s+/g, ' ').slice(0, 200));
            if (c.type === 'tool_use' && ['Read', 'Grep', 'Glob'].includes(c.name)) s.ran.push(`${c.name} ${c.input?.file_path || c.input?.pattern || ''}`.slice(0, 120));
            if (c.type === 'tool_use' && c.name === 'Skill') s.ran.push(`Skill ${c.input?.skill}`);
          }
          if (j.type === 'result') reply = String(j.result || '').trim();
        }
        reply = reply || `(no output) ${r.stderr}`;
        transcript.push(`**You:** ${prompt}`, '', `_Ran:_ ${s.ran.length ? s.ran.join(' | ') : '(nothing)'}`, '', ...reply.split('\n').map((l) => `> ${l}`), '');
        return reply;
      },
      check(label, ok, detail = '') {
        console.log(`${ok ? 'OK  ' : 'FAIL'} [${letter}${run}] ${label}${ok ? '' : `\n     ${String(detail).slice(0, 500)}`}`);
        transcript.push(`- ${ok ? 'PASS' : 'FAIL'}: ${label}`);
        if (!ok) failed += 1;
      },
    };
    transcript.push(`### Run ${run}`, '');
    setup(s);
    if (fs.existsSync(path.join(cwd, '.board'))) fs.writeFileSync(path.join(cwd, '.board/config.json'), '{"openBrowserOnSessionStart": false}');
    body(s);
    if (!failed) passed += 1;
    transcript.push('');
    fs.rmSync(cwd, { recursive: true, force: true });
  }
  rates[title] = `${passed} of ${RUNS}`;
  console.log(`== ${title}: ${passed} of ${RUNS}`);
}

const notes = (d) => Object.values(d.seen || {});
const pathsExist = (s, list) => list.every((n) => fs.existsSync(path.join(s.cwd, n.path)));
const ranSeen = (s) => s.ran.some((c) => /board ai seen/.test(c));

scenario('a', 'a. After /brick:init, notes are recorded for the related code and the user is told', (s) => fixture(s.cwd), (s) => {
  const r = s.says('/brick:init Login');
  const d = s.data();
  s.check('at least one project-level note, with a path that exists', notes(d).some((n) => n.node === null) && pathsExist(s, notes(d)), JSON.stringify(notes(d)));
  s.check('the reply says what it found (names the users module or the auth route)', /users|findByEmail|auth/i.test(r), r);
  s.check('a short title was set', !!d.project.title, JSON.stringify(d.project));
});

scenario('b', 'b. A requested draft is based on the code, with notes on the nodes', (s) => { fixture(s.cwd); s.board('init', 'Login'); }, (s) => {
  const r = s.says('Break the login flow down for me.');
  const d = s.data();
  s.check('boxes were drafted', Object.keys(d.nodes).length >= 1, JSON.stringify(Object.values(d.nodes).map((n) => n.title)));
  s.check('a note was recorded', notes(d).length >= 1 && pathsExist(s, notes(d)), s.ran.join(' | '));
  s.check('the reply says what the draft is based on', /users|findByEmail|auth\.js|existing|already/i.test(r), r);
});

scenario('c', 'c. A step that duplicates existing code gets a gap that points at the note', (s) => {
  fixture(s.cwd);
  s.board('init', 'Login');
  s.board('ai', 'seen', '--path', 'src/db/users.js', '--note', 'users store and findByEmail() already exist');
  s.board('add', 'box', 'Create the users table');
}, (s) => {
  const r = s.says('What is missing in "Create the users table"? Look for gaps.');
  const gaps = Object.values(s.data().gaps);
  s.check('a gap was raised', gaps.length >= 1, s.ran.join(' | '));
  s.check('a gap points at a note', gaps.some((g) => g.seen), JSON.stringify(gaps));
  s.check('the reply does not call it ready or give the fix as an order', !/\b(ready|looks good)\b/i.test(r) && !/you should/i.test(r), r);
});

scenario('d', 'd. An empty repo: no notes, and it says so', (s) => fixture(s.cwd, { empty: true }), (s) => {
  const r = s.says('/brick:init Login');
  const d = s.data();
  s.check('no notes were recorded', notes(d).length === 0, JSON.stringify(notes(d)));
  s.check('it says there is no related code', /no (existing |related |relevant )?(code|source|files)|nothing (yet|there|to)|empty|fresh|from scratch|greenfield/i.test(r), r);
});

scenario('e', 'e. A note whose file is gone makes it look again', (s) => {
  fixture(s.cwd);
  s.board('init', 'Login');
  s.board('ai', 'seen', '--path', 'src/db/users.js', '--note', 'users store and findByEmail() already exist');
  s.board('add', 'box', 'Look up the user');
  fs.rmSync(path.join(s.cwd, 'src/db/users.js'));
}, (s) => {
  const r = s.says('Continue with "Look up the user": what is missing?');
  s.check('it read the board notes', s.ran.some((c) => /board (show|ls|brief)/.test(c)), s.ran.join(' | '));
  s.check('it noticed the file is gone, or looked at the code again', /gone|deleted|no longer|removed|moved|renamed|missing file/i.test(r) || ranSeen(s) || s.ran.some((c) => /^(Read|Grep|Glob)/.test(c)), r);
});

transcript.push('## Summary', '', ...Object.entries(rates).map(([k, v]) => `- ${k}: ${v}`), '');
fs.writeFileSync(only ? OUT.replace('.md', `-${only}.md`) : OUT, `${transcript.join('\n')}\n`);
fs.rmSync(fakeBin, { recursive: true, force: true });
console.log(Object.entries(rates).map(([k, v]) => `${k}: ${v}`).join('\n'));
