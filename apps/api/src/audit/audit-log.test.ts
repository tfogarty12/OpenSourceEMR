import { describe, it, expect } from 'vitest';
import {
  InMemoryAuditLog,
  nextEvent,
  verifyEventChain,
  type AuditEvent,
  type AuditInput,
} from './audit-log';

const sample: AuditInput = {
  actor: 'u1',
  action: 'read',
  resourceType: 'Patient',
  resourceId: 'p1',
  outcome: 'success',
};

describe('audit chain primitives', () => {
  it('chains events: each prevHash links to the prior hash', () => {
    const e1 = nextEvent(sample, undefined);
    const e2 = nextEvent({ ...sample, action: 'update' }, e1);
    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(e2.prevHash).toBe(e1.hash);
    expect(verifyEventChain([e1, e2])).toBe(true);
  });

  it('detects a tampered field', () => {
    const e1 = nextEvent(sample, undefined);
    const e2 = nextEvent({ ...sample, action: 'delete' }, e1);
    const tampered: AuditEvent = { ...e2, actor: 'attacker' };
    expect(verifyEventChain([e1, tampered])).toBe(false);
  });

  it('detects a removed/reordered event', () => {
    const e1 = nextEvent(sample, undefined);
    const e2 = nextEvent(sample, e1);
    const e3 = nextEvent(sample, e2);
    // drop e2 from the middle -> chain broken
    expect(verifyEventChain([e1, e3])).toBe(false);
  });
});

describe('InMemoryAuditLog', () => {
  it('records and verifies an intact chain', async () => {
    const log = new InMemoryAuditLog();
    await log.record(sample);
    await log.record({ ...sample, action: 'update' });
    await log.record({
      actor: 'u2',
      action: 'search',
      resourceType: 'Patient',
      outcome: 'success',
    });

    const events = await log.list();
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(await log.verifyChain()).toBe(true);
  });

  it('captures break-the-glass context', async () => {
    const log = new InMemoryAuditLog();
    await log.record({ ...sample, emergencyAccess: true, reason: 'code blue' });
    const [event] = await log.list();
    expect(event?.emergencyAccess).toBe(true);
    expect(event?.reason).toBe('code blue');
  });
});
