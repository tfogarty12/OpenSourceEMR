# Regulatory landscape (summary)

This is an engineer's orientation map, **not legal advice**. Compliance depends
on jurisdiction, deployment, and organizational policy. It is US-centric in this
first draft; international requirements (GDPR, NHS/DCB0129–0160, Canada PIPEDA,
AU My Health Record) are noted as follow-ups.

## Why this matters to architecture

Regulatory requirements are _design inputs_. Designing them in late means
re-architecting. The items below are reflected in ARCHITECTURE.md and SECURITY.md.

## US — the big ones

### HIPAA (Privacy, Security, Breach Notification Rules)

- Governs use/disclosure of PHI, security safeguards, and breach reporting.
- **Architectural impact:** audit-everything, encryption, access control,
  minimum-necessary, accounting-of-disclosures, BAAs with subprocessors.
- Software cannot be "HIPAA certified" — compliance is a deployment property.

### 42 CFR Part 2

- Heightened protection for substance-use-disorder treatment records.
- **Architectural impact:** consent-driven data segmentation; you cannot treat
  all clinical data uniformly. First-class in the consent model.

### ONC Health IT Certification (21st Century Cures Act, §170.315)

- The certification framework for "Certified EHR Technology," including:
  - **USCDI** data classes (the standardized data contract).
  - **(b)(10)** EHI export (anti-information-blocking).
  - API criteria built on **FHIR + SMART** and Bulk Data.
  - **Information blocking** rules — you must not unreasonably impede access.
- **Architectural impact:** USCDI as a stable internal contract; FHIR/SMART
  APIs; standardized export. We target conformance over time; not certified now.

### DEA EPCS (21 CFR 1311)

- Electronic prescribing of controlled substances requires two-factor identity
  proofing and a third-party audit/certification of the application.
- **Architectural impact:** EPCS is a pluggable, audited capability at the
  prescribing/transmission boundary — off by default.

### CLIA

- Governs lab testing and result reporting; affects how/when results are
  released and labeled.
- **Architectural impact:** result-release rules, provider review gating,
  patient-facing result timing (also interacts with information-blocking).

### CMS programs

- Reimbursement and quality programs (e.g., Promoting Interoperability, MIPS,
  eCQMs) shape required reporting and data capture.
- **Architectural impact:** clinical-quality measure calculation and reporting
  (Phase 6).

## Standards we conform to (not regulations, but de facto requirements)

- **FHIR R4 + US Core**, SMART on FHIR, FHIR Bulk Data.
- **HL7v2** for legacy interfacing; **C-CDA** for document exchange.
- **NCPDP SCRIPT** for ePrescribing; **RxNorm** for med identity.
- **X12** 837/835/270/271/278 for billing and authorization.
- **UCUM** for units; **LOINC/SNOMED/ICD-10-CM/CPT** for terminology.
- **DICOM / DICOMweb** for imaging.

## International (follow-up, not yet designed)

- **EU GDPR** — lawful basis, data subject rights, DPIAs, data residency.
- **UK** clinical safety standards **DCB0129 / DCB0160** (manufacturer +
  deployment safety cases) — notable because they formalize the hazard-log
  practice we adopt voluntarily in ARCHITECTURE.md §7.
- **MDR / FDA SaMD** — if/when features become "medical device" software
  (some CDS can cross this line), regulatory obligations change materially.

## The honest summary

A credible EMR is as much a regulatory and content-licensing project as a
software project. We keep this file current so contributors design _with_ these
constraints instead of discovering them after writing code.
