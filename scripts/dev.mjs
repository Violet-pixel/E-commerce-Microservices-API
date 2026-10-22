import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const file = resolve(root, '.env');
const fromFile = existsSync(file)
  ? Object.fromEntries(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
        .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()])
    )
  : {};
const env = { ...fromFile, ...process.env };
const db = (name) => `postgresql://${env.DB_USER ?? 'cesto'}:${env.DB_PASSWORD ?? 'cesto'}@${env.DB_HOST ?? 'localhost'}:${env.DB_PORT ?? '5432'}/cesto_${name}`;
const mode = process.argv.includes('--built') ? 'built' : 'watch';

const services = [
  { name: 'auth', port: 4001, db: true },
  { name: 'catalog', port: 4002, db: true },
  { name: 'inventory', port: 4003, db: true },
  { name: 'cart', port: 4004, db: false },
  { name: 'orders', port: 4005, db: true },
  { name: 'payments', port: 4006, db: true },
  { name: 'notifications', port: 4007, db: true },
  { name: 'gateway', port: 8000, db: false }
];

const shared = {
  AUTH_URL: 'http://localhost:4001',
  CATALOG_URL: 'http://localhost:4002',
  INVENTORY_URL: 'http://localhost:4003',
  CART_URL: 'http://localhost:4004',
  ORDERS_URL: 'http://localhost:4005',
  PAYMENTS_URL: 'http://localhost:4006',
  NOTIFICATIONS_URL: 'http://localhost:4007'
};

const colors = [31, 32, 33, 34, 35, 36, 91, 92];
const children = [];

const start = (service, index) => {
  const cwd = resolve(root, 'services', service.name);
  const args = mode === 'built' ? ['dist/main.js'] : [resolve(root, 'node_modules/tsx/dist/cli.mjs'), 'watch', 'src/main.ts'];
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...env, ...shared, PORT: String(service.port), ...(service.db ? { DATABASE_URL: db(service.name) } : {}) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const tag = `\x1b[${colors[index % colors.length]}m${service.name.padEnd(13)}\x1b[0m`;
  const pipe = (stream) => stream.on('data', (chunk) => chunk.toString().split('\n').filter(Boolean).forEach((line) => console.log(`${tag} ${line}`)));
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => console.log(`${tag} saiu com código ${code}`));
  children.push(child);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

start(services[0], 0);
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch('http://localhost:4001/health')).ok) break;
  } catch {}
  await wait(500);
}
services.slice(1).forEach((service, i) => start(service, i + 1));

const stop = () => {
  children.forEach((child) => child.kill('SIGTERM'));
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
