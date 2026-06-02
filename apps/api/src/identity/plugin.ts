import type { FastifyInstance } from 'fastify';
import type { AuditLog } from '../audit/audit-log';
import { AuthnError, AuthzError } from './errors';
import { authorize } from './rbac';
import { signDevToken, type TokenVerifier } from './token';

// Routes that never require authentication (no PHI).
const PUBLIC_PATHS = new Set([
  '/health',
  '/fhir/metadata',
  '/admin/codesystems',
  '/auth/dev-login',
]);

const BREAK_GLASS_HEADER = 'x-break-the-glass-reason';

export interface AuthDeps {
  tokenVerifier?: TokenVerifier;
  auditLog: AuditLog;
}

/**
 * Wires authentication and authorization as global hooks (fail-closed):
 *  - onRequest authenticates the bearer token for non-public routes.
 *  - preHandler enforces the route's declared permission, allowing emergency
 *    READ via break-the-glass (which is audited downstream).
 * A denied authorization is itself recorded to the audit log.
 */
export function registerAuth(app: FastifyInstance, deps: AuthDeps): void {
  app.addHook('onRequest', async (request) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (PUBLIC_PATHS.has(path)) return;

    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AuthnError('Missing bearer token');
    }
    if (!deps.tokenVerifier) {
      throw new AuthnError('Authentication is not configured on this server');
    }
    try {
      request.principal = await deps.tokenVerifier.verify(header.slice('Bearer '.length));
    } catch {
      throw new AuthnError('Invalid or expired token');
    }

    const reason = request.headers[BREAK_GLASS_HEADER];
    if (typeof reason === 'string' && reason.trim().length > 0) {
      request.emergencyReason = reason.trim();
    }
  });

  app.addHook('preHandler', async (request) => {
    const authz = request.routeOptions.config?.authz;
    if (!authz) return;

    const principal = request.principal;
    if (!principal) throw new AuthnError();

    if (authorize(principal, authz.resourceType, authz.action)) return;

    // Break-the-glass grants emergency READ only; the access is loud and logged.
    if (authz.action === 'read' && request.emergencyReason) return;

    await deps.auditLog.record({
      actor: principal.subject,
      action: authz.action,
      resourceType: authz.resourceType,
      outcome: 'denied',
      sourceIp: request.ip,
    });
    throw new AuthzError(`${principal.subject} lacks ${authz.resourceType}:${authz.action}`);
  });
}

/**
 * Registers a development-only login endpoint that mints a dev token. Enabled
 * by the server only when AUTH_DEV_SECRET is set. Never enable in production.
 */
export function registerDevLogin(app: FastifyInstance, secret: string): void {
  app.post('/auth/dev-login', (request, reply) => {
    const body = (request.body ?? {}) as { sub?: string; roles?: string[]; name?: string };
    const token = signDevToken(
      {
        sub: body.sub ?? 'dev-user',
        roles: body.roles ?? ['system-admin'],
        ...(body.name ? { name: body.name } : {}),
      },
      secret,
    );
    reply.send({ access_token: token, token_type: 'Bearer' });
  });
}
