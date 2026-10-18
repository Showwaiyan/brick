// Commands: parse arguments, call the rules, return one short line of text.
import { parseArgs } from 'node:util';
import { findProject, load, mutate, nextId, addEvent, TOOL_NAME, DATA_DIR, PLUGIN_NAME } from './store.mjs';
import { children } from './model.mjs';
import { approve, reopen, supersede, restore, closeGap, needNode, nextOrder, blank, raiseGapChecked, lintSaid } from './rules.mjs';
import { ls, show, log, brief, HELP } from './text.mjs';
import { checkText } from './signals.mjs';
import { initProject } from './init.mjs';
import { renderFile, renderQuiet } from './render.mjs';
import { openFile } from './open.mjs';

const T = TOOL_NAME;
const CONTRACT = ['input', 'output', 'check', 'limits'];
const NODE_FLAGS = {
  title: { type: 'string' }, desc: { type: 'string' },
  input: { type: 'string' }, output: { type: 'string' }, check: { type: 'string' }, limits: { type: 'string' },
};

// Parses a command's arguments; checks the number of positional words.
function parse(argv, options, usage, count) {
  let r;
  try {
    r = parseArgs({ args: argv, options, allowPositionals: true, strict: true });
  } catch (e) {
    throw new Error(`${e.message}\nUsage: ${T} ${usage}`);
  }
  if (r.positionals.length !== count) throw new Error(`Usage: ${T} ${usage}`);
  return r;
}

// Empty text clears a contract field.
const clean = (v) => (blank(v) ? null : v);

// Adds a node. `f` = { kind, title, parent, after, desc, contract, source, said }.
export function addNode(data, f, now) {
  const title = (f.title || '').trim();
  if (!title) throw new Error('A title is required.');
  let parent = null;
  if (f.kind === 'box') {
    if (f.parent) throw new Error(`Boxes have no parent. Use "problem" for a sub-problem.`);
  } else {
    if (!f.parent) throw new Error('A problem needs --parent <id>.');
    const p = needNode(data, f.parent);
    if (p.status === 'superseded') throw new Error(`${f.parent} is superseded; nothing can be added under it.`);
    if (p.status === 'approved') throw new Error(`${f.parent} is approved. Reopen it first: /${PLUGIN_NAME}:reopen ${f.parent} --why "…"`);
    parent = f.parent;
  }
  let order = nextOrder(data, parent);
  if (f.after) {
    const a = needNode(data, f.after);
    if (a.parent !== parent) throw new Error(`${f.after} is not at the same level as the new node.`);
    order = a.order + 1;
    for (const s of children(data, parent)) if (s.order >= order) s.order += 1;
  }
  const id = nextId(data, f.kind === 'box' ? 'b' : 'p');
  const contract = {};
  for (const k of CONTRACT) contract[k] = clean(f.contract?.[k]);
  data.nodes[id] = {
    id, kind: f.kind, parent, order, title, description: f.desc || '', contract,
    status: 'drafting', domain: 'software', source: f.source || 'human',
    said: f.said ? [f.said] : [], superseded: null, created_at: now, updated_at: now,
  };
  const viaDraft = f.source === 'ai-draft';
  addEvent(data, (f.source || 'human') === 'human' ? 'human' : 'ai', 'add', id, { kind: f.kind, parent, title, ...(viaDraft ? { via: 'draft' } : {}) }, now);
  return parent ? `added ${id} under ${parent}` : `added ${id}`;
}

// Edits a drafting node. `f` = { title, desc, contract, said, drafted } with only the changed fields set.
export function editNode(data, id, f, actor, now) {
  const n = needNode(data, id);
  if (n.status === 'superseded') throw new Error(`${id} is superseded and cannot be edited.`);
  if (n.status === 'approved') throw new Error(`${id} is approved. Reopen it first: /${PLUGIN_NAME}:reopen ${id} --why "…"`);
  const changed = [];
  if (f.title !== undefined) {
    if (blank(f.title)) throw new Error('The title cannot be empty.');
    n.title = f.title.trim();
    changed.push('title');
  }
  if (f.desc !== undefined) { n.description = f.desc; changed.push('desc'); }
  for (const k of CONTRACT) {
    if (f.contract?.[k] !== undefined) { n.contract[k] = clean(f.contract[k]); changed.push(k); }
  }
  if (!changed.length) throw new Error('Nothing to change. Give at least one of --title --desc --input --output --check --limits.');
  if (f.said) n.said.push(f.said);
  n.updated_at = now;
  addEvent(data, actor, 'edit', id, { fields: changed, ...(f.drafted ? { via: 'draft' } : {}) }, now);
  return `edited ${id} (${changed.join(', ')})`;
}

