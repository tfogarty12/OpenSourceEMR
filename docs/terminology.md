# Terminology & clinical content strategy

A serious EMR is only as good as the coded vocabularies behind it. This file
explains how OpenSourceEMR handles terminology and drug knowledge so that the
project stays **legally distributable** while supporting real clinical use.

## The core problem

Some of the vocabularies an EMR needs are free; others are commercially
licensed. We must never commit licensed content into an open repository, yet we
must make it trivial for a licensed organization to plug their content in.

## Pluggable content providers

Terminology and drug knowledge sit behind interfaces (SPIs), not hardcoded
tables:

- `packages/terminology` — `CodeSystem`, `ValueSet`, `ConceptMap` lookup,
  validation, and translation (a FHIR terminology service facade).
- `packages/medication-knowledge` — drug search, dosing, drug–drug and
  drug–allergy interaction checking, RxNorm normalization.

We ship **open adapters** for free sources and a **documented SPI** so an org
can drop in a commercial feed (FDB, Medi-Span, Multum) without forking.

## Source-by-source

| Vocabulary               | Domain                        | Cost/License                               | Ship in repo?            |
| ------------------------ | ----------------------------- | ------------------------------------------ | ------------------------ |
| **RxNorm**               | Medication identity           | Free (NLM)                                 | Loader, not data         |
| **LOINC**                | Labs, observations            | Free w/ license acceptance                 | Loader, not data         |
| **SNOMED CT**            | Clinical concepts             | Free in US via UMLS; per-country elsewhere | Loader, not data         |
| **ICD-10-CM**            | Diagnoses                     | Free (CMS/CDC)                             | Loader, not data         |
| **ICD-10-PCS**           | Inpatient procedures          | Free (CMS)                                 | Loader, not data         |
| **CPT / HCPCS II**       | Outpatient procedures/billing | **CPT: AMA-licensed, fee**                 | **Never** — adapter only |
| **NDC**                  | Drug product codes            | Free (FDA)                                 | Loader, not data         |
| **UCUM**                 | Units of measure              | Free                                       | Yes (small, open)        |
| **CVX/MVX**              | Immunizations                 | Free (CDC)                                 | Loader, not data         |
| FDB / Medi-Span / Multum | Dosing, interactions          | **Commercial**                             | **Never** — adapter only |

"Loader, not data" = we ship code that imports the vocabulary from its official
source under the user's own license acceptance; we do not redistribute the
content itself.

## Why we don't author our own drug-interaction database

Building and _maintaining_ a safe, current drug-knowledge base (interactions,
dose ranges, pediatric weight-based dosing, renal adjustment) is a specialized,
liability-heavy, full-time endeavor. Shipping a half-maintained one would be
_more_ dangerous than integrating a maintained source. We therefore integrate,
behind a clean interface, and are explicit that interaction/dosing checking
requires a content subscription for production use.

## Versioning & safety

- Terminology is **versioned**; a coded clinical fact records the code _and_ the
  code-system version in effect when it was recorded.
- Value sets used for decision support are pinned and change-controlled.
- Terminology updates that affect CDS go through the clinical-safety review
  process (see CONTRIBUTING.md).
