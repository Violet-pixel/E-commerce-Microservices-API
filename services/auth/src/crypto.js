import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const PARAMS = { N: 16384, r: 8, p: 1 };

export const hashSecret = async (secret) => {
  const salt = randomBytes(16);
  const key = await scryptAsync(secret, salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${salt.toString('base64url')}$${key.toString('base64url')}`;
};

export const verifySecret = async (secret, stored) => {
  const [scheme, n, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(secret, Buffer.from(salt, 'base64url'), expected.length, { ...PARAMS, N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const pkceChallenge = (verifier) => createHash('sha256').update(verifier).digest('base64url');

export const verifyPkce = (verifier, challenge) => {
  const computed = Buffer.from(pkceChallenge(verifier));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
};
