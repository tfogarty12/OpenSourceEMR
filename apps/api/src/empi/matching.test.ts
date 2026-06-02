import { describe, it, expect } from 'vitest';
import type { Patient } from '@osemr/fhir-model';
import {
  extractDemographics,
  gradeFor,
  scoreDemographics,
  stringSimilarity,
  type Demographics,
} from './matching';

function demo(overrides: Partial<Demographics> = {}): Demographics {
  return {
    family: 'Carter',
    given: ['Elizabeth'],
    birthDate: '1980-04-12',
    gender: 'female',
    identifiers: [],
    ...overrides,
  };
}

describe('stringSimilarity', () => {
  it('is 1 for identical (normalized) strings and 0 for missing', () => {
    expect(stringSimilarity('Smith', 'smith')).toBe(1);
    expect(stringSimilarity('Smith', undefined)).toBe(0);
  });

  it('is between 0 and 1 for near matches', () => {
    const s = stringSimilarity('Catherine', 'Katherine');
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(1);
  });
});

describe('scoreDemographics', () => {
  it('scores identical demographics as a perfect match', () => {
    expect(scoreDemographics(demo(), demo())).toBeCloseTo(1, 5);
  });

  it('treats a shared identifier as certain regardless of name', () => {
    const a = demo({ family: 'Smith', identifiers: [{ system: 'urn:mrn', value: '123' }] });
    const b = demo({ family: 'Jones', identifiers: [{ system: 'urn:mrn', value: '123' }] });
    expect(scoreDemographics(a, b)).toBe(1);
  });

  it('drops below "possible" for a clearly different person', () => {
    const a = demo();
    const b = demo({ family: 'Okafor', given: ['Chidi'], birthDate: '1995-09-02', gender: 'male' });
    expect(gradeFor(scoreDemographics(a, b))).toBeUndefined();
  });

  it('is symmetric', () => {
    const a = demo();
    const b = demo({ given: ['Beth'], birthDate: '1980-04-12' });
    expect(scoreDemographics(a, b)).toBeCloseTo(scoreDemographics(b, a), 10);
  });

  it('stays within [0,1] across varied inputs', () => {
    const noBirthDate: Demographics = {
      family: 'Carter',
      given: ['Elizabeth'],
      gender: 'female',
      identifiers: [],
    };
    const cases: [Demographics, Demographics][] = [
      [demo(), demo({ gender: 'male' })],
      [demo({ family: '' }), demo({ given: [] })],
      [noBirthDate, demo()],
    ];
    for (const [a, b] of cases) {
      const s = scoreDemographics(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('gradeFor', () => {
  it('bands scores into certain/probable/possible', () => {
    expect(gradeFor(0.95)).toBe('certain');
    expect(gradeFor(0.8)).toBe('probable');
    expect(gradeFor(0.65)).toBe('possible');
    expect(gradeFor(0.4)).toBeUndefined();
  });
});

describe('extractDemographics', () => {
  it('pulls comparable fields off a Patient', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      name: [{ family: 'Carter', given: ['Elizabeth', 'Anne'] }],
      birthDate: '1980-04-12',
      gender: 'female',
      identifier: [{ system: 'urn:mrn', value: '123' }, { value: 'no-system' }],
    };
    const d = extractDemographics(patient);
    expect(d.family).toBe('Carter');
    expect(d.given).toEqual(['Elizabeth', 'Anne']);
    expect(d.identifiers).toEqual([{ system: 'urn:mrn', value: '123' }, { value: 'no-system' }]);
  });
});
