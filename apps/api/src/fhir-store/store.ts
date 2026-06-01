import type { Resource } from '@osemr/fhir-model';

/**
 * FHIR store facade.
 *
 * A small persistence service for FHIR resources, kept deliberately boring and
 * backend-agnostic. Two implementations exist: an in-memory store (dev/tests)
 * and a Postgres store (durable, versioned). Domain code depends only on this
 * interface.
 *
 * Writes are versioned: every create/update/delete bumps `meta.versionId` and
 * appends to history, which gives us an audit trail and a path to vread/$history
 * later. Deletes are soft (the record is retained, hidden from read/search).
 */
export interface FhirStore {
  /** Create a new resource. If `id` is absent one is generated. */
  create<T extends Resource>(resource: T): Promise<T>;
  /** Read the current (non-deleted) version, or undefined. */
  read(resourceType: string, id: string): Promise<Resource | undefined>;
  /** Update (or create at a known id), bumping the version. */
  update<T extends Resource>(resource: T): Promise<T>;
  /** Soft-delete. Returns true if a live resource was deleted. */
  remove(resourceType: string, id: string): Promise<boolean>;
  /** Search current (non-deleted) resources of a type by supported params. */
  search(resourceType: string, params: SearchParams): Promise<Resource[]>;
}

export type SearchParams = Record<string, string | undefined>;

/** Result-control params that are not filters (ignored by the matcher). */
export const RESULT_PARAMS = new Set(['_count', '_sort', '_offset', '_include', '_format']);

/** Stamp FHIR meta (version + lastUpdated) onto a copy of a resource. */
export function stampMeta<T extends Resource>(
  resource: T,
  versionId: number,
  lastUpdated: string,
): T {
  return {
    ...resource,
    meta: { ...resource.meta, versionId: String(versionId), lastUpdated },
  };
}

// --- Supported search parameters -------------------------------------------
// One registry, consulted by BOTH the in-memory matcher and the Postgres SQL
// builder, so the two backends cannot drift apart in what they support.

type ParamDef =
  | { kind: 'id' }
  | { kind: 'string'; paths: ('name.family' | 'name.given')[] }
  | { kind: 'token-identifier' }
  | { kind: 'equals'; field: string }
  | { kind: 'reference'; field: string; targetType: string };

export const SEARCH_PARAMS: Record<string, Record<string, ParamDef>> = {
  Patient: {
    _id: { kind: 'id' },
    identifier: { kind: 'token-identifier' },
    family: { kind: 'string', paths: ['name.family'] },
    name: { kind: 'string', paths: ['name.family', 'name.given'] },
    birthdate: { kind: 'equals', field: 'birthDate' },
    gender: { kind: 'equals', field: 'gender' },
    active: { kind: 'equals', field: 'active' },
  },
  Practitioner: {
    _id: { kind: 'id' },
    identifier: { kind: 'token-identifier' },
    family: { kind: 'string', paths: ['name.family'] },
    name: { kind: 'string', paths: ['name.family', 'name.given'] },
  },
  Encounter: {
    _id: { kind: 'id' },
    patient: { kind: 'reference', field: 'subject', targetType: 'Patient' },
    status: { kind: 'equals', field: 'status' },
  },
};

export function paramDef(resourceType: string, name: string): ParamDef | undefined {
  return SEARCH_PARAMS[resourceType]?.[name];
}

/** Normalize a reference search value: `123` and `Patient/123` are equivalent. */
export function normalizeReference(targetType: string, value: string): string {
  return value.includes('/') ? value : `${targetType}/${value}`;
}

// --- In-memory matching (shared by InMemoryFhirStore) -----------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function namePartStrings(resource: Resource, part: 'family' | 'given'): string[] {
  const names = (resource as { name?: unknown }).name;
  if (!Array.isArray(names)) return [];
  const out: string[] = [];
  for (const entry of names) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const v = rec[part];
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) for (const g of v) if (typeof g === 'string') out.push(g);
  }
  return out;
}

function matchesParam(def: ParamDef, resource: Resource, value: string): boolean {
  switch (def.kind) {
    case 'id':
      return resource.id === value;
    case 'string': {
      const needle = value.toLowerCase();
      const haystack = def.paths.flatMap((p) =>
        namePartStrings(resource, p === 'name.family' ? 'family' : 'given'),
      );
      return haystack.some((s) => s.toLowerCase().includes(needle));
    }
    case 'token-identifier': {
      const identifiers = (resource as { identifier?: unknown }).identifier;
      if (!Array.isArray(identifiers)) return false;
      const [a, b] = value.split('|');
      const wantSystem = b === undefined ? undefined : a;
      const wantValue = b === undefined ? a : b;
      return identifiers.some((id) => {
        const rec = asRecord(id);
        if (!rec) return false;
        const systemOk = wantSystem === undefined || rec['system'] === wantSystem;
        return systemOk && rec['value'] === wantValue;
      });
    }
    case 'equals': {
      const actual = (resource as unknown as Record<string, unknown>)[def.field];
      return actual !== undefined && String(actual) === value;
    }
    case 'reference': {
      const ref = asRecord((resource as unknown as Record<string, unknown>)[def.field])?.[
        'reference'
      ];
      return ref === normalizeReference(def.targetType, value);
    }
  }
}

/** True if `resource` satisfies all supported, non-empty filter params (AND). */
export function matchesSearch(
  resourceType: string,
  resource: Resource,
  params: SearchParams,
): boolean {
  for (const [name, raw] of Object.entries(params)) {
    if (raw === undefined || raw === '' || RESULT_PARAMS.has(name)) continue;
    const def = paramDef(resourceType, name);
    if (!def) continue; // unknown params are ignored (FHIR lenient default)
    if (!matchesParam(def, resource, raw)) return false;
  }
  return true;
}
