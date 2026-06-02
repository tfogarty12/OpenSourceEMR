import type { Bundle, Patient, Resource } from '@osemr/fhir-model';

export interface AuditEvent {
  seq: number;
  recordedAt: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: string;
  sourceIp?: string;
  emergencyAccess?: boolean;
  reason?: string;
}

export interface AuditPage {
  total: number;
  valid: boolean;
  events: AuditEvent[];
}

interface OperationOutcomeLike {
  resourceType?: string;
  issue?: { diagnostics?: string; code?: string }[];
}

/** An error from an API call, carrying the HTTP status and any OperationOutcome. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** A 403 can potentially be retried with break-the-glass (for reads). */
  get breakGlassEligible(): boolean {
    return this.status === 403;
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  breakTheGlassReason?: string;
}

export interface ClientDeps {
  baseUrl?: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
}

export class FhirClient {
  constructor(private readonly deps: ClientDeps) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const doFetch = this.deps.fetchImpl ?? fetch;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const token = this.deps.getToken();
    if (token) headers['authorization'] = `Bearer ${token}`;
    if (options.breakTheGlassReason) {
      headers['x-break-the-glass-reason'] = options.breakTheGlassReason;
    }

    const response = await doFetch(`${this.deps.baseUrl ?? ''}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });

    if (response.status === 401) {
      this.deps.onUnauthorized?.();
      throw new ApiError(401, 'Authentication required');
    }

    const text = await response.text();
    const data: unknown = text ? JSON.parse(text) : undefined;

    if (!response.ok) {
      const outcome = data as OperationOutcomeLike | undefined;
      const message =
        outcome?.issue?.[0]?.diagnostics ?? `Request failed with status ${response.status}`;
      throw new ApiError(response.status, message);
    }
    return data as T;
  }

  // --- Auth -----------------------------------------------------------------
  devLogin(subject: string, roles: string[]): Promise<{ access_token: string }> {
    return this.request('/auth/dev-login', { method: 'POST', body: { sub: subject, roles } });
  }

  // --- Patient / EMPI -------------------------------------------------------
  searchPatients(params: Record<string, string>): Promise<Bundle<Patient>> {
    const query = new URLSearchParams(params).toString();
    return this.request(`/fhir/Patient${query ? `?${query}` : ''}`);
  }

  matchPatients(demographics: Patient): Promise<Bundle<Patient>> {
    return this.request('/fhir/Patient/$match', { method: 'POST', body: demographics });
  }

  getPatient(id: string, breakTheGlassReason?: string): Promise<Patient> {
    return this.request(`/fhir/Patient/${id}`, breakTheGlassReason ? { breakTheGlassReason } : {});
  }

  // --- Chart ----------------------------------------------------------------
  searchByPatient<T extends Resource>(
    resourceType: string,
    patientId: string,
    breakTheGlassReason?: string,
  ): Promise<Bundle<T>> {
    const path = `/fhir/${resourceType}?patient=${encodeURIComponent(patientId)}`;
    return this.request(path, breakTheGlassReason ? { breakTheGlassReason } : {});
  }

  // --- Audit ----------------------------------------------------------------
  listAudit(): Promise<AuditPage> {
    return this.request('/admin/audit');
  }
}
