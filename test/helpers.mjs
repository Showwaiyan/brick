// Shared test helpers: temp dirs, git repos, small sample data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Makes an empty temp folder (realpath'd so paths compare equal).
export function tmp() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brick-')));
}

// Runs git in a folder with a fixed identity.
export function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' }).toString().trim();
}

// A temp git repo with one commit.
export function gitRepo() {
  const dir = tmp();
  git(dir, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}

// Builds a node with sensible defaults.
export function node(id, over = {}) {
  const kind = id[0] === 'b' ? 'box' : 'problem';
  return {
    id, kind, parent: null, order: 1, title: id, description: '',
    contract: { input: null, output: null, check: null, limits: null },
    status: 'drafting', domain: 'software', source: 'human', said: [],
    superseded: null, created_at: 'x', updated_at: 'x', ...over,
  };
}

// Small valid tree: b1 (approved) > p1 (approved), p2 (drafting, gap g1); b2 drafting.
export function sample() {
  return {
    version: 1,
    project: { name: 't', input: null, output: null, created_at: 'x' },
    counters: { b: 2, p: 2, g: 1 },
    nodes: {
      b1: node('b1', { status: 'approved' }),
      p1: node('p1', { parent: 'b1', status: 'approved' }),
      p2: node('p2', { parent: 'b1', order: 2 }),
      b2: node('b2', { order: 2 }),
    },
    gaps: { g1: { id: 'g1', node: 'p2', missing: 'm', where: null, status: 'open', raised_at: 'x', closed_at: null, note: null } },
    events: [],
  };
}
