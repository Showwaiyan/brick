// Runs the human's typed /brick:<action> commands. No shell is ever involved.
import { execute } from './commands.mjs';
import { initProject } from './init.mjs';
import { findProject, DATA_DIR, PLUGIN_NAME as PLUGIN } from './store.mjs';

const TAG = `[${PLUGIN}]`;

// Engine argv prefix for each human-only action. `init` is handled separately.
const HUMAN = {
  init: null,
  approve: ['approve'],
  reopen: ['reopen'],
  supersede: ['supersede'],
  restore: ['restore'],
  resolve: ['gap', 'resolve'],
  dismiss: ['gap', 'dismiss'],
  open: ['open'],
};

// Splits text into words. Handles "double" and 'single' quotes and \" \\ inside double quotes.
export function tokenize(text) {
  const out = [];
  let cur = '';
  let inToken = false;
  let quote = null;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote === '"') {
      if (c === '\\' && (s[i + 1] === '"' || s[i + 1] === '\\')) { cur += s[++i]; }
      else if (c === '"') quote = null;
      else cur += c;
    } else if (quote === "'") {
      if (c === "'") quote = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      inToken = true;
    } else if (/\s/.test(c)) {
      if (inToken) { out.push(cur); cur = ''; inToken = false; }
    } else {
      cur += c;
      inToken = true;
    }
  }
  if (quote) throw new Error(`Unterminated ${quote} quote in the command.`);
  if (inToken) out.push(cur);
  return out;
}

// Rewrites engine wording so the human is pointed at slash commands, never at the board CLI.
function humanize(msg) {
  return String(msg)
    .replace(/Usage: board gap (resolve|dismiss)/g, `Usage: /${PLUGIN}:$1`)
    .replace(/Usage: board (\w+)/g, `Usage: /${PLUGIN}:$1`)
    .replace(/Run board init in the main checkout/g, `Run /${PLUGIN}:init in the main checkout`);
}

// Runs one typed command. Returns '' if it is not one of ours; otherwise a "[brick] ..." line. Never throws.
export function runSlash(commandName, argsText, cwd) {
  const name = String(commandName || '');
  const action = name.startsWith(`${PLUGIN}:`) ? name.slice(PLUGIN.length + 1) : null;
  if (!action || !Object.hasOwn(HUMAN, action)) return '';
  try {
    const argv = tokenize(argsText);
    if (action === 'init') return `${TAG} ${initProject(cwd, argv)}`;
    const project = findProject(cwd);
    if (!project.exists) return `${TAG} No ${DATA_DIR}/ here. Run: /${PLUGIN}:init "<name>"`;
    return `${TAG} ${execute(project.dir, [...HUMAN[action], ...argv])}`;
  } catch (e) {
    return `${TAG} ${humanize(e.message)}`;
  }
}
