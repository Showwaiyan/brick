import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, newBoard } from './helpers.mjs';
import { execute } from '../src/commands.mjs';
import { load } from '../src/store.mjs';
import { safeJson, pageData } from '../src/render.mjs';
import { openFile } from '../src/open.mjs';

const EVIL = '</script><img src=x onerror=alert(1)>';

// Pulls the two <script> bodies out of a rendered page.
function scripts(html) {
  const data = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  const code = html.match(/<\/script>\s*<script>\n([\s\S]*?)<\/script>/)[1];
  return { data, code };
}

test('embedded data cannot break out of the script tag', async () => {
  const dir = await newBoard(EVIL);
  execute(dir, ['add', 'box', EVIL, '--desc', `a b c ${EVIL}`]);
  const html = fs.readFileSync(path.join(dir, 'tree.html'), 'utf8');
  assert.equal(html.split('</script').length - 1, 2, 'only our own two closing tags');
  assert.ok(!html.includes('<img src=x'));
  const { data } = scripts(html);
  assert.ok(!data.includes(' ') && !data.includes(' ') && !data.includes('<'));
  const parsed = JSON.parse(data);
  assert.equal(parsed.nodes.b1.title, EVIL);
  assert.equal(parsed.project.name, EVIL);
  assert.match(html, /<title>&lt;\/script&gt;/);
});

test('safeJson escapes <, U+2028 and U+2029', () => {
  const out = safeJson({ a: `<${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}` });
  assert.equal(out, '{"a":"\\u003c\\u2028\\u2029"}');
});

test('the page is offline and safe: no URLs, no fetch, no innerHTML, scripts parse', async () => {
  const dir = path.join(tmp(), 'x');
  fs.mkdirSync(dir);
  const r = spawnSync('node', [path.resolve('bin/board.mjs'), 'init', 'User login', '--demo'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const html = fs.readFileSync(path.join(dir, '.board/tree.html'), 'utf8');
  assert.ok(!/https?:\/\//.test(html));
  assert.ok(!html.includes('fetch('));
  assert.ok(!html.includes('<link') && !html.includes(' src='));
  const js = fs.readFileSync(path.resolve('src/page.js'), 'utf8');
  assert.ok(!js.includes('innerHTML'));
  const file = path.join(tmp(), 'embedded.js');
  fs.writeFileSync(file, scripts(html).code);
  const check = spawnSync('node', ['--check', file], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
});

test('every mutating command re-renders tree.html; render failure only warns', async () => {
  const dir = await newBoard();
  execute(dir, ['add', 'box', 'One']);
  const file = path.join(dir, 'tree.html');
  assert.match(fs.readFileSync(file, 'utf8'), /One/);
  fs.rmSync(file);
  fs.mkdirSync(file); // a folder in the way makes the rename fail
  const out = execute(dir, ['add', 'box', 'Two']);
  assert.equal(out, 'added b2');
  assert.equal(load(dir).nodes.b2.title, 'Two', 'data was saved');
});

test('pageData carries states, commands, counts and history for the page', async () => {
  const dir = await newBoard('P');
  execute(dir, ['add', 'box', 'One']);
  execute(dir, ['add', 'problem', 'Leaf', '--parent', 'b1']);
  const p = pageData(load(dir), 'T');
  assert.deepEqual(p.roots, ['b1']);
  assert.equal(p.nodes.b1.active_children, 1);
  assert.equal(p.nodes.p1.state, 'drafting');
  assert.deepEqual(p.counts, { approved: 0, drafting: 2, superseded: 0, open_gaps: 0 });
  assert.ok(p.nodes.p1.next_commands.includes('/brick:approve p1'));
  assert.equal(p.nodes.p1.history[0].action, 'add');
  assert.equal(p.generated_at, 'T');
});

test('render and open commands; open never throws', async () => {
  const dir = await newBoard();
  assert.match(execute(dir, ['render']), /^rendered .*tree\.html$/);
  assert.equal(openFile('/x', () => ({ status: 0 })), true);
  assert.equal(openFile('/x', () => ({ status: 1 })), false);
  assert.equal(openFile('/x', () => ({ error: new Error('no') })), false);
  assert.equal(openFile('/x', () => { throw new Error('boom'); }), false);
});