// Picks the contract flags out of parsed values.
const contractOf = (v) => Object.fromEntries(CONTRACT.map((k) => [k, v[k]]));

// Changes the project name, input or output. Empty text clears input or output.
function setProject(data, values, actor, now, said) {
  const changed = [];
  if (values.name !== undefined) {
    if (blank(values.name)) throw new Error('The project name cannot be empty.');
    data.project.name = values.name.trim();
    changed.push('name');
  }
  for (const k of ['input', 'output']) {
    if (values[k] !== undefined) { data.project[k] = clean(values[k]); changed.push(k); }
  }
  if (!changed.length) throw new Error('Nothing to change. Give at least one of --name --input --output.');
  addEvent(data, actor, 'project', null, said ? { fields: changed, said } : { fields: changed }, now);
  return `updated project (${changed.join(', ')})`;
}

// Mutating commands. Each takes (data, argv, now) and returns a result line.
const MUTATING = {
  add(data, argv, now) {
    const { values, positionals } = parse(argv, { ...NODE_FLAGS, parent: { type: 'string' }, after: { type: 'string' } },
      'add box|problem "<title>" [--parent <id>] [--after <id>] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]', 2);
    if (!['box', 'problem'].includes(positionals[0])) throw new Error(`Say "box" or "problem", not "${positionals[0]}".`);
    return addNode(data, { kind: positionals[0], title: positionals[1], parent: values.parent, after: values.after,
      desc: values.desc, contract: contractOf(values) }, now);
  },
  edit(data, argv, now) {
    const { values, positionals } = parse(argv, NODE_FLAGS, 'edit <id> [--title ..] [--desc ..] [--input ..] ...', 1);
    return editNode(data, positionals[0], { title: values.title, desc: values.desc, contract: contractOf(values) }, 'human', now);
  },
  project(data, argv, now) {
    const { values } = parse(argv, { name: { type: 'string' }, input: { type: 'string' }, output: { type: 'string' } },
      'project [--name ..] [--input ..] [--output ..]', 0);
    return setProject(data, values, 'human', now);
  },
  approve: (data, argv, now) => approve(data, parse(argv, {}, 'approve <id>', 1).positionals[0], now),
  reopen(data, argv, now) {
    const { values, positionals } = parse(argv, { why: { type: 'string' } }, 'reopen <id> --why "<reason>"', 1);
    return reopen(data, positionals[0], values.why, now);
  },
  supersede(data, argv, now) {
    const { values, positionals } = parse(argv, { why: { type: 'string' }, by: { type: 'string' } },
      'supersede <id> --why "<reason>" [--by <id>]', 1);
    return supersede(data, positionals[0], values.why, values.by, now);
  },
  restore: (data, argv, now) => restore(data, parse(argv, {}, 'restore <id>', 1).positionals[0], now),
  gap(data, argv, now) {
    const [sub, ...rest] = argv;
    if (sub === 'resolve') {
      const { values, positionals } = parse(rest, { note: { type: 'string' } }, 'gap resolve <gapId> --note "<text>"', 1);
      return closeGap(data, positionals[0], 'resolved', values.note, now);
    }
    if (sub === 'dismiss') {
      const { values, positionals } = parse(rest, { why: { type: 'string' } }, 'gap dismiss <gapId> --why "<text>"', 1);
      return closeGap(data, positionals[0], 'dismissed', values.why, now);
    }
    throw new Error(`Usage: ${T} gap resolve|dismiss <gapId> ...`);
  },
};

// The user's own words, required on every AI write. Returns the trimmed quote.
function quoteOf(values) {
  const q = (values['user-said'] || '').trim();
  if (!q) throw new Error('--user-said is required: quote the words the user said that justify this. Record nothing the user has not said.');
  if (q.length > 400) throw new Error('--user-said is limited to 400 characters. Quote the key part.');
  return lintSaid(q);
}

