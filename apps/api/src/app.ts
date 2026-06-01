import Fastify, { type FastifyServerOptions } from 'fastify';
import { operationOutcome } from '@osemr/fhir-model';
import { CodeSystems } from '@osemr/terminology';
import { InMemoryEncounterRepository, type EncounterRepository } from './encounters/repository';
import { AdtService } from './adt/service';
import { AdtError } from './adt/errors';
import { registerAdtRoutes } from './adt/routes';

const FHIR_JSON = 'application/fhir+json';

/** Application dependencies, injectable so tests can supply their own. */
export interface AppDependencies {
  encounters: EncounterRepository;
  adt: AdtService;
}

/** Default wiring: in-memory persistence (swapped for Postgres later). */
export function defaultDependencies(): AppDependencies {
  const encounters = new InMemoryEncounterRepository();
  const adt = new AdtService(encounters);
  return { encounters, adt };
}

/**
 * A deliberately minimal FHIR CapabilityStatement. It advertises that this is
 * an (early, not-yet-conformant) FHIR R4 server. As real resources land, their
 * interactions get described here.
 */
function buildCapabilityStatement() {
  return {
    resourceType: 'CapabilityStatement',
    status: 'draft',
    date: new Date().toISOString(),
    publisher: 'OpenSourceEMR',
    kind: 'instance',
    software: { name: 'OpenSourceEMR API', version: '0.0.0' },
    fhirVersion: '4.0.1',
    format: ['json'],
    rest: [
      {
        mode: 'server',
        documentation:
          'Phase 0 skeleton. Encounter read/search plus ADT (admit/transfer/' +
          'discharge/cancel) operations are available; not yet FHIR-conformant. ' +
          'Do not use for patient care.',
        resource: [
          {
            type: 'Encounter',
            interaction: [{ code: 'read' }, { code: 'search-type' }],
            searchParam: [{ name: 'patient', type: 'reference' }],
          },
        ],
      },
    ],
  };
}

/**
 * Builds the Fastify application. Kept separate from server start-up so tests
 * can drive it via `app.inject(...)` without binding a port, and can inject
 * their own dependencies.
 */
export function buildApp(
  options: FastifyServerOptions = {},
  deps: AppDependencies = defaultDependencies(),
) {
  const app = Fastify(options);

  // Liveness/readiness probe (not PHI, safe to expose to orchestration).
  app.get('/health', () => ({ status: 'ok', service: 'osemr-api' }));

  // FHIR conformance endpoint.
  app.get('/fhir/metadata', (_request, reply) => {
    reply.type(FHIR_JSON).send(buildCapabilityStatement());
  });

  // Dev/admin: which terminology systems the server knows canonical URIs for.
  // Exercises the @osemr/terminology dependency; carries no licensed content.
  app.get('/admin/codesystems', () => ({ codeSystems: Object.values(CodeSystems) }));

  // ADT workflow + Encounter read/search.
  registerAdtRoutes(app, deps);

  // Translate ADT lifecycle errors into FHIR OperationOutcomes.
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AdtError) {
      const status =
        error.code === 'not-found' ? 404 : error.code === 'invalid-transition' ? 409 : 422;
      reply
        .code(status)
        .type(FHIR_JSON)
        .send(operationOutcome('error', error.code, error.message));
      return;
    }
    reply.log.error(error);
    reply
      .code(500)
      .type(FHIR_JSON)
      .send(operationOutcome('fatal', 'exception', 'Internal server error'));
  });

  // Unknown routes get a FHIR-conformant OperationOutcome, not a bare 404.
  app.setNotFoundHandler((request, reply) => {
    reply
      .code(404)
      .type(FHIR_JSON)
      .send(
        operationOutcome('error', 'not-found', `No route for ${request.method} ${request.url}`),
      );
  });

  return app;
}
