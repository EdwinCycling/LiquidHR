# ADR-PAYLAB-002 — Arrangement Foundation

**Status:** Accepted for CAO-BENCH02 Phase 1 candidate; integration approval remains separate<br>
**Date:** 2026-10-03<br>
**Baseline:** `6349d02538351cd01fc51f298c6e6fa0ba88006c`

## Decision

Model primary payroll arrangements as reviewed, versioned application metadata and scoped Payroll Lab administration data. The Phase 1 scope is restricted to three synthetic fixtures and three static package identities. A fixture can receive at most one primary arrangement for its synthetic employment, effective-dated and scoped to the active Payroll administration.

The package catalog stores references, effective boundaries, supported salary-strategy labels, source metadata and a deterministic version hash. It does not contain executable CAO code, wage tables, salary amounts, applicability decisions or payroll calculations. A composition snapshot copies the resolved package version metadata, fixture/assignment identity and scope into canonical JSON, then stores a SHA-256 hash. Snapshot reads validate the stored content/hash and assignment/scope relationship without rebuilding historical content from the current catalog.

Administration availability has an effective start and optional inclusive end date. A new assignment requires availability to include both its effective date and the current selection date. It can be ended by a scoped, audited service-role update that only shortens the interval, no earlier than a stored assignment's effective start. The availability identity and start date stay immutable; assignments and snapshots stay insert-only. Existing assignments may resolve snapshots after availability ends, within their own effective dates. Availability renewal/reactivation is outside this phase.

## Scope and security

- Persist only in the separate Payroll Lab Supabase project; use composite tenant + HR-group + Core-administration + Payroll-administration relationships.
- Keep RLS enabled. Service-role access is used only after the existing server-side Payroll Lab permission/context guard and scoped repository checks.
- Keep assignment, availability and snapshot IDs separate from Core employee/employment foreign keys. Fixture employment IDs are synthetic identifiers only.
- Use the shared searchable `DropdownSelect` and `TextInput` controls. All visible copy lives in matching NL/EN navigation messages.
- Preserve exact Core QA findings from [AA-PAYROLL §13](../AA/AA-PAYROLL.md), including Planeten → Jupiter BV → Directie. They inform a later read-only benchmark phase and do not authorize Core access in Phase 1.

## Consequences

- A synthetic historical scenario can resolve a package version for an as-of date and preserve that exact metadata even after the live display catalog changes.
- A changed package is represented by a new version; historical snapshots are not silently rewritten.
- Ending package availability cannot invalidate an existing assignment or snapshot date. Renewal/reactivation needs a separately designed auditable history model.
- Package metadata is not evidence that an arrangement legally applies to an employer or employee. Official source references in this phase are for identification and date/version metadata only.
- Authenticated browser acceptance, real Core source mapping, full salary calculations and any later Core writes require separately scoped acceptance and authorization.

## Related evidence

- [CAO-BENCH02 Phase 1 acceptance](../payroll/acceptance/CAO-BENCH02-20261003.md)
- [Execution plan and chapter 13 cohort finding](../payroll/research/CAO-BENCH02-TWO-CAO-TEST-EMPLOYEE-EXECUTION-PLAN.md)
- [Payroll Lab boundary ADR](ADR-PAYLAB-001-BOUNDARY.md)
