import { signHs256, verifyHs256, type JwtClaims } from './jwt';
import type { Principal } from './types';

/**
 * Verifies a bearer token and yields a Principal. The application depends only
 * on this interface, so a real OIDC/JWKS verifier can replace the dev one
 * without touching route or authorization code.
 */
export interface TokenVerifier {
  verify(token: string): Promise<Principal>;
}

function principalFromClaims(claims: JwtClaims): Principal {
  const principal: Principal = {
    subject: claims.sub,
    roles: claims.roles ?? [],
    scopes: claims.scope ? claims.scope.split(' ').filter(Boolean) : [],
  };
  if (claims.name !== undefined) principal.name = claims.name;
  return principal;
}

/**
 * HS256 token verifier for local development and tests. NOT for production —
 * it uses a shared symmetric secret. Enabled only when AUTH_DEV_SECRET is set.
 */
export class DevTokenVerifier implements TokenVerifier {
  constructor(private readonly secret: string) {}

  verify(token: string): Promise<Principal> {
    try {
      return Promise.resolve(principalFromClaims(verifyHs256(token, this.secret)));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error('Invalid token'));
    }
  }
}

/** Mint a dev token (used by the dev-login endpoint and tests). */
export function signDevToken(claims: JwtClaims, secret: string, ttlSeconds?: number): string {
  return signHs256(claims, secret, ttlSeconds);
}
