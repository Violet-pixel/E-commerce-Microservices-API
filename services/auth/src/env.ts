import { z } from 'zod';
import { BaseEnv, DatabaseEnv, RedisEnv, ServiceClientEnv, loadConfig } from '@cesto/core';

export const Env = BaseEnv.extend(DatabaseEnv.shape)
  .extend(RedisEnv.shape)
  .extend(ServiceClientEnv.shape)
  .extend({
    PORT: z.coerce.number().int().default(4001),
    ACCESS_TOKEN_TTL: z.coerce.number().int().min(60).max(86_400).default(900),
    REFRESH_TOKEN_TTL: z.coerce.number().int().min(3600).default(2_592_000),
    AUTH_CODE_TTL: z.coerce.number().int().min(10).max(600).default(60),
    WEB_REDIRECT_URIS: z.string().default('http://localhost:8080/callback,http://localhost:5173/callback'),
    SEED_DEMO: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    DEMO_PASSWORD: z.string().min(8).default('Cesto@2026')
  });

export const env = loadConfig(Env);
