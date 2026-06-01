import { describe, it, expect, beforeEach } from 'vitest';
import type { Encounter, Patient, Practitioner } from '@osemr/fhir-model';
import { InMemoryFhirStore } from './in-memory-store';

function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    resourceType: 'Patient',
    name: [{ family: 'Carter', given: ['Elizabeth'] }],
    identifier: [{ system: 'urn:mrn', value: '12345' }],
    birthDate: '1980-04-12',
    active: true,
    ...overrides,
  };
}

describe('InMemoryFhirStore', () => {
  let store: InMemoryFhirStore;

  beforeEach(() => {
    store = new InMemoryFhirStore();
  });

  describe('lifecycle & versioning', () => {
    it('creates with a generated id and version 1', async () => {
      const created = await store.create(patient());
      expect(created.id).toBeTruthy();
      expect(created.meta?.versionId).toBe('1');
      expect(created.meta?.lastUpdated).toBeTruthy();

      const read = await store.read('Patient', created.id!);
      expect(read?.id).toBe(created.id);
    });

    it('honors a provided id on create', async () => {
      const created = await store.create(patient({ id: 'fixed-1' }));
      expect(created.id).toBe('fixed-1');
    });

    it('bumps the version on update', async () => {
      const created = await store.create(patient());
      const updated = await store.update({ ...created, active: false });
      expect(updated.meta?.versionId).toBe('2');
      const read = (await store.read('Patient', created.id!)) as Patient;
      expect(read.active).toBe(false);
    });

    it('soft-deletes: read and search no longer see it', async () => {
      const created = await store.create(patient());
      expect(await store.remove('Patient', created.id!)).toBe(true);
      expect(await store.read('Patient', created.id!)).toBeUndefined();
      expect(await store.search('Patient', {})).toHaveLength(0);
      // deleting again reports nothing was deleted
      expect(await store.remove('Patient', created.id!)).toBe(false);
    });
  });

  describe('Patient search', () => {
    beforeEach(async () => {
      await store.create(patient());
      await store.create(
        patient({
          name: [{ family: 'Nguyen', given: ['Sam'] }],
          identifier: [{ system: 'urn:mrn', value: '67890' }],
          birthDate: '1991-01-01',
        }),
      );
    });

    it('matches family case-insensitively and as a substring', async () => {
      expect(await store.search('Patient', { family: 'cart' })).toHaveLength(1);
      expect(await store.search('Patient', { family: 'NGUYEN' })).toHaveLength(1);
    });

    it('matches given names via the name param', async () => {
      const results = (await store.search('Patient', { name: 'sam' })) as Patient[];
      expect(results).toHaveLength(1);
      expect(results[0]?.name?.[0]?.family).toBe('Nguyen');
    });

    it('matches identifier by value and by system|value', async () => {
      expect(await store.search('Patient', { identifier: '12345' })).toHaveLength(1);
      expect(await store.search('Patient', { identifier: 'urn:mrn|12345' })).toHaveLength(1);
      expect(await store.search('Patient', { identifier: 'other|12345' })).toHaveLength(0);
      expect(await store.search('Patient', { identifier: '00000' })).toHaveLength(0);
    });

    it('matches birthdate exactly and supports _id', async () => {
      expect(await store.search('Patient', { birthdate: '1980-04-12' })).toHaveLength(1);
      const all = (await store.search('Patient', {})) as Patient[];
      const target = all[0]!;
      expect(await store.search('Patient', { _id: target.id! })).toHaveLength(1);
    });

    it('ANDs multiple params and ignores unknown ones', async () => {
      expect(
        await store.search('Patient', { family: 'cart', birthdate: '1991-01-01' }),
      ).toHaveLength(0);
      expect(await store.search('Patient', { unsupported: 'x' })).toHaveLength(2);
    });
  });

  it('searches Practitioner by family and Encounter by patient/status', async () => {
    const prac: Practitioner = {
      resourceType: 'Practitioner',
      name: [{ family: 'Lee' }],
    };
    await store.create(prac);
    expect(await store.search('Practitioner', { family: 'lee' })).toHaveLength(1);

    const enc: Encounter = {
      resourceType: 'Encounter',
      status: 'in-progress',
      subject: { reference: 'Patient/p1' },
    };
    await store.create(enc);
    expect(await store.search('Encounter', { patient: 'p1' })).toHaveLength(1);
    expect(await store.search('Encounter', { patient: 'Patient/p1' })).toHaveLength(1);
    expect(await store.search('Encounter', { patient: 'p2' })).toHaveLength(0);
    expect(await store.search('Encounter', { status: 'finished' })).toHaveLength(0);
  });
});
