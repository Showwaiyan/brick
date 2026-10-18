// Runs the human's typed /brick:<action> commands, given in plain words. No shell is ever involved.
import { execute } from './commands.mjs';
import { initProject } from './init.mjs';
import { parseRequest } from './refer.mjs';
import { findProject, load, listBoards, activeKey, migrateLegacy, setActive, DATA_DIR, PLUGIN_NAME as PLUGIN } from './store.mjs';
import { resolveForText } from './boards.mjs';
import { openOverview } from './overview.mjs';
import { decorateIds } from './ids.mjs';

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
    migrateLegacy(project.dir);
    if (action === 'open' && (words.toLowerCase() === 'all' || (!words && !activeKey(project.dir) && listBoards(project.dir).length > 1))) {
      const { file, opened } = openOverview(project.dir);
      return `${TAG} ${opened ? 'opened' : 'Could not open a browser. The page is here:'} ${file}`;
    }
    const board = resolveForText(project.dir, words, action);
    if (board.needs) return `${TAG} ${board.needs}`;
    if (action === 'open') return `${TAG} ${execute(board.dir, ['open'])}`;
    const parsed = parseRequest(load(board.dir), action, board.text);
    if (parsed.needs) return `${TAG} ${parsed.needs}`;
    const result = execute(board.dir, parsed.argv);
    if (board.explicit) setActive(project.dir, board.key);
    return `${TAG} ${decorateIds(result, board.key)}`;
  } catch (e) {
    return `${TAG} ${humanize(e.message)}`;
  }
}
