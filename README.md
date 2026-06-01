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

## License

Not yet selected. See [ARCHITECTURE.md §License](./ARCHITECTURE.md#license) —
this is a community decision (AGPLv3 vs Apache 2.0) we'd like to make
deliberately rather than by default.
