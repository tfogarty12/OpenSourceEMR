# @osemr/terminology

The pluggable **terminology provider SPI** — the boundary that keeps licensed
vocabulary content out of this repository.

**License: Apache-2.0** (a `packages/*` library — see [licensing.md](../../licensing.md)).

## Why this exists

A real EMR needs RxNorm, LOINC, SNOMED, ICD-10-CM, CPT, and drug knowledge.
Some are free; **CPT and commercial drug knowledge are licensed**. We never
commit licensed content. Instead, the application depends on the
`TerminologyProvider` interface, and a deployment registers adapters:

- **Open adapters** for free sources (RxNorm, LOINC, ICD-10-CM, SNOMED via UMLS)
  — loaded from each source under the deployer's own license acceptance.
- **Commercial adapters** (FDB, Medi-Span) dropped in behind the same interface.

`InMemoryTerminologyProvider` ships here for tests and local dev only and holds
**no licensed content** — just whatever concepts you add to it.

See [docs/terminology.md](../../docs/terminology.md) for the full content
strategy and source-by-source licensing table.
