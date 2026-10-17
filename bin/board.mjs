#!/usr/bin/env node
// Thin entry point: run the command, print the result, exit 1 with a message on error.
import { run } from '../src/commands.mjs';
import { guardMain } from '../src/guard.mjs';

try {
  if (process.argv[2] === 'guard') {
    process.exitCode = guardMain(process.argv.slice(3), process.cwd()); // hidden: called by hooks
  } else {
    const out = run(process.argv.slice(2), process.cwd());
    if (out) console.log(out);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
