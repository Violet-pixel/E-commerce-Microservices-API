import { z } from 'zod';
import { BaseEnv, RedisEnv, ServiceClientEnv, loadConfig } from '@cesto/core';

export const env = loadConfig(
  BaseEnv.extend(RedisEnv.shape)
    .extend(ServiceClientEnv.shape)
    .extend({
      PORT: z.coerce.number().int().default(4004),
      CATALOG_URL: z.url().default('http://localhost:4002'),
      CART_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
      CART_MAX_ITEMS: z.coerce.number().int().min(1).max(200).default(50)
    })
);
