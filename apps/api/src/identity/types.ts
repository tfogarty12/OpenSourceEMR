// Identity & access types, plus the Fastify request/route augmentations the
// auth plugin relies on.

/** An authenticated caller. */
export interface Principal {
  subject: string;
  name?: string;
  roles: string[];
  /** SMART-style scopes (space-delimited in the token). */
  scopes: string[];
}

/** The two coarse actions we authorize against (write = create/update/delete). */
export type Action = 'read' | 'write';

/** Per-route access requirement, declared in the route's Fastify config. */
export interface AuthzRequirement {
  resourceType: string;
  action: Action;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the auth plugin once the bearer token is verified. */
    principal?: Principal;
    /** Captured from the break-the-glass header, if present. */
    emergencyReason?: string;
  }
  interface FastifyContextConfig {
    /** When set, the route requires this permission. */
    authz?: AuthzRequirement;
  }
}
