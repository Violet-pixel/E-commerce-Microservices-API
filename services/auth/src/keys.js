import { exportJWK, generateKeyPair, importJWK, SignJWT } from 'jose';

export const loadSigner = async (db, issuer, audience) => {
  let key = await db.signingKey.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  if (!key) {
    const pair = await generateKeyPair('RS256', { extractable: true, modulusLength: 2048 });
    const kid = crypto.randomUUID();
    const privateJwk = { ...(await exportJWK(pair.privateKey)), kid, alg: 'RS256', use: 'sig' };
    const publicJwk = { ...(await exportJWK(pair.publicKey)), kid, alg: 'RS256', use: 'sig' };
    key = await db.signingKey.create({ data: { kid, privateJwk, publicJwk } });
  }
  const privateKey = await importJWK(key.privateJwk, 'RS256');
  const kid = key.kid;
  return {
    kid,
    async sign(claims, options) {
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid, typ: 'at+jwt' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(options.subject)
        .setIssuedAt()
        .setJti(crypto.randomUUID())
        .setExpirationTime(`${options.expiresInSeconds}s`)
        .sign(privateKey);
    },
    async jwks() {
      const keys = await db.signingKey.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
      return { keys: keys.map((k) => k.publicJwk) };
    }
  };
};
