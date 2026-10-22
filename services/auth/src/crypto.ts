import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };

export const hashSecret = async (secret: string): Promise<string> => {
  const salt = randomBytes(16);
  const key = await scryptAsync(secret, salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${salt.toString('base64url')}$${key.toString('base64url')}`;
};

export const verifySecret = async (secret: string, stored: string): Promise<boolean> => {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(secret, Buffer.from(salt, 'base64url'), expected.length, { ...PARAMS, N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export const pkceChallenge = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

export const verifyPkce = (verifier: string, challenge: string): boolean => {
  const computed = Buffer.from(pkceChallenge(verifier));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
};
