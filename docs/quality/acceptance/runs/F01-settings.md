# F01 — Settings

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** SOLO
- **Mutation risk:** HIGH
- **Expected runtime class:** LONG
- **Required personas:** Owner, HR, Manager, Employee
- **External dependencies:** Settings APIs, audit, module flags and tenant config
- **Preferred fixture isolation:** Inventory settings; read → change → save → readback → refresh → relogin → downstream → restore. Cover invalid, duplicate, conflict, module-off, direct API denial and audit evidence.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Inventory settings; read → change → save → readback → refresh → relogin → downstream → restore. Cover invalid, duplicate, conflict, module-off, direct API denial and audit evidence.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
