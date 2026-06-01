import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { Patient } from '@osemr/fhir-model';
import { createPool } from '../db/pool';
import { runMigrations } from '../db/migrate';
import { PostgresFhirStore } from './postgres-store';

// Integration tests against a real Postgres. Skipped unless TEST_DATABASE_URL
// is set (so `pnpm test` is green without a database); CI provides one.
const url = process.env.TEST_DATABASE_URL;

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

describe.skipIf(!url)('PostgresFhirStore (integration)', () => {
  let pool: Pool;
  let store: PostgresFhirStore;

  beforeAll(async () => {
    pool = createPool(url);
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE fhir_resource, fhir_resource_history');
    store = new PostgresFhirStore(pool);
  });

  it('creates, reads, and keeps a history row', async () => {
    const created = await store.create(patient());
    expect(created.id).toBeTruthy();
    expect(created.meta?.versionId).toBe('1');

    const read = (await store.read('Patient', created.id!)) as Patient;
    expect(read.name?.[0]?.family).toBe('Carter');

    const history = await pool.query('SELECT version_id FROM fhir_resource_history WHERE id = $1', [
      created.id,
    ]);
    expect(history.rowCount).toBe(1);
  });

  it('updates with a version bump and appends history', async () => {
    const created = await store.create(patient());
    const updated = await store.update({ ...created, active: false });
    expect(updated.meta?.versionId).toBe('2');

    const read = (await store.read('Patient', created.id!)) as Patient;
    expect(read.active).toBe(false);

    const history = await pool.query('SELECT version_id FROM fhir_resource_history WHERE id = $1', [
      created.id,
    ]);
    expect(history.rowCount).toBe(2);
  });

  it('soft-deletes: hidden from read/search but retained in history', async () => {
    const created = await store.create(patient());
    expect(await store.remove('Patient', created.id!)).toBe(true);
    expect(await store.read('Patient', created.id!)).toBeUndefined();
    expect(await store.search('Patient', {})).toHaveLength(0);
    expect(await store.remove('Patient', created.id!)).toBe(false);

    const history = await pool.query(
      'SELECT deleted FROM fhir_resource_history WHERE id = $1 ORDER BY version_id DESC LIMIT 1',
      [created.id],
    );
    expect(history.rows[0]?.deleted).toBe(true);
  });

  it('persists across store instances over the same pool', async () => {
    const created = await store.create(patient());
    const store2 = new PostgresFhirStore(pool);
    const read = await store2.read('Patient', created.id!);
    expect(read?.id).toBe(created.id);
  });

  describe('search', () => {
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

    it('matches family (substring, case-insensitive) and name (given)', async () => {
      expect(await store.search('Patient', { family: 'cart' })).toHaveLength(1);
      expect(await store.search('Patient', { name: 'sam' })).toHaveLength(1);
    });

    it('matches identifier by value and system|value', async () => {
      expect(await store.search('Patient', { identifier: '12345' })).toHaveLength(1);
      expect(await store.search('Patient', { identifier: 'urn:mrn|12345' })).toHaveLength(1);
      expect(await store.search('Patient', { identifier: 'other|12345' })).toHaveLength(0);
    });

    it('matches birthdate and ANDs params', async () => {
      expect(await store.search('Patient', { birthdate: '1980-04-12' })).toHaveLength(1);
      expect(
        await store.search('Patient', { family: 'cart', birthdate: '1991-01-01' }),
      ).toHaveLength(0);
    });
  });
});
