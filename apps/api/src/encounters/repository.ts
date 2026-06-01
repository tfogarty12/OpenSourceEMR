import type { Encounter } from '@osemr/fhir-model';

/**
 * Persistence boundary for Encounter resources.
 *
 * The ADT service depends only on this interface, never on a concrete store.
 * Phase 0 ships an in-memory implementation; the Postgres-backed FHIR store
 * facade (next Phase 0 brick) drops in here without changing any ADT logic.
 */
export interface EncounterRepository {
  save(encounter: Encounter): Promise<Encounter>;
  findById(id: string): Promise<Encounter | undefined>;
  findByPatient(patientId: string): Promise<Encounter[]>;
}

/**
 * In-memory EncounterRepository for local dev and tests. Not durable — data is
 * lost on restart — and not for production. Holds no PHI beyond what a caller
 * puts in it during a session.
 */
export class InMemoryEncounterRepository implements EncounterRepository {
  private readonly store = new Map<string, Encounter>();

  save(encounter: Encounter): Promise<Encounter> {
    if (!encounter.id) {
      throw new Error('Encounter must have an id before it can be saved');
    }
    // Store a copy so later in-place mutation by callers cannot corrupt state.
    this.store.set(encounter.id, structuredClone(encounter));
    return Promise.resolve(encounter);
  }

  findById(id: string): Promise<Encounter | undefined> {
    const found = this.store.get(id);
    return Promise.resolve(found ? structuredClone(found) : undefined);
  }

  findByPatient(patientId: string): Promise<Encounter[]> {
    const ref = `Patient/${patientId}`;
    const matches = [...this.store.values()]
      .filter((e) => e.subject?.reference === ref)
      .map((e) => structuredClone(e));
    return Promise.resolve(matches);
  }
}
