import type { Pool } from 'pg';
import {
  nextEvent,
  verifyEventChain,
  type AuditEvent,
  type AuditInput,
  type AuditLog,
} from './audit-log';

// Lock key serializing audit appends so the hash chain stays consistent under
// concurrency (arbitrary constant; just needs to be stable).
const AUDIT_LOCK_KEY = 4_815_162_342;

interface AuditRow {
  seq: string;
  recorded_at: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: AuditEvent['outcome'];
  source_ip: string | null;
  emergency_access: boolean;
  reason: string | null;
  prev_hash: string;
  hash: string;
}

function rowToEvent(row: AuditRow): AuditEvent {
  const event: AuditEvent = {
    seq: Number(row.seq),
    recordedAt: row.recorded_at,
    actor: row.actor,
    action: row.action,
    resourceType: row.resource_type,
    outcome: row.outcome,
    emergencyAccess: row.emergency_access,
    prevHash: row.prev_hash,
    hash: row.hash,
  };
  if (row.resource_id !== null) event.resourceId = row.resource_id;
  if (row.source_ip !== null) event.sourceIp = row.source_ip;
  if (row.reason !== null) event.reason = row.reason;
  return event;
}

/** Postgres-backed append-only audit log (table `audit_event`). */
export class PostgresAuditLog implements AuditLog {
  constructor(private readonly pool: Pool) {}

  async record(input: AuditInput): Promise<AuditEvent> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize appends so prev/next hashes are computed against a stable tail.
      await client.query('SELECT pg_advisory_xact_lock($1)', [AUDIT_LOCK_KEY]);
      const { rows } = await client.query<AuditRow>(
        'SELECT * FROM audit_event ORDER BY seq DESC LIMIT 1',
      );
      const prev = rows[0] ? rowToEvent(rows[0]) : undefined;
      const event = nextEvent(input, prev);
      await client.query(
        `INSERT INTO audit_event
           (seq, recorded_at, actor, action, resource_type, resource_id, outcome,
            source_ip, emergency_access, reason, prev_hash, hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          event.seq,
          event.recordedAt,
          event.actor,
          event.action,
          event.resourceType,
          event.resourceId ?? null,
          event.outcome,
          event.sourceIp ?? null,
          event.emergencyAccess ?? false,
          event.reason ?? null,
          event.prevHash,
          event.hash,
        ],
      );
      await client.query('COMMIT');
      return event;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async list(): Promise<AuditEvent[]> {
    const { rows } = await this.pool.query<AuditRow>('SELECT * FROM audit_event ORDER BY seq ASC');
    return rows.map(rowToEvent);
  }

  async verifyChain(): Promise<boolean> {
    return verifyEventChain(await this.list());
  }
}
