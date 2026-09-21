# P01 — Process Automation

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** SOLO
- **Mutation risk:** LONG
- **Expected runtime class:** LONG
- **Required personas:** Employee, Manager, HR, owner
- **External dependencies:** Recipes, requests, approvals, outputs
- **Preferred fixture isolation:** Inventory representative process; start/form/manager/request changes/correction/approve/output/complete. Test stale/wrong actor/double approval/direct bypass and exact state/event/ledger readback.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Inventory representative process; start/form/manager/request changes/correction/approve/output/complete. Test stale/wrong actor/double approval/direct bypass and exact state/event/ledger readback.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
