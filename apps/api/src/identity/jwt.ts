import { createHmac, timingSafeEqual } from 'node:crypto';

// A minimal, dependency-free HS256 JWT implementation for the dev token path.
// Production OIDC (RS256 + JWKS discovery) plugs in behind the TokenVerifier
// interface; we deliberately do not hand-roll asymmetric crypto.

export interface JwtClaims {
  sub: string;
  name?: string;
  roles?: string[];
  scope?: string;
  iat?: number;
  exp?: number;
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signHs256(claims: JwtClaims, secret: string, ttlSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ ...claims, iat: now, exp: now + ttlSeconds });
  const data = `${header}.${payload}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifyHs256(token: string, secret: string): JwtClaims {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw new Error('Malformed token');
  }
  const data = `${header}.${payload}`;
  const expected = createHmac('sha256', secret).update(data).digest();
  const provided = Buffer.from(signature, 'base64url');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('Invalid token signature');
  }
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtClaims;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && now >= claims.exp) {
    throw new Error('Token expired');
  }
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new Error('Token missing subject');
  }
  return claims;
}
