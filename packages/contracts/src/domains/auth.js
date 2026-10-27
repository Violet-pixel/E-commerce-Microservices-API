import { z } from 'zod';
import { Email, Id, IsoDate } from '../primitives.js';

export const Role = z.enum(['CUSTOMER', 'ADMIN']);

export const SCOPES = [
  'catalog:write',
  'inventory:write',
  'orders:read',
  'orders:write',
  'orders:manage',
  'cart:write',
  'notifications:read',
  'internal'
];
export const Scope = z.enum(SCOPES);

export const CUSTOMER_SCOPES = ['orders:read', 'orders:write', 'cart:write', 'notifications:read'];
export const ADMIN_SCOPES = [...CUSTOMER_SCOPES, 'catalog:write', 'inventory:write', 'orders:manage'];

export const Password = z
  .string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/, 'A senha precisa de ao menos uma letra')
  .regex(/[0-9]/, 'A senha precisa de ao menos um número');

export const UserDto = z.object({
  id: Id,
  email: z.string(),
  name: z.string(),
  role: Role,
  createdAt: IsoDate
});

export const RegisterBody = z.strictObject({
  email: Email,
  name: z.string().trim().min(2).max(80),
  password: Password
});

export const PkceChallenge = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);
export const PkceVerifier = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/);

export const AuthorizeBody = z.strictObject({
  response_type: z.literal('code'),
  client_id: z.string().min(3).max(64),
  redirect_uri: z.url(),
  code_challenge: PkceChallenge,
  code_challenge_method: z.literal('S256'),
  scope: z.string().max(400).optional(),
  state: z.string().max(200).optional(),
  email: Email,
  password: z.string().min(1).max(128)
});

export const AuthorizeResponse = z.object({
  code: z.string(),
  state: z.string().optional(),
  redirect_uri: z.string()
});

export const TokenBody = z.discriminatedUnion('grant_type', [
  z.strictObject({
    grant_type: z.literal('authorization_code'),
    code: z.string().min(10),
    redirect_uri: z.url(),
    client_id: z.string(),
    client_secret: z.string().optional(),
    code_verifier: PkceVerifier
  }),
  z.strictObject({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string().min(10),
    client_id: z.string(),
    client_secret: z.string().optional(),
    scope: z.string().optional()
  }),
  z.strictObject({
    grant_type: z.literal('client_credentials'),
    client_id: z.string(),
    client_secret: z.string().min(8),
    scope: z.string().optional()
  })
]);

export const TokenResponse = z.object({
  access_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int(),
  refresh_token: z.string().optional(),
  scope: z.string()
});

export const RevokeBody = z.strictObject({
  token: z.string().min(10),
  token_type_hint: z.enum(['refresh_token', 'access_token']).optional(),
  client_id: z.string().optional()
});

export const TokenClaims = z.object({
  sub: z.string(),
  scope: z.string(),
  client_id: z.string(),
  role: Role.optional(),
  name: z.string().optional(),
  email: z.string().optional()
});

export const Jwks = z.object({ keys: z.array(z.record(z.string(), z.unknown())) });
