import { createHash } from 'node:crypto';

// Append-only, tamper-evident audit log.
//
// Every PHI access and change is recorded. Entries are hash-chained: each
// entry's hash covers its own fields plus the previous entry's hash, so any
// after-the-fact edit or deletion breaks the chain and is detectable via
// verifyChain(). This is the "append-only and tamper-evident" property the
// security model requires.

export type AuditOutcome = 'success' | 'denied' | 'error';

/** What a caller provides when recording an event. */
export interface AuditInput {
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: AuditOutcome;
  sourceIp?: string;
  /** True when access was granted via break-the-glass. */
  emergencyAccess?: boolean;
  reason?: string;
}

/** A persisted audit event, with chain metadata. */
export interface AuditEvent extends AuditInput {
  seq: number;
  recordedAt: string;
  prevHash: string;
  hash: string;
}

const GENESIS_HASH = '0'.repeat(64);

/** Deterministic hash over an event's content plus the previous hash. */
export function hashEvent(event: Omit<AuditEvent, 'hash'>): string {
  const canonical = JSON.stringify([
    event.seq,
    event.recordedAt,
    event.actor,
    event.action,
    event.resourceType,
    event.resourceId ?? '',
    event.outcome,
    event.sourceIp ?? '',
    event.emergencyAccess ?? false,
    event.reason ?? '',
    event.prevHash,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

/** Drop undefined-valued keys so optional fields don't pollute equality/hashing. */
function compact(input: AuditInput): AuditInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as unknown as AuditInput;
}

/** Build the next event (seq, timestamp, chained hashes) from prior state. */
export function nextEvent(input: AuditInput, prev: AuditEvent | undefined): AuditEvent {
  const prevHash = prev?.hash ?? GENESIS_HASH;
  const base: Omit<AuditEvent, 'hash'> = {
    ...compact(input),
    seq: (prev?.seq ?? 0) + 1,
    recordedAt: new Date().toISOString(),
    prevHash,
  };
  return { ...base, hash: hashEvent(base) };
}

/** Verify a fully-ordered list of events forms an intact chain. */
export function verifyEventChain(events: AuditEvent[]): boolean {
  let prevHash = GENESIS_HASH;
  for (const event of events) {
    if (event.prevHash !== prevHash) return false;
    const { hash, ...rest } = event;
    if (hashEvent(rest) !== hash) return false;
    prevHash = hash;
  }
  return true;
}

export interface AuditLog {
  record(input: AuditInput): Promise<AuditEvent>;
  list(): Promise<AuditEvent[]>;
  verifyChain(): Promise<boolean>;
}

/** In-memory audit log for dev/tests. Not durable. */
export class InMemoryAuditLog implements AuditLog {
  private readonly events: AuditEvent[] = [];

  record(input: AuditInput): Promise<AuditEvent> {
    const event = nextEvent(input, this.events[this.events.length - 1]);
    this.events.push(event);
    return Promise.resolve(event);
  }

  list(): Promise<AuditEvent[]> {
    return Promise.resolve(this.events.map((e) => ({ ...e })));
  }

  verifyChain(): Promise<boolean> {
    return Promise.resolve(verifyEventChain(this.events));
  }
}
