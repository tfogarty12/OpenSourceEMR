import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { createPool } from '../db/pool';
import { runMigrations } from '../db/migrate';
import { PostgresAuditLog } from './postgres-audit-log';
import type { AuditInput } from './audit-log';

const url = process.env.TEST_DATABASE_URL;

const sample: AuditInput = {
  actor: 'u1',
  action: 'read',
  resourceType: 'Patient',
  resourceId: 'p1',
  outcome: 'success',
};

describe.skipIf(!url)('PostgresAuditLog (integration)', () => {
  let pool: Pool;
  let log: PostgresAuditLog;

  beforeAll(async () => {
    pool = createPool(url);
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE audit_event');
    log = new PostgresAuditLog(pool);
  });

  it('appends sequential, hash-chained events', async () => {
    await log.record(sample);
    await log.record({ ...sample, action: 'update' });
    await log.record({ ...sample, action: 'delete', emergencyAccess: true, reason: 'emergency' });

    const events = await log.list();
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(events[2]?.emergencyAccess).toBe(true);
    expect(events[2]?.reason).toBe('emergency');
    expect(await log.verifyChain()).toBe(true);
  });

  it('persists across log instances over the same pool', async () => {
    await log.record(sample);
    const other = new PostgresAuditLog(pool);
    expect(await other.list()).toHaveLength(1);
    expect(await other.verifyChain()).toBe(true);
  });

  it('detects tampering with a stored row', async () => {
    await log.record(sample);
    await log.record({ ...sample, action: 'update' });
    await pool.query("UPDATE audit_event SET actor = 'attacker' WHERE seq = 2");
    expect(await log.verifyChain()).toBe(false);
  });
});
