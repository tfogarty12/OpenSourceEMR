import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from './app';
import { bearer, testDependencies } from './test-support/auth';

const app = buildApp({}, testDependencies());

afterAll(async () => {
  await app.close();
});

describe('API', () => {
  it('GET /health returns ok (public)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'osemr-api' });
  });

  it('GET /fhir/metadata returns a FHIR R4 CapabilityStatement (public)', async () => {
    const res = await app.inject({ method: 'GET', url: '/fhir/metadata' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/fhir+json');
    const body = res.json();
    expect(body.resourceType).toBe('CapabilityStatement');
    expect(body.fhirVersion).toBe('4.0.1');
  });

  it('GET /admin/codesystems lists known canonical systems (public)', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/codesystems' });
    expect(res.statusCode).toBe(200);
    expect(res.json().codeSystems).toContain('http://loinc.org');
  });

  it('protected routes require authentication (401 without a token)', async () => {
    const res = await app.inject({ method: 'GET', url: '/fhir/Patient/anything' });
    expect(res.statusCode).toBe(401);
    expect(res.json().resourceType).toBe('OperationOutcome');
  });

  it('unknown (authenticated) routes return a FHIR OperationOutcome 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
      headers: { authorization: bearer(['system-admin']) },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.resourceType).toBe('OperationOutcome');
    expect(body.issue[0].code).toBe('not-found');
  });
});
