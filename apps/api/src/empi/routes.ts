import type { FastifyInstance } from 'fastify';
import { operationOutcome, type Bundle, type Patient } from '@osemr/fhir-model';
import type { AuditLog } from '../audit/audit-log';
import { recordAudit } from '../audit/record';
import { EmpiError, type EmpiService } from './service';

const FHIR_JSON = 'application/fhir+json';

const readPatient = { config: { authz: { resourceType: 'Patient', action: 'read' as const } } };
const writePatient = { config: { authz: { resourceType: 'Patient', action: 'write' as const } } };

/**
 * EMPI operations on Patient: $match (candidate ranking) and the reversible
 * $merge / $unmerge. Merges are audited with the source and target captured.
 */
export function registerEmpiRoutes(
  app: FastifyInstance,
  empi: EmpiService,
  auditLog: AuditLog,
): void {
  // POST /fhir/Patient/$match — body is a Patient with the demographics to match.
  app.post('/fhir/Patient/$match', readPatient, async (request, reply) => {
    const query = (request.body ?? {}) as Patient;
    if (query.resourceType !== 'Patient') {
      reply
        .code(400)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'invalid', 'Body must be a Patient resource'));
      return;
    }
    const candidates = await empi.match(query);
    await recordAudit(auditLog, request, {
      action: 'match',
      resourceType: 'Patient',
      outcome: 'success',
      detail: `${candidates.length} candidate(s)`,
    });
    const bundle: Bundle<Patient> = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: candidates.length,
      entry: candidates.map((c) => ({
        resource: c.patient,
        search: { mode: 'match', score: c.score },
      })),
    };
    reply.type(FHIR_JSON).send(bundle);
  });

  // POST /fhir/Patient/:id/$merge — merge :id (source) into body.targetId.
  app.post('/fhir/Patient/:id/$merge', writePatient, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { targetId?: string };
    if (!body.targetId) {
      throw new EmpiError('invalid', 'targetId is required');
    }
    const result = await empi.merge(id, body.targetId);
    await recordAudit(auditLog, request, {
      action: 'merge',
      resourceType: 'Patient',
      resourceId: id,
      outcome: 'success',
      detail: `merged into Patient/${body.targetId}`,
    });
    reply.type(FHIR_JSON).send({
      resourceType: 'Parameters',
      parameter: [
        { name: 'target', resource: result.target },
        { name: 'source', resource: result.source },
      ],
    });
  });

  // POST /fhir/Patient/:id/$unmerge — reverse a prior merge of :id.
  app.post('/fhir/Patient/:id/$unmerge', writePatient, async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await empi.unmerge(id);
    await recordAudit(auditLog, request, {
      action: 'unmerge',
      resourceType: 'Patient',
      resourceId: id,
      outcome: 'success',
    });
    reply.type(FHIR_JSON).send(source);
  });
}
