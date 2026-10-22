import { z } from 'zod';

export const BaseEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  AUTH_ISSUER: z.string().default('cesto-auth'),
  AUTH_AUDIENCE: z.string().default('cesto-api'),
  AUTH_URL: z.url().default('http://localhost:4001'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:8080,http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
});
export type BaseEnv = z.infer<typeof BaseEnv>;

export const ServiceClientEnv = z.object({
  SERVICE_CLIENT_ID: z.string().default('cesto-internal'),
  SERVICE_CLIENT_SECRET: z.string().min(8)
});

export const RedisEnv = z.object({ REDIS_URL: z.string().default('redis://localhost:6379') });
export const DatabaseEnv = z.object({ DATABASE_URL: z.string().min(1) });

export const loadConfig = <S extends z.ZodType>(schema: S, source: NodeJS.ProcessEnv = process.env): z.output<S> => {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuração inválida:\n${lines}`);
  }
  return result.data;
};
