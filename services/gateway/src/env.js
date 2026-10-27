import { z } from 'zod';
import { BaseEnv, RedisEnv, loadConfig } from '@cesto/core';

export const env = loadConfig(
  BaseEnv.extend(RedisEnv.shape).extend({
    PORT: z.coerce.number().int().default(8000),
    CATALOG_URL: z.url().default('http://localhost:4002'),
    INVENTORY_URL: z.url().default('http://localhost:4003'),
    CART_URL: z.url().default('http://localhost:4004'),
    ORDERS_URL: z.url().default('http://localhost:4005'),
    PAYMENTS_URL: z.url().default('http://localhost:4006'),
    NOTIFICATIONS_URL: z.url().default('http://localhost:4007'),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    RATE_LIMIT_WINDOW: z.string().default('1 minute')
  })
);
