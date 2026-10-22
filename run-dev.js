import { spawn } from 'child_process';
import path from 'path';

console.log('====================================================');
console.log('  Starting SafeSignal Full-Stack Application...    ');
console.log('====================================================');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const nodeCmd = isWindows ? 'node.exe' : 'node';

// 1. Start Backend API Server
const server = spawn(nodeCmd, ['server/src/server.js'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: isWindows
});

server.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[36m[Backend]\x1b[0m ${data}`);
});

server.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[31m[Backend Error]\x1b[0m ${data}`);
});

// 2. Start Frontend Vite Client
const client = spawn(npmCmd, ['--prefix', 'client', 'run', 'dev', '--', '--port', '5173'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: isWindows
});

client.stdout.on('data', (data) => {
  process.stdout.write(`\x1b[35m[Frontend]\x1b[0m ${data}`);
});

client.stderr.on('data', (data) => {
  process.stderr.write(`\x1b[31m[Frontend Error]\x1b[0m ${data}`);
});

// Clean shutdown on Ctrl+C
function cleanup() {
  console.log('\nStopping SafeSignal servers...');
  server.kill('SIGINT');
  client.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
