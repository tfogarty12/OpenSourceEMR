import type { Patient } from '@osemr/fhir-model';
import { calculateAge, formatName, mergeStatus, primaryIdentifier } from '../format';

/**
 * The patient banner — the single most important safety surface in the chart.
 * It is always visible and states, unambiguously, *who you are looking at*.
 * If the record has been merged away or inactivated, it shows a loud warning so
 * a clinician never charts on the wrong (or a defunct) record.
 */
export function PatientBanner({ patient }: { patient: Patient }) {
  const age = calculateAge(patient.birthDate);
  const mrn = primaryIdentifier(patient);
  const { merged, replacedBy } = mergeStatus(patient);

  return (
    <header className="patient-banner" data-testid="patient-banner" aria-label="Patient identity">
      {merged && (
        <div role="alert" className="banner-warning">
          ⚠ MERGED / INACTIVE RECORD — DO NOT CHART
          {replacedBy ? ` · replaced by ${replacedBy}` : ''}
        </div>
      )}
      <div className="banner-row">
        <span className="banner-name">{formatName(patient.name)}</span>
        <span className="banner-field">
          DOB: {patient.birthDate ?? '—'}
          {age !== null ? ` (Age ${age})` : ''}
        </span>
        <span className="banner-field">Sex: {patient.gender ?? '—'}</span>
        <span className="banner-field">MRN: {mrn ?? '—'}</span>
      </div>
    </header>
  );
}
