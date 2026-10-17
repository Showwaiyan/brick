#!/usr/bin/env node
// Thin entry point: run the command, print the result, exit 1 with a message on error.
import { run } from '../src/commands.mjs';

try {
  const out = run(process.argv.slice(2), process.cwd());
  if (out) console.log(out);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
