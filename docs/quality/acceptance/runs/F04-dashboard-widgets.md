# F04 — Dashboard / widgets

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** SOLO
- **Mutation risk:** MEDIUM
- **Expected runtime class:** MEDIUM
- **Required personas:** Owner, HR, Manager, Employee
- **External dependencies:** Dashboard APIs, widgets, alerts and permissions
- **Preferred fixture isolation:** Prove UI = API = DB for widgets, filters, empty/error/loading states, alert dismissal/readback, controlled mutation, role privacy, responsive layout and refresh stability.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Prove UI = API = DB for widgets, filters, empty/error/loading states, alert dismissal/readback, controlled mutation, role privacy, responsive layout and refresh stability.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
