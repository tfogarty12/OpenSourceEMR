import Fastify, { type FastifyServerOptions } from 'fastify';
import { operationOutcome } from '@osemr/fhir-model';
import { CodeSystems } from '@osemr/terminology';

const FHIR_JSON = 'application/fhir+json';

/**
 * A deliberately minimal FHIR CapabilityStatement. It advertises that this is
 * an (early, not-yet-conformant) FHIR R4 server. As real resources land in
 * Phase 1, their interactions get described here.
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
          'Phase 0 skeleton. No clinical resources are served yet; do not use for patient care.',
        resource: [],
      },
    ],
  };
}

/**
 * Builds the Fastify application. Kept separate from server start-up so tests
 * can drive it via `app.inject(...)` without binding a port.
 */
export function buildApp(options: FastifyServerOptions = {}) {
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
