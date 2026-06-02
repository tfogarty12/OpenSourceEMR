import { useState } from 'react';

const ROLES = ['physician', 'nurse', 'registration', 'patient', 'system-admin'];

/**
 * Development login. Mints a dev token via /auth/dev-login. This is NOT a
 * production sign-in — it exists so the shell is usable before OIDC lands.
 */
export function Login({
  onLogin,
}: {
  onLogin: (subject: string, roles: string[]) => Promise<void>;
}) {
  const [subject, setSubject] = useState('dr-smith');
  const [role, setRole] = useState('physician');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onLogin(subject, [role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>OpenSourceEMR</h1>
      <p className="muted">Development sign-in (not for production).</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.75rem', maxWidth: 320 }}>
        <label>
          User
          <br />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="User" />
        </label>
        <label>
          Role
          <br />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy || subject.trim().length === 0}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p className="badge-bad">{error}</p>}
      </form>
    </main>
  );
}
