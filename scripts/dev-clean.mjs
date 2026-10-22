import { rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import process from 'node:process';

rmSync('.next', { recursive: true, force: true });

const isWindows = process.platform === 'win32';
const nextBin = isWindows ? 'node_modules\\.bin\\next.cmd' : 'node_modules/.bin/next';
const port = process.env.PORT || process.argv[2] || '3005';
const child = spawn(nextBin, ['dev', '-p', port], {
  stdio: 'inherit',
  // Windows exposes Next's executable as a .cmd shim; it must run through a shell.
  shell: isWindows,
});

child.on('error', (error) => {
  console.error('Impossible de démarrer Next.js :', error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
