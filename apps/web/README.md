# @osemr/web

The OpenSourceEMR **clinician web shell** — a read-only chart UI.

**License: AGPL-3.0-only** (an `apps/*` package — see [licensing.md](../../licensing.md)).

> **Phase 1, read-only.** Sign in (dev), find a patient, view the chart, inspect
> the audit log. No charting/ordering yet. **Not for patient care.**

## What it does

- **Dev sign-in** via `POST /auth/dev-login` (pick a subject + role). Real OIDC
  replaces this later; the token is held in `sessionStorage`.
- **Patient search** by family name or MRN.
- **Patient banner** — the safety-critical "right-patient" cue: name, DOB+age,
  sex, MRN, always visible, with a loud **MERGED / INACTIVE — DO NOT CHART**
  warning on records that were merged away or deactivated.
- **Chart** — problems (Condition), allergies, medications, vitals/results
  (Observation), and encounters, each fetched by patient.
- **Break-the-glass** — when the API returns `403`, a high-friction prompt
  collects a reason and retries with the `X-Break-The-Glass-Reason` header; the
  access is recorded in the audit log.
- **Audit viewer** (system-admin) — lists events and shows whether the
  tamper-evident hash chain still verifies.

## Run it

The app calls the API on same-origin paths; the Vite dev server proxies them to
the backend (default `http://localhost:8080`, override with `API_URL`).

```bash
# terminal 1 — the API (needs AUTH_DEV_SECRET for dev login)
AUTH_DEV_SECRET=dev-secret pnpm --filter @osemr/api dev
# terminal 2 — the web shell
pnpm --filter @osemr/web dev      # or: pnpm dev:web
```

## Layout

- `src/api/client.ts` — typed API client (auth header, break-the-glass, errors).
- `src/auth/session.ts` — token storage + JWT decode (display only).
- `src/format.ts` — name/age/MRN/merge-status/concept display helpers.
- `src/components/` — `PatientBanner`, `PatientSearch`, `PatientChart`,
  `ChartSection`, `BreakTheGlass`, `AuditViewer`, `Login`.
- `src/App.tsx` — auth gate, client wiring, navigation.

Types come from `@osemr/fhir-model` (type-only imports), so the frontend shares
the exact FHIR model the backend uses without bundling any runtime from it.
