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

test('the skills folder has exactly the eight stubs, decompose, discuss and sizing', () => {
  assert.deepEqual(fs.readdirSync(ROOT).sort(), [...STUBS, 'decompose', 'discuss', 'sizing'].sort());
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
    assert.match(body, /NEEDS/, name);
    assert.match(body, /Complete command/, name);
    assert.ok(!/--\w+/.test(front.description + front['argument-hint']), `${name}: no CLI flags in the usage`);
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
  assert.ok(!/--(why|note|by|input|output)\b/.test(body.replace(/board ai [^\n]*/g, '')), 'no flag-style slash commands');
  assert.match(body, /ask the user/i);
});

test('the old templates folder is gone', () => {
  assert.equal(fs.existsSync(path.resolve('templates')), false);
});

test('discuss is model-invocable, opt-in, and keeps the decision with the user', () => {
  const { front, body } = readSkill('discuss');
  assert.equal(front.name, 'discuss');
  assert.equal(front['disable-model-invocation'], undefined);
  assert.ok(front.description.length < 1000);
  assert.match(front.description, /opt-in/i);
  assert.match(body, /Ask once per point/);
  assert.match(body, /Do you want my suggestions/);
  assert.match(body, /In your own words/);
  assert.match(body, /Never slip an idea into the question/);
  assert.match(body, /two or three options/i);
  assert.match(body, /never how to fill it/);
  assert.ok(!/\bboard (approve|reopen|supersede|restore|resolve|dismiss|init)\b/.test(body));
});

test('decompose and init point at discuss; init asks one open question', () => {
  assert.match(readSkill('decompose').body, /discuss skill/);
  assert.match(readSkill('decompose').body, /board open/);
  const init = readSkill('init').body;
  assert.match(init, /discuss skill/);
  assert.match(init, /What do you want to solve, and how do you want to go about it\?/);
});

test('no decision command can be run by the model', () => {
  for (const name of ['init', 'approve', 'reopen', 'supersede', 'restore', 'resolve', 'dismiss']) {
    assert.equal(readSkill(name).front['disable-model-invocation'], 'true', name);
  }
});

test('sizing is model-invocable, runs board check, and states observations in both directions', () => {
  const { front, body } = readSkill('sizing');
  assert.equal(front.name, 'sizing');
  assert.equal(front['disable-model-invocation'], undefined);
  assert.ok(front.description.length < 1000);
  assert.match(body, /board check <id>/);
  assert.match(body, /can stay whole/);
  assert.match(body, /could be split/);
  assert.match(body, /Your call/);
  assert.match(body, /Never\nSay ready, approved, complete, done, or looks good/);
  assert.match(body, /about 3 to 9 boxes/);
  assert.ok(!/\bboard (approve|reopen|supersede|restore|resolve|dismiss|init)\b/.test(body));
});

test('decompose explains drafting on request and the gap sweep with kinds', () => {
  const { body } = readSkill('decompose');
  assert.match(body, /## Drafting on request/);
  assert.match(body, /--drafted --user-said/);
  assert.match(body, /Do not go deeper unless they ask again/);
  assert.match(body, /Want me to look for gaps in this draft\?/);
  assert.match(body, /--kind edge-case\|architecture\|assumption\|order\|other/);
  assert.match(body, /edge-case/);
  assert.match(body, /sizing skill/);
});
