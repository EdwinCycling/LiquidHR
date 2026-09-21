# AW02 — Actual Work rules and concurrency

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** ISOLATED_FIXTURE
- **Mutation risk:** HIGH
- **Expected runtime class:** LONG
- **Required personas:** Employee, Manager, HR, out-of-scope
- **External dependencies:** Actual Work service/RPC/RLS, periods, schedules, leave and ledger
- **Preferred fixture isolation:** Use unique run key and exact before/after ledger/revision. Cover create/edit own, foreign denial, Manager misuse, invalid/closed/overlap/type/schedule rules, duplicate/retry/concurrency and downstream totals/projections; never only happy path.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Use unique run key and exact before/after ledger/revision. Cover create/edit own, foreign denial, Manager misuse, invalid/closed/overlap/type/schedule rules, duplicate/retry/concurrency and downstream totals/projections; never only happy path.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
