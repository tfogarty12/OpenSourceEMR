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
- [ ] FHIR store facade over Postgres; Patient + Practitioner + Encounter
- [ ] ADT: admit / discharge / transfer + encounter lifecycle (inpatient core)
- [ ] Identity: OIDC login, RBAC scaffold, audit log (append-only)
- **Exit:** a developer can run the stack, log in, and CRUD a Patient as FHIR.

## Phase 1 — The chart (read before write)

- [ ] EMPI v1: patient search with match confidence, merge/unmerge + audit
- [ ] Problem list, allergies/intolerances, medication list (FHIR-native)
- [ ] Encounters, vitals, results review (Observation/DiagnosticReport)
- [ ] Clinician web shell + patient banner with hard "right patient" cues
- [ ] Audit viewer; break-the-glass flow
- **Exit:** a clinician can safely _view_ a longitudinal chart.

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
