# Licensing

OpenSourceEMR uses **split licensing**. The rule is the directory boundary:

| Location                                          | License        | SPDX id         | Why                                                                                                                   |
| ------------------------------------------------- | -------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `apps/**` (the deployable application)            | **GNU AGPLv3** | `AGPL-3.0-only` | Copyleft + Affero clause: hosted forks must share modifications with their users. Protects the platform as a commons. |
| `packages/**` (libraries, SDKs, content adapters) | **Apache 2.0** | `Apache-2.0`    | Permissive + patent grant: integrators and content-provider adapters can embed freely. Maximizes reuse.               |

## How it's enforced

- Every `package.json` declares the correct `"license"` field
  (`AGPL-3.0-only` or `Apache-2.0`).
- The root [`LICENSE`](./LICENSE) file is the AGPLv3 text (applies to the app).
- [`LICENSE-APACHE-2.0.txt`](./LICENSE-APACHE-2.0.txt) is the library license.
- CI checks that no `package.json` under `apps/` is Apache and none under
  `packages/` is AGPL (see `.github/workflows/ci.yml`).

## What this means in practice

- You can take a `@osemr/*` library (e.g. the FHIR model, a terminology
  adapter) and use it in a closed-source product — that's intentional.
- If you run a **modified** version of the **application** as a network
  service, AGPLv3 §13 requires you to offer your users the modified source.
- **Licensed third-party content** (CPT, commercial drug knowledge) is never
  in this repo under any license — it is loaded at deploy time through the
  pluggable provider interfaces. See [docs/terminology.md](./docs/terminology.md).

## Contributions

By contributing you agree your contribution is licensed under the license of
the directory it lands in (AGPLv3 for `apps/`, Apache-2.0 for `packages/`). A
DCO sign-off may be adopted; see [CONTRIBUTING.md](./CONTRIBUTING.md).
