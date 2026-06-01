import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, type AppDependencies } from '../app';
import { bearer, testDependencies } from '../test-support/auth';

let app: FastifyInstance;
let deps: AppDependencies;

beforeEach(() => {
  deps = testDependencies();
  app = buildApp({}, deps);
});

afterEach(async () => {
  await app.close();
});

describe('auth + audit integration', () => {
  it('records a successful create with the acting principal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/fhir/Patient',
      headers: { authorization: bearer(['physician'], 'dr-house') },
      payload: { resourceType: 'Patient', name: [{ family: 'Doe' }] },
    });
    expect(res.statusCode).toBe(201);

    const events = await deps.auditLog.list();
    const create = events.find((e) => e.action === 'create');
    expect(create?.actor).toBe('dr-house');
    expect(create?.resourceType).toBe('Patient');
    expect(create?.outcome).toBe('success');
    expect(await deps.auditLog.verifyChain()).toBe(true);
  });

  it('records denied access when a role lacks permission', async () => {
    // 'registration' cannot read Encounter.
    const res = await app.inject({
      method: 'GET',
      url: '/fhir/Encounter/whatever',
      headers: { authorization: bearer(['registration'], 'clerk-1') },
    });
    expect(res.statusCode).toBe(403);

    const denied = (await deps.auditLog.list()).find((e) => e.outcome === 'denied');
    expect(denied?.actor).toBe('clerk-1');
    expect(denied?.resourceType).toBe('Encounter');
  });

  it('break-the-glass grants emergency read and flags the audit event', async () => {
    // A physician admits a patient (creates the Encounter).
    const admit = await app.inject({
      method: 'POST',
      url: '/adt/admit',
      headers: { authorization: bearer(['physician']) },
      payload: { patientId: 'p1', location: 'bed-1' },
    });
    const encounterId = admit.json().id;

    // 'registration' normally cannot read an Encounter; break-the-glass allows it.
    const res = await app.inject({
      method: 'GET',
      url: `/fhir/Encounter/${encounterId}`,
      headers: {
        authorization: bearer(['registration'], 'clerk-2'),
        'x-break-the-glass-reason': 'patient unresponsive in ED',
      },
    });
    expect(res.statusCode).toBe(200);

    const emergency = (await deps.auditLog.list()).find((e) => e.emergencyAccess);
    expect(emergency?.actor).toBe('clerk-2');
    expect(emergency?.reason).toBe('patient unresponsive in ED');
    expect(emergency?.resourceType).toBe('Encounter');
  });

  it('exposes the audit log to admins and verifies the chain', async () => {
    await app.inject({
      method: 'POST',
      url: '/fhir/Patient',
      headers: { authorization: bearer(['physician']) },
      payload: { resourceType: 'Patient', name: [{ family: 'Roe' }] },
    });

    const asAdmin = await app.inject({
      method: 'GET',
      url: '/admin/audit',
      headers: { authorization: bearer(['system-admin']) },
    });
    expect(asAdmin.statusCode).toBe(200);
    expect(asAdmin.json().valid).toBe(true);
    expect(asAdmin.json().total).toBeGreaterThanOrEqual(1);

    const asPhysician = await app.inject({
      method: 'GET',
      url: '/admin/audit',
      headers: { authorization: bearer(['physician']) },
    });
    expect(asPhysician.statusCode).toBe(403);
  });
});
