import { describe, it, expect } from 'vitest';
import {
  operationOutcome,
  formatHumanName,
  reference,
  searchset,
  type HumanName,
  type Patient,
} from './index';

describe('operationOutcome', () => {
  it('builds a conformant OperationOutcome', () => {
    const oo = operationOutcome('error', 'not-found', 'Patient/123 was not found');
    expect(oo.resourceType).toBe('OperationOutcome');
    expect(oo.issue).toHaveLength(1);
    expect(oo.issue[0]).toEqual({
      severity: 'error',
      code: 'not-found',
      diagnostics: 'Patient/123 was not found',
    });
  });

  it('omits diagnostics when not provided', () => {
    const oo = operationOutcome('warning', 'processing');
    expect(oo.issue[0]).toEqual({ severity: 'warning', code: 'processing' });
    expect(oo.issue[0]).not.toHaveProperty('diagnostics');
  });
});

describe('formatHumanName', () => {
  it('returns a placeholder for missing names', () => {
    expect(formatHumanName(undefined)).toBe('(unknown)');
    expect(formatHumanName([])).toBe('(unknown)');
  });

  it('prefers the official name', () => {
    const names: HumanName[] = [
      { use: 'nickname', text: 'Liz' },
      { use: 'official', given: ['Elizabeth', 'Anne'], family: 'Carter' },
    ];
    expect(formatHumanName(names)).toBe('Elizabeth Anne Carter');
  });

  it('falls back to the first name when no official name exists', () => {
    expect(formatHumanName([{ given: ['Sam'], family: 'Lee' }])).toBe('Sam Lee');
  });

  it('uses text when present', () => {
    expect(formatHumanName([{ use: 'official', text: 'Dr. Sam Lee' }])).toBe('Dr. Sam Lee');
  });
});

describe('reference', () => {
  it('builds a literal reference', () => {
    expect(reference('Patient', '123')).toEqual({ reference: 'Patient/123' });
  });

  it('omits display when not provided, includes it when given', () => {
    expect(reference('Patient', '123')).not.toHaveProperty('display');
    expect(reference('Practitioner', 'p1', 'Dr. Lee')).toEqual({
      reference: 'Practitioner/p1',
      display: 'Dr. Lee',
    });
  });
});

describe('searchset', () => {
  it('wraps resources in a searchset Bundle with a total', () => {
    const patients: Patient[] = [
      { resourceType: 'Patient', id: 'a' },
      { resourceType: 'Patient', id: 'b' },
    ];
    const bundle = searchset(patients);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('searchset');
    expect(bundle.total).toBe(2);
    expect(bundle.entry?.map((e) => e.resource.id)).toEqual(['a', 'b']);
  });

  it('handles an empty result set', () => {
    const bundle = searchset([]);
    expect(bundle.total).toBe(0);
    expect(bundle.entry).toEqual([]);
  });
});
