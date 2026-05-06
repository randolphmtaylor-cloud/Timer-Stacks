import { spawn } from 'node:child_process';
import { loadDesktopEnv } from './env.mjs';

loadDesktopEnv();

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('[sync/env] Missing command to run');
  process.exit(1);
}

const child = spawn(command, args, {
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(`[sync/env] Failed to run ${command}:`, error);
  process.exit(1);
});
