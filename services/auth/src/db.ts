import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export const createDb = (url: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
export type Db = ReturnType<typeof createDb>;
