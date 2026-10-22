import { z } from 'zod';
import { BaseEnv, DatabaseEnv, RedisEnv, loadConfig } from '@cesto/core';

export const env = loadConfig(
  BaseEnv.extend(DatabaseEnv.shape)
    .extend(RedisEnv.shape)
    .extend({
      PORT: z.coerce.number().int().default(4003),
      SEED_DEMO: z
        .enum(['true', 'false'])
        .default('true')
        .transform((v) => v === 'true')
    })
);
