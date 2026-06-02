import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApiError, type AuditPage, type FhirClient } from '../api/client';
import { AuditViewer } from './AuditViewer';

const page: AuditPage = {
  total: 1,
  valid: true,
  events: [
    {
      seq: 1,
      recordedAt: '2026-01-01T00:00:00.000Z',
      actor: 'dr-smith',
      action: 'read',
      resourceType: 'Patient',
      outcome: 'success',
    },
  ],
};

function clientWith(impl: Partial<FhirClient>): FhirClient {
  return impl as FhirClient;
}

describe('AuditViewer', () => {
  it('shows a verified chain and event rows', async () => {
    const client = clientWith({ listAudit: vi.fn().mockResolvedValue(page) });
    render(<AuditViewer client={client} />);
    expect(await screen.findByText(/chain verified/i)).toBeInTheDocument();
    expect(screen.getByText('dr-smith')).toBeInTheDocument();
  });

  it('warns when the chain is broken', async () => {
    const client = clientWith({ listAudit: vi.fn().mockResolvedValue({ ...page, valid: false }) });
    render(<AuditViewer client={client} />);
    expect(await screen.findByText(/CHAIN BROKEN/)).toBeInTheDocument();
  });

  it('explains a permission error for non-admins', async () => {
    const client = clientWith({
      listAudit: vi.fn().mockRejectedValue(new ApiError(403, 'forbidden')),
    });
    render(<AuditViewer client={client} />);
    expect(await screen.findByText(/system-admin only/i)).toBeInTheDocument();
  });
});
