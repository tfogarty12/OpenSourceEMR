import { useState } from 'react';

/**
 * Break-the-glass prompt. Shown when access is denied (403) but emergency
 * access is permitted for reads. It is intentionally high-friction: a reason is
 * required, and the copy makes clear the access is logged and reviewed.
 */
export function BreakTheGlass({
  resourceLabel,
  onProceed,
  onCancel,
}: {
  resourceLabel?: string;
  onProceed: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <div role="alertdialog" aria-label="Break the glass" className="btg">
      <h2>Access restricted</h2>
      <p>
        You do not normally have permission to view {resourceLabel ?? 'this record'}. You may use
        emergency <strong>break-the-glass</strong> access. This access is recorded in the audit log
        and is reviewed.
      </p>
      <label>
        Reason for emergency access
        <br />
        <input
          aria-label="Reason for emergency access"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. patient unresponsive in ED"
        />
      </label>
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button onClick={onCancel}>Cancel</button>
        <button disabled={trimmed.length === 0} onClick={() => onProceed(trimmed)}>
          Proceed with emergency access
        </button>
      </div>
    </div>
  );
}
