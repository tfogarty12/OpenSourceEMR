// Helpers for tests that need authenticated requests. Not production code.
import { InMemoryFhirStore } from '../fhir-store/in-memory-store';
import { InMemoryAuditLog } from '../audit/audit-log';
import { DevTokenVerifier, signDevToken } from '../identity/token';
import { dependenciesFor, type AppDependencies } from '../app';

export const TEST_SECRET = 'test-secret-not-for-production';

/** App dependencies wired with a dev token verifier and a fresh in-memory store. */
export function testDependencies(): AppDependencies {
  return dependenciesFor(new InMemoryFhirStore(), {
    auditLog: new InMemoryAuditLog(),
    tokenVerifier: new DevTokenVerifier(TEST_SECRET),
  });
}

/** Build an Authorization header for a caller with the given roles. */
export function bearer(roles: string[], sub = 'tester'): string {
  return `Bearer ${signDevToken({ sub, roles }, TEST_SECRET)}`;
}
