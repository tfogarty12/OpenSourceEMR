import { describe, it, expect, beforeEach } from 'vitest';
import type { Patient } from '@osemr/fhir-model';
import { InMemoryFhirStore } from '../fhir-store/in-memory-store';
import { EmpiService, EmpiError } from './service';

function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    resourceType: 'Patient',
    name: [{ family: 'Carter', given: ['Elizabeth'] }],
    birthDate: '1980-04-12',
    gender: 'female',
    ...overrides,
  };
}

describe('EmpiService', () => {
  let store: InMemoryFhirStore;
  let empi: EmpiService;

  beforeEach(() => {
    store = new InMemoryFhirStore();
    empi = new EmpiService(store);
  });

  describe('match', () => {
    it('ranks a near-duplicate as a strong candidate', async () => {
      await store.create(patient());
      await store.create(
        patient({ name: [{ family: 'Okafor', given: ['Chidi'] }], gender: 'male' }),
      );

      const candidates = await empi.match(
        patient({ name: [{ family: 'Carter', given: ['Beth'] }] }),
      );
      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.patient.name?.[0]?.family).toBe('Carter');
      expect(candidates[0]?.grade).toBeDefined();
    });

    it('treats a shared identifier as a certain match', async () => {
      await store.create(patient({ identifier: [{ system: 'urn:mrn', value: 'A1' }] }));
      const candidates = await empi.match(
        patient({
          name: [{ family: 'Different' }],
          identifier: [{ system: 'urn:mrn', value: 'A1' }],
        }),
      );
      expect(candidates[0]?.grade).toBe('certain');
      expect(candidates[0]?.score).toBe(1);
    });

    it('excludes already-merged (inactive) patients', async () => {
      const a = await store.create(patient());
      const b = await store.create(patient());
      await empi.merge(a.id!, b.id!);
      const candidates = await empi.match(patient());
      // Only the surviving (active) patient remains a candidate.
      expect(candidates.every((c) => c.patient.active !== false)).toBe(true);
      expect(candidates.some((c) => c.patient.id === a.id)).toBe(false);
    });
  });

  describe('merge / unmerge', () => {
    it('merges source into target with reciprocal links and inactivation', async () => {
      const source = await store.create(patient());
      const target = await store.create(patient());

      await empi.merge(source.id!, target.id!);

      const storedSource = (await store.read('Patient', source.id!)) as Patient;
      const storedTarget = (await store.read('Patient', target.id!)) as Patient;
      expect(storedSource.active).toBe(false);
      expect(storedSource.link).toContainEqual({
        other: { reference: `Patient/${target.id}` },
        type: 'replaced-by',
      });
      expect(storedTarget.link).toContainEqual({
        other: { reference: `Patient/${source.id}` },
        type: 'replaces',
      });
    });

    it('reverses a merge on unmerge', async () => {
      const source = await store.create(patient());
      const target = await store.create(patient());
      await empi.merge(source.id!, target.id!);

      await empi.unmerge(source.id!);

      const storedSource = (await store.read('Patient', source.id!)) as Patient;
      const storedTarget = (await store.read('Patient', target.id!)) as Patient;
      expect(storedSource.active).toBe(true);
      expect(storedSource.link ?? []).toHaveLength(0);
      expect(storedTarget.link ?? []).toHaveLength(0);
    });

    it('rejects invalid merges', async () => {
      const a = await store.create(patient());
      await expect(empi.merge(a.id!, a.id!)).rejects.toMatchObject({ code: 'invalid' });
      await expect(empi.merge(a.id!, 'missing')).rejects.toMatchObject({ code: 'not-found' });
    });

    it('rejects merging an already-merged patient and unmerging an unmerged one', async () => {
      const source = await store.create(patient());
      const target = await store.create(patient());
      await empi.merge(source.id!, target.id!);

      await expect(empi.merge(source.id!, target.id!)).rejects.toBeInstanceOf(EmpiError);
      await expect(empi.unmerge(target.id!)).rejects.toMatchObject({ code: 'conflict' });
    });
  });
});
