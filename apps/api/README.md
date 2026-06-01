# @osemr/api

The OpenSourceEMR backend API — the deployable application.

**License: AGPL-3.0-only** (an `apps/*` package — see [licensing.md](../../licensing.md)).

> **Phase 0 skeleton.** This serves a health check, a FHIR `metadata`
> (CapabilityStatement) stub, and a dev code-systems endpoint. No clinical
> resources yet. Not for patient care.

## Run it

From the repo root:

```bash
corepack enable        # provides pnpm
pnpm install
docker compose up -d db
cp .env.example .env
pnpm dev               # starts this API with hot reload (tsx watch)
```

Then:

```bash
curl localhost:8080/health
curl localhost:8080/fhir/metadata
```

## Layout

- `src/config.ts` — environment-driven config.
- `src/app.ts` — `buildApp()` constructs the Fastify instance and routes
  (separated from start-up so tests can use `app.inject`).
- `src/server.ts` — process entry point: load config, build app, listen.
- `src/app.test.ts` — route tests, no network bind.
