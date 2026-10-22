import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'node_modules/prisma/build/index.js');
for (const name of ['auth', 'catalog', 'inventory', 'orders', 'payments', 'notifications']) {
  execFileSync(process.execPath, [cli, 'generate'], {
    cwd: resolve(root, 'services', name),
    stdio: 'inherit',
    env: { DATABASE_URL: 'postgresql://cesto:cesto@localhost:5432/cesto', ...process.env }
  });
}
