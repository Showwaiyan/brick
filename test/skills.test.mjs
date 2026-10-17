import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('skills');
const STUBS = ['init', 'approve', 'reopen', 'supersede', 'restore', 'resolve', 'dismiss', 'open'];

// Reads a skill file; returns { front: {key: value}, body }.
function readSkill(name) {
  const text = fs.readFileSync(path.join(ROOT, name, 'SKILL.md'), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${name}: frontmatter`);
  const front = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    front[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { front, body: m[2] };
}

test('the skills folder has exactly the eight stubs and decompose', () => {
  assert.deepEqual(fs.readdirSync(ROOT).sort(), [...STUBS, 'decompose'].sort());
});

test('every stub is human-only and tells the AI to report the hook line', () => {
  for (const name of STUBS) {
    const { front, body } = readSkill(name);
    assert.equal(front.name, name);
    assert.match(front.description, /^Human-only\./, name);
    assert.equal(front['disable-model-invocation'], 'true', name);
    assert.ok(front['argument-hint'] !== undefined, name);
    assert.ok(body.includes('[brick]'), name);
    assert.match(body, /Do not run any command/, name);
  }
});

test('decompose is model-invocable and names the slash commands', () => {
  const { front, body } = readSkill('decompose');
  assert.equal(front.name, 'decompose');
  assert.equal(front['disable-model-invocation'], undefined);
  assert.ok(front.description.length < 1000);
  for (const c of ['init', 'approve', 'reopen', 'supersede', 'restore', 'resolve', 'dismiss']) {
    assert.ok(body.includes(`/brick:${c}`), c);
  }
  for (const bad of ['board approve', 'board init', 'board reopen', 'board supersede']) {
    assert.ok(!body.includes(bad), bad);
  }
  assert.ok(body.includes('board ai gap'));
});

test('the old templates folder is gone', () => {
  assert.equal(fs.existsSync(path.resolve('templates')), false);
});
