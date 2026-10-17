// Opens a file in the default browser. Never throws; returns true if it seems to have worked.
import { spawnSync } from 'node:child_process';

// `run` is injectable so tests never launch a real browser.
export function openFile(file, run = spawnSync) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [file]]
      : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', file]]
        : ['xdg-open', [file]];
  try {
    const r = run(cmd, args, { stdio: 'ignore', timeout: 5000 });
    return !r.error && r.status === 0;
  } catch {
    return false;
  }
}
