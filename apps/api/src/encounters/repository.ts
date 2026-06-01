import type { Encounter } from '@osemr/fhir-model';
import type { FhirStore } from '../fhir-store/store';

/**
 * Persistence boundary for Encounter resources.
 *
 * The ADT service depends only on this narrow interface, never on a concrete
 * store. It can be backed by the in-memory implementation below (fast unit
 * tests) or by the FHIR store facade (`FhirStoreEncounterRepository`), which is
 * what the running application uses.
 */
export interface EncounterRepository {
  save(encounter: Encounter): Promise<Encounter>;
  findById(id: string): Promise<Encounter | undefined>;
  findByPatient(patientId: string): Promise<Encounter[]>;
}

/**
 * Adapts the generic FhirStore to the EncounterRepository port. `save` is an
 * upsert: a new admission creates the Encounter; later lifecycle steps update
 * it (bumping its version and history).
 */
export class FhirStoreEncounterRepository implements EncounterRepository {
  constructor(private readonly store: FhirStore) {}

  async save(encounter: Encounter): Promise<Encounter> {
    if (!encounter.id) throw new Error('Encounter must have an id before it can be saved');
    const existing = await this.store.read('Encounter', encounter.id);
    const saved = existing
      ? await this.store.update(encounter)
      : await this.store.create(encounter);
    return saved as Encounter;
  }

  async findById(id: string): Promise<Encounter | undefined> {
    return (await this.store.read('Encounter', id)) as Encounter | undefined;
  }

  async findByPatient(patientId: string): Promise<Encounter[]> {
    return (await this.store.search('Encounter', { patient: patientId })) as Encounter[];
  }
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
