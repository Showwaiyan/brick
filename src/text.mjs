// Plain-text output: ls, show, log, brief, help.
import { children, displayState, openGaps, nextCommands } from './model.mjs';
import { approveCheck } from './rules.mjs';
import { TOOL_NAME, PLUGIN_NAME } from './store.mjs';
import { fid } from './ids.mjs';

const T = TOOL_NAME;
const LABEL = { approved: 'approved', drafting: 'drafting', has_gaps: 'has gaps', superseded: 'superseded' };

export const HELP = `${T} - keep the breakdown of a project in a file you own.

Human commands (run these yourself; in Claude Code type them with a leading !):
  ${T} init "<name>" [--key KEY] [--input ".."] [--output ".."] [--demo]
  ${T} add box|problem "<title>" [--parent <id>] [--after <id>] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]
  ${T} edit <id> [--title ..] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]
  ${T} project [--name ..] [--input ..] [--output ..]
  ${T} approve <id>
  ${T} reopen <id> --why "<reason>"
  ${T} supersede <id> --why "<reason>" [--by <id>]
  ${T} restore <id>
  ${T} gap resolve <gapId> --note "<text>"
  ${T} gap dismiss <gapId> --why "<text>"

AI commands (the only writes the AI may run; each needs the user's own words):
  ${T} ai add box|problem --title "<t>" --user-said "<quote>" [--drafted] [--parent <id>] [--after <id>] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]
  ${T} ai edit <id> --user-said "<quote>" [--drafted] [--title ..] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]
      (--drafted: only when the user asked you to write it for them; the quote is their request)
  ${T} ai project --user-said "<quote>" [--input ..] [--output ..]
  ${T} ai gap <nodeId> --missing "<what is missing>" [--kind edge-case|architecture|assumption|order|other] [--where "<location>"]

Several boards: ids carry the board key (LOGIN-p3.1). Add --board KEY after any command, or use a full id.
Read-only (human or AI):
  ${T} ls | ${T} show <id> | ${T} log [--last N] | ${T} brief | ${T} help
  ${T} boards              the boards in this project (* is the active one)
  ${T} use <KEY>           make a board the active one
  ${T} check [id]          signals about size and shape (facts and flags, not a verdict)
  ${T} render              rebuild .board/tree.html
  ${T} open [--quiet]      rebuild it and open it in your browser
`;

// Depth-first list of [node, depth], children in order (superseded stay in place).
function walk(data, parent = null, depth = 0) {
  return children(data, parent).flatMap((n) => [[n, depth], ...walk(data, n.id, depth + 1)]);
}

// Children before their parents, so the first match is the deepest node.
function postOrder(data, parent = null) {
  return children(data, parent).flatMap((n) => [...postOrder(data, n.id), n]);
}

// The whole tree as indented text.
export function ls(data) {
  const p = data.project;
  const io = p.input || p.output ? `  (${p.input || '-'} -> ${p.output || '-'})` : '';
  const F = (id) => fid(data, id);
  const lines = [`${p.name}${p.key ? ` [${p.key}]` : ''}${io}`];
  for (const [n, depth] of walk(data)) {
    const state = displayState(data, n.id);
    const gaps = openGaps(data, n.id).length;
    const tag = state === 'superseded' ? '(superseded)' : `[${LABEL[state]}]`;
    const draft = n.source === 'ai-draft' && n.status === 'drafting' ? '  AI draft' : '';
    lines.push(`${'  '.repeat(depth + 1)}${F(n.id)}  ${n.title}  ${tag}${draft}${gaps ? `  ${gaps} open gap${gaps > 1 ? 's' : ''}` : ''}`);
  }
  if (lines.length === 1) lines.push(`  (empty) Start with: ${T} add box "<title>"`);
  return lines.join('\n');
}

// Events that belong to a node (about it, or about one of its gaps).
export function eventsFor(data, id) {
  return data.events.filter((e) => e.target === id || e.detail?.node === id).reverse();
}

// One event as a line.
function eventLine(e, key = null) {
  const d = Object.keys(e.detail || {}).length ? ` ${JSON.stringify(e.detail)}` : '';
  return `#${e.seq} ${e.at} ${e.actor} ${e.action} ${e.target ? (key ? `${key}-${e.target}` : e.target) : '-'}${d}`;
}

