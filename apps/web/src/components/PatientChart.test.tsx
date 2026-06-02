import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Bundle, Patient, Resource } from '@osemr/fhir-model';
import { ApiError, type FhirClient } from '../api/client';
import { PatientChart } from './PatientChart';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'p1',
  name: [{ family: 'Doe', given: ['Jane'] }],
  birthDate: '1980-04-12',
  gender: 'female',
};

function bundle<T extends Resource>(items: T[]): Bundle<T> {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: items.length,
    entry: items.map((resource) => ({ resource })),
  };
}

describe('PatientChart', () => {
  it('renders the banner and chart sections', async () => {
    const client = {
      getPatient: vi.fn().mockResolvedValue(patient),
      searchByPatient: vi
        .fn()
        .mockImplementation((type: string) =>
          Promise.resolve(
            type === 'Condition'
              ? bundle([{ resourceType: 'Condition', id: 'c1', code: { text: 'Hypertension' } }])
              : bundle([]),
          ),
        ),
    } as unknown as FhirClient;

    render(<PatientChart client={client} patientId="p1" onBack={() => {}} />);

    expect(await screen.findByTestId('patient-banner')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(await screen.findByText('Hypertension')).toBeInTheDocument();
  });

  it('prompts for break-the-glass on a 403', async () => {
    const client = {
      getPatient: vi.fn().mockRejectedValue(new ApiError(403, 'forbidden')),
      searchByPatient: vi.fn(),
    } as unknown as FhirClient;

    render(<PatientChart client={client} patientId="p1" onBack={() => {}} />);
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });
});
