import { useEffect, useMemo, useRef, useState } from 'react';
import { FhirClient } from './api/client';
import { clearToken, decodeUser, loadToken, saveToken } from './auth/session';
import { Login } from './components/Login';
import { PatientSearch } from './components/PatientSearch';
import { PatientChart } from './components/PatientChart';
import { AuditViewer } from './components/AuditViewer';

type View = 'patients' | 'audit';

export function App() {
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [view, setView] = useState<View>('patients');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Keep a ref so the (memoized) client always reads the current token.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const client = useMemo(
    () =>
      new FhirClient({
        getToken: () => tokenRef.current,
        onUnauthorized: () => {
          clearToken();
          setToken(null);
        },
      }),
    [],
  );

  async function handleLogin(subject: string, roles: string[]) {
    const { access_token } = await client.devLogin(subject, roles);
    saveToken(access_token);
    setToken(access_token);
  }

  function logout() {
    clearToken();
    setToken(null);
    setSelectedPatientId(null);
    setView('patients');
  }

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  const user = decodeUser(token);

  return (
    <>
      <header className="app-header">
        <strong>OpenSourceEMR</strong>
        <nav className="app-nav">
          <button onClick={() => setView('patients')} disabled={view === 'patients'}>
            Patients
          </button>
          <button onClick={() => setView('audit')} disabled={view === 'audit'}>
            Audit
          </button>
        </nav>
        <span>
          <span className="muted">
            {user?.subject} · {user?.roles.join(', ')}
          </span>{' '}
          <button onClick={logout}>Sign out</button>
        </span>
      </header>
      <main>
        {view === 'patients' &&
          (selectedPatientId ? (
            <PatientChart
              client={client}
              patientId={selectedPatientId}
              onBack={() => setSelectedPatientId(null)}
            />
          ) : (
            <PatientSearch client={client} onSelect={setSelectedPatientId} />
          ))}
        {view === 'audit' && <AuditViewer client={client} />}
      </main>
    </>
  );
}
