import { execFileSync } from 'node:child_process';
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
const cli = resolve(root, 'node_modules/prisma/build/index.js');

for (const name of ['auth', 'catalog', 'inventory', 'orders', 'payments', 'notifications']) {
  const url = `postgresql://${env.DB_USER ?? 'cesto'}:${env.DB_PASSWORD ?? 'cesto'}@${env.DB_HOST ?? 'localhost'}:${env.DB_PORT ?? '5432'}/cesto_${name}`;
  console.log(`migrando ${name}`);
  execFileSync(process.execPath, [cli, 'migrate', 'deploy'], { cwd: resolve(root, 'services', name), stdio: 'inherit', env: { ...env, DATABASE_URL: url } });
}
