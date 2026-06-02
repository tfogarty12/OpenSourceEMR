import type { FastifyInstance } from 'fastify';
import { operationOutcome, searchset, type Encounter } from '@osemr/fhir-model';
import type { EncounterRepository } from '../encounters/repository';
import type { AuditLog } from '../audit/audit-log';
import { recordAudit } from '../audit/record';
import type { AdmitCommand, AdtService, DischargeCommand, TransferCommand } from './service';

const FHIR_JSON = 'application/fhir+json';

export interface AdtRouteDeps {
  encounters: EncounterRepository;
  adt: AdtService;
  auditLog: AuditLog;
}

const writeEncounter = {
  config: { authz: { resourceType: 'Encounter', action: 'write' as const } },
};
const readEncounter = { config: { authz: { resourceType: 'Encounter', action: 'read' as const } } };

/**
 * Registers the ADT workflow endpoints and read/search of the Encounter
 * resources they produce. Each route declares its permission and audits the
 * action. Lifecycle errors become FHIR OperationOutcomes via the app's error
 * handler.
 */
export function registerAdtRoutes(app: FastifyInstance, deps: AdtRouteDeps): void {
  const { adt, encounters, auditLog } = deps;

  app.post('/adt/admit', writeEncounter, async (request, reply) => {
    const body = (request.body ?? {}) as Partial<AdmitCommand>;
    const encounter = await adt.admit({
      patientId: body.patientId ?? '',
      location: body.location ?? '',
      ...(body.classCode ? { classCode: body.classCode } : {}),
    });
    await recordAudit(auditLog, request, {
      action: 'admit',
      resourceType: 'Encounter',
      resourceId: encounter.id ?? '',
      outcome: 'success',
    });
    reply.code(201).type(FHIR_JSON).send(encounter);
  });

  app.post('/adt/encounters/:id/transfer', writeEncounter, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Partial<TransferCommand>;
    const encounter = await adt.transfer(id, { toLocation: body.toLocation ?? '' });
    await recordAudit(auditLog, request, {
      action: 'transfer',
      resourceType: 'Encounter',
      resourceId: id,
      outcome: 'success',
    });
    reply.type(FHIR_JSON).send(encounter);
  });

  app.post('/adt/encounters/:id/discharge', writeEncounter, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Partial<DischargeCommand>;
    const command: DischargeCommand = body.disposition ? { disposition: body.disposition } : {};
    const encounter = await adt.discharge(id, command);
    await recordAudit(auditLog, request, {
      action: 'discharge',
      resourceType: 'Encounter',
      resourceId: id,
      outcome: 'success',
    });
    reply.type(FHIR_JSON).send(encounter);
  });

  app.post('/adt/encounters/:id/cancel', writeEncounter, async (request, reply) => {
    const { id } = request.params as { id: string };
    const encounter = await adt.cancel(id);
    await recordAudit(auditLog, request, {
      action: 'cancel',
      resourceType: 'Encounter',
      resourceId: id,
      outcome: 'success',
    });
    reply.type(FHIR_JSON).send(encounter);
  });

  app.get('/fhir/Encounter/:id', readEncounter, async (request, reply) => {
    const { id } = request.params as { id: string };
    const encounter = await encounters.findById(id);
    await recordAudit(auditLog, request, {
      action: 'read',
      resourceType: 'Encounter',
      resourceId: id,
      outcome: 'success',
    });
    if (!encounter) {
      reply
        .code(404)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'not-found', `Encounter/${id} not found`));
      return;
    }
    reply.type(FHIR_JSON).send(encounter);
  });

  app.get('/fhir/Encounter', readEncounter, async (request, reply) => {
    const { patient } = request.query as { patient?: string };
    if (!patient) {
      reply
        .code(400)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'required', "search parameter 'patient' is required"));
      return;
    }
    const results: Encounter[] = await encounters.findByPatient(patient);
    await recordAudit(auditLog, request, {
      action: 'search',
      resourceType: 'Encounter',
      outcome: 'success',
    });
    reply.type(FHIR_JSON).send(searchset(results));
  });
}
