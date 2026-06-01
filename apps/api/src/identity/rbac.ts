import type { Action, Principal } from './types';

// Role-based access control scaffold.
//
// Permissions are `${resourceType}:${action}` strings, with `*` wildcards.
// This is a starting matrix, not a finished access model: real deployments will
// add ABAC narrowing (a clinician sees the patients they actually care for) and
// patient-scoped access. Those refinements layer on top of this baseline.

export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  'system-admin': ['*:*'],
  physician: [
    'Patient:read',
    'Patient:write',
    'Practitioner:read',
    'Encounter:read',
    'Encounter:write',
  ],
  nurse: ['Patient:read', 'Practitioner:read', 'Encounter:read', 'Encounter:write'],
  registration: ['Patient:read', 'Patient:write', 'Practitioner:read', 'Practitioner:write'],
  // Patient-facing access; ABAC narrowing to the caller's own record is a TODO.
  patient: ['Patient:read'],
};

export function permissionsFor(roles: string[]): Set<string> {
  const permissions = new Set<string>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      permissions.add(permission);
    }
  }
  return permissions;
}

/** True if the principal's roles grant `${resourceType}:${action}`. */
export function authorize(principal: Principal, resourceType: string, action: Action): boolean {
  const permissions = permissionsFor(principal.roles);
  return (
    permissions.has('*:*') ||
    permissions.has(`${resourceType}:*`) ||
    permissions.has(`*:${action}`) ||
    permissions.has(`${resourceType}:${action}`)
  );
}
