# Roadmap

This roadmap is sequenced by **clinical value delivered per unit of risk**, not
by feature glamour. Each phase ends with something a real (pilot) site could
use under supervision. Dates are intentionally omitted — this is a capability
sequence, not a schedule.

Decided direction (see ARCHITECTURE.md §9): **acute / inpatient-first**,
TypeScript/Node, modular monolith, FHIR R4 / US Core, AGPLv3 app + Apache-2.0
libs. Inpatient-first pulls ADT (admit/discharge/transfer), encounter and
bed/census management, inpatient CPOE/MAR, and acuity-based nurse staffing
forward as central concerns — but the chart-read foundation still ships first
because everything depends on it.

---

## Phase 0 — Foundation (current)

- [x] Architecture, scope, roadmap, contribution & safety docs
- [x] Decide Q1 (backend stack → TypeScript/Node) and Q2 (license → split)
- [x] Repo skeleton, CI, dev environment (one-command up)
- [x] FHIR store facade over Postgres; Patient + Practitioner + Encounter
      — versioned JSONB store (current + history tables), soft delete, CRUD +
      search; in-memory and Postgres backends behind one `FhirStore` interface;
      forward-only SQL migration runner
- [x] ADT: admit / discharge / transfer + encounter lifecycle (inpatient core)
      — now persisted through the FHIR store (Postgres when `DATABASE_URL` is set)
- [x] Identity: bearer-token auth (OIDC-ready `TokenVerifier`; dev HS256 issuer),
      RBAC scaffold + break-the-glass, append-only **hash-chained** audit log
- **Exit (met):** a developer can run the stack, log in (`/auth/dev-login`), and
  CRUD a Patient as FHIR with every access authorized and audited.

> **Phase 0 is functionally complete.** Remaining hardening before calling it
> "done done": real OIDC/JWKS verifier, ABAC narrowing (care-relationship), and
> session management — tracked into Phase 1.

## Phase 1 — The chart (read before write)

- [x] EMPI v1: `$match` with confidence scoring (deterministic identifier +
      probabilistic demographics), reversible `$merge`/`$unmerge`, fully audited
- [x] Problem list, allergies/intolerances, medication list (FHIR-native:
      Condition, AllergyIntolerance, MedicationStatement)
- [x] Vitals/results as Observation (search by patient + status);
      DiagnosticReport still to come
- [ ] Clinician web shell + patient banner with hard "right patient" cues
- [ ] Audit viewer UI; break-the-glass UX (API + audit are done — see Phase 0)
- **Exit (partial):** the chart's data model + identity safety layer are in the
  API; the read-only clinician UI is the remaining piece.

## Phase 2 — Documentation & scheduling

- [ ] Note templates, narrative editor, addenda, e-signature, amendment trail
- [ ] Patient appointment scheduling + provider/resource scheduling
- [ ] Patient portal v1: view chart, messages, appointments
- [ ] Secure messaging / in-basket (clinician ↔ patient, clinician ↔ clinician)
- **Exit:** a clinic can schedule, see, document, and share a visit.

## Phase 3 — Orders & medications (highest-risk; gated)

- [ ] Terminology service (RxNorm, LOINC, ICD-10-CM, SNOMED via UMLS)
- [ ] Medication-knowledge SPI + open adapter; allergy & interaction checking
- [ ] CPOE: order sets, order lifecycle, CDS hooks, alert-fatigue controls
- [ ] MAR: scheduled/PRN meds, five-rights, barcode med administration
- [ ] Outpatient prescribing; NCPDP SCRIPT via routing partner (EPCS off)
- **Exit:** supervised CPOE + MAR + eRx in a pilot, behind a safety review.

## Phase 4 — Revenue cycle

- [ ] Charge capture + coding assist (ICD-10 + CPT via licensed adapter)
- [ ] Eligibility (270/271), claims (837), remittance (835), statements
- [ ] Prior authorization (278) workflow
- **Exit:** a visit can go from documentation to a submitted, posted claim.

## Phase 5 — Operations: staffing & credentialing

- [ ] Credentialing: enrollment, primary-source verification hooks
      (NPDB/OIG/SAM/state license/DEA), expirables tracking
- [ ] Acuity-based nurse staffing (patient classification → required hours)
- [ ] Workload-based therapy staffing (PT/OT/SLP units → assignment)
- **Exit:** a unit can plan a shift and a system can manage provider eligibility.

## Phase 6 — Interop, reporting, and the long road to certification

- [ ] HL7v2 edge (ADT/ORM/ORU/SIU/DFT), C-CDA exchange, Bulk Data export
- [ ] Operational + clinical-quality + population-health reporting
- [ ] Public health reporting (immunizations, syndromic, reportable labs)
- [ ] USCDI/(b)(10) export conformance; certification gap analysis
- **Exit:** the platform exchanges data and reports like a grown-up EHR.

---

## How phases map to the original request

| Requested capability            | Phase                                |
| ------------------------------- | ------------------------------------ |
| Patient-facing applications     | 2 (portal), ongoing                  |
| Provider/clinician workflows    | 1–3                                  |
| Financial/billing workflows     | 4                                    |
| Provider scheduling             | 2                                    |
| Credentialing                   | 5                                    |
| Acuity-based nurse staffing     | 5                                    |
| Workload-based therapy staffing | 5                                    |
| CPOE                            | 3                                    |
| MAR                             | 3                                    |
| Prescribing                     | 3                                    |
| Communication layers            | 2                                    |
| Notes / documentation           | 2                                    |
| Reports                         | 6 (with operational reports earlier) |

The ordering front-loads the safe, high-value chart and scheduling, and gates
the dangerous medication/order modules behind real terminology and a safety
review — which is the opposite of how a demo would be built, and the right way
to build something that touches patients.
