# Contributing

Thank you for considering a contribution. This project builds software that can
affect patient care, so our contribution process has one unusual property: some
changes are held to a clinical-safety bar, not just a code-quality bar.

## Before you start

- Read [ARCHITECTURE.md](./ARCHITECTURE.md), especially §2 (the hard problems)
  and the Open Questions. Several big decisions (backend stack, license, FHIR
  engine) are not yet made; PRs that depend on them may be asked to wait.
- For anything non-trivial, open an issue or discussion first. We would rather
  align on approach than reject a large PR.

## Ground rules

1. **No real PHI, ever.** Do not include real patient data in code, tests,
   fixtures, screenshots, or issues. Use synthetic data (e.g., Synthea).
2. **Standards first.** Clinical data changes should map to FHIR R4 / US Core.
   If you find yourself inventing a parallel clinical model, stop and discuss.
3. **No hardcoded licensed content.** Do not commit CPT descriptors, commercial
   drug-knowledge content, or other licensed terminology into the repo. Use the
   pluggable content interfaces. See [docs/terminology.md](./docs/terminology.md).
4. **Accessibility is not optional.** Patient- and clinician-facing UI targets
   WCAG 2.1 AA. A button a clinician can't use at 3am is a safety problem.

## The clinical-safety change class

Any PR that touches one of these areas requires **two reviewers**, at least one
with domain context, plus an explicit hazard note in the PR description
(*what could go wrong clinically, and how this change mitigates it*):

- `cpoe` (order entry, order sets, decision support)
- `mar` (medication administration)
- `prescribing` (eRx, EPCS boundary)
- `medication-knowledge` (drug DB, interactions, dosing)
- `empi` (patient identity / matching / merge)
- any dose, unit, or time calculation

For these changes:
- Dose/unit/time math must have property-based tests.
- Patient-identity changes must preserve full audit and reversibility.
- Decision-support changes must consider alert fatigue (false-positive cost).

## Commit & PR conventions

- Small, reviewable PRs. One concern per PR.
- Conventional commit style (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Every behavioral change ships with tests. Clinical-safety code ships with
  tests *and* a hazard note.
- Link the issue/decision the PR implements.

## Code of conduct

Be respectful and assume good faith. A formal Code of Conduct (Contributor
Covenant) will be adopted as the community grows.

## Licensing of contributions

The project license is not yet finalized (see ARCHITECTURE.md §License). By
contributing you agree your contributions will be licensed under the project's
eventual OSI-approved license. We may adopt a Developer Certificate of Origin
(DCO) sign-off requirement.
