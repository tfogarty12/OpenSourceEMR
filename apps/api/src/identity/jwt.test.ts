import { describe, it, expect } from 'vitest';
import { signHs256, verifyHs256 } from './jwt';

const secret = 'unit-test-secret';

describe('HS256 JWT', () => {
  it('round-trips claims', () => {
    const token = signHs256({ sub: 'u1', roles: ['nurse'], scope: 'patient/*.read' }, secret);
    const claims = verifyHs256(token, secret);
    expect(claims.sub).toBe('u1');
    expect(claims.roles).toEqual(['nurse']);
    expect(claims.scope).toBe('patient/*.read');
    expect(typeof claims.exp).toBe('number');
  });

  it('rejects a wrong secret', () => {
    const token = signHs256({ sub: 'u1' }, secret);
    expect(() => verifyHs256(token, 'other-secret')).toThrow();
  });

  it('rejects a tampered payload', () => {
    const token = signHs256({ sub: 'u1', roles: ['nurse'] }, secret);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'u1', roles: ['system-admin'] })).toString(
      'base64url',
    );
    expect(() => verifyHs256(`${header}.${forged}.${signature}`, secret)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = signHs256({ sub: 'u1' }, secret, -1);
    expect(() => verifyHs256(token, secret)).toThrow(/expired/i);
  });

  it('rejects a token without a subject', () => {
    const token = signHs256({ sub: '' }, secret);
    expect(() => verifyHs256(token, secret)).toThrow(/subject/i);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyHs256('not-a-jwt', secret)).toThrow();
  });
});
