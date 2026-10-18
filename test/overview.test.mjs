import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp } from './helpers.mjs';
import { overviewHtml, renderOverview } from '../src/overview.mjs';

const BIN = path.resolve('bin/board.mjs');
const run = (cwd, ...a) => spawnSync('node', [BIN, ...a], { cwd, encoding: 'utf8' });
const card = (key, name, over = {}) => ({ key, name, counts: { approved: 2, drafting: 1, has_gaps: 1, superseded: 0 }, open_gaps: 1, broken: null, ...over });

test('one card per board: key, name, counts and a link to its page; the active one is marked', () => {
  const html = overviewHtml([card('EXPORT', 'Export report'), card('LOGIN', 'Login', { open_gaps: 0 })], 'LOGIN');
  assert.match(html, /href="boards\/EXPORT\/tree\.html"/);
  assert.match(html, /href="boards\/LOGIN\/tree\.html"/);
  assert.match(html, /Export report/);
  assert.match(html, /2 approved · 2 drafting · 1 open gap\b/);
  assert.match(html, /2 approved · 2 drafting · 0 open gaps/);
  assert.equal((html.match(/Active/g) || []).length, 1);
  assert.match(html, /LOGIN[^<]*· Active/);
});

test('the overview is offline and safe: no script, no URLs, names escaped', () => {
  const html = overviewHtml([card('EVIL', '<img src=x onerror=alert(1)>')], null);
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img/);
  assert.ok(!/<script/i.test(html));
  assert.ok(!/https?:\/\//.test(html));
});

test('no boards, and a board that cannot be read', () => {
  assert.match(overviewHtml([], null), /No boards yet/);
  const html = overviewHtml([card('BAD', null, { broken: 'tree.json is invalid' })], null);
  assert.match(html, /cannot be read/);
  assert.ok(!html.includes('href="boards/BAD'));
});

test('renderOverview writes index.html next to the boards, with no temp file left', () => {
  const cwd = tmp();
  run(cwd, 'init', 'Login');
  run(cwd, 'init', 'Export report');
  const file = renderOverview(path.join(cwd, '.board'));
  assert.equal(file, path.join(cwd, '.board', 'index.html'));
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /boards\/EXPORT\/tree\.html/);
  assert.match(html, /boards\/LOGIN\/tree\.html/);
  assert.deepEqual(fs.readdirSync(path.join(cwd, '.board')).filter((f) => f.endsWith('.tmp')), []);
});

test('any change to a board refreshes the overview', () => {
  const cwd = tmp();
  run(cwd, 'init', 'Login');
  run(cwd, 'init', 'Export report');
  assert.match(fs.readFileSync(path.join(cwd, '.board/index.html'), 'utf8'), /LOGIN[^]*0 approved · 0 drafting/);
  run(cwd, 'add', 'box', 'One', '--board', 'LOGIN');
  assert.match(fs.readFileSync(path.join(cwd, '.board/index.html'), 'utf8'), /Login[^]*0 approved · 1 drafting/);
});

test('open --all opens the overview; with several boards and none active, plain open does too', () => {
  const cwd = tmp();
  const bin = tmp();
  fs.writeFileSync(path.join(bin, 'open'), '#!/bin/sh\necho "$@" >> "$OPENED"\n', { mode: 0o755 });
  const opened = path.join(tmp(), 'opened.txt');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, OPENED: opened };
  const go = (...a) => spawnSync('node', [BIN, ...a], { cwd, encoding: 'utf8', env });
  go('init', 'Login');
  go('init', 'Export report');
  go('open', '--all');
  assert.match(fs.readFileSync(opened, 'utf8'), /\.board\/index\.html\n$/);
  go('open');
  assert.match(fs.readFileSync(opened, 'utf8').trim().split('\n').pop(), /boards\/EXPORT\/tree\.html$/);
  fs.rmSync(path.join(cwd, '.board/active'));
  go('open');
  assert.match(fs.readFileSync(opened, 'utf8').trim().split('\n').pop(), /\.board\/index\.html$/);
});
