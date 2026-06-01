# Architecture & Design Considerations

This document is the reasoning layer for OpenSourceEMR. It is deliberately
opinionated where safety demands it and deliberately undecided where the
community should weigh in. Read this before proposing structural changes.

---

## 1. First principles

1. **Patient safety is a hard constraint, not a feature.** Any module touching
   orders, medications, allergies, results, or identity is held to a higher bar
   (tests, review, audit) than the rest of the system. A wrong med dose or a
   mispatched result can kill someone. We design as if it can.
2. **Standards-native, not standards-adjacent.** Clinical data is FHIR R4
   first. We do not invent a proprietary clinical data model and bolt FHIR on
   later — that is how vendors end up with lossy export. FHIR resources are the
   internal lingua franca for clinical data.
3. **Interoperability is the product.** An EMR that cannot exchange data is a
   silo. SMART on FHIR, US Core, Bulk Data, HL7v2, C-CDA, NCPDP, and X12 are
   table stakes, not roadmap nice-to-haves.
4. **Free to use, sustainable to run.** "Free" means no license fee and an
   OSI-approved license. It does not mean zero operational cost — terminology
   licensing, EPCS audits, and clearinghouse connections have real costs we
   document honestly.
5. **Boring where it counts.** We prefer well-understood, auditable technology
   (Postgres, proven web frameworks) over novel infrastructure in the clinical
   core. Innovation budget is spent on workflow and safety, not on databases.

---

## 2. The hard problems (read this section first)

These are the considerations that determine whether this project is credible.
None are solved by writing more code faster.

### 2.1 Clinical content is licensed, not free

You cannot legally ship a serious EMR without third-party clinical knowledge,
and most of it is **not** open:

| Need                                | Common source                             | License reality                                                |
| ----------------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Drug database, dosing, interactions | First Databank, Medi-Span, Multum, RxNorm | RxNorm is free; interaction/dosing knowledge is **commercial** |
| Diagnoses                           | ICD-10-CM                                 | Free (CMS/CDC) in the US                                       |
| Procedures                          | CPT                                       | **AMA-licensed, fee-based**                                    |
| Labs/observations                   | LOINC                                     | Free with license agreement                                    |
| Clinical terms                      | SNOMED CT                                 | Free in US (NLM UMLS license); **per-country** elsewhere       |
| Meds (transmission)                 | NCPDP SCRIPT                              | Membership/standard fees                                       |

**Design consequence:** terminology and drug knowledge live behind a
**pluggable content provider interface** (`packages/terminology`,
`packages/medication-knowledge`). We ship adapters for the free sources
(RxNorm, ICD-10-CM, LOINC, SNOMED via UMLS) and a documented SPI so an
organization can drop in their licensed FDB/Medi-Span feed. We never hardcode
CPT descriptors into the repo. See [docs/terminology.md](./docs/terminology.md).

### 2.2 Prescribing controlled substances (EPCS) is a regulated identity problem

ePrescribing of controlled substances requires DEA-compliant **two-factor
identity proofing** and a **third-party audit (or certification)** of the
application against DEA 21 CFR 1311. This is not something you turn on with a
config flag.

**Design consequence:** the prescribing module separates _clinical decisioning_
(open) from _transmission + EPCS identity assurance_ (an integration boundary).
We target NCPDP SCRIPT via a certified routing partner (e.g., Surescripts) and
treat EPCS as a pluggable, audited capability — off by default, with a clear
compliance checklist.

### 2.3 Patient identity and record matching

The single most dangerous bug in any EMR is the **wrong patient**. There is no
national patient identifier in the US. We need a deliberate
**EMPI (Enterprise Master Patient Index)** strategy: deterministic + probabilistic
matching, identity confidence scoring, merge/unmerge with full reversibility and
audit, and "are you sure this is the right patient" friction at every order.

**Design consequence:** patient identity is its own bounded context
(`packages/empi`) with an explicit match-confidence model, never a naive
`WHERE name = ?`.

### 2.4 Certification and "meaningful use"

ONC Health IT Certification (the (b)(10) export, USCDI data classes, §170.315
criteria) gates real-world adoption and reimbursement. It is a multi-year,
expensive, test-script-driven process. We will not be certified at v1, and we
say so plainly. We _architect toward_ it (USCDI as a first-class data
contract, audit logging to spec, C-CDA generation) so it is achievable, not
bolted on.

### 2.5 Availability is a clinical safety property

In a hospital, EMR downtime is a patient-safety event. Uptime, deterministic
failover, and **downtime/read-only fallback** ("downtime forms", cached MAR)
are design requirements, not ops afterthoughts. The clinical read path must be
able to degrade to read-only rather than fail closed entirely.

### 2.6 Time, units, and rounding are clinical hazards

