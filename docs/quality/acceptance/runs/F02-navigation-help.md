# F02 — Navigation / Help

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** PARALLEL_SAFE
- **Mutation risk:** LOW
- **Expected runtime class:** MEDIUM
- **Required personas:** Owner, HR, Manager, Employee
- **External dependencies:** Navigation, sidepanel, help, permissions, i18n
- **Preferred fixture isolation:** Inventory routes and role visibility; test active state, deep links, back/forward, keyboard, search/help, denied routes and missing modules without business writes.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Inventory routes and role visibility; test active state, deep links, back/forward, keyboard, search/help, denied routes and missing modules without business writes.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
