import { describe, it, expect, vi } from 'vitest';
import { ApiError, FhirClient } from './client';

function makeResponse(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

function headersFrom(fetchImpl: ReturnType<typeof vi.fn>): Record<string, string> {
  const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
  return init.headers as Record<string, string>;
}

describe('FhirClient', () => {
  it('attaches the bearer token and content type', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { resourceType: 'Patient' }));
    const client = new FhirClient({ getToken: () => 'tok-123', fetchImpl });
    await client.request('/fhir/Patient/1');
    expect(headersFrom(fetchImpl)['authorization']).toBe('Bearer tok-123');
    expect(headersFrom(fetchImpl)['content-type']).toBe('application/json');
  });

  it('adds the break-the-glass header when a reason is given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, {}));
    const client = new FhirClient({ getToken: () => 't', fetchImpl });
    await client.getPatient('1', 'patient unresponsive');
    expect(headersFrom(fetchImpl)['x-break-the-glass-reason']).toBe('patient unresponsive');
  });

  it('calls onUnauthorized and throws on 401', async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(401));
    const client = new FhirClient({ getToken: () => null, onUnauthorized, fetchImpl });
    await expect(client.request('/x')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('surfaces a 403 as break-glass-eligible with the OperationOutcome message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeResponse(403, {
        resourceType: 'OperationOutcome',
        issue: [{ code: 'forbidden', diagnostics: 'lacks Encounter:read' }],
      }),
    );
    const client = new FhirClient({ getToken: () => 't', fetchImpl });
    const error = await client.request('/fhir/Encounter/1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).breakGlassEligible).toBe(true);
    expect((error as ApiError).message).toBe('lacks Encounter:read');
  });

  it('builds the search-by-patient URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { resourceType: 'Bundle' }));
    const client = new FhirClient({ getToken: () => 't', fetchImpl });
    await client.searchByPatient('Condition', 'pt 1');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/fhir/Condition?patient=pt%201');
  });
});
