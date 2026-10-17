// `board init`: creates the data folder and the .gitignore line. Hooks and skills ship with the plugin.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findProject, isLinkedWorktree, create, emptyData, TOOL_NAME, DATA_DIR } from './store.mjs';
import { seedDemo } from './demo.mjs';
import { renderQuiet } from './render.mjs';

const T = TOOL_NAME;
const USAGE = `Usage: ${T} init "<name>" [--input ".."] [--output ".."] [--demo]`;

// Makes sure .board/ is in the project's .gitignore. Returns one line saying what happened.
function setupGitignore(root) {
  const file = path.join(root, '.gitignore');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (text.split(/\r?\n/).some((l) => l.trim() === `${DATA_DIR}/` || l.trim() === DATA_DIR)) return `.gitignore: already has ${DATA_DIR}/`;
  fs.writeFileSync(file, text + (text && !text.endsWith('\n') ? '\n' : '') + `${DATA_DIR}/\n`);
  return `.gitignore: added ${DATA_DIR}/`;
}

// Creates .board/ with empty data and a default config; optionally seeds the demo.
export function initProject(cwd, argv) {
  let r;
  try {
    r = parseArgs({ args: argv, allowPositionals: true, strict: true,
      options: { input: { type: 'string' }, output: { type: 'string' }, demo: { type: 'boolean' } } });
  } catch (e) {
    throw new Error(`${e.message}\n${USAGE}`);
  }
  const name = (r.positionals[0] || '').trim();
  if (r.positionals.length !== 1 || !name) throw new Error(USAGE);
  const project = findProject(cwd);
  if (isLinkedWorktree(cwd)) throw new Error(`Run ${T} init in the main checkout: ${project.root}`);
  if (fs.existsSync(project.dir)) throw new Error(`${DATA_DIR}/ already exists in ${project.root}.`);
  create(project.dir, emptyData(name, r.values.input || null, r.values.output || null));
  fs.writeFileSync(path.join(project.dir, 'config.json'), JSON.stringify({ openBrowserOnSessionStart: true }, null, 2) + '\n');
  if (r.values.demo) seedDemo(project.dir);
  renderQuiet(project.dir);
  return [
    `created ${project.dir}${r.values.demo ? ' with the demo project' : ''}`,
    setupGitignore(project.root),
    `${DATA_DIR}/ is gitignored, so git does not back it up. Copy it somewhere safe if you care about it.`,
  ].join('\n');
}
