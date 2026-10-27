import { ConflictError, NotFoundError, OAuthError, UnauthenticatedError } from '@cesto/core';
import { hashSecret, randomToken, sha256, verifyPkce, verifySecret } from './crypto.js';
import { allowedForRole, grantScopes, narrowScopes } from './scopes.js';

export const toUserDto = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  createdAt: user.createdAt.toISOString()
});

export class OAuthService {
  constructor(db, signer, settings) {
    this.db = db;
    this.signer = signer;
    this.settings = settings;
  }

  async register(input) {
    const exists = await this.db.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictError('E-mail já cadastrado', { field: 'email' });
    return this.db.user.create({ data: { email: input.email, name: input.name, passwordHash: await hashSecret(input.password) } });
  }

  async me(userId) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Usuário', userId);
    return user;
  }

  async client(id, secret, grant) {
    const client = await this.db.oAuthClient.findUnique({ where: { id } });
    if (!client) throw new OAuthError('INVALID_CLIENT', 'Cliente desconhecido');
    if (client.secretHash) {
      if (!secret || !(await verifySecret(secret, client.secretHash))) throw new OAuthError('INVALID_CLIENT', 'Credenciais do cliente inválidas');
    }
    if (!client.grantTypes.includes(grant)) throw new OAuthError('UNSUPPORTED_GRANT_TYPE', `O cliente não pode usar ${grant}`);
    return client;
  }

  async authorize(input) {
    const client = await this.client(input.client_id, undefined, 'authorization_code').catch((error) => {
      if (error instanceof OAuthError && error.code === 'INVALID_CLIENT') throw new OAuthError('INVALID_CLIENT', 'Use um cliente público com PKCE');
      throw error;
    });
    if (!client.redirectUris.includes(input.redirect_uri)) throw new OAuthError('INVALID_GRANT', 'redirect_uri não registrada para o cliente');
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifySecret(input.password, user.passwordHash))) throw new UnauthenticatedError('E-mail ou senha incorretos');
    const scope = grantScopes(input.scope, client.scopes, allowedForRole(user.role));
    const code = randomToken();
    await this.db.authorizationCode.create({
      data: {
        codeHash: sha256(code),
        clientId: client.id,
        userId: user.id,
        redirectUri: input.redirect_uri,
        codeChallenge: input.code_challenge,
        scope,
        expiresAt: new Date(Date.now() + this.settings.codeTtl * 1000)
      }
    });
    return { code, state: input.state, redirect_uri: input.redirect_uri };
  }

  async token(input) {
    switch (input.grant_type) {
      case 'authorization_code':
        return this.exchangeCode(input);
      case 'refresh_token':
        return this.refresh(input);
      case 'client_credentials':
        return this.clientCredentials(input);
    }
  }

  async exchangeCode(input) {
    const client = await this.client(input.client_id, input.client_secret, 'authorization_code');
    const stored = await this.db.authorizationCode.findUnique({ where: { codeHash: sha256(input.code) }, include: { user: true } });
    if (!stored || stored.clientId !== client.id) throw new OAuthError('INVALID_GRANT', 'Código inválido');
    if (stored.usedAt) {
      await this.db.refreshToken.updateMany({ where: { userId: stored.userId, clientId: client.id, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new OAuthError('INVALID_GRANT', 'Código já utilizado');
    }
    if (stored.expiresAt < new Date()) throw new OAuthError('INVALID_GRANT', 'Código expirado');
    if (stored.redirectUri !== input.redirect_uri) throw new OAuthError('INVALID_GRANT', 'redirect_uri diferente da autorização');
    if (!verifyPkce(input.code_verifier, stored.codeChallenge)) throw new OAuthError('INVALID_GRANT', 'code_verifier não confere');
    const claimed = await this.db.authorizationCode.updateMany({ where: { codeHash: stored.codeHash, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new OAuthError('INVALID_GRANT', 'Código já utilizado');
    return this.issueForUser(stored.user, client.id, stored.scope, crypto.randomUUID());
  }

  async refresh(input) {
    const client = await this.client(input.client_id, input.client_secret, 'refresh_token');
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash: sha256(input.refresh_token) }, include: { user: true } });
    if (!stored || stored.clientId !== client.id) throw new OAuthError('INVALID_GRANT', 'Refresh token inválido');
    if (stored.revokedAt || stored.rotatedAt) {
      await this.db.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new OAuthError('INVALID_GRANT', 'Refresh token reutilizado; a sessão foi encerrada');
    }
    if (stored.expiresAt < new Date()) throw new OAuthError('INVALID_GRANT', 'Refresh token expirado');
    const rotated = await this.db.refreshToken.updateMany({ where: { id: stored.id, rotatedAt: null, revokedAt: null }, data: { rotatedAt: new Date() } });
    if (rotated.count !== 1) throw new OAuthError('INVALID_GRANT', 'Refresh token já utilizado');
    const scope = narrowScopes(input.scope, stored.scope);
    return this.issueForUser(stored.user, client.id, scope, stored.familyId);
  }

  async clientCredentials(input) {
    const client = await this.client(input.client_id, input.client_secret, 'client_credentials');
    if (!client.secretHash) throw new OAuthError('INVALID_CLIENT', 'client_credentials exige cliente confidencial');
    const scope = grantScopes(input.scope, client.scopes);
    const access = await this.signer.sign({ scope, client_id: client.id }, { subject: client.id, expiresInSeconds: this.settings.accessTtl });
    return { access_token: access, token_type: 'Bearer', expires_in: this.settings.accessTtl, scope };
  }

  async issueForUser(user, clientId, scope, familyId) {
    const access = await this.signer.sign(
      { scope, client_id: clientId, role: user.role, name: user.name, email: user.email },
      { subject: user.id, expiresInSeconds: this.settings.accessTtl }
    );
    const refresh = randomToken(48);
    await this.db.refreshToken.create({
      data: {
        tokenHash: sha256(refresh),
        familyId,
        clientId,
        userId: user.id,
        scope,
        expiresAt: new Date(Date.now() + this.settings.refreshTtl * 1000)
      }
    });
    return { access_token: access, token_type: 'Bearer', expires_in: this.settings.accessTtl, refresh_token: refresh, scope };
  }

  async revoke(token) {
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!stored) return;
    await this.db.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async purgeExpired() {
    const now = new Date();
    const [codes, tokens] = await this.db.$transaction([
      this.db.authorizationCode.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.db.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } })
    ]);
    return codes.count + tokens.count;
  }
}
