#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const workerName = process.argv[2] || 'operit-api';
const deployArgs = process.argv.slice(3);
const workerDir = resolve(scriptDir, workerName);
const envPath = resolve(rootDir, '.env.local');

if (!/^[a-z0-9-]+$/i.test(workerName) || !existsSync(workerDir)) {
  throw new Error(`Unknown worker: ${workerName}`);
}

if (!existsSync(resolve(workerDir, 'wrangler.toml'))) {
  throw new Error(`Missing wrangler.toml: ${workerDir}`);
}

loadEnvFile(envPath);
if (!process.env.CLOUDFLARE_API_TOKEN) {
  throw new Error('Missing CLOUDFLARE_API_TOKEN in .env.local');
}

if (workerName === 'market') {
  await run(packageCommand('npm'), ['run', 'build'], workerDir);
}

await run(packageCommand('npx'), ['--yes', 'wrangler@latest', 'deploy', '--minify', ...deployArgs], workerDir);

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function packageCommand(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const windowsCommand = process.platform === 'win32'
      ? {
          command: process.env.ComSpec || 'cmd.exe',
          args: ['/d', '/c', command, ...args],
        }
      : { command, args };
    const child = spawn(windowsCommand.command, windowsCommand.args, {
      cwd,
      env: process.env,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}
