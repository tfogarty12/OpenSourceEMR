import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from './app';

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe('API', () => {
  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'osemr-api' });
  });

  it('GET /fhir/metadata returns a FHIR R4 CapabilityStatement', async () => {
    const res = await app.inject({ method: 'GET', url: '/fhir/metadata' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/fhir+json');
    const body = res.json();
    expect(body.resourceType).toBe('CapabilityStatement');
    expect(body.fhirVersion).toBe('4.0.1');
  });

  it('GET /admin/codesystems lists known canonical systems', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/codesystems' });
    expect(res.statusCode).toBe(200);
    expect(res.json().codeSystems).toContain('http://loinc.org');
  });

  it('unknown routes return a FHIR OperationOutcome', async () => {
    const res = await app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.resourceType).toBe('OperationOutcome');
    expect(body.issue[0].code).toBe('not-found');
  });
});
