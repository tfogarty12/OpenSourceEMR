import { useCallback, useEffect, useState } from 'react';
import type {
  AllergyIntolerance,
  Bundle,
  Condition,
  Encounter,
  MedicationStatement,
  Observation,
  Patient,
  Resource,
} from '@osemr/fhir-model';
import { ApiError, type FhirClient } from '../api/client';
import { conceptText } from '../format';
import { PatientBanner } from './PatientBanner';
import { ChartSection } from './ChartSection';
import { BreakTheGlass } from './BreakTheGlass';

function entries<T extends Resource>(bundle: Bundle<T>): T[] {
  return (bundle.entry ?? []).map((e) => e.resource);
}

interface ChartData {
  patient: Patient;
  problems: Condition[];
  allergies: AllergyIntolerance[];
  medications: MedicationStatement[];
  observations: Observation[];
  encounters: Encounter[];
}

export function PatientChart({
  client,
  patientId,
  onBack,
}: {
  client: FhirClient;
  patientId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsBreakGlass, setNeedsBreakGlass] = useState(false);

  const load = useCallback(
    async (breakGlassReason?: string) => {
      setLoading(true);
      setError(null);
      setNeedsBreakGlass(false);
      try {
        const patient = await client.getPatient(patientId, breakGlassReason);
        const [problems, allergies, medications, observations, encounters] = await Promise.all([
          client.searchByPatient<Condition>('Condition', patientId, breakGlassReason),
          client.searchByPatient<AllergyIntolerance>(
            'AllergyIntolerance',
            patientId,
            breakGlassReason,
          ),
          client.searchByPatient<MedicationStatement>(
            'MedicationStatement',
            patientId,
            breakGlassReason,
          ),
          client.searchByPatient<Observation>('Observation', patientId, breakGlassReason),
          client.searchByPatient<Encounter>('Encounter', patientId, breakGlassReason),
        ]);
        setData({
          patient,
          problems: entries(problems),
          allergies: entries(allergies),
          medications: entries(medications),
          observations: entries(observations),
          encounters: entries(encounters),
        });
      } catch (err) {
        if (err instanceof ApiError && err.breakGlassEligible) {
          setNeedsBreakGlass(true);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load chart');
        }
      } finally {
        setLoading(false);
      }
    },
    [client, patientId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="muted">Loading chart…</p>;

  if (needsBreakGlass) {
    return (
      <BreakTheGlass
        resourceLabel="this patient's chart"
        onProceed={(reason) => void load(reason)}
        onCancel={onBack}
      />
    );
  }

  if (error) {
    return (
      <div>
        <p className="badge-bad">{error}</p>
        <button onClick={onBack}>Back to search</button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <button onClick={onBack}>← Back to search</button>
      <PatientBanner patient={data.patient} />
      <div className="chart-grid">
        <ChartSection
          title="Problems"
          items={data.problems}
          renderItem={(c) => conceptText(c.code)}
        />
        <ChartSection
          title="Allergies"
          items={data.allergies}
          renderItem={(a) => conceptText(a.code)}
        />
        <ChartSection
          title="Medications"
          items={data.medications}
          renderItem={(m) => `${conceptText(m.medicationCodeableConcept)} (${m.status ?? '—'})`}
        />
        <ChartSection
          title="Vitals & Results"
          items={data.observations}
          renderItem={(o) =>
            `${conceptText(o.code)}: ${o.valueQuantity?.value ?? '—'} ${o.valueQuantity?.unit ?? ''}`.trim()
          }
        />
        <ChartSection
          title="Encounters"
          items={data.encounters}
          renderItem={(e) =>
            `${e.class?.code ?? '—'} · ${e.status} · ${e.period?.start?.slice(0, 10) ?? ''}`
          }
        />
      </div>
    </div>
  );
}
