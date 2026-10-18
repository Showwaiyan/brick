// Plain-text output: ls, show, log, brief, help.
import { children, displayState, openGaps, nextCommands } from './model.mjs';
import { approveCheck } from './rules.mjs';
import { TOOL_NAME, PLUGIN_NAME } from './store.mjs';

const T = TOOL_NAME;
const LABEL = { approved: 'approved', drafting: 'drafting', has_gaps: 'has gaps', superseded: 'superseded' };

export const HELP = `${T} - keep the breakdown of a project in a file you own.

Human commands (run these yourself; in Claude Code type them with a leading !):
  ${T} init "<name>" [--input ".."] [--output ".."] [--demo]
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
  ${T} ai gap <nodeId> --missing "<what is missing>" [--where "<location>"]

Read-only (human or AI):
  ${T} ls | ${T} show <id> | ${T} log [--last N] | ${T} brief | ${T} help
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
  const lines = [`${p.name}${io}`];
  for (const [n, depth] of walk(data)) {
    const state = displayState(data, n.id);
    const gaps = openGaps(data, n.id).length;
    const tag = state === 'superseded' ? '(superseded)' : `[${LABEL[state]}]`;
    const draft = n.source === 'ai-draft' && n.status === 'drafting' ? '  AI draft' : '';
    lines.push(`${'  '.repeat(depth + 1)}${n.id}  ${n.title}  ${tag}${draft}${gaps ? `  ${gaps} open gap${gaps > 1 ? 's' : ''}` : ''}`);
  }
  if (lines.length === 1) lines.push(`  (empty) Start with: ${T} add box "<title>"`);
  return lines.join('\n');
}

// Events that belong to a node (about it, or about one of its gaps).
export function eventsFor(data, id) {
  return data.events.filter((e) => e.target === id || e.detail?.node === id).reverse();
}

// One event as a line.
function eventLine(e) {
  const d = Object.keys(e.detail || {}).length ? ` ${JSON.stringify(e.detail)}` : '';
  return `#${e.seq} ${e.at} ${e.actor} ${e.action} ${e.target ?? '-'}${d}`;
}

// One node in full.
export function show(data, id) {
  const n = data.nodes[id];
  if (!n) throw new Error(`There is no node "${id}". Run: ${T} ls`);
  const out = [`${n.id}  ${n.title}`, `kind: ${n.kind}   parent: ${n.parent || '-'}   state: ${LABEL[displayState(data, id)]}   source: ${n.source}`];
  out.push(`description: ${n.description || 'not set'}`, 'contract:');
  for (const k of ['input', 'output', 'check', 'limits']) out.push(`  ${k}: ${n.contract[k] ?? 'not set'}`);
  if (n.said.length) out.push('said by the user:', ...n.said.map((s) => `  "${s}"`));
  const gaps = Object.values(data.gaps).filter((g) => g.node === id);
  if (gaps.length) {
    out.push('gaps:');
    for (const g of gaps) out.push(`  ${g.id} [${g.status}] ${g.missing}${g.where ? ` (${g.where})` : ''}${g.note ? ` - ${g.note}` : ''}`);
  }
  if (n.superseded) {
    const s = n.superseded;
    out.push(`superseded: ${s.reason}${s.by ? `  (replaced by ${s.by})` : ''}${s.cascade_from ? `  (with ${s.cascade_from})` : ''}`);
  }
  out.push('recent events:', ...eventsFor(data, id).slice(0, 10).map((e) => `  ${eventLine(e)}`));
  out.push('next commands:', ...nextCommands(data, id).map((c) => `  ${c}`));
  return out.join('\n');
}

// The event log, newest first.
export function log(data, last) {
  if (!Number.isInteger(last) || last < 1) throw new Error('--last needs a whole number of 1 or more.');
  return data.events.slice().reverse().slice(0, last).map(eventLine).join('\n') || '(no events yet)';
}

// The single most useful next command for the human.
function nextStep(data) {
  const gap = Object.values(data.gaps).find((g) => g.status === 'open');
  if (gap) return `${T} show ${gap.node}   (${gap.id} is open: resolve or dismiss it)`;
  if (!Object.keys(data.nodes).length) return `${T} add box "<title>"`;
  const drafting = postOrder(data).filter((n) => n.status === 'drafting');
  const ready = drafting.find((n) => approveCheck(data, n.id) === null);
  if (ready) return `/${PLUGIN_NAME}:approve ${ready.id}`;
  return drafting.length ? `${T} show ${drafting[0].id}   (see what is left to fill in)` : `${T} ls`;
}

// Five lines: project, counts, open gaps, next command, pointer.
export function brief(data) {
  const count = { approved: 0, drafting: 0, has_gaps: 0, superseded: 0 };
  for (const id of Object.keys(data.nodes)) count[displayState(data, id)] += 1;
  const open = Object.values(data.gaps).filter((g) => g.status === 'open');
  return [
    `Project: ${data.project.name}`,
    `Nodes: ${count.approved} approved, ${count.drafting} drafting, ${count.has_gaps} with gaps, ${count.superseded} superseded`,
    `Open gaps: ${open.length}${open.length ? ` (${open.map((g) => `${g.id} on ${g.node}`).join(', ')})` : ''}`,
    `Next: ${nextStep(data)}`,
    `Tree: ${T} ls`,
    'Discussion rules: never volunteer ideas, options, designs or recommendations. Ask questions and record what the user says.',
    'If the user says they are unsure or do not know, about the same point twice, ask once: "You sound unsure about <point>. Do you want my suggestions on it, or would you rather think it through yourself first?" Then stop and wait. After a no, you may offer once more if they are unsure about it again; after a second no, never offer on that point again unless they ask. In between, keep asking plain questions.',
    'Give ideas or comparisons only when the user asks for them or says yes to that offer, and load the brick:discuss skill with the Skill tool first.',
  ].join('\n');
}