Timezones, daylight saving, weight-based pediatric dosing, unit conversions
(mg vs mcg vs mEq), and rounding rules have all killed patients in real systems.
We standardize on UCUM units, store instants in UTC with originating timezone,
and centralize dose calculation in one audited, property-tested library rather
than letting each module do its own math.

---

## 3. System shape

A modular monolith first, with bounded contexts that can be extracted into
services later. We do **not** start as 30 microservices — that adds distributed
-systems failure modes to a team still defining the domain. Boundaries are
enforced in code (separate packages, explicit interfaces) so extraction is cheap
when scale demands it.

```
                    ┌─────────────────────────────────────────────┐
                    │              Clients                         │
                    │  Patient portal · Clinician web · Mobile     │
                    │  (all are SMART on FHIR apps)                │
                    └───────────────┬─────────────────────────────┘
                                    │  OAuth2 / OIDC / SMART scopes
                    ┌───────────────▼─────────────────────────────┐
                    │            API Gateway / BFF                 │
                    │   AuthN/Z · audit · rate limit · routing     │
                    └───────────────┬─────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────────┐
        │                           │                               │
┌───────▼────────┐        ┌─────────▼─────────┐          ┌──────────▼─────────┐
│  Clinical core │        │  Operational      │          │  Financial / RCM   │
│  ── FHIR data  │        │  Scheduling       │          │  Charge capture    │
│  ── CPOE       │        │  Credentialing    │          │  Coding assist     │
│  ── MAR        │        │  Acuity staffing  │          │  837/835 (X12)     │
│  ── Results    │        │  Therapy workload │          │  Eligibility/PA    │
│  ── Notes/CDS  │        │                   │          │  Statements        │
└───────┬────────┘        └─────────┬─────────┘          └──────────┬─────────┘
        │                           │                               │
        └───────────────────────────┼───────────────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────────────┐
                    │   Platform services (shared)                 │
                    │   FHIR store · EMPI · Terminology · Audit ·  │
                    │   Notification · Document/DICOM · Eventing   │
                    └───────────────┬─────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────────┐
        │                           │                               │
┌───────▼────────┐        ┌─────────▼─────────┐          ┌──────────▼─────────┐
│  PostgreSQL    │        │  Object store     │          │  Integration edge  │
│  (+ FHIR)      │        │  (docs, images)   │          │  HL7v2 · NCPDP ·   │
│                │        │                   │          │  X12 · Surescripts │
└────────────────┘        └───────────────────┘          └────────────────────┘
```

### Domain boundaries (bounded contexts)

- `fhir-store` — persistence + search for FHIR resources (the clinical record).
- `empi` — patient identity & matching.
- `terminology` — code systems, value sets, ConceptMaps (pluggable content).
- `medication-knowledge` — drug DB, interactions, dosing (pluggable content).
- `cpoe` — order sets, order lifecycle, clinical decision support hooks.
- `mar` — medication administration, the five rights, barcode scanning.
- `prescribing` — outpatient Rx, NCPDP SCRIPT, EPCS boundary.
- `scheduling` — patient appts + provider/resource scheduling.
- `credentialing` — provider enrollment, primary source verification.
- `staffing` — acuity (nursing) and workload (therapy) models.
- `documentation` — notes, templates, narrative, e-signature.
- `rcm` — charges, coding, claims, remits, statements, prior auth.
- `audit` — tamper-evident access & change log.
- `identity` — users, roles, SMART/OIDC, sessions, break-the-glass.
- `reporting` — operational + clinical quality + population health.

---

## 4. Technology direction (proposed, open to debate)

| Concern           | Proposed default                                                                                 | Rationale                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Primary datastore | PostgreSQL                                                                                       | Boring, auditable, JSONB for FHIR, strong constraints                                                                     |
| FHIR engine       | Embed/adapt an existing open FHIR server (e.g. HAPI FHIR-compatible model) behind our own facade | Don't reinvent FHIR persistence/search                                                                                    |
| Backend language  | **TypeScript (Node)** — _decided (Q1)_                                                           | One language across front/back end; large ecosystem; we build a FHIR facade over Postgres rather than inherit a JVM stack |
| API               | FHIR REST + SMART on FHIR; GraphQL/BFF for app-specific reads                                    | Standards out, ergonomics in                                                                                              |
| Frontend          | React + TypeScript design system shared across portal/clinician                                  | One component library, accessibility built in                                                                             |
| AuthN/Z           | OIDC + SMART scopes; RBAC+ABAC; break-the-glass                                                  | Clinical access control is contextual                                                                                     |
| Eventing          | Postgres-backed outbox → message bus                                                             | Reliable, no premature Kafka                                                                                              |
| Integration       | Dedicated edge services per protocol (HL7v2, X12, NCPDP)                                         | Isolate ugly legacy formats from the core                                                                                 |
| Deploy            | Containers + Helm; single-node compose for dev/small clinic                                      | Scales down to a clinic and up to a system                                                                                |

