import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../app';
import { bearer, testDependencies } from '../test-support/auth';

const app = buildApp({}, testDependencies());
const auth = { authorization: bearer(['physician']) };

afterAll(async () => {
  await app.close();
});

async function admit(patientId: string, location: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/adt/admit',
    headers: auth,
    payload: { patientId, location },
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('ADT routes', () => {
  it('runs a full admit -> transfer -> discharge flow', async () => {
    const admitted = await admit('p1', 'bed-101');
    expect(admitted.resourceType).toBe('Encounter');
    expect(admitted.status).toBe('in-progress');

    const transferRes = await app.inject({
      method: 'POST',
      url: `/adt/encounters/${admitted.id}/transfer`,
      headers: auth,
      payload: { toLocation: 'icu-3' },
    });
    expect(transferRes.statusCode).toBe(200);
    expect(transferRes.json().location).toHaveLength(2);

    const dischargeRes = await app.inject({
      method: 'POST',
      url: `/adt/encounters/${admitted.id}/discharge`,
      headers: auth,
      payload: { disposition: 'home' },
    });
    expect(dischargeRes.statusCode).toBe(200);
    expect(dischargeRes.json().status).toBe('finished');
  });

  it('reads an encounter by id and 404s for unknown ids', async () => {
    const admitted = await admit('p2', 'bed-200');

    const read = await app.inject({
      method: 'GET',
      url: `/fhir/Encounter/${admitted.id}`,
      headers: auth,
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().id).toBe(admitted.id);

    const missing = await app.inject({
      method: 'GET',
      url: '/fhir/Encounter/does-not-exist',
      headers: auth,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().resourceType).toBe('OperationOutcome');
  });

  it('searches encounters by patient and returns a Bundle', async () => {
    await admit('p3', 'bed-300');
    await admit('p3', 'bed-301');

    const res = await app.inject({
      method: 'GET',
      url: '/fhir/Encounter?patient=p3',
      headers: auth,
    });
    expect(res.statusCode).toBe(200);
    const bundle = res.json();
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('searchset');
    expect(bundle.total).toBe(2);
  });

  it('requires the patient search parameter', async () => {
    const res = await app.inject({ method: 'GET', url: '/fhir/Encounter', headers: auth });
    expect(res.statusCode).toBe(400);
    expect(res.json().issue[0].code).toBe('required');
  });

  it('maps invalid transitions to 409 OperationOutcome', async () => {
    const admitted = await admit('p4', 'bed-400');
    await app.inject({
      method: 'POST',
      url: `/adt/encounters/${admitted.id}/discharge`,
      headers: auth,
      payload: {},
    });

    const secondDischarge = await app.inject({
      method: 'POST',
      url: `/adt/encounters/${admitted.id}/discharge`,
      headers: auth,
      payload: {},
    });
    expect(secondDischarge.statusCode).toBe(409);
    expect(secondDischarge.json().issue[0].code).toBe('invalid-transition');
  });

  it('maps a transfer of an unknown encounter to 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/adt/encounters/nope/transfer',
      headers: auth,
      payload: { toLocation: 'icu-3' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().issue[0].code).toBe('not-found');
  });

  it('rejects ADT without a token (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/adt/admit',
      payload: { patientId: 'p9', location: 'bed-9' },
    });
    expect(res.statusCode).toBe(401);
  });
});
