import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp } from './helpers.mjs';

const ROOT = path.resolve('.');
const json = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

test('plugin.json and marketplace.json name the plugin brick', () => {
  const p = json('.claude-plugin/plugin.json');
  assert.equal(p.name, 'brick');
  assert.ok(p.version && p.description);
  const m = json('.claude-plugin/marketplace.json');
  assert.equal(m.name, 'brick');
  assert.ok(m.owner.name);
  assert.deepEqual(m.plugins.map((x) => [x.name, x.source]), [['brick', './']]);
});

test('hooks.json has exactly the four hooks, each calling the plugin copy of board', () => {
  const hooks = json('hooks/hooks.json').hooks;
  assert.deepEqual(Object.keys(hooks).sort(), ['PreToolUse', 'SessionStart', 'UserPromptExpansion']);
  const flat = [];
  for (const [event, groups] of Object.entries(hooks)) {
    for (const g of groups) for (const h of g.hooks) flat.push({ event, matcher: g.matcher, type: h.type, command: h.command });
  }
  assert.deepEqual(flat.map((h) => [h.event, h.matcher, h.command.split(' ').slice(-2).join(' ')]), [
    ['UserPromptExpansion', undefined, 'guard prompt'],
    ['PreToolUse', 'Bash', 'guard bash'],
    ['PreToolUse', 'Write|Edit|MultiEdit|NotebookEdit', 'guard write'],
    ['SessionStart', undefined, 'guard session-start'],
  ]);
  for (const h of flat) {
    assert.equal(h.type, 'command');
    assert.ok(h.command.includes('${CLAUDE_PLUGIN_ROOT}/bin/board.mjs'), h.command);
  }
});

test('every hook command runs and stays silent on an empty payload in a folder with no board', () => {
  const hooks = json('hooks/hooks.json').hooks;
  const cwd = tmp();
  for (const groups of Object.values(hooks)) {
    for (const g of groups) for (const h of g.hooks) {
      const cmd = h.command.replaceAll('${CLAUDE_PLUGIN_ROOT}', ROOT);
      const r = spawnSync('sh', ['-c', cmd], { input: '{}', encoding: 'utf8', cwd });
      assert.equal(r.status, 0, `${cmd}: ${r.stderr}`);
      assert.equal(r.stdout, '', cmd);
    }
  }
});
