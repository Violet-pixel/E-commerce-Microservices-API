import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

export const createDb = (url) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
