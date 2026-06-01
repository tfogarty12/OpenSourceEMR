import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../app';
import { bearer, testDependencies } from '../test-support/auth';

const app = buildApp({}, testDependencies());
const auth = { authorization: bearer(['physician']) };

afterAll(async () => {
  await app.close();
});

function createPatient(payload: Record<string, unknown>, headers: Record<string, string> = auth) {
  return app.inject({
    method: 'POST',
    url: '/fhir/Patient',
    headers,
    payload: { resourceType: 'Patient', ...payload },
  });
}

describe('Patient FHIR routes', () => {
  it('creates a Patient, assigns an id, and returns 201 with Location', async () => {
    const res = await createPatient({
      name: [{ family: 'Carter', given: ['Elizabeth'] }],
      birthDate: '1980-04-12',
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.resourceType).toBe('Patient');
    expect(body.id).toBeTruthy();
    expect(body.meta.versionId).toBe('1');
    expect(res.headers['location']).toBe(`Patient/${body.id}`);
  });

  it('ignores a client-supplied id on create', async () => {
    const res = await createPatient({ id: 'client-chosen', name: [{ family: 'X' }] });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).not.toBe('client-chosen');
  });

  it('rejects a create whose resourceType is wrong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/fhir/Patient',
      headers: auth,
      payload: { resourceType: 'Practitioner' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().issue[0].code).toBe('invalid');
  });

  it('reads, updates (version bump), and deletes a Patient', async () => {
    const created = (await createPatient({ name: [{ family: 'Reyes' }], active: true })).json();

    const read = await app.inject({
      method: 'GET',
      url: `/fhir/Patient/${created.id}`,
      headers: auth,
    });
    expect(read.statusCode).toBe(200);

    const update = await app.inject({
      method: 'PUT',
      url: `/fhir/Patient/${created.id}`,
      headers: auth,
      payload: {
        resourceType: 'Patient',
        id: created.id,
        name: [{ family: 'Reyes' }],
        active: false,
      },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().meta.versionId).toBe('2');
    expect(update.json().active).toBe(false);

    const del = await app.inject({
      method: 'DELETE',
      url: `/fhir/Patient/${created.id}`,
      headers: auth,
    });
    expect(del.statusCode).toBe(204);

    const readAfter = await app.inject({
      method: 'GET',
      url: `/fhir/Patient/${created.id}`,
      headers: auth,
    });
    expect(readAfter.statusCode).toBe(404);
  });

  it('rejects an update whose body id contradicts the URL', async () => {
    const created = (await createPatient({ name: [{ family: 'Z' }] })).json();
    const res = await app.inject({
      method: 'PUT',
      url: `/fhir/Patient/${created.id}`,
      headers: auth,
      payload: { resourceType: 'Patient', id: 'different', name: [{ family: 'Z' }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('searches Patients and returns a searchset Bundle', async () => {
    await createPatient({
      name: [{ family: 'Searchme', given: ['Aaron'] }],
      birthDate: '2001-02-03',
    });

    const byFamily = await app.inject({
      method: 'GET',
      url: '/fhir/Patient?family=searchme',
      headers: auth,
    });
    expect(byFamily.statusCode).toBe(200);
    const bundle = byFamily.json();
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('searchset');
    expect(bundle.total).toBeGreaterThanOrEqual(1);
    expect(bundle.entry[0].resource.resourceType).toBe('Patient');
  });

  describe('access control', () => {
    it('returns 401 without a token', async () => {
      const res = await app.inject({ method: 'GET', url: '/fhir/Patient?family=x' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when the role lacks the permission', async () => {
      // 'patient' role may read Patient but not write it.
      const res = await createPatient(
        { name: [{ family: 'Denied' }] },
        { authorization: bearer(['patient']) },
      );
      expect(res.statusCode).toBe(403);
      expect(res.json().issue[0].code).toBe('forbidden');
    });
  });
});
