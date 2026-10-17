// Derived values. Nothing here is stored; it is all computed from tree.json.
import { PLUGIN_NAME } from './store.mjs';

const S = `/${PLUGIN_NAME}:`; // slash-command prefix: these are for the human to type

// Child nodes of a node (null = top-level boxes), ordered by `order`.
export function children(data, id) {
  return Object.values(data.nodes)
    .filter((n) => n.parent === id)
    .sort((a, b) => a.order - b.order);
}

// Children that are not superseded.
export function activeChildren(data, id) {
  return children(data, id).filter((n) => n.status !== 'superseded');
}

// A leaf is a problem with no active children.
export function isLeaf(data, id) {
  return data.nodes[id].kind === 'problem' && activeChildren(data, id).length === 0;
}

// Open gaps on a node, in id order.
export function openGaps(data, id) {
  return Object.values(data.gaps)
    .filter((g) => g.node === id && g.status === 'open')
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

// What to show for a node. First match wins.
export function displayState(data, id) {
  const n = data.nodes[id];
  if (n.status === 'superseded') return 'superseded';
  if (openGaps(data, id).length > 0) return 'has_gaps';
  return n.status; // 'approved' or 'drafting'
}

// The exact slash commands the human can type for this node right now.
export function nextCommands(data, id) {
  const n = data.nodes[id];
  const cmds = [];
  if (n.status === 'superseded') {
    if (n.superseded.cascade_from === null) cmds.push(`${S}restore ${id}`);
    return cmds;
  }
  if (n.status === 'drafting') {
    const gaps = openGaps(data, id);
    if (gaps.length === 0) cmds.push(`${S}approve ${id}`);
    for (const g of gaps) {
      cmds.push(`${S}resolve ${g.id} --note "…"`);
      cmds.push(`${S}dismiss ${g.id} --why "…"`);
    }
  }
  if (n.status === 'approved') cmds.push(`${S}reopen ${id} --why "…"`);
  cmds.push(`${S}supersede ${id} --why "…"`);
  return cmds;
}
