// Runs the human's typed /brick:<action> commands, given in plain words. No shell is ever involved.
import { execute } from './commands.mjs';
import { initProject } from './init.mjs';
import { parseRequest } from './refer.mjs';
import { findProject, load, DATA_DIR, PLUGIN_NAME as PLUGIN } from './store.mjs';

const TAG = `[${PLUGIN}]`;
const REASON_VERBS = ['approve', 'reopen', 'supersede', 'restore', 'resolve', 'dismiss'];
const ACTIONS = ['init', 'open', ...REASON_VERBS];

// Rewrites engine wording so the human is pointed at slash commands, never at the board CLI.
function humanize(msg) {
  return String(msg)
    .replace(/Usage: board gap (resolve|dismiss)/g, `Usage: /${PLUGIN}:$1`)
    .replace(/Usage: board (\w+)/g, `Usage: /${PLUGIN}:$1`)
    .replace(/Run board init in the main checkout/g, `Run /${PLUGIN}:init in the main checkout`);
}

// Runs one typed command. Returns '' if it is not one of ours; otherwise a "[brick] ..." block. Never throws.
export function runSlash(commandName, text, cwd) {
  const name = String(commandName || '').toLowerCase();
  const action = name.startsWith(`${PLUGIN}:`) ? name.slice(PLUGIN.length + 1) : null;
  if (!action || !ACTIONS.includes(action)) return '';
  try {
    const words = String(text ?? '').trim();
    if (action === 'init') {
      if (!words) return `${TAG} NEEDS: a name for the project, in your own words.\nNothing was changed.\nComplete command: /${PLUGIN}:init <what you want to build>`;
      return `${TAG} ${initProject(cwd, ['--', words])}`;
    }
    const project = findProject(cwd);
    if (!project.exists) return `${TAG} No ${DATA_DIR}/ here. Run: /${PLUGIN}:init <what you want to build>`;
    if (action === 'open') return `${TAG} ${execute(project.dir, ['open'])}`;
    const parsed = parseRequest(load(project.dir), action, words);
    if (parsed.needs) return `${TAG} ${parsed.needs}`;
    return `${TAG} ${execute(project.dir, parsed.argv)}`;
  } catch (e) {
    return `${TAG} ${humanize(e.message)}`;
  }
}
