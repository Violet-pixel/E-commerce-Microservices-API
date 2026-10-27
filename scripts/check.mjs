import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const skip = new Set(['node_modules', 'generated', 'dist', 'coverage']);
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (skip.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(m?js)$/.test(entry.name) ? [path] : [];
  });

const files = ['packages', 'services', 'scripts'].flatMap((dir) => walk(resolve(root, dir)));
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log(`${files.length} arquivos verificados`);
