import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../app';
import { bearer, testDependencies } from '../test-support/auth';

const app = buildApp({}, testDependencies());
const auth = { authorization: bearer(['physician']) };

afterAll(async () => {
  await app.close();
});

function createPatient(payload: Record<string, unknown>) {
  return app
    .inject({
      method: 'POST',
      url: '/fhir/Patient',
      headers: auth,
      payload: { resourceType: 'Patient', ...payload },
    })
    .then((r) => r.json());
}

describe('EMPI routes', () => {
  it('$match returns scored candidates as a searchset Bundle', async () => {
    await createPatient({ name: [{ family: 'Vega', given: ['Maria'] }], birthDate: '1975-06-01' });

    const res = await app.inject({
      method: 'POST',
      url: '/fhir/Patient/$match',
      headers: auth,
      payload: {
        resourceType: 'Patient',
        name: [{ family: 'Vega', given: ['Maria'] }],
        birthDate: '1975-06-01',
      },
    });
    expect(res.statusCode).toBe(200);
    const bundle = res.json();
    expect(bundle.type).toBe('searchset');
    expect(bundle.total).toBeGreaterThanOrEqual(1);
    expect(bundle.entry[0].search.mode).toBe('match');
    expect(bundle.entry[0].search.score).toBeGreaterThan(0.5);
  });

  it('$merge links the duplicate and $unmerge reverses it', async () => {
    const source = await createPatient({ name: [{ family: 'Dup' }] });
    const target = await createPatient({ name: [{ family: 'Survivor' }] });

    const merge = await app.inject({
      method: 'POST',
      url: `/fhir/Patient/${source.id}/$merge`,
      headers: auth,
      payload: { targetId: target.id },
    });
    expect(merge.statusCode).toBe(200);

    const afterMerge = await app.inject({
      method: 'GET',
      url: `/fhir/Patient/${source.id}`,
      headers: auth,
    });
    expect(afterMerge.json().active).toBe(false);
    expect(afterMerge.json().link[0]).toMatchObject({
      type: 'replaced-by',
      other: { reference: `Patient/${target.id}` },
    });

    const unmerge = await app.inject({
      method: 'POST',
      url: `/fhir/Patient/${source.id}/$unmerge`,
      headers: auth,
      payload: {},
    });
    expect(unmerge.statusCode).toBe(200);
    expect(unmerge.json().active).toBe(true);

    const afterUnmerge = await app.inject({
      method: 'GET',
      url: `/fhir/Patient/${source.id}`,
      headers: auth,
    });
    expect(afterUnmerge.json().link ?? []).toHaveLength(0);
  });

  it('returns 409 when merging an already-merged patient', async () => {
    const source = await createPatient({ name: [{ family: 'A' }] });
    const target = await createPatient({ name: [{ family: 'B' }] });
    await app.inject({
      method: 'POST',
      url: `/fhir/Patient/${source.id}/$merge`,
      headers: auth,
      payload: { targetId: target.id },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/fhir/Patient/${source.id}/$merge`,
      headers: auth,
      payload: { targetId: target.id },
    });
    expect(second.statusCode).toBe(409);
  });

  it('requires Patient:write to merge (nurse is forbidden) and a token to match', async () => {
    const source = await createPatient({ name: [{ family: 'C' }] });
    const target = await createPatient({ name: [{ family: 'D' }] });

    const forbidden = await app.inject({
      method: 'POST',
      url: `/fhir/Patient/${source.id}/$merge`,
      headers: { authorization: bearer(['nurse']) },
      payload: { targetId: target.id },
    });
    expect(forbidden.statusCode).toBe(403);

    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/fhir/Patient/$match',
      payload: { resourceType: 'Patient' },
    });
    expect(unauthenticated.statusCode).toBe(401);
  });
});
