import { rmSync } from 'node:fs';
import { globSync } from 'node:fs';

for (const pattern of ['services/*/src/generated', 'apps/web/dist']) {
  for (const path of globSync(pattern)) rmSync(path, { recursive: true, force: true });
}
