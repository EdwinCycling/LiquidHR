# F03 — Workforce / Employment

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** SOLO
- **Mutation risk:** HIGH
- **Expected runtime class:** LONG
- **Required personas:** Owner, HR, Manager, Employee
- **External dependencies:** Employee, employment, publication, manager scope, RLS
- **Preferred fixture isolation:** Create dedicated employee lifecycle; verify draft/publish/change/deactivate, employment dates, manager graph, readbacks, audit/history, direct API denial and downstream Focus/Leave/Actual Work.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Create dedicated employee lifecycle; verify draft/publish/change/deactivate, employment dates, manager graph, readbacks, audit/history, direct API denial and downstream Focus/Leave/Actual Work.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
