# OpenSourceEMR

An open source, FHIR-native electronic medical record system intended to be a
viable alternative to proprietary EMR/EHR platforms (Epic, Oracle Health/Cerner,
MEDITECH, athenahealth, eClinicalWorks). The goal is a clinically safe,
standards-based, free-to-use platform spanning patient, clinician, and revenue
cycle workflows.

> **Status: design phase.** No clinical code exists yet. The repo currently
> contains architecture, scope, roadmap, and contribution guidance. Do not use
> any of this for patient care.

## Scope

- **Patient-facing**: portal, scheduling, secure messaging, results release,
  payments, intake, consent, telehealth.
- **Clinician-facing**: charting, problem/allergy/medication management, CPOE,
  results review, MAR (medication administration record), ePrescribing, in-basket,
  care plans, referrals.
- **Financial / RCM**: charge capture, coding assist, eligibility, claim
  generation (X12 837), remittance posting (835), patient statements,
  prior authorization.
- **Operational**: provider scheduling, credentialing (NPDB / OIG / SAM /
  state license / DEA), acuity-based nurse staffing, workload-based therapy
  staffing.
- **Cross-cutting**: identity (SMART on FHIR + OIDC), audit, RBAC + ABAC +
  break-the-glass, clinical decision support hooks, reporting, public health
  reporting, interoperability (FHIR R4/R5, HL7v2, C-CDA, NCPDP, DICOM).

## Non-goals (initially)

- ONC Health IT Certification on day one (multi-year process; tracked as a
  long-term goal).
- DEA EPCS production support without a partnership with an IdP that has
  completed EPCS audit.
- In-house authoring of drug knowledge, drug-drug interaction, or terminology
  content. We integrate licensed/standard sources.
- Replacement of a hospital's enterprise scheduling or ERP in a single release.

## Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — design considerations and decisions.
- [ROADMAP.md](./ROADMAP.md) — phased delivery plan.
- [SECURITY.md](./SECURITY.md) — security model and disclosure policy.
- [CONTRIBUTING.md](./CONTRIBUTING.md) — how to contribute, including the
  clinical-safety bar for changes that touch orders, meds, or results.
- [docs/regulatory.md](./docs/regulatory.md) — regulatory landscape summary.
- [docs/terminology.md](./docs/terminology.md) — code systems and licensing.

## Stack

TypeScript / Node monorepo (pnpm workspaces). The deployable application lives
in `apps/`; reusable libraries and content adapters live in `packages/`. See
[ARCHITECTURE.md §4](./ARCHITECTURE.md#4-technology-direction-proposed-open-to-debate)
and the dev quick-start in `apps/api` once the skeleton lands.

```
git clone … && cd OpenSourceEMR
corepack enable          # provides pnpm
pnpm install
docker compose up -d db  # local Postgres
pnpm dev                 # run the API
pnpm test                # run tests
```

## License

**Split licensing** (a deliberate decision — see
[ARCHITECTURE.md §8](./ARCHITECTURE.md#8-license--decided-q2) and
[licensing.md](./licensing.md)):

- **Application** (`apps/*`) — **AGPLv3** (root [LICENSE](./LICENSE)). Copyleft
  with the Affero clause, so hosted forks must share their changes.
- **Libraries** (`packages/*`) — **Apache-2.0**
  ([LICENSE-APACHE-2.0.txt](./LICENSE-APACHE-2.0.txt)). Permissive, to maximize
  reuse of the FHIR model and content adapters.
