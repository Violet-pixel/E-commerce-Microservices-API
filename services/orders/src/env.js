import { z } from 'zod';
import { BaseEnv, DatabaseEnv, RedisEnv, ServiceClientEnv, loadConfig } from '@cesto/core';

export const env = loadConfig(
  BaseEnv.extend(DatabaseEnv.shape)
    .extend(RedisEnv.shape)
    .extend(ServiceClientEnv.shape)
    .extend({
      PORT: z.coerce.number().int().default(4005),
      CATALOG_URL: z.url().default('http://localhost:4002'),
      CART_URL: z.url().default('http://localhost:4004')
    })
);