// One node in full.
export function show(data, id) {
  const n = data.nodes[id];
  if (!n) throw new Error(`There is no node "${id}". Run: ${T} ls`);
  const F = (x) => fid(data, x);
  const out = [`${F(n.id)}  ${n.title}`, `kind: ${n.kind}   parent: ${n.parent ? F(n.parent) : '-'}   state: ${LABEL[displayState(data, id)]}   source: ${n.source}`];
  out.push(`description: ${n.description || 'not set'}`, 'contract:');
  for (const k of ['input', 'output', 'check', 'limits']) out.push(`  ${k}: ${n.contract[k] ?? 'not set'}`);
  if (n.said.length) out.push('said by the user:', ...n.said.map((s) => `  "${s}"`));
  const gaps = Object.values(data.gaps).filter((g) => g.node === id);
  if (gaps.length) {
    out.push('gaps:');
    for (const g of gaps) out.push(`  ${F(g.id)} [${g.status}] ${g.kind ? `(${g.kind}) ` : ''}${g.missing}${g.where ? ` (${g.where})` : ''}${g.note ? ` - ${g.note}` : ''}`);
  }
  if (n.superseded) {
    const s = n.superseded;
    out.push(`superseded: ${s.reason}${s.by ? `  (replaced by ${F(s.by)})` : ''}${s.cascade_from ? `  (with ${F(s.cascade_from)})` : ''}`);
  }
  out.push('recent events:', ...eventsFor(data, id).slice(0, 10).map((e) => `  ${eventLine(e, data.project.key)}`));
  out.push('next commands:', ...nextCommands(data, id).map((c) => `  ${c}`));
  return out.join('\n');
}

// The event log, newest first.
export function log(data, last) {
  if (!Number.isInteger(last) || last < 1) throw new Error('--last needs a whole number of 1 or more.');
  return data.events.slice().reverse().slice(0, last).map((e) => eventLine(e, data.project.key)).join('\n') || '(no events yet)';
}

// The single most useful next command for the human.
function nextStep(data) {
  const F = (id) => fid(data, id);
  const gap = Object.values(data.gaps).find((g) => g.status === 'open');
  if (gap) return `${T} show ${F(gap.node)}   (${F(gap.id)} is open: resolve or dismiss it)`;
  if (!Object.keys(data.nodes).length) return `${T} add box "<title>"`;
  const drafting = postOrder(data).filter((n) => n.status === 'drafting');
  const ready = drafting.find((n) => approveCheck(data, n.id) === null);
  if (ready) return `/${PLUGIN_NAME}:approve ${F(ready.id)}`;
  return drafting.length ? `${T} show ${F(drafting[0].id)}   (see what is left to fill in)` : `${T} ls`;
}

// The list of boards, with the active one marked.
const boardsLine = ({ boards, active }) =>
  `Boards: ${boards.map((b) => `${b.key}${b.key === active ? ' (active)' : ''}`).join(', ')}`;

// With several boards and none active: only the list and what to do. The board rules come in a later line.
export function briefNoActive(ctx) {
  return [
    boardsLine({ boards: ctx.boards, active: null }),
    'No board is active. Ask the user which board they mean before recording anything, or run `board use <KEY>` when they name one.',
  ].join('\n');
}

// The session brief: project, counts, open gaps, next command, pointer, and the rules.
export function brief(data, ctx = null) {
  const count = { approved: 0, drafting: 0, has_gaps: 0, superseded: 0 };
  for (const id of Object.keys(data.nodes)) count[displayState(data, id)] += 1;
  const open = Object.values(data.gaps).filter((g) => g.status === 'open');
  const many = ctx && ctx.boards.length > 1;
  return [
    `Project: ${data.project.name}${data.project.key ? ` (board ${data.project.key})` : ''}`,
    ...(many ? [boardsLine(ctx)] : []),
    `Nodes: ${count.approved} approved, ${count.drafting} drafting, ${count.has_gaps} with gaps, ${count.superseded} superseded`,
    `Open gaps: ${open.length}${open.length ? ` (${open.map((g) => `${fid(data, g.id)} on ${fid(data, g.node)}`).join(', ')})` : ''}`,
    `Next: ${nextStep(data)}`,
    `Tree: ${T} ls`,
    'Discussion rules: never volunteer ideas, options, designs or recommendations. When the user states a flow step, a sub-problem or a contract, record it at once in their words (board ai add, edit or project with --user-said, after loading the brick:decompose skill), say the id, then ask one question. Run board ls first, and edit a node that already exists instead of adding a duplicate.',
    'If the user says they are unsure or do not know, about the same point twice, ask once: "You sound unsure about <point>. Do you want my suggestions on it, or would you rather think it through yourself first?" Then stop and wait. After a no, you may offer once more if they are unsure about it again; after a second no, never offer on that point again unless they ask. In between, keep asking plain questions.',
    'Give ideas or comparisons only when the user asks for them or says yes to that offer, and load the brick:discuss skill with the Skill tool first.',
    'When the user asks you to break something down for them or to draft the flow ("break it down for me", "draft the flow"), draft it with board ai add --drafted, one level, and do not ask them questions or for their own breakdown first: draft from the title and what is on the board, and say what you assumed afterwards. Draft only on such a request. When asked for gaps, sweep for gaps, edge cases and architecture issues (see the decompose skill).',
    'When the user has finished describing a node, or asks whether to split further, run `board check <id>`, load the brick:sizing skill, and state what the checks show as an observation.',
  ].join('\n');
}
