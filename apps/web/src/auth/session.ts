// Token storage and decoding for the dev auth flow. The token is kept in
// sessionStorage so a refresh doesn't force re-login, but it does not survive
// closing the tab. Real OIDC would replace this.

const TOKEN_KEY = 'osemr.token';

export interface SessionUser {
  subject: string;
  roles: string[];
  name?: string;
}

export function loadToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable (e.g. private mode) — token stays in memory only */
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
}

/** Decode a JWT payload for display only (never trusted for authorization). */
export function decodeUser(token: string): SessionUser | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const claims = JSON.parse(base64UrlDecode(payload)) as {
      sub?: string;
      roles?: string[];
      name?: string;
    };
    if (!claims.sub) return null;
    return {
      subject: claims.sub,
      roles: claims.roles ?? [],
      ...(claims.name ? { name: claims.name } : {}),
    };
  } catch {
    return null;
  }
}
