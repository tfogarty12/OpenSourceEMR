import Fastify, { type FastifyServerOptions } from 'fastify';
import { operationOutcome } from '@osemr/fhir-model';
import { CodeSystems } from '@osemr/terminology';
import { FhirStoreEncounterRepository, type EncounterRepository } from './encounters/repository';
import { AdtService } from './adt/service';
import { AdtError } from './adt/errors';
import { registerAdtRoutes } from './adt/routes';
import type { FhirStore } from './fhir-store/store';
import { InMemoryFhirStore } from './fhir-store/in-memory-store';
import { registerResourceRoutes } from './resources/routes';

const FHIR_JSON = 'application/fhir+json';

/** Resource types served by the generic FHIR CRUD/search routes. */
const RESOURCE_ROUTES = ['Patient', 'Practitioner'] as const;

/** Application dependencies, injectable so tests can supply their own. */
export interface AppDependencies {
  fhirStore: FhirStore;
  encounters: EncounterRepository;
  adt: AdtService;
}

/** Build the application's services on top of a given FHIR store. */
export function dependenciesFor(fhirStore: FhirStore): AppDependencies {
  const encounters = new FhirStoreEncounterRepository(fhirStore);
  const adt = new AdtService(encounters);
  return { fhirStore, encounters, adt };
}

/** Default wiring: in-memory FHIR store (swapped for Postgres when configured). */
export function defaultDependencies(): AppDependencies {
  return dependenciesFor(new InMemoryFhirStore());
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
          'Phase 0. Patient/Practitioner CRUD+search, Encounter read/search, ' +
          'and ADT (admit/transfer/discharge/cancel) operations are available; ' +
          'not yet FHIR-conformant. Do not use for patient care.',
        resource: [
          {
            type: 'Patient',
            interaction: [
              { code: 'read' },
              { code: 'create' },
              { code: 'update' },
              { code: 'delete' },
              { code: 'search-type' },
            ],
            searchParam: [
              { name: 'identifier', type: 'token' },
              { name: 'family', type: 'string' },
              { name: 'name', type: 'string' },
              { name: 'birthdate', type: 'date' },
            ],
          },
          {
            type: 'Practitioner',
            interaction: [
              { code: 'read' },
              { code: 'create' },
              { code: 'update' },
              { code: 'delete' },
              { code: 'search-type' },
            ],
          },
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

  // FHIR CRUD + search for the resource types we serve generically.
  for (const resourceType of RESOURCE_ROUTES) {
    registerResourceRoutes(app, deps.fhirStore, resourceType);
  }

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
