import type { FastifyInstance } from 'fastify';
import { operationOutcome, searchset, type Resource } from '@osemr/fhir-model';
import type { FhirStore, SearchParams } from '../fhir-store/store';

const FHIR_JSON = 'application/fhir+json';

/** Take only the string-valued query entries as search params. */
function toSearchParams(query: unknown): SearchParams {
  const params: SearchParams = {};
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
      if (typeof v === 'string') params[k] = v;
    }
  }
  return params;
}

/**
 * Registers FHIR REST CRUD + search for one resource type against the FHIR
 * store: create (POST), read (GET /:id), update (PUT /:id), delete (DELETE),
 * and type-level search (GET). Responses are FHIR JSON; failures are
 * OperationOutcomes.
 */
export function registerResourceRoutes(
  app: FastifyInstance,
  store: FhirStore,
  resourceType: string,
): void {
  const base = `/fhir/${resourceType}`;

  // create
  app.post(base, async (request, reply) => {
    const body = (request.body ?? {}) as Resource;
    if (body.resourceType !== resourceType) {
      reply
        .code(400)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'invalid', `Expected resourceType '${resourceType}'`));
      return;
    }
    // The server assigns the id on create; ignore any client-supplied one.
    const { id: _ignored, ...rest } = body;
    const created = await store.create(rest as Resource);
    reply
      .code(201)
      .header('Location', `${resourceType}/${created.id}`)
      .type(FHIR_JSON)
      .send(created);
  });

  // read
  app.get(`${base}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const resource = await store.read(resourceType, id);
    if (!resource) {
      reply
        .code(404)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'not-found', `${resourceType}/${id} not found`));
      return;
    }
    reply.type(FHIR_JSON).send(resource);
  });

  // update (or create-at-id)
  app.put(`${base}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Resource;
    if (body.resourceType !== resourceType) {
      reply
        .code(400)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'invalid', `Expected resourceType '${resourceType}'`));
      return;
    }
    if (body.id && body.id !== id) {
      reply
        .code(400)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'invalid', 'Body id does not match URL id'));
      return;
    }
    const updated = await store.update({ ...body, id });
    reply.type(FHIR_JSON).send(updated);
  });

  // delete (soft)
  app.delete(`${base}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const removed = await store.remove(resourceType, id);
    if (!removed) {
      reply
        .code(404)
        .type(FHIR_JSON)
        .send(operationOutcome('error', 'not-found', `${resourceType}/${id} not found`));
      return;
    }
    reply.code(204).send();
  });

  // search
  app.get(base, async (request, reply) => {
    const results = await store.search(resourceType, toSearchParams(request.query));
    reply.type(FHIR_JSON).send(searchset(results));
  });
}
