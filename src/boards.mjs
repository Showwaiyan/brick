// Which board does a command mean? Fixed rules, no guessing by topic (that is the AI's job, and never for decisions).
import { listBoards, activeKey, load, PLUGIN_NAME } from './store.mjs';
import { displayState, openGaps } from './model.mjs';

const FULL_ID = /^([A-Za-z][A-Za-z0-9]{1,5})-([bp]\d+(?:\.\d+)*(?:\.g\d+)?|g\d+)$/i;
const KEYED_IN_TEXT = /(?<![\w-])([A-Za-z][A-Za-z0-9]{1,5})-(?=[bpg]\d)/g;
const HOW_TO_NAME = (first) => `Name one: add --board <KEY> to the command, use a full id like ${first}-b1, or run: board use <KEY>`;

// One line of facts about a board: its key, name and counts. Never throws.
export function boardSummary({ key, dir }) {
  try {
    const data = load(dir);
    const counts = { approved: 0, drafting: 0, has_gaps: 0, superseded: 0 };
    for (const id of Object.keys(data.nodes)) counts[displayState(data, id)] += 1;
    const gaps = Object.keys(data.nodes).reduce((n, id) => n + openGaps(data, id).length, 0);
    return { key, name: data.project.name, counts, open_gaps: gaps, broken: null };
  } catch (e) {
    return { key, name: null, counts: null, open_gaps: 0, broken: e.message.split('\n')[0] };
  }
}

// The text of `board boards`: one line per board, * marks the active one.
export function boardsText(dataDir) {
  const active = activeKey(dataDir);
  const lines = listBoards(dataDir).map((b) => {
    const s = boardSummary(b);
    const mark = s.key === active ? '*' : ' ';
    if (s.broken) return `${mark} ${s.key}  (cannot be read: ${s.broken})`;
    const c = s.counts;
    return `${mark} ${s.key}  ${s.name}  ${c.approved} approved, ${c.drafting} drafting, ${c.has_gaps} with gaps${s.open_gaps ? `, ${s.open_gaps} open gap${s.open_gaps > 1 ? 's' : ''}` : ''}`;
  });
  return lines.length ? lines.join('\n') : '(no boards yet)';
}

// Which board, when nothing names one: the active board, or the only board. Otherwise null.
function fallback(dataDir, boards) {
  const key = activeKey(dataDir);
  if (key) return boards.find((b) => b.key === key);
  return boards.length === 1 ? boards[0] : null;
}

// Resolves the board for a CLI command. Returns { key, dir, argv, explicit }; argv has --board and key prefixes removed.
export function resolveBoard(dataDir, argv) {
  const boards = listBoards(dataDir);
  const keys = boards.map((b) => b.key);
  const named = new Set();
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--board' || t.startsWith('--board=')) {
      const value = t === '--board' ? argv[++i] : t.slice('--board='.length);
      if (!value) throw new Error('--board needs a board key, for example --board LOGIN.');
      if (!keys.includes(value.toUpperCase())) throw new Error(`There is no board "${value}". Boards: ${keys.join(', ') || 'none'}.`);
      named.add(value.toUpperCase());
      continue;
    }
    const flag = t.match(/^(--[a-z-]+=)(.*)$/);
    const value = flag ? flag[2] : t;
    const m = value.match(FULL_ID);
    if (m && keys.includes(m[1].toUpperCase())) {
      named.add(m[1].toUpperCase());
      out.push((flag ? flag[1] : '') + m[2].toLowerCase());
    } else {
      out.push(t);
    }
  }
  if (named.size > 1) throw new Error(`These name different boards: ${[...named].join(', ')}. Use one board per command.`);
  if (named.size === 1) {
    const key = [...named][0];
    return { key, dir: boards.find((b) => b.key === key).dir, argv: out, explicit: true };
  }
  const b = fallback(dataDir, boards);
  if (!b) throw new Error(`Several boards: ${keys.join(', ')}. ${HOW_TO_NAME(keys[0])}`);
  return { key: b.key, dir: b.dir, argv: out, explicit: false };
}

// Resolves the board for a typed /brick: command from the person's words. Returns { key, dir, text, explicit } or { needs }.
export function resolveForText(dataDir, text, action = '<action>') {
  const boards = listBoards(dataDir);
  const keys = boards.map((b) => b.key);
  const named = new Set();
  const stripped = String(text).replace(KEYED_IN_TEXT, (all, k) => {
    if (!keys.includes(k.toUpperCase())) return all;
    named.add(k.toUpperCase());
    return '';
  });
  const ask = (headline) => ({ needs: ['NEEDS: ' + headline, 'Nothing was changed.', `Complete command: /${PLUGIN_NAME}:${action} ${keys[0] || 'KEY'}-<id> ...`].join('\n') });
  if (named.size > 1) return ask(`which board? You named different boards: ${[...named].join(', ')}.`);
  if (named.size === 1) {
    const key = [...named][0];
    return { key, dir: boards.find((b) => b.key === key).dir, text: stripped, explicit: true };
  }
  const b = fallback(dataDir, boards);
  if (!b) return ask(`which board? There are several: ${keys.join(', ')}. Put the board key in front of the id.`);
  return { key: b.key, dir: b.dir, text: stripped, explicit: false };
}
