import { useState } from 'react';
import type { Patient } from '@osemr/fhir-model';
import { ApiError, type FhirClient } from '../api/client';
import { calculateAge, formatName, mergeStatus, primaryIdentifier } from '../format';

/** Find a patient by name or identifier, then open the chart. */
export function PatientSearch({
  client,
  onSelect,
}: {
  client: FhirClient;
  onSelect: (patientId: string) => void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Patient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const value = term.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      // A digit-leading term is treated as an identifier, else a family name.
      const params: Record<string, string> = /^\d/.test(value)
        ? { identifier: value }
        : { family: value };
      const bundle = await client.searchPatients(params);
      setResults((bundle.entry ?? []).map((entry) => entry.resource));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Find a patient</h2>
      <form onSubmit={search} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Family name or MRN"
          aria-label="Search patients"
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="badge-bad">{error}</p>}

      {results && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>DOB (Age)</th>
              <th>Sex</th>
              <th>MRN</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {results.map((patient) => {
              const age = calculateAge(patient.birthDate);
              const { merged } = mergeStatus(patient);
              return (
                <tr key={patient.id}>
                  <td>
                    {formatName(patient.name)}
                    {merged && <span className="badge-bad"> (merged)</span>}
                  </td>
                  <td>
                    {patient.birthDate ?? '—'}
                    {age !== null ? ` (${age})` : ''}
                  </td>
                  <td>{patient.gender ?? '—'}</td>
                  <td>{primaryIdentifier(patient) ?? '—'}</td>
                  <td>
                    <button onClick={() => patient.id && onSelect(patient.id)}>Open</button>
                  </td>
                </tr>
              );
            })}
            {results.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
