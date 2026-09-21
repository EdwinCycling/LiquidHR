# AW02 — Actual Work Rules and Concurrency

- **Run ID:** AW02
- **Name:** Actual Work rules, limits and concurrency acceptance
- **Status:** READY
- **Execution mode:** ISOLATED_FIXTURE
- **Mutation risk:** HIGH
- **Expected runtime:** LONG
- **Required personas:** Employee self, Other Employee, Manager in scope, Manager out of scope, HR Admin
- **External dependencies:** Actual Work service/RPC/RLS, work-hour types, periods, schedules, Leave, ledger/revisions and Auth
- **Preferred branch name:** `work/acceptance-AW02-YYYYMMDD`
- **Fixture isolation strategy:** Dedicated employee/employment and unique run ID; use one controlled entry per scenario and never reuse accepted GJ03 rows for destructive/concurrency probes
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Exact mutation evidence

Before and after every scenario record the unique run ID, entry/ledger row counts, exact ledger values, exact revision count and values, actor, subject, events and downstream totals. Assert no unintended duplicate rows. Use the canonical Actual Work service/RPC; do not create a parallel Focus backend.

## Positive and privacy matrix

Cover Employee own create and own correction, foreign read/write, own delete according to the approved contract, Manager mutation according to contract and HR mutation. Verify own-row privacy, Other Employee denial, Manager out-of-scope denial and cross-tenant denial. Every denial must be 403/404 as appropriate with no leak or mutation.

## Rule matrix

Test closed-period create, closed-period edit, future entry, inactive type, day/period granularity, comment-required type, future-allowed type, ADDITIONAL part-time/full-time rules when implemented, day/week/month limits, approved Leave overlap, non-approved Leave, schedule boundary, employment boundary and invalid precision. Read back unchanged ledger/revisions after every rejection.

## Idempotency and concurrency

Test double submit, repeated submit, same-key retry, refresh after success, duplicate entry prevention, concurrent correction/version conflict and stale form submission. Never blindly repeat a non-idempotent ledger mutation. Prove final totals, revisions and projections are deterministic and that one actor cannot overwrite another actor's subject or row.
