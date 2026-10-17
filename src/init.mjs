// `board init`: creates the data folder (M2 does only this; hooks and skill come later).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findProject, isLinkedWorktree, create, emptyData, TOOL_NAME, DATA_DIR } from './store.mjs';
import { seedDemo } from './demo.mjs';

// Creates .board/ with empty data and a default config; optionally seeds the demo.
export function initProject(cwd, argv) {
  let r;
  try {
    r = parseArgs({ args: argv, allowPositionals: true, strict: true,
      options: { input: { type: 'string' }, output: { type: 'string' }, demo: { type: 'boolean' } } });
  } catch (e) {
    throw new Error(`${e.message}\nUsage: ${TOOL_NAME} init "<name>" [--input ".."] [--output ".."] [--demo]`);
  }
  const name = (r.positionals[0] || '').trim();
  if (r.positionals.length !== 1 || !name) throw new Error(`Usage: ${TOOL_NAME} init "<name>" [--input ".."] [--output ".."] [--demo]`);
  const project = findProject(cwd);
  if (isLinkedWorktree(cwd)) throw new Error(`Run ${TOOL_NAME} init in the main checkout: ${project.root}`);
  if (fs.existsSync(project.dir)) throw new Error(`${DATA_DIR}/ already exists in ${project.root}.`);
  create(project.dir, emptyData(name, r.values.input || null, r.values.output || null));
  fs.writeFileSync(path.join(project.dir, 'config.json'), JSON.stringify({ openBrowserOnSessionStart: true }, null, 2) + '\n');
  if (r.values.demo) seedDemo(project.dir);
  return `created ${project.dir}${r.values.demo ? ' with the demo project' : ''}`;
}
