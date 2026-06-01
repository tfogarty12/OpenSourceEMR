import type { FastifyRequest } from 'fastify';
import type { AuditLog, AuditOutcome } from './audit-log';

export interface AuditFields {
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: AuditOutcome;
}

/**
 * Record an audit event for the current request, pulling actor, source IP, and
 * break-the-glass context off the request automatically.
 */
export function recordAudit(
  auditLog: AuditLog,
  request: FastifyRequest,
  fields: AuditFields,
): Promise<unknown> {
  const emergency = request.emergencyReason;
  return auditLog.record({
    actor: request.principal?.subject ?? 'anonymous',
    sourceIp: request.ip,
    action: fields.action,
    resourceType: fields.resourceType,
    ...(fields.resourceId ? { resourceId: fields.resourceId } : {}),
    outcome: fields.outcome,
    ...(emergency ? { emergencyAccess: true, reason: emergency } : {}),
  });
}
