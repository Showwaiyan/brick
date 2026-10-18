import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp } from './helpers.mjs';
import { load } from '../src/store.mjs';
import { displayState, children, openGaps } from '../src/model.mjs';

test('the demo matches section 12', () => {
  const dir = tmp();
  const r = spawnSync('node', [path.resolve('bin/board.mjs'), 'init', 'User login', '--demo'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const d = load(path.join(dir, '.board/boards/USER'));
  assert.equal(d.project.input, 'username + password');
  assert.equal(d.project.output, 'logged in');
  const states = Object.fromEntries(Object.keys(d.nodes).map((id) => [id, displayState(d, id)]));
  assert.deepEqual(states, { b1: 'approved', p1: 'approved', p2: 'approved', b2: 'approved', p3: 'approved',
    b3: 'has_gaps', p4: 'approved', p5: 'drafting', b4: 'drafting', b5: 'superseded' });
  assert.deepEqual(children(d, null).map((n) => n.id), ['b1', 'b2', 'b5', 'b3', 'b4']);
  assert.deepEqual(children(d, 'b3').map((n) => n.id), ['p4', 'p5']);
  assert.equal(d.nodes.b5.superseded.by, 'b2');
  assert.equal(d.nodes.b5.superseded.reason, 'Dropped OAuth: the client only needs a password.');
  assert.equal(openGaps(d, 'b3')[0].missing, 'Nothing says what happens when the username does not exist.');
  for (const id of ['p1', 'p2', 'p3', 'p4']) assert.ok(d.nodes[id].contract.check, id);
});
