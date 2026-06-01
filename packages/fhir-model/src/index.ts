// Minimal, deliberately small slice of the FHIR R4 model. This is NOT a full
// FHIR implementation — it is just enough to type the resources the Phase 0
// skeleton touches, with a clean place to grow. Apache-2.0 licensed so other
// projects can reuse it.

/** FHIR primitive: a URI. */
export type Uri = string;

/** FHIR primitive: an instant in time (ISO 8601, with timezone). */
export type Instant = string;

/** A reference to a code defined by a terminology system. */
export interface Coding {
  system?: Uri;
  code?: string;
  display?: string;
  version?: string;
}

/** A concept that may be coded and/or expressed as free text. */
export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

/** An identifier intended for computation (e.g. MRN). */
export interface Identifier {
  system?: Uri;
  value?: string;
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
}

/** A human name, with the parts FHIR cares about. */
export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  family?: string;
  given?: string[];
  text?: string;
}

/** Base shape shared by all resources. */
export interface Resource {
  resourceType: string;
  id?: string;
}

/** A FHIR Patient (minimal). */
export interface Patient extends Resource {
  resourceType: 'Patient';
  identifier?: Identifier[];
  name?: HumanName[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  active?: boolean;
}

export type IssueSeverity = 'fatal' | 'error' | 'warning' | 'information';

export interface OperationOutcomeIssue {
  severity: IssueSeverity;
  code: string;
  diagnostics?: string;
}

/** FHIR OperationOutcome — how a server reports errors and warnings. */
export interface OperationOutcome extends Resource {
  resourceType: 'OperationOutcome';
  issue: OperationOutcomeIssue[];
}

/**
 * Build an OperationOutcome. Centralizing this keeps error responses uniform
 * and FHIR-conformant across the API surface.
 */
export function operationOutcome(
  severity: IssueSeverity,
  code: string,
  diagnostics?: string,
): OperationOutcome {
  const issue: OperationOutcomeIssue =
    diagnostics === undefined ? { severity, code } : { severity, code, diagnostics };
  return { resourceType: 'OperationOutcome', issue: [issue] };
}

/** Format a HumanName for display, preferring the official name. */
export function formatHumanName(names: HumanName[] | undefined): string {
  if (!names || names.length === 0) return '(unknown)';
  const preferred = names.find((n) => n.use === 'official') ?? names[0];
  if (!preferred) return '(unknown)';
  if (preferred.text) return preferred.text;
  const given = preferred.given?.join(' ') ?? '';
  const family = preferred.family ?? '';
  const full = `${given} ${family}`.trim();
  return full.length > 0 ? full : '(unknown)';
}

/** A literal reference to another resource, e.g. `Patient/123`. */
export interface Reference {
  reference?: string;
  display?: string;
}

/** A time period with optional start/end (FHIR Period). */
export interface Period {
  start?: Instant;
  end?: Instant;
}

/** Build a Reference like `{ reference: 'Patient/123' }`. */
export function reference(resourceType: string, id: string, display?: string): Reference {
  const ref: Reference = { reference: `${resourceType}/${id}` };
  return display === undefined ? ref : { ...ref, display };
}

export type EncounterStatus =
  | 'planned'
  | 'arrived'
  | 'triaged'
  | 'in-progress'
  | 'onleave'
  | 'finished'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/** One stop in the patient's journey through locations (a bed, a unit). */
export interface EncounterLocation {
  location: Reference;
  status?: 'planned' | 'active' | 'reserved' | 'completed';
  period?: Period;
}

/** Inpatient admission/discharge details (FHIR Encounter.hospitalization). */
export interface EncounterHospitalization {
  dischargeDisposition?: CodeableConcept;
}

/** A FHIR Encounter (minimal slice used by ADT). */
export interface Encounter extends Resource {
  resourceType: 'Encounter';
  status: EncounterStatus;
  /** v3 ActCode class, e.g. IMP (inpatient), AMB (ambulatory), EMER. */
  class?: Coding;
  subject?: Reference;
  period?: Period;
  location?: EncounterLocation[];
  hospitalization?: EncounterHospitalization;
}

export interface BundleEntry<T extends Resource = Resource> {
  resource: T;
}

/** A FHIR Bundle (minimal). */
export interface Bundle<T extends Resource = Resource> extends Resource {
  resourceType: 'Bundle';
  type: 'searchset' | 'collection' | 'batch' | 'transaction';
  total?: number;
  entry?: BundleEntry<T>[];
}

/** Wrap resources in a FHIR `searchset` Bundle (how search results are returned). */
export function searchset<T extends Resource>(resources: T[]): Bundle<T> {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map((resource) => ({ resource })),
  };
}
