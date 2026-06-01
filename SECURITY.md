# Security & Privacy

OpenSourceEMR handles Protected Health Information (PHI). Security is a
correctness property here, not a hardening checklist applied at the end.

> This document describes the *target* security model for the platform. It does
> not constitute a HIPAA compliance attestation, and running this software does
> not by itself make a deployment compliant. Compliance is a property of a
> deployment, its operator, its BAAs, and its policies — not of source code.

## Reporting a vulnerability

Until a formal process exists, report suspected vulnerabilities privately to the
maintainers (do **not** open a public issue for anything exploitable). We will
add a security contact / GitHub private advisory channel as the project
formalizes. Please include affected versions, reproduction, and impact.

We ask researchers to act in good faith: no accessing real PHI, no degradation
of service, and reasonable disclosure timelines. We will credit reporters who
follow coordinated disclosure.

## Security model (target)

### Identity & access
- OIDC-based authentication; MFA supported and required for privileged roles.
- **RBAC + ABAC**: role grants a baseline; attributes (care relationship,
  location, encounter) narrow it. A clinician's access follows the patients
  they actually care for.
- **Break-the-glass**: emergency access is allowed but is loud — it warns the
  user, captures a reason, fires real-time alerts, and is queued for review.
- Session management with idle/absolute timeouts appropriate to shared
  clinical workstations.

### Auditing
- Every PHI access (read included) and every change is recorded: who, what
  resource, when, from where, and why where applicable.
- The audit log is **append-only and tamper-evident** (e.g., hash-chained) and
  stored separately from the data it describes.
- Audit is queryable for accounting-of-disclosures and breach investigation.

### Data protection
- TLS 1.2+ in transit; encryption at rest for database and object storage.
- Secrets via a secret manager, never in source or images.
- Field-level protection and special handling for sensitive categories:
  - **42 CFR Part 2** substance-use disorder records (segmented consent).
  - Adolescent/minor confidentiality and proxy access rules.
  - Reproductive, behavioral health, and HIV-status sensitivity where mandated.
- Minimum-necessary access enforced at the API.

### Tenancy & isolation
- Strong tenant isolation for multi-tenant deployments; no cross-tenant
  identifiers in shared caches or logs.
- PHI must never enter application logs, error trackers, or analytics without
  explicit de-identification.

### Software supply chain
- Pinned dependencies, SBOM generation, automated dependency and secret
  scanning in CI, signed releases.
- Reproducible container builds where feasible.

### Availability as safety
- The clinical read path is designed to degrade to read-only rather than fail
  closed, with documented downtime procedures (cached MAR / downtime forms).

## What this project will not do

- Ship default credentials or "demo mode" that is unsafe in production.
- Log PHI.
- Claim certifications (ONC, HITRUST, EPCS) it has not actually earned.
- Enable controlled-substance ePrescribing without the required DEA-compliant
  identity proofing and third-party audit in place for that deployment.
