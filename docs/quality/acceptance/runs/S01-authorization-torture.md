# S01 — Authorization torture

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** SOLO
- **Mutation risk:** MEDIUM
- **Expected runtime class:** MEDIUM
- **Required personas:** Owner, HR, Manager, Employee, out-of-scope
- **External dependencies:** All exposed domain APIs and RLS
- **Preferred fixture isolation:** Matrix every persona against read/create/update/delete/approve/act-as across domains. Prove fail-closed 403/404, no existence leak, no revision/event/business mutation and no cross-tenant access.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Matrix every persona against read/create/update/delete/approve/act-as across domains. Prove fail-closed 403/404, no existence leak, no revision/event/business mutation and no cross-tenant access.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
