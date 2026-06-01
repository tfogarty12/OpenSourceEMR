# @osemr/fhir-model

Minimal FHIR R4 types and helpers shared across OpenSourceEMR.

**License: Apache-2.0** (a `packages/*` library — see [licensing.md](../../licensing.md)).

This is intentionally tiny right now: just the resources and helpers the
Phase 0 skeleton needs (`Patient`, `OperationOutcome`, name formatting). It
grows toward US Core profiles as the chart-read foundation lands. It does **not**
attempt to be a complete FHIR implementation — that's the job of the FHIR store
facade (Q3 in [ARCHITECTURE.md](../../ARCHITECTURE.md)).
