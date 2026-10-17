// Commands: parse arguments, call the rules, return one short line of text.
import { parseArgs } from 'node:util';
import { findProject, load, mutate, nextId, addEvent, TOOL_NAME, DATA_DIR } from './store.mjs';
import { children } from './model.mjs';
import { approve, reopen, supersede, restore, closeGap, needNode, nextOrder, blank } from './rules.mjs';
import { ls, show, log, brief, HELP } from './text.mjs';
import { initProject } from './init.mjs';

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
    if (p.status === 'approved') throw new Error(`${f.parent} is approved. Reopen it first: ${T} reopen ${f.parent} --why "…"`);
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
  addEvent(data, f.source === 'ai-scribe' ? 'ai' : 'human', 'add', id, { kind: f.kind, parent, title }, now);
  return parent ? `added ${id} under ${parent}` : `added ${id}`;
}

// Edits a drafting node. `f` = { title, desc, contract, said } with only the changed fields set.
export function editNode(data, id, f, actor, now) {
  const n = needNode(data, id);
  if (n.status === 'superseded') throw new Error(`${id} is superseded and cannot be edited.`);
  if (n.status === 'approved') throw new Error(`${id} is approved. Reopen it first: ${T} reopen ${id} --why "…"`);
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
  addEvent(data, actor, 'edit', id, { fields: changed }, now);
  return `edited ${id} (${changed.join(', ')})`;
}

// Picks the contract flags out of parsed values.
const contractOf = (v) => Object.fromEntries(CONTRACT.map((k) => [k, v[k]]));

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
    addEvent(data, 'human', 'project', null, { fields: changed }, now);
    return `updated project (${changed.join(', ')})`;
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

// Read-only commands. Each takes (data, argv) and returns text.
const READING = {
  ls: (data) => ls(data),
  show: (data, argv) => show(data, parse(argv, {}, 'show <id>', 1).positionals[0]),
  log: (data, argv) => log(data, Number(parse(argv, { last: { type: 'string' } }, 'log [--last N]', 0).values.last || 20)),
  brief: (data) => brief(data),
};

// Runs one command against a data folder. Used by run() and by the demo.
export function execute(dir, argv, now = new Date().toISOString()) {
  const [cmd, ...rest] = argv;
  if (MUTATING[cmd]) return mutate(dir, (data) => MUTATING[cmd](data, rest, now));
  if (READING[cmd]) return READING[cmd](load(dir), rest);
  throw new Error(`Unknown command "${cmd}". Run: ${T} help`);
}

// Entry point for the CLI: finds the project and runs the command.
export function run(argv, cwd) {
  const [cmd] = argv;
  if (!cmd || cmd === 'help') return HELP;
  if (cmd === 'init') return initProject(cwd, argv.slice(1));
  if (!MUTATING[cmd] && !READING[cmd]) throw new Error(`Unknown command "${cmd}". Run: ${T} help`);
  const project = findProject(cwd);
  for (const w of project.warnings) console.error(w);
  if (!project.exists) throw new Error(`No ${DATA_DIR}/ here. Run: ${T} init "<name>"`);
  return execute(project.dir, argv);
}
