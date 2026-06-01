import { describe, it, expect } from 'vitest';
import { operationOutcome, formatHumanName, type HumanName } from './index';

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
