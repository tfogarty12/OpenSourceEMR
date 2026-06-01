<!-- Thanks for contributing! Keep PRs small and focused. -->

## What & why

<!-- What does this change and why? Link the issue/decision it implements. -->

## Type of change

- [ ] Docs
- [ ] Feature
- [ ] Fix
- [ ] Refactor / chore

## Clinical-safety change class

Does this PR touch `cpoe`, `mar`, `prescribing`, `medication-knowledge`,
`empi`, or any dose/unit/time calculation? (See CONTRIBUTING.md.)

- [ ] No — standard review.
- [ ] Yes — requires **two reviewers** and the hazard note below.

### Hazard note (required if "Yes")

<!--
What could go wrong clinically if this change is wrong, and how does this PR
mitigate it? e.g. wrong dose, wrong patient, missed interaction, stale data.
-->

## Checklist

- [ ] No real PHI in code, tests, fixtures, or screenshots (synthetic only).
- [ ] No hardcoded licensed content (CPT, commercial drug knowledge).
- [ ] Tests added/updated (and dose/unit/time math has property-based tests).
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally.