// AI commands: the only mutating commands the AI may run. No approve, reopen, supersede, restore, resolve or dismiss.
const SAID = { 'user-said': { type: 'string' }, drafted: { type: 'boolean' } };
const AI = {
  add(data, argv, now) {
    const { values, positionals } = parse(argv, { ...NODE_FLAGS, ...SAID, parent: { type: 'string' }, after: { type: 'string' } },
      'ai add box|problem --title "<t>" --user-said "<quote>" [--drafted] [--parent <id>] [--after <id>] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]', 1);
    if (!['box', 'problem'].includes(positionals[0])) throw new Error(`Say "box" or "problem", not "${positionals[0]}".`);
    const said = quoteOf(values);
    return addNode(data, { kind: positionals[0], title: values.title, parent: values.parent, after: values.after,
      desc: values.desc, contract: contractOf(values), source: values.drafted ? 'ai-draft' : 'ai-scribe', said }, now);
  },
  edit(data, argv, now) {
    const { values, positionals } = parse(argv, { ...NODE_FLAGS, ...SAID },
      'ai edit <id> --user-said "<quote>" [--drafted] [--title ..] [--desc ..] [--input ..] [--output ..] [--check ..] [--limits ..]', 1);
    const said = quoteOf(values);
    return editNode(data, positionals[0], { title: values.title, desc: values.desc, contract: contractOf(values), said, drafted: values.drafted }, 'ai', now);
  },
  project(data, argv, now) {
    const { values } = parse(argv, { 'user-said': SAID['user-said'], input: { type: 'string' }, output: { type: 'string' } },
      'ai project --user-said "<quote>" [--input ..] [--output ..]', 0);
    return setProject(data, values, 'ai', now, quoteOf(values));
  },
  gap(data, argv, now) {
    const { values, positionals } = parse(argv, { missing: { type: 'string' }, where: { type: 'string' }, kind: { type: 'string' } },
      'ai gap <nodeId> --missing "<what is missing>" [--kind edge-case|architecture|assumption|order|other] [--where "<location>"]', 1);
    return `raised ${raiseGapChecked(data, positionals[0], values.missing, values.where, now, values.kind)} on ${positionals[0]}`;
  },
};

// Read-only commands. Each takes (data, argv, dir) and returns text.
const READING = {
  render: (data, argv, dir) => `rendered ${renderFile(dir)}`,
  open(data, argv, dir) {
    const { values } = parse(argv, { quiet: { type: 'boolean' } }, 'open [--quiet]', 0);
    const file = renderFile(dir);
    if (openFile(file)) return values.quiet ? '' : `opened ${file}`;
    return values.quiet ? '' : `Could not open a browser. The page is here: ${file}`;
  },
  ls: (data) => ls(data),
  show: (data, argv) => show(data, parse(argv, {}, 'show <id>', 1).positionals[0]),
  check(data, argv) {
    const { positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true });
    if (positionals.length > 1) throw new Error(`Usage: ${T} check [id]`);
    return checkText(data, positionals[0]);
  },
  log: (data, argv) => log(data, Number(parse(argv, { last: { type: 'string' } }, 'log [--last N]', 0).values.last || 20)),
  brief: (data) => brief(data),
};

// Looks up an `ai` subcommand, or explains what the AI may run.
function aiHandler(sub) {
  if (AI[sub]) return AI[sub];
  throw new Error(`"${T} ai ${sub || ''}" is not an AI command. The AI may run: ${Object.keys(AI).map((k) => `${T} ai ${k}`).join(', ')}. Approving and deciding are the user's job.`);
}

// Runs one command against a data folder. Used by run() and by the demo.
export function execute(dir, argv, now = new Date().toISOString()) {
  const [cmd, ...rest] = argv;
  const handler = cmd === 'ai' ? aiHandler(rest[0]) : MUTATING[cmd];
  if (handler) {
    const args = cmd === 'ai' ? rest.slice(1) : rest;
    const result = mutate(dir, (data) => handler(data, args, now)); // save first,
    renderQuiet(dir); // render second: a render failure only warns
    return result;
  }
  if (READING[cmd]) return READING[cmd](load(dir), rest, dir);
  throw new Error(`Unknown command "${cmd}". Run: ${T} help`);
}

// Entry point for the CLI: finds the project and runs the command.
export function run(argv, cwd) {
  const [cmd] = argv;
  if (!cmd || cmd === 'help') return HELP;
  if (cmd === 'init') return initProject(cwd, argv.slice(1));
  if (cmd !== 'ai' && !MUTATING[cmd] && !READING[cmd]) throw new Error(`Unknown command "${cmd}". Run: ${T} help`);
  const project = findProject(cwd);
  for (const w of project.warnings) console.error(w);
  if (!project.exists) throw new Error(`No ${DATA_DIR}/ here. Run: ${T} init "<name>"`);
  return execute(project.dir, argv);
}
