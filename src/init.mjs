// `board init`: creates the data folder and the .gitignore line. Hooks and skills ship with the plugin.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findProject, isLinkedWorktree, createBoard, emptyData, listBoards, migrateLegacy, setActive, TOOL_NAME, DATA_DIR } from './store.mjs';
import { deriveKey, KEY_RE } from './ids.mjs';
import { seedDemo } from './demo.mjs';
import { renderQuiet } from './render.mjs';

const T = TOOL_NAME;
const USAGE = `Usage: ${T} init "<name>" [--key KEY] [--input ".."] [--output ".."] [--demo]`;

// Makes sure .board/ is in the project's .gitignore. Returns one line saying what happened.
function setupGitignore(root) {
  const file = path.join(root, '.gitignore');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (text.split(/\r?\n/).some((l) => l.trim() === `${DATA_DIR}/` || l.trim() === DATA_DIR)) return `.gitignore: already has ${DATA_DIR}/`;
  fs.writeFileSync(file, text + (text && !text.endsWith('\n') ? '\n' : '') + `${DATA_DIR}/\n`);
  return `.gitignore: added ${DATA_DIR}/`;
}

// Creates a board in .board/boards/<KEY>/ (the first one also creates .board/ and its config); optionally seeds the demo.
export function initProject(cwd, argv) {
  let r;
  try {
    r = parseArgs({ args: argv, allowPositionals: true, strict: true,
      options: { key: { type: 'string' }, input: { type: 'string' }, output: { type: 'string' }, demo: { type: 'boolean' } } });
  } catch (e) {
    throw new Error(`${e.message}\n${USAGE}`);
  }
  const name = (r.positionals[0] || '').trim();
  if (r.positionals.length !== 1 || !name) throw new Error(USAGE);
  const project = findProject(cwd);
  if (isLinkedWorktree(cwd)) throw new Error(`Run ${T} init in the main checkout: ${project.root}`);
  if (fs.existsSync(project.dir)) migrateLegacy(project.dir);
  const taken = listBoards(project.dir).map((b) => b.key);
  const key = r.values.key === undefined ? deriveKey(name, taken) : r.values.key.toUpperCase();
  if (!KEY_RE.test(key)) throw new Error(`"${r.values.key}" is not a board key. Use 2 to 6 capital letters or digits, starting with a letter.`);
  const dir = createBoard(project.dir, emptyData(name, r.values.input || null, r.values.output || null, undefined, key));
  const config = path.join(project.dir, 'config.json');
  if (!fs.existsSync(config)) fs.writeFileSync(config, JSON.stringify({ openBrowserOnSessionStart: true }, null, 2) + '\n');
  setActive(project.dir, key);
  if (r.values.demo) seedDemo(dir);
  renderQuiet(dir);
  return [
    `created board ${key} ("${name}") in ${project.dir}${r.values.demo ? ' with the demo project' : ''}`,
    `Its ids start with ${key}-, for example ${key}-b1. It is now the active board.`,
    setupGitignore(project.root),
    `${DATA_DIR}/ is gitignored, so git does not back it up. Copy it somewhere safe if you care about it.`,
  ].join('\n');
}
