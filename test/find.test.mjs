import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmp, git, gitRepo } from './helpers.mjs';
import { findProject, isLinkedWorktree } from '../src/store.mjs';

test('git repo: found from a subfolder', () => {
  const root = gitRepo();
  fs.mkdirSync(path.join(root, '.board'));
  fs.mkdirSync(path.join(root, 'src/deep'), { recursive: true });
  const p = findProject(path.join(root, 'src/deep'));
  assert.equal(p.root, root);
  assert.equal(p.dir, path.join(root, '.board'));
});

test('linked worktree resolves to the main checkout', () => {
  const root = gitRepo();
  fs.mkdirSync(path.join(root, '.board'));
  fs.writeFileSync(path.join(root, '.board/tree.json'), '{}');
  const wt = path.join(tmp(), 'wt');
  git(root, 'worktree', 'add', '-q', wt, '-b', 'feat');
  const p = findProject(wt);
  assert.equal(p.root, root);
  assert.equal(p.exists, true);
  assert.deepEqual(p.warnings, []);
  assert.equal(isLinkedWorktree(wt), true);
  assert.equal(isLinkedWorktree(root), false);
});

test('no git: walks up to find the data folder', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.board'));
  fs.mkdirSync(path.join(root, 'a/b'), { recursive: true });
  assert.equal(findProject(path.join(root, 'a/b')).dir, path.join(root, '.board'));
});

test('no git and no data folder: reports it does not exist', () => {
  const root = tmp();
  const p = findProject(root);
  assert.equal(p.exists, false);
  assert.equal(p.root, root);
});

test('a data folder inside a linked worktree is ignored with a warning', () => {
  const root = gitRepo();
  const wt = path.join(tmp(), 'wt');
  git(root, 'worktree', 'add', '-q', wt, '-b', 'feat');
  fs.mkdirSync(path.join(wt, '.board'));
  const p = findProject(wt);
  assert.equal(p.root, root);
  assert.equal(p.warnings.length, 1);
  assert.match(p.warnings[0], /Ignoring/);
});
