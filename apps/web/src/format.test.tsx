import { describe, it, expect } from 'vitest';
import type { Patient } from '@osemr/fhir-model';
import { calculateAge, conceptText, formatName, mergeStatus, primaryIdentifier } from './format';

describe('formatName', () => {
  it('prefers the official name and handles missing names', () => {
    expect(formatName([{ use: 'official', given: ['Jane'], family: 'Doe' }])).toBe('Jane Doe');
    expect(formatName(undefined)).toBe('(unknown)');
  });
});

describe('calculateAge', () => {
  const now = new Date('2026-06-02T00:00:00Z');
  it('computes whole years and respects the birthday boundary', () => {
    expect(calculateAge('1980-04-12', now)).toBe(46);
    expect(calculateAge('1980-06-02', now)).toBe(46);
    expect(calculateAge('1980-06-03', now)).toBe(45); // birthday not yet reached
    expect(calculateAge(undefined, now)).toBeNull();
    expect(calculateAge('not-a-date', now)).toBeNull();
  });
});

describe('primaryIdentifier', () => {
  it('prefers the official identifier', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      identifier: [{ value: 'tmp' }, { use: 'official', value: 'MRN-1' }],
    };
    expect(primaryIdentifier(patient)).toBe('MRN-1');
    expect(primaryIdentifier({ resourceType: 'Patient' })).toBeNull();
  });
});

describe('mergeStatus', () => {
  it('flags inactive or replaced-by records', () => {
    expect(mergeStatus({ resourceType: 'Patient', active: true }).merged).toBe(false);
    expect(mergeStatus({ resourceType: 'Patient', active: false }).merged).toBe(true);
    const replaced: Patient = {
      resourceType: 'Patient',
      link: [{ type: 'replaced-by', other: { reference: 'Patient/2' } }],
    };
    expect(mergeStatus(replaced)).toEqual({ merged: true, replacedBy: 'Patient/2' });
  });
});

describe('conceptText', () => {
  it('falls back text > display > code > dash', () => {
    expect(conceptText({ text: 'Hypertension' })).toBe('Hypertension');
    expect(conceptText({ coding: [{ display: 'HTN' }] })).toBe('HTN');
    expect(conceptText({ coding: [{ code: 'I10' }] })).toBe('I10');
    expect(conceptText(undefined)).toBe('—');
  });
});
