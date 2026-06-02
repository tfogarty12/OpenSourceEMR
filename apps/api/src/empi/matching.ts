import type { Patient } from '@osemr/fhir-model';

// Patient matching for the EMPI.
//
// Two strategies, combined:
//  - deterministic: a shared identifier (same system+value) means same person.
//  - probabilistic: a weighted agreement score across demographics.
//
// Everything here is pure and deterministic so it can be property-tested. The
// stakes are high — a wrong match merges two people's records — so the scoring
// is explicit and conservative, and grades are bands, not a single yes/no.

export interface Demographics {
  family?: string;
  given: string[];
  birthDate?: string;
  gender?: string;
  identifiers: { system?: string; value: string }[];
}

export type MatchGrade = 'certain' | 'probable' | 'possible';

const WEIGHTS = { family: 0.3, given: 0.2, birthDate: 0.35, gender: 0.15 };
const POSSIBLE_THRESHOLD = 0.6;

export function extractDemographics(patient: Patient): Demographics {
  const demographics: Demographics = { given: [], identifiers: [] };
  const name = patient.name?.[0];
  if (name?.family) demographics.family = name.family;
  if (name?.given) demographics.given = name.given.filter((g) => g.length > 0);
  if (patient.birthDate) demographics.birthDate = patient.birthDate;
  if (patient.gender) demographics.gender = patient.gender;
  if (patient.identifier) {
    demographics.identifiers = patient.identifier
      .filter((i): i is { system?: string; value: string } => typeof i.value === 'string')
      .map((i) =>
        i.system !== undefined ? { system: i.system, value: i.value } : { value: i.value },
      );
  }
  return demographics;
}

/** Normalize a string for comparison: lowercase, trim, collapse non-alphanumerics. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Levenshtein edit distance. */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j < cols; j++) {
      const temp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[cols - 1]!;
}

/** Similarity of two strings in [0,1] (1 = identical after normalization). */
export function stringSimilarity(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na.length === 0 || nb.length === 0) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - editDistance(na, nb) / maxLen;
}

function identifiersMatch(a: Demographics, b: Demographics): boolean {
  return a.identifiers.some((x) =>
    b.identifiers.some((y) => {
      const sameValue = normalize(x.value) === normalize(y.value) && normalize(x.value).length > 0;
      const sameSystem = x.system === undefined || y.system === undefined || x.system === y.system;
      return sameValue && sameSystem;
    }),
  );
}

function bestGivenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let best = 0;
  for (const x of a) {
    for (const y of b) {
      best = Math.max(best, stringSimilarity(x, y));
    }
  }
  return best;
}

/** Demographic agreement score in [0,1]. A shared identifier short-circuits to 1. */
export function scoreDemographics(query: Demographics, candidate: Demographics): number {
  if (identifiersMatch(query, candidate)) return 1;

  const family = stringSimilarity(query.family, candidate.family);
  const given = bestGivenSimilarity(query.given, candidate.given);
  const birthDate =
    query.birthDate && candidate.birthDate && query.birthDate === candidate.birthDate ? 1 : 0;
  const gender = query.gender && candidate.gender && query.gender === candidate.gender ? 1 : 0;

  return (
    WEIGHTS.family * family +
    WEIGHTS.given * given +
    WEIGHTS.birthDate * birthDate +
    WEIGHTS.gender * gender
  );
}

/** Band a score, or return undefined if below the "possible" threshold. */
export function gradeFor(score: number): MatchGrade | undefined {
  if (score >= 0.9) return 'certain';
  if (score >= 0.75) return 'probable';
  if (score >= POSSIBLE_THRESHOLD) return 'possible';
  return undefined;
}
