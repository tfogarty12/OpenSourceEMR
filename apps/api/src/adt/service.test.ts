import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEncounterRepository } from '../encounters/repository';
import { AdtService } from './service';
import { AdtError } from './errors';

// Deterministic, monotonically increasing clock so timestamps are predictable.
function fixedClock(start = '2026-01-01T00:00:00.000Z'): () => string {
  let n = 0;
  const base = Date.parse(start);
  return () => new Date(base + n++ * 60_000).toISOString();
}

describe('AdtService', () => {
  let repo: InMemoryEncounterRepository;
  let adt: AdtService;

  beforeEach(() => {
    repo = new InMemoryEncounterRepository();
    adt = new AdtService(repo, fixedClock());
  });

  it('admits a patient into a new in-progress inpatient encounter', async () => {
    const enc = await adt.admit({ patientId: 'p1', location: 'bed-101' });
    expect(enc.id).toBeTruthy();
    expect(enc.status).toBe('in-progress');
    expect(enc.class?.code).toBe('IMP');
    expect(enc.subject?.reference).toBe('Patient/p1');
    expect(enc.period?.start).toBe('2026-01-01T00:00:00.000Z');
    expect(enc.location).toHaveLength(1);
    expect(enc.location?.[0]).toMatchObject({
      location: { reference: 'Location/bed-101' },
      status: 'active',
    });
  });

  it('rejects admit without patient and location', async () => {
    await expect(adt.admit({ patientId: '', location: 'bed-101' })).rejects.toBeInstanceOf(
      AdtError,
    );
    await expect(adt.admit({ patientId: 'p1', location: '' })).rejects.toBeInstanceOf(AdtError);
  });

  it('transfers: closes the prior bed and opens the next, staying in-progress', async () => {
    const admitted = await adt.admit({ patientId: 'p1', location: 'bed-101' });
    const transferred = await adt.transfer(admitted.id!, { toLocation: 'icu-3' });

    expect(transferred.status).toBe('in-progress');
    expect(transferred.location).toHaveLength(2);

    const [first, second] = transferred.location!;
    expect(first?.location.reference).toBe('Location/bed-101');
    expect(first?.status).toBe('completed');
    expect(first?.period?.end).toBeTruthy();
    expect(second?.location.reference).toBe('Location/icu-3');
    expect(second?.status).toBe('active');
    expect(second?.period?.end).toBeUndefined();
  });

  it('discharges: finishes the encounter, closes the bed, records disposition', async () => {
    const admitted = await adt.admit({ patientId: 'p1', location: 'bed-101' });
    const discharged = await adt.discharge(admitted.id!, { disposition: 'home' });

    expect(discharged.status).toBe('finished');
    expect(discharged.period?.end).toBeTruthy();
    expect(discharged.location?.[0]?.status).toBe('completed');
    expect(discharged.hospitalization?.dischargeDisposition?.text).toBe('home');
  });

  it('cancels an admission', async () => {
    const admitted = await adt.admit({ patientId: 'p1', location: 'bed-101' });
    const cancelled = await adt.cancel(admitted.id!);
    expect(cancelled.status).toBe('cancelled');
  });

  describe('invalid transitions', () => {
    it('cannot transfer or discharge an unknown encounter', async () => {
      await expect(adt.transfer('nope', { toLocation: 'icu-3' })).rejects.toMatchObject({
        code: 'not-found',
      });
      await expect(adt.discharge('nope', {})).rejects.toMatchObject({ code: 'not-found' });
    });

    it('cannot discharge twice', async () => {
      const admitted = await adt.admit({ patientId: 'p1', location: 'bed-101' });
      await adt.discharge(admitted.id!, {});
      await expect(adt.discharge(admitted.id!, {})).rejects.toMatchObject({
        code: 'invalid-transition',
      });
    });

    it('cannot transfer a discharged encounter', async () => {
      const admitted = await adt.admit({ patientId: 'p1', location: 'bed-101' });
      await adt.discharge(admitted.id!, {});
      await expect(adt.transfer(admitted.id!, { toLocation: 'icu-3' })).rejects.toMatchObject({
        code: 'invalid-transition',
      });
    });

    it('cannot cancel a finished encounter', async () => {
      const admitted = await adt.admit({ patientId: 'p1', location: 'bed-101' });
      await adt.discharge(admitted.id!, {});
      await expect(adt.cancel(admitted.id!)).rejects.toMatchObject({ code: 'invalid-transition' });
    });
  });
});
