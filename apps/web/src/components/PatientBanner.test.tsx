import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Patient } from '@osemr/fhir-model';
import { PatientBanner } from './PatientBanner';

const base: Patient = {
  resourceType: 'Patient',
  name: [{ family: 'Doe', given: ['Jane'] }],
  birthDate: '1980-04-12',
  gender: 'female',
  identifier: [{ use: 'official', value: 'MRN-9' }],
  active: true,
};

describe('PatientBanner', () => {
  it('shows name, DOB+age, sex and MRN', () => {
    render(<PatientBanner patient={base} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/DOB: 1980-04-12/)).toBeInTheDocument();
    expect(screen.getByText(/Age \d+/)).toBeInTheDocument();
    expect(screen.getByText(/MRN: MRN-9/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns loudly on an inactive record', () => {
    render(<PatientBanner patient={{ ...base, active: false }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/DO NOT CHART/);
  });

  it('warns and names the survivor on a merged record', () => {
    const merged: Patient = {
      ...base,
      link: [{ type: 'replaced-by', other: { reference: 'Patient/survivor-1' } }],
    };
    render(<PatientBanner patient={merged} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Patient/survivor-1');
  });
});
