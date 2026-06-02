import { reference, type Patient, type PatientLink } from '@osemr/fhir-model';
import type { FhirStore } from '../fhir-store/store';
import { extractDemographics, gradeFor, scoreDemographics, type MatchGrade } from './matching';

/** A domain error from EMPI operations. */
export type EmpiErrorCode = 'not-found' | 'conflict' | 'invalid';

export class EmpiError extends Error {
  constructor(
    readonly code: EmpiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EmpiError';
  }
}

export interface MatchCandidate {
  patient: Patient;
  score: number;
  grade: MatchGrade;
}

/**
 * Enterprise Master Patient Index operations: matching, and reversible,
 * audited merge/unmerge. Identity is the highest-risk surface in the system,
 * so merges are explicit, never automatic, and fully reversible (the FHIR
 * store keeps every version, and unmerge restores the prior links/active flag).
 */
export class EmpiService {
  constructor(private readonly store: FhirStore) {}

  /** Rank active patients against a candidate demographic record. */
  async match(query: Patient): Promise<MatchCandidate[]> {
    const queryDemographics = extractDemographics(query);
    const all = (await this.store.search('Patient', {})) as Patient[];

    const candidates: MatchCandidate[] = [];
    for (const patient of all) {
      if (patient.active === false) continue; // skip merged-away / inactivated
      if (query.id && patient.id === query.id) continue;
      const score = scoreDemographics(queryDemographics, extractDemographics(patient));
      const grade = gradeFor(score);
      if (grade) candidates.push({ patient, score, grade });
    }
    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Merge `sourceId` into `targetId`: the source is inactivated and linked as
   * replaced-by the target; the target gains a `replaces` link. Reversible.
   */
  async merge(sourceId: string, targetId: string): Promise<{ source: Patient; target: Patient }> {
    if (sourceId === targetId) {
      throw new EmpiError('invalid', 'Cannot merge a patient into itself');
    }
    const source = (await this.store.read('Patient', sourceId)) as Patient | undefined;
    const target = (await this.store.read('Patient', targetId)) as Patient | undefined;
    if (!source) throw new EmpiError('not-found', `Patient/${sourceId} not found`);
    if (!target) throw new EmpiError('not-found', `Patient/${targetId} not found`);
    if (source.active === false || hasLink(source, 'replaced-by')) {
      throw new EmpiError('conflict', `Patient/${sourceId} is already merged`);
    }

    const mergedSource: Patient = {
      ...source,
      active: false,
      link: [
        ...(source.link ?? []),
        { other: reference('Patient', targetId), type: 'replaced-by' },
      ],
    };
    const mergedTarget: Patient = {
      ...target,
      link: [...(target.link ?? []), { other: reference('Patient', sourceId), type: 'replaces' }],
    };

    return {
      source: (await this.store.update(mergedSource)) as Patient,
      target: (await this.store.update(mergedTarget)) as Patient,
    };
  }

  /** Reverse a merge: reactivate the source and remove the reciprocal links. */
  async unmerge(sourceId: string): Promise<Patient> {
    const source = (await this.store.read('Patient', sourceId)) as Patient | undefined;
    if (!source) throw new EmpiError('not-found', `Patient/${sourceId} not found`);

    const replacedBy = source.link?.find((l) => l.type === 'replaced-by');
    if (!replacedBy) throw new EmpiError('conflict', `Patient/${sourceId} is not merged`);

    const targetId = idFromReference(replacedBy.other.reference);
    const restoredSource: Patient = {
      ...source,
      active: true,
      link: withoutLink(source.link, 'replaced-by', `Patient/${targetId}`),
    };

    if (targetId) {
      const target = (await this.store.read('Patient', targetId)) as Patient | undefined;
      if (target) {
        await this.store.update({
          ...target,
          link: withoutLink(target.link, 'replaces', `Patient/${sourceId}`),
        });
      }
    }
    return (await this.store.update(restoredSource)) as Patient;
  }
}

function hasLink(patient: Patient, type: PatientLink['type']): boolean {
  return (patient.link ?? []).some((l) => l.type === type);
}

function withoutLink(
  links: PatientLink[] | undefined,
  type: PatientLink['type'],
  otherReference: string,
): PatientLink[] {
  return (links ?? []).filter((l) => !(l.type === type && l.other.reference === otherReference));
}

function idFromReference(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const slash = ref.lastIndexOf('/');
  return slash >= 0 ? ref.slice(slash + 1) : ref;
}
