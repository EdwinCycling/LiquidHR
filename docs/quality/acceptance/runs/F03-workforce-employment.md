# F03 — Workforce / Employment

- **Run ID:** F03
- **Name:** Workforce and employment lifecycle acceptance
- **Status:** READY
- **Execution mode:** SOLO
- **Mutation risk:** HIGH
- **Expected runtime:** LONG
- **Required personas:** HR Admin, Manager in scope, Manager out of scope, Employee self, Other Employee
- **External dependencies:** Employee/employment domain, organization, work patterns, documents, Focus, dashboard/read models, audit and Auth
- **Preferred branch name:** `work/acceptance-F03-YYYYMMDD`
- **Fixture isolation strategy:** One dedicated Employee and dedicated employment chain; no reuse of active payroll or acceptance employee without an explicit snapshot/restore plan
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Lifecycle scope

Discover and exercise the canonical create/edit/publish/archive/terminate model. Cover Employee identity, contact, office/work information, employment and start date, job/job group, seniority when implemented, department/team, manager, location, work pattern, contract fields, history, custom fields, dossier, secure identifiers, future employment, multiple employment when supported, manager transfer, department transfer, location transfer, termination/end date and archive when supported.

## Readback after every material mutation

After each mutation verify HR detail, Workforce list, Manager Team, Employee Focus/Profile, dashboard/read model and audit/history. Record actor, subject, row counts, revisions/events, effective dates and downstream values before and after. Hard refresh and relogin when the mutation affects session-derived or effective-dated behavior.

## Edge cases and security

Cover no employment, future employment, ended employment, multiple employment, missing manager, missing department, inactive location and duplicate constrained values. Use direct ID substitution and privacy probes for secure identifiers, another Employee, out-of-scope Manager, cross-HR-group and cross-tenant cases where safe. Every denial must be fail-closed with no data, business, revision or false-audit mutation.

Do not delete or destructively restore shared fixtures. A fixture conflict or ambiguous employment-chain result is recorded as `FIXTURE_DRIFT` or `PRODUCT_DECISION` before proceeding.
