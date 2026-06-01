# @osemr/api

The OpenSourceEMR backend API — the deployable application.

**License: AGPL-3.0-only** (an `apps/*` package — see [licensing.md](../../licensing.md)).

> **Phase 0 skeleton.** This serves a health check, a FHIR `metadata`
> (CapabilityStatement) stub, a dev code-systems endpoint, and the **ADT**
> (admit/discharge/transfer) workflow with Encounter read/search. Persistence
> is in-memory for now (the Postgres store facade is the next brick). Not for
> patient care.

## Endpoints

| Method & path                        | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `GET /health`                        | Liveness/readiness probe                                |
| `GET /fhir/metadata`                 | FHIR CapabilityStatement                                |
| `POST /adt/admit`                    | Admit a patient → new in-progress inpatient `Encounter` |
| `POST /adt/encounters/:id/transfer`  | Transfer to a new location                              |
| `POST /adt/encounters/:id/discharge` | Discharge (finishes the encounter)                      |
| `POST /adt/encounters/:id/cancel`    | Cancel an admission                                     |
| `GET /fhir/Encounter/:id`            | Read an Encounter                                       |
| `GET /fhir/Encounter?patient=:id`    | Search encounters for a patient (Bundle)                |

Lifecycle errors return a FHIR `OperationOutcome`: unknown id → 404, illegal
transition (e.g. discharging twice) → 409.

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

# Admit, transfer, discharge:
ENC=$(curl -s -X POST localhost:8080/adt/admit \
  -H 'content-type: application/json' \
  -d '{"patientId":"p1","location":"bed-101"}')
ID=$(echo "$ENC" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X POST localhost:8080/adt/encounters/$ID/transfer \
  -H 'content-type: application/json' -d '{"toLocation":"icu-3"}'
curl -s -X POST localhost:8080/adt/encounters/$ID/discharge \
  -H 'content-type: application/json' -d '{"disposition":"home"}'
curl -s "localhost:8080/fhir/Encounter?patient=p1"
```

## Layout

- `src/config.ts` — environment-driven config.
- `src/app.ts` — `buildApp()` constructs the Fastify instance, wires
  dependencies, and registers routes (separated from start-up so tests can use
  `app.inject` and inject their own dependencies).
- `src/server.ts` — process entry point: load config, build app, listen.
- `src/encounters/` — `EncounterRepository` interface + in-memory store.
- `src/adt/` — the admit/discharge/transfer lifecycle service, errors, and routes.
