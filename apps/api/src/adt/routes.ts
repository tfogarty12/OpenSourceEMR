import type { FastifyInstance } from 'fastify';
import { operationOutcome, searchset, type Encounter } from '@osemr/fhir-model';
import type { EncounterRepository } from '../encounters/repository';
import type { AdmitCommand, AdtService, DischargeCommand, TransferCommand } from './service';

const FHIR_JSON = 'application/fhir+json';

export interface AdtRouteDeps {
  encounters: EncounterRepository;
  adt: AdtService;
}

/**
 * Registers the ADT workflow endpoints and the read/search access to the
 * Encounter resources they produce. Lifecycle errors thrown by AdtService are
 * translated to FHIR OperationOutcomes by the app-level error handler.
 */
export function registerAdtRoutes(app: FastifyInstance, deps: AdtRouteDeps): void {
  const { adt, encounters } = deps;

  // Admit a patient -> new in-progress inpatient encounter.
  app.post('/adt/admit', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<AdmitCommand>;
    const encounter = await adt.admit({
      patientId: body.patientId ?? '',
      location: body.location ?? '',
      ...(body.classCode ? { classCode: body.classCode } : {}),
    });
    reply.code(201).type(FHIR_JSON).send(encounter);
  });

  // Transfer to a new location.
  app.post('/adt/encounters/:id/transfer', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Partial<TransferCommand>;
    const encounter = await adt.transfer(id, { toLocation: body.toLocation ?? '' });
    reply.type(FHIR_JSON).send(encounter);
  });

  // Discharge.
  app.post('/adt/encounters/:id/discharge', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Partial<DischargeCommand>;
    const command: DischargeCommand = body.disposition ? { disposition: body.disposition } : {};
    const encounter = await adt.discharge(id, command);
    reply.type(FHIR_JSON).send(encounter);
  });

  // Cancel an admission.
  app.post('/adt/encounters/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const encounter = await adt.cancel(id);
    reply.type(FHIR_JSON).send(encounter);
  });

  // FHIR read: GET /fhir/Encounter/:id
  app.get('/fhir/Encounter/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const encounter = await encounters.findById(id);
    if (!encounter) {
      reply
        .code(404)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'not-found', `Encounter/${id} not found`));
      return;
    }
    reply.type(FHIR_JSON).send(encounter);
  });

  // FHIR search: GET /fhir/Encounter?patient=:id -> searchset Bundle
  app.get('/fhir/Encounter', async (request, reply) => {
    const { patient } = request.query as { patient?: string };
    if (!patient) {
      reply
        .code(400)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'required', "search parameter 'patient' is required"));
      return;
    }
    const results: Encounter[] = await encounters.findByPatient(patient);
    reply.type(FHIR_JSON).send(searchset(results));
  });
}
