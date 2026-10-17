// The guards. Pure functions that decide; `board guard ...` reads stdin and exits with the result.
// They stop accidents and drift. They are not a security boundary.
import fs from 'node:fs';
import path from 'node:path';
import { findProject, load, TOOL_NAME, DATA_DIR } from './store.mjs';
import { brief } from './text.mjs';
import { renderFile } from './render.mjs';
import { runSlash } from './slash.mjs';
import { openFile } from './open.mjs';

const T = TOOL_NAME;

// Finds `board <word> [<word>]` anywhere in a command line (after a space, ; & | ( ` $ " or ').
// The tool name is built from TOOL_NAME so a rename keeps the guard in step.
const CALL = new RegExp(`(^|[\\s;&|(\`$"'])(?:\\S*/)?${T}(?:\\.mjs)?\\s+([A-Za-z-]+)(?:\\s+([A-Za-z-]+))?`, 'g');
const READ_ONLY = ['ls', 'show', 'log', 'brief', 'render', 'open', 'help'];
const AI_ALLOWED = ['add', 'edit', 'gap', 'project'];

// True when one `board ...` call is something the AI may run.
function allowedCall(first, second) {
  if (READ_ONLY.includes(first)) return true;
  return first === 'ai' && AI_ALLOWED.includes(second);
}

// Slash command a human types for each blocked `board` subcommand.
const SLASH = { approve: 'approve', reopen: 'reopen', supersede: 'supersede', restore: 'restore', init: 'init' };

// The message that tells the AI what to do instead of a blocked `board` call.
function blockMessage(first, second) {
  const slash = first === 'gap' && ['resolve', 'dismiss'].includes(second) ? second : SLASH[first];
  if (slash) return `This is a human-only command. Ask the user to run: /brick:${slash} ... Do not run it yourself.`;
  if (['add', 'edit', 'project'].includes(first)) {
    return `Do not run ${T} ${first} yourself. Record what the user said with: ${T} ai ${first} ... --user-said "<their words>"`;
  }
  if (first === 'ai') return `The AI may only run: ${T} ai add|edit|project|gap. Approving and deciding are the user's job.`;
  return `"${T} ${first}" is not a command the AI may run. The AI may run ${T} ai add|edit|project|gap and the read-only commands.`;
}

// Decides on a Bash command. Returns null to allow, or the message that blocks it.
export function checkBash(command) {
  const text = String(command || '');
  for (const m of text.matchAll(CALL)) {
    if (!allowedCall(m[2], m[3])) return blockMessage(m[2], m[3]);
  }
  if (text.includes(`${DATA_DIR}/`)) {
    return `Do not read or write ${DATA_DIR}/ directly. Use ${T} ls, ${T} show <id> or ${T} brief instead.`;
  }
  return null;
}

// Decides on a file path for Write/Edit. Returns null to allow, or the blocking message.
export function checkWrite(filePath) {
  if (!filePath) return null;
  const segments = path.resolve(String(filePath)).split(path.sep);
  if (segments.includes(DATA_DIR)) return `${DATA_DIR}/ is written only by the ${T} command. Use ${T} ai ... instead.`;
  return null;
}

// The path a write-type tool is about to touch (Write/Edit/MultiEdit use file_path, NotebookEdit notebook_path).
export function pathOf(toolInput) {
  return toolInput?.file_path || toolInput?.notebook_path || null;
}

// What to print at session start: the brief, if a board exists. Never throws.
// `opener` is injectable so tests never launch a browser.
export function sessionStart(cwd, opener = openFile) {
  try {
    const project = findProject(cwd);
    if (!project.exists) return '';
    const data = load(project.dir);
    let config = {};
    try { config = JSON.parse(fs.readFileSync(path.join(project.dir, 'config.json'), 'utf8')); } catch { /* use defaults */ }
    if (config.openBrowserOnSessionStart) opener(renderFile(project.dir));
    return brief(data);
  } catch {
    return '';
  }
}

// Runs one guard on the hook's stdin text. Returns { code, out, err }; code 2 blocks the tool call.
// A guard that cannot understand its input lets the call through: it must never break a session.
export function runGuard(sub, stdinText, cwd) {
  let input = {};
  try { input = JSON.parse(stdinText || '{}'); } catch { /* treat as empty */ }
  if (sub === 'prompt') return { code: 0, out: runSlash(input.command_name || '', input.command_args || '', input.cwd || cwd), err: '' };
  if (sub === 'session-start') return { code: 0, out: sessionStart(input.cwd || cwd), err: '' };
  let message = null;
  if (sub === 'bash') message = checkBash(input.tool_input?.command);
  else if (sub === 'write') message = checkWrite(pathOf(input.tool_input));
  else return { code: 0, out: '', err: '' };
  return message ? { code: 2, out: '', err: message } : { code: 0, out: '', err: '' };
}

// Entry for `board guard <bash|write|session-start>`: reads stdin, prints, returns the exit code.
export function guardMain(argv, cwd) {
  let text = '';
  try { text = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
  const r = runGuard(argv[0], text, cwd);
  if (r.out) console.log(r.out);
  if (r.err) console.error(r.err);
  return r.code;
}
