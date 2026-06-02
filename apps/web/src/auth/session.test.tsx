import { describe, it, expect } from 'vitest';
import { decodeUser } from './session';

function token(payload: object): string {
  return `header.${btoa(JSON.stringify(payload))}.sig`;
}

describe('decodeUser', () => {
  it('decodes subject, roles, and name from a JWT payload', () => {
    const user = decodeUser(token({ sub: 'dr-smith', roles: ['physician'], name: 'Dr. Smith' }));
    expect(user).toEqual({ subject: 'dr-smith', roles: ['physician'], name: 'Dr. Smith' });
  });

  it('defaults roles and omits name when absent', () => {
    expect(decodeUser(token({ sub: 'u' }))).toEqual({ subject: 'u', roles: [] });
  });

  it('returns null for malformed or subject-less tokens', () => {
    expect(decodeUser('garbage')).toBeNull();
    expect(decodeUser(token({ roles: ['x'] }))).toBeNull();
  });
});
