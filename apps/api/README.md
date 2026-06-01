# @osemr/api

The OpenSourceEMR backend API — the deployable application.

**License: AGPL-3.0-only** (an `apps/*` package — see [licensing.md](../../licensing.md)).

> **Phase 0.** Serves a health check, FHIR `metadata`, a dev code-systems
> endpoint, **Patient/Practitioner** CRUD+search, **Encounter** read/search, and
> the **ADT** (admit/discharge/transfer) workflow — all behind authentication,
> RBAC, and an append-only audit log. Storage is the FHIR store facade: Postgres
> when `DATABASE_URL` is set, in-memory otherwise. Not for patient care.

## Security

Every PHI route is **fail-closed**: no valid bearer token → `401`; authenticated
but lacking the role permission → `403` (recorded as a `denied` audit event).

- **AuthN** (`src/identity/`): bearer JWT verified by a pluggable `TokenVerifier`.
  Production OIDC (RS256/JWKS) drops in behind that interface; for local dev a
  `DevTokenVerifier` (HS256) is enabled when `AUTH_DEV_SECRET` is set, with a
  `POST /auth/dev-login` endpoint to mint tokens. **Dev only.**
- **RBAC** (`src/identity/rbac.ts`): roles → `${resourceType}:${action}`
  permissions (`physician`, `nurse`, `registration`, `patient`, `system-admin`).
- **Break-the-glass**: send `X-Break-The-Glass-Reason: <why>` to gain emergency
  **read** access; it is allowed but loud — the audit event is flagged
  `emergencyAccess` with the reason.
- **Audit** (`src/audit/`): append-only, **hash-chained** (tamper-evident) log of
  who/what/when/from where/why. `GET /admin/audit` (system-admin) lists events
  and verifies the chain.

```bash
# get a dev token, then call a protected route
TOK=$(curl -s -X POST localhost:8080/auth/dev-login \
  -H 'content-type: application/json' \
  -d '{"sub":"dr-house","roles":["physician"]}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s localhost:8080/fhir/Patient?family=carter -H "authorization: Bearer $TOK"
```

## Storage

The API uses the `FhirStore` facade (`src/fhir-store/`): a versioned JSONB store
with current + history tables and soft delete. With `DATABASE_URL` set it uses
Postgres (migrations auto-run on boot); without it, an in-memory store (data is
not persisted) — handy for a zero-dependency `pnpm dev`.

```bash
docker compose up -d db                 # local Postgres
cp .env.example .env                    # sets DATABASE_URL
pnpm --filter @osemr/api migrate        # apply migrations (optional; boot also does it)
```

## Endpoints

| Method & path                        | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `GET /health`                        | Liveness/readiness probe                                |
| `GET /fhir/metadata`                 | FHIR CapabilityStatement                                |
| `POST /fhir/Patient`                 | Create a Patient (server assigns id) → 201              |
| `GET /fhir/Patient/:id`              | Read a Patient                                          |
| `PUT /fhir/Patient/:id`              | Update a Patient (version bump)                         |
| `DELETE /fhir/Patient/:id`           | Soft-delete a Patient → 204                             |
| `GET /fhir/Patient?...`              | Search (`identifier`, `family`, `name`, `birthdate`)    |
| `… /fhir/Practitioner`               | Same CRUD+search for Practitioner                       |
| `POST /adt/admit`                    | Admit a patient → new in-progress inpatient `Encounter` |
| `POST /adt/encounters/:id/transfer`  | Transfer to a new location                              |
| `POST /adt/encounters/:id/discharge` | Discharge (finishes the encounter)                      |
| `POST /adt/encounters/:id/cancel`    | Cancel an admission                                     |
| `GET /fhir/Encounter/:id`            | Read an Encounter                                       |
| `GET /fhir/Encounter?patient=:id`    | Search encounters for a patient (Bundle)                |
| `POST /auth/dev-login`               | Dev only: mint a bearer token                           |
| `GET /admin/audit`                   | system-admin: list audit events + verify the chain      |

Errors return a FHIR `OperationOutcome`: unauthenticated → 401, forbidden → 403,
unknown id → 404, illegal ADT transition (e.g. discharging twice) → 409, bad
request → 400.

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

# Create and find a patient:
curl -s -X POST localhost:8080/fhir/Patient -H 'content-type: application/json' \
  -d '{"resourceType":"Patient","name":[{"family":"Carter","given":["Eli"]}],"birthDate":"1980-04-12"}'
curl -s "localhost:8080/fhir/Patient?family=carter"

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
- `src/server.ts` — process entry point: choose Postgres/in-memory, migrate, listen.
- `src/fhir-store/` — the `FhirStore` facade: interface + search registry
  (`store.ts`), `in-memory-store.ts`, and `postgres-store.ts`.
- `src/db/` — Postgres pool and the SQL migration runner; `migrations/*.sql`.
- `src/resources/` — generic FHIR CRUD + search routes (Patient, Practitioner).
- `src/encounters/` — `EncounterRepository` port + FHIR-store adapter + in-memory.
- `src/adt/` — the admit/discharge/transfer lifecycle service, errors, and routes.
