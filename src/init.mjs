// `board init`: creates the data folder, then sets up the project (gitignore, hooks, skill, PATH check).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { findProject, isLinkedWorktree, create, emptyData, TOOL_NAME, DATA_DIR } from './store.mjs';
import { seedDemo } from './demo.mjs';
import { renderQuiet } from './render.mjs';

const T = TOOL_NAME;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const USAGE = `Usage: ${T} init "<name>" [--input ".."] [--output ".."] [--demo]   or   ${T} init --update`;

// The three hook entries we add to .claude/settings.json (thin: the logic lives in `board guard`).
export const HOOKS = [
  { event: 'PreToolUse', matcher: 'Bash', command: `${T} guard bash` },
  { event: 'PreToolUse', matcher: 'Write|Edit|MultiEdit|NotebookEdit', command: `${T} guard write` },
  { event: 'SessionStart', matcher: null, command: `${T} guard session-start` },
];

// Reads .claude/settings.json. Returns {} if missing; throws if it is not valid JSON.
function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object');
    return parsed;
  } catch (e) {
    throw new Error(`${file} is not valid JSON (${e.message}). Nothing was changed. Fix or move that file, then run again.`);
  }
}

// Adds our hook entries to a settings object, keeping everything else. Returns how many were added.
export function mergeHooks(settings) {
  if (settings.hooks === undefined) settings.hooks = {};
  if (typeof settings.hooks !== 'object' || settings.hooks === null || Array.isArray(settings.hooks)) {
    throw new Error('"hooks" in .claude/settings.json is not an object. Nothing was changed.');
  }
  let added = 0;
  for (const h of HOOKS) {
    if (settings.hooks[h.event] === undefined) settings.hooks[h.event] = [];
    const groups = settings.hooks[h.event];
    if (!Array.isArray(groups)) throw new Error(`hooks.${h.event} in .claude/settings.json is not a list. Nothing was changed.`);
    const there = groups.some((g) => Array.isArray(g?.hooks) && g.hooks.some((x) => x?.command === h.command));
    if (there) continue;
    const group = { hooks: [{ type: 'command', command: h.command }] };
    if (h.matcher) group.matcher = h.matcher;
    groups.push(group);
    added += 1;
  }
  return added;
}

// Step: merge the hooks into the settings file.
function setupHooks(root, settings) {
  const file = path.join(root, '.claude', 'settings.json');
  const added = mergeHooks(settings);
  if (added) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  }
  return added ? `hooks: added ${added} entr${added === 1 ? 'y' : 'ies'} to .claude/settings.json` : 'hooks: already in .claude/settings.json';
}

// Step: make sure .board/ is in .gitignore.
function setupGitignore(root) {
  const file = path.join(root, '.gitignore');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (text.split(/\r?\n/).some((l) => l.trim() === `${DATA_DIR}/` || l.trim() === DATA_DIR)) return `.gitignore: already has ${DATA_DIR}/`;
  fs.writeFileSync(file, text + (text && !text.endsWith('\n') ? '\n' : '') + `${DATA_DIR}/\n`);
  return `.gitignore: added ${DATA_DIR}/`;
}

// Step: copy the decompose skill. A differing existing copy is kept unless --update.
function setupSkill(root, update) {
  const src = fs.readFileSync(path.join(HERE, '..', 'templates', 'SKILL.md'), 'utf8');
  const file = path.join(root, '.claude', 'skills', 'decompose', 'SKILL.md');
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') === src) return 'skill: up to date';
    if (!update) return `skill differs; run ${T} init --update to replace it`;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, src);
  return 'skill: copied to .claude/skills/decompose/SKILL.md';
}

// Step: warn when `board` is not on the PATH (the hooks would silently do nothing).
function checkPath() {
  try {
    execFileSync('sh', ['-c', `${T} help`], { stdio: 'ignore' });
    return `PATH: ${T} found`;
  } catch {
    return `WARNING: "${T}" is not on your PATH, so the hooks will not run and the guards are OFF. Run: npm link (in the ${T} tool's folder)`;
  }
}

// Runs the setup steps for a project root. Returns one line per step.
function setup(root, settings, update) {
  return [setupGitignore(root), setupHooks(root, settings), setupSkill(root, update), checkPath()];
}

// Creates .board/ with empty data and a default config; optionally seeds the demo; sets up the project.
export function initProject(cwd, argv) {
  let r;
  try {
    r = parseArgs({ args: argv, allowPositionals: true, strict: true,
      options: { input: { type: 'string' }, output: { type: 'string' }, demo: { type: 'boolean' }, update: { type: 'boolean' } } });
  } catch (e) {
    throw new Error(`${e.message}\n${USAGE}`);
  }
  const project = findProject(cwd);
  if (isLinkedWorktree(cwd)) throw new Error(`Run ${T} init in the main checkout: ${project.root}`);
  const settings = readSettings(path.join(project.root, '.claude', 'settings.json')); // before changing anything

  if (r.values.update) {
    if (r.positionals.length || r.values.demo || r.values.input || r.values.output) throw new Error(USAGE);
    if (!project.exists) throw new Error(`No ${DATA_DIR}/ here. Run: ${T} init "<name>"`);
    return ['updated (tree.json untouched)', ...setup(project.root, settings, true)].join('\n');
  }

  const name = (r.positionals[0] || '').trim();
  if (r.positionals.length !== 1 || !name) throw new Error(USAGE);
  if (fs.existsSync(project.dir)) throw new Error(`${DATA_DIR}/ already exists in ${project.root}.`);
  create(project.dir, emptyData(name, r.values.input || null, r.values.output || null));
  fs.writeFileSync(path.join(project.dir, 'config.json'), JSON.stringify({ openBrowserOnSessionStart: true }, null, 2) + '\n');
  if (r.values.demo) seedDemo(project.dir);
  renderQuiet(project.dir);
  const lines = [`created ${project.dir}${r.values.demo ? ' with the demo project' : ''}`, ...setup(project.root, settings, false)];
  lines.push(`${DATA_DIR}/ is gitignored, so git does not back it up. Copy it somewhere safe if you care about it.`);
  return lines.join('\n');
}
