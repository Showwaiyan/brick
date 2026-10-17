// Seeds the "User login" demo by running the real commands (so the rules are exercised too).
import { execute } from './commands.mjs';
import { mutate } from './store.mjs';
import { raiseGap } from './rules.mjs';

// Each step is one command line, as an argument list.
const STEPS = [
  ['project', '--input', 'username + password', '--output', 'logged in'],
  ['add', 'box', 'Validate input'],
  ['add', 'box', 'Look up user'],
  ['add', 'box', 'Check password'],
  ['add', 'box', 'Create session'],
  ['add', 'box', 'Sign in with Google', '--after', 'b2'],
  ['add', 'problem', 'Trim + length check', '--parent', 'b1', '--input', 'raw username and password text',
    '--output', 'trimmed text, or an error', '--check', 'a name of 1 to 64 characters after trimming passes; 65 fails'],
  ['add', 'problem', 'Reject empty fields', '--parent', 'b1', '--input', 'trimmed username and password',
    '--output', 'ok, or a "missing field" error', '--check', 'an empty username or an empty password is rejected'],
  ['add', 'problem', 'Query by username', '--parent', 'b2', '--input', 'username',
    '--output', 'the user record, or "not found"', '--check', 'a known user returns a record; an unknown one returns "not found"'],
  ['add', 'problem', 'Hash comparison', '--parent', 'b3', '--input', 'password and stored hash',
    '--output', 'match or no match', '--check', 'the right password matches; a wrong one does not'],
  ['add', 'problem', 'Rate-limit attempts', '--parent', 'b3'],
  ...['p1', 'p2', 'b1', 'p3', 'b2', 'p4'].map((id) => ['approve', id]),
  ['supersede', 'b5', '--why', 'Dropped OAuth: the client only needs a password.', '--by', 'b2'],
];

// Runs the steps against a data folder, then raises the one gap.
export function seedDemo(dir) {
  for (const step of STEPS) execute(dir, step);
  const now = new Date().toISOString();
  mutate(dir, (data) => raiseGap(data, 'ai', 'b3', 'Nothing says what happens when the username does not exist.', null, now));
}
