import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const target = process.argv[2];
const targets = {
  local: 'http://100.65.154.68:8000/api',
  staging: 'https://orgaviahr-staging-api.onrender.com/api',
};

if (!Object.hasOwn(targets, target)) {
  console.error('Choose either "local" or "staging".');
  process.exit(1);
}

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(directory, '..');
const expoBinary = path.join(projectDirectory, 'node_modules', '.bin', process.platform === 'win32' ? 'expo.cmd' : 'expo');
const expoArguments = ['start', '--clear', ...process.argv.slice(3)];

console.log(`Starting Valtireo mobile against ${target}: ${targets[target]}`);

const expo = spawn(expoBinary, expoArguments, {
  cwd: projectDirectory,
  // Expo is installed as a .cmd shim on Windows. Node can execute binaries
  // directly, but needs the shell to launch that command-wrapper.
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    EXPO_PUBLIC_API_BASE_URL: targets[target],
  },
  stdio: 'inherit',
});

expo.on('error', (error) => {
  console.error(`Could not start Expo: ${error.message}`);
  process.exit(1);
});

expo.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
