import { useEffect, useState } from 'react';
import { ApiError, type AuditPage, type FhirClient } from '../api/client';

/** Audit log viewer (system-admin only). Shows chain integrity + recent events. */
export function AuditViewer({ client }: { client: FhirClient }) {
  const [page, setPage] = useState<AuditPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    client
      .listAudit()
      .then((result) => active && setPage(result))
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiError && err.status === 403
            ? 'You do not have permission to view the audit log (system-admin only).'
            : err instanceof Error
              ? err.message
              : 'Failed to load audit log',
        );
      });
    return () => {
      active = false;
    };
  }, [client]);

  if (error) return <p className="badge-bad">{error}</p>;
  if (!page) return <p className="muted">Loading audit log…</p>;

  return (
    <div>
      <h2>
        Audit log{' '}
        {page.valid ? (
          <span className="badge-ok" role="status">
            ✓ chain verified
          </span>
        ) : (
          <span className="badge-bad" role="status">
            ✗ CHAIN BROKEN
          </span>
        )}
      </h2>
      <p className="muted">{page.total} events</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Resource</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {page.events.map((event) => (
            <tr key={event.seq}>
              <td>{event.seq}</td>
              <td>{event.recordedAt.replace('T', ' ').slice(0, 19)}</td>
              <td>{event.actor}</td>
              <td>
                {event.action}
                {event.emergencyAccess && <span className="badge-bad"> ⚠ emergency</span>}
              </td>
              <td>
                {event.resourceType}
                {event.resourceId ? `/${event.resourceId.slice(0, 8)}` : ''}
              </td>
              <td className={event.outcome === 'denied' ? 'badge-bad' : ''}>{event.outcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
