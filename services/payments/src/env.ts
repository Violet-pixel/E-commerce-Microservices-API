import { z } from 'zod';
import { BaseEnv, DatabaseEnv, RedisEnv, loadConfig } from '@cesto/core';

export const env = loadConfig(
  BaseEnv.extend(DatabaseEnv.shape)
    .extend(RedisEnv.shape)
    .extend({
      PORT: z.coerce.number().int().default(4006),
      PAYMENT_DECLINE_ABOVE_CENTS: z.coerce.number().int().positive().default(500_000),
      PAYMENT_DELAY_MS: z.coerce.number().int().min(0).max(30_000).default(800)
    })
);
