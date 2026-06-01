import { describe, it, expect } from 'vitest';
import { authorize } from './rbac';
import type { Principal } from './types';

function principal(roles: string[]): Principal {
  return { subject: 'u', roles, scopes: [] };
}

describe('authorize', () => {
  it('grants by exact permission', () => {
    expect(authorize(principal(['physician']), 'Patient', 'write')).toBe(true);
    expect(authorize(principal(['physician']), 'Encounter', 'read')).toBe(true);
  });

  it('denies what a role does not grant', () => {
    expect(authorize(principal(['patient']), 'Patient', 'write')).toBe(false);
    expect(authorize(principal(['registration']), 'Encounter', 'read')).toBe(false);
    expect(authorize(principal(['nurse']), 'Patient', 'write')).toBe(false);
  });

  it('honors the system-admin wildcard', () => {
    expect(authorize(principal(['system-admin']), 'Patient', 'write')).toBe(true);
    expect(authorize(principal(['system-admin']), 'AuditEvent', 'read')).toBe(true);
  });

  it('unions permissions across multiple roles', () => {
    expect(authorize(principal(['patient', 'registration']), 'Patient', 'write')).toBe(true);
  });

  it('denies unknown roles', () => {
    expect(authorize(principal(['intruder']), 'Patient', 'read')).toBe(false);
  });
});
