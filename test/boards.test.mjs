import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmp, gitRepo } from './helpers.mjs';
import { create, load, emptyData, createBoard, listBoards, activeKey, setActive, migrateLegacy, findProject } from '../src/store.mjs';

const board = (name, key) => emptyData(name, null, null, 'now', key);
const dataDir = () => path.join(tmp(), '.board');
const legacy = (dir, name = 'Login', key = null) => { create(dir, board(name, key)); fs.writeFileSync(path.join(dir, 'tree.html'), '<html></html>'); };

test('createBoard writes boards/<KEY>/tree.json and refuses a taken key', () => {
  const dir = dataDir();
  const where = createBoard(dir, board('Login', 'LOGIN'));
  assert.equal(where, path.join(dir, 'boards', 'LOGIN'));
  assert.equal(load(where).project.key, 'LOGIN');
  assert.throws(() => createBoard(dir, board('Other', 'LOGIN')), /already exists/);
  assert.throws(() => createBoard(dir, board('Bad', 'login x')), /key/i);
});

test('listBoards is sorted by key and ignores folders without a tree.json', () => {
  const dir = dataDir();
  createBoard(dir, board('Login', 'LOGIN'));
  createBoard(dir, board('Export', 'EXPORT'));
  fs.mkdirSync(path.join(dir, 'boards', 'EMPTY'));
  assert.deepEqual(listBoards(dir).map((b) => b.key), ['EXPORT', 'LOGIN']);
  assert.deepEqual(listBoards(path.join(tmp(), '.board')), []);
});

test('the active board is a pointer that must name a board that exists', () => {
  const dir = dataDir();
  createBoard(dir, board('Login', 'LOGIN'));
  assert.equal(activeKey(dir), null);
  setActive(dir, 'LOGIN');
  assert.equal(activeKey(dir), 'LOGIN');
  fs.writeFileSync(path.join(dir, 'active'), 'GONE\n');
  assert.equal(activeKey(dir), null);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['active', 'boards']);
});

test('a legacy board is moved into boards/<KEY>/ with a key, once', () => {
  const dir = dataDir();
  legacy(dir);
  fs.writeFileSync(path.join(dir, 'config.json'), '{}');
  const before = JSON.parse(fs.readFileSync(path.join(dir, 'tree.json'), 'utf8'));
  assert.equal(migrateLegacy(dir), 'LOGIN');
  const moved = JSON.parse(fs.readFileSync(path.join(dir, 'boards/LOGIN/tree.json'), 'utf8'));
  assert.deepEqual({ ...moved, project: { ...moved.project, key: undefined } }, { ...before, project: { ...before.project, key: undefined } });
  assert.equal(moved.project.key, 'LOGIN');
  assert.ok(fs.existsSync(path.join(dir, 'boards/LOGIN/tree.html')));
  assert.equal(fs.existsSync(path.join(dir, 'tree.json')), false);
  assert.ok(fs.existsSync(path.join(dir, 'config.json')));
  assert.equal(migrateLegacy(dir), null);
});

test('migration keeps a key the file already has, and picks another on a clash', () => {
  const a = dataDir();
  legacy(a, 'Whatever', 'KEEP');
  assert.equal(migrateLegacy(a), 'KEEP');
  const b = dataDir();
  legacy(b, 'Login');
  createBoard(b, board('Other', 'LOGIN'));
  assert.equal(migrateLegacy(b), 'LOGIN2');
  const c = dataDir();
  legacy(c, 'Login', 'LOGIN');
  createBoard(c, board('Other', 'LOGIN'));
  assert.throws(() => migrateLegacy(c), /already exists/);
  assert.ok(fs.existsSync(path.join(c, 'tree.json')));
});

test('a corrupt legacy tree.json is reported and left where it is', () => {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tree.json'), '{ nope');
  assert.throws(() => migrateLegacy(dir), /not valid/);
  assert.equal(fs.readFileSync(path.join(dir, 'tree.json'), 'utf8'), '{ nope');
  assert.deepEqual(fs.readdirSync(dir), ['tree.json']);
});

test('findProject says a board exists for the old layout and the new one, not for an empty folder', () => {
  const root = gitRepo();
  const dir = path.join(root, '.board');
  assert.equal(findProject(root).exists, false);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'config.json'), '{}');
  assert.equal(findProject(root).exists, false);
  create(dir, board('Login'));
  assert.equal(findProject(root).exists, true);
  fs.rmSync(path.join(dir, 'tree.json'));
  createBoard(dir, board('Login', 'LOGIN'));
  assert.equal(findProject(root).exists, true);
});