Nothing here is final. The language choice (Q1) blocks a lot and should be
decided early and deliberately.

---

## 5. Data & interoperability contracts

- **Clinical data model:** FHIR R4, conforming to **US Core** profiles; USCDI
  data classes treated as a stable contract.
- **Documents:** C-CDA generation/ingest for transitions of care; DICOM (or
  DICOMweb) references for imaging, not blobs in the clinical DB.
- **Messaging:** HL7v2 (ADT, ORM, ORU, SIU, DFT) at the integration edge,
  mapped to FHIR internally.
- **Pharmacy:** NCPDP SCRIPT for eRx; RxNorm for medication identity.
- **Billing:** X12 837 (claims), 835 (remit), 270/271 (eligibility),
  278 (prior auth).
- **Bulk:** FHIR Bulk Data ($export) for analytics and migration — this is also
  our anti-lock-in guarantee.

---

## 6. Security & privacy model (summary; full detail in SECURITY.md)

- Encryption in transit (TLS 1.2+) and at rest (DB + object store).
- Every read and write of PHI is audited (who, what, when, why, from where).
  Audit is append-only and tamper-evident.
- Access control: least privilege by role, narrowed by context (care
  relationship), with **break-the-glass** emergency access that is loud,
  logged, and reviewed.
- Minimum necessary, configurable data retention, and patient-driven consent
  (incl. 42 CFR Part 2 substance-use special handling and adolescent
  confidentiality — these are notoriously hard and treated as first-class).
- De-identification path for research/reporting (Safe Harbor / Expert
  Determination aware).

---

## 7. Clinical safety process

- A `SAFETY.md`-governed change class: PRs touching `cpoe`, `mar`,
  `prescribing`, `medication-knowledge`, `empi`, or dose math require a second
  reviewer and explicit hazard consideration.
- Dose/unit math lives in one library with property-based tests.
- Decision support (alerts, interaction checks, allergy checks) is built to
  minimize **alert fatigue** — measured, tunable, and overridable with reason
  capture.
- We will maintain a hazard log and incident review process modeled on
  established health-IT safety practice (e.g., SAFER guides, ISO 14971
  risk-management thinking) without claiming formal certification we don't have.

---

## 8. License — _decided (Q2)_

**Split licensing**, to protect the platform commons while maximizing reuse of
the building blocks:

- **The application is AGPLv3.** Anything under `apps/` (the deployable EMR) is
  copyleft. The Affero clause closes the "SaaS loophole": a vendor offering a
  hosted fork must share their modifications with their users. This keeps the
  platform a commons rather than free R&D for a proprietary fork.
- **The libraries/SDKs are Apache 2.0.** Anything under `packages/` — FHIR
  model, terminology and medication-knowledge adapters, clients — is permissive
  with a patent grant, so integrators (including commercial EMRs and our own
  content-provider adapters) can embed them without copyleft obligations.

The split boundary is the directory boundary: `apps/* = AGPLv3`,
`packages/* = Apache-2.0`. Each package declares its `license` in
`package.json` and carries the appropriate header. See
[licensing.md](./licensing.md) for the rule and the SPDX identifiers, the
root [LICENSE](./LICENSE) (AGPLv3), and [LICENSE-APACHE-2.0.txt](./LICENSE-APACHE-2.0.txt).

---

## 9. Decisions & open questions

**Decided:**

- **Q1 — Backend stack:** ✅ **TypeScript/Node.** Unified language across front
  and back end; we build a focused FHIR facade over Postgres (see Q3).
- **Q2 — License:** ✅ **Split — AGPLv3 application, Apache-2.0 libraries** (§8).
- **Q4 — Initial care setting:** ✅ **Acute / inpatient first.** This is where
  CPOE, MAR, and acuity-based nurse staffing matter most — and the highest-risk,
  highest-complexity surface. It means ADT (admit/discharge/transfer), encounter
  and bed/census management, and inpatient order/medication workflows are
  first-class earlier than they would be in an ambulatory-first build. The
  chart-read foundation (FHIR store, EMPI, identity, audit) still comes first
  because everything sits on it.

- **Q3 — FHIR engine:** ✅ **Build a focused FHIR facade over Postgres.** Shipped
  as the `FhirStore` service: resources stored as JSONB with versioned current +
  history tables, soft delete, and a search-parameter registry shared by the
  in-memory and Postgres backends. An external FHIR server can still slot in
  behind the same interface later if scale or conformance demands it.

**Still open:**

- **Q5 — Hosting model:** self-host-first vs. reference multi-tenant SaaS.

The roadmap (ROADMAP.md) reflects inpatient-first ordering and a modular
monolith until proven otherwise.
