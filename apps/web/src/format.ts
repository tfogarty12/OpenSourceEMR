import type { CodeableConcept, HumanName, Patient } from '@osemr/fhir-model';

/** Format a HumanName list for display, preferring the official name. */
export function formatName(names: HumanName[] | undefined): string {
  if (!names || names.length === 0) return '(unknown)';
  const preferred = names.find((n) => n.use === 'official') ?? names[0];
  if (!preferred) return '(unknown)';
  if (preferred.text) return preferred.text;
  const given = preferred.given?.join(' ') ?? '';
  const family = preferred.family ?? '';
  const full = `${given} ${family}`.trim();
  return full.length > 0 ? full : '(unknown)';
}

/** Whole-years age from a YYYY-MM-DD birthDate, or null if unknown/invalid. */
export function calculateAge(birthDate: string | undefined, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  const dob = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/** The patient's primary identifier value (official if present), else null. */
export function primaryIdentifier(patient: Patient): string | null {
  const identifiers = patient.identifier ?? [];
  const chosen = identifiers.find((i) => i.use === 'official') ?? identifiers[0];
  return chosen?.value ?? null;
}

/** Whether a record should not be charted on (merged away or inactivated). */
export function mergeStatus(patient: Patient): { merged: boolean; replacedBy?: string } {
  const replacedBy = patient.link?.find((l) => l.type === 'replaced-by');
  const merged = patient.active === false || replacedBy !== undefined;
  return replacedBy?.other.reference
    ? { merged, replacedBy: replacedBy.other.reference }
    : { merged };
}

/** Human-readable text for a CodeableConcept (text > display > code). */
export function conceptText(concept: CodeableConcept | undefined): string {
  if (!concept) return '—';
  return concept.text ?? concept.coding?.[0]?.display ?? concept.coding?.[0]?.code ?? '—';
}
