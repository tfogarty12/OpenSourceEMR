// Terminology provider SPI.
//
// This interface is the boundary described in docs/terminology.md: it lets the
// application validate, look up, and translate codes WITHOUT the repo ever
// shipping licensed vocabulary content (CPT, commercial drug knowledge, etc.).
// Free sources (RxNorm, LOINC, ICD-10-CM, SNOMED via UMLS) get open adapters;
// licensed sources are dropped in behind this same interface at deploy time.

import type { Coding } from '@osemr/fhir-model';

/** Canonical URIs for the code systems we reference most. */
export const CodeSystems = {
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  LOINC: 'http://loinc.org',
  SNOMED: 'http://snomed.info/sct',
  ICD10CM: 'http://hl7.org/fhir/sid/icd-10-cm',
  UCUM: 'http://unitsofmeasure.org',
  CPT: 'http://www.ama-assn.org/go/cpt',
} as const;

export interface CodeLookup {
  system: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  /** The resolved coding (with display) when the code is known. */
  coding?: Coding;
  message?: string;
}

export interface ConceptDetails {
  system: string;
  code: string;
  display: string;
  /** System-specific extra properties (e.g. RxNorm term type). */
  properties?: Record<string, string>;
}

/**
 * The pluggable terminology provider. Adapters implement this against a
 * specific source (in-memory, a FHIR terminology server, a licensed feed, …).
 */
export interface TerminologyProvider {
  /** Which code systems this provider can answer for. */
  supports(system: string): boolean;

  /** Is this code valid within its system? */
  validateCode(lookup: CodeLookup): Promise<ValidationResult>;

  /** Resolve display text and properties for a code. */
  lookup(lookup: CodeLookup): Promise<ConceptDetails | undefined>;

  /** Translate a code from one system to another, if a mapping exists. */
  translate(lookup: CodeLookup, targetSystem: string): Promise<Coding[]>;
}

/**
 * A trivial in-memory provider. It exists for tests and local development ONLY
 * and contains NO licensed content — just whatever concepts you hand it. Real
 * deployments register source-specific adapters instead.
 */
export class InMemoryTerminologyProvider implements TerminologyProvider {
  private readonly concepts = new Map<string, ConceptDetails>();
  private readonly maps = new Map<string, Coding[]>();

  private key(system: string, code: string): string {
    return `${system}|${code}`;
  }

  addConcept(concept: ConceptDetails): this {
    this.concepts.set(this.key(concept.system, concept.code), concept);
    return this;
  }

  addMapping(from: CodeLookup, to: Coding): this {
    const k = this.key(from.system, from.code);
    const existing = this.maps.get(k) ?? [];
    existing.push(to);
    this.maps.set(k, existing);
    return this;
  }

  supports(system: string): boolean {
    for (const concept of this.concepts.values()) {
      if (concept.system === system) return true;
    }
    return false;
  }

  validateCode(lookup: CodeLookup): Promise<ValidationResult> {
    const concept = this.concepts.get(this.key(lookup.system, lookup.code));
    if (!concept) {
      return Promise.resolve({
        valid: false,
        message: `Unknown code ${lookup.code} in ${lookup.system}`,
      });
    }
    return Promise.resolve({
      valid: true,
      coding: { system: concept.system, code: concept.code, display: concept.display },
    });
  }

  lookup(lookup: CodeLookup): Promise<ConceptDetails | undefined> {
    return Promise.resolve(this.concepts.get(this.key(lookup.system, lookup.code)));
  }

  translate(lookup: CodeLookup, targetSystem: string): Promise<Coding[]> {
    const all = this.maps.get(this.key(lookup.system, lookup.code)) ?? [];
    return Promise.resolve(all.filter((c) => c.system === targetSystem));
  }
}
