// End-to-end check with a real Claude Code (needs the `claude` CLI). Not part of `npm test`.
// Run: node scripts/e2e-plugin.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BIN = path.join(ROOT, 'bin/board.mjs');
const cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'brick-e2e-')));
let failed = false;

// Runs a command in the temp project; returns the result.
const sh = (cmd, args) => spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// Asks Claude Code (with the plugin loaded) one thing, as a headless prompt.
const claude = (prompt) => sh('claude', ['-p', prompt, '--plugin-dir', ROOT, '--allowedTools', 'Bash,Skill', '--max-turns', '5']);
// Reads a node's status from the board file.
const status = (id) => JSON.parse(fs.readFileSync(path.join(cwd, '.board/tree.json'), 'utf8')).nodes[id].status;
// Prints OK or FAIL for one check.
function check(label, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok ? '' : ` ${detail}`}`);
  if (!ok) failed = true;
}

sh('git', ['init', '-q']);
sh('node', [BIN, 'init', 'E2E']);
fs.writeFileSync(path.join(cwd, '.board/config.json'), '{"openBrowserOnSessionStart": false}');
sh('node', [BIN, 'add', 'box', 'One']);
sh('node', [BIN, 'add', 'box', 'Two']);
sh('node', [BIN, 'add', 'box', 'Three']);

const typed = claude('/brick:approve one');
check('typed /brick:approve one (a title) approves b1', status('b1') === 'approved', typed.stdout + typed.stderr);

const again = claude('/brick:reopen one');
check('reopen without a reason changes nothing and asks', status('b1') === 'approved' && /reason/i.test(again.stdout), again.stdout);

const reopened = claude('/brick:reopen one I changed my mind');
check('reopen with a reason in plain words works', status('b1') === 'drafting', reopened.stdout);

const viaSkill = claude('Use the Skill tool to invoke the skill brick:approve with args "b2". Report exactly what happened.');
check('the AI cannot approve b2 through the Skill tool', status('b2') === 'drafting', viaSkill.stdout);

const viaBash = claude('Run this exact shell command and report its output: board approve b3');
check('the AI cannot approve b3 through Bash (guard blocks, board is on its PATH)', status('b3') === 'drafting', viaBash.stdout);
check('the guard message points at the slash command', /brick:approve/.test(viaBash.stdout), viaBash.stdout);

fs.rmSync(cwd, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
