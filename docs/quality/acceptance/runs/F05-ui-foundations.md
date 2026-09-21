# F05 — UI foundations

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** PARALLEL_SAFE
- **Mutation risk:** LOW
- **Expected runtime class:** MEDIUM
- **Required personas:** Owner, HR, Manager, Employee
- **External dependencies:** Foundation primitives and representative routes
- **Preferred fixture isolation:** Cross-product check of buttons, forms, tables, dialogs, empty/error/loading states, focus/keyboard, contrast, responsive 390x844 and desktop; no domain mutation.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Cross-product check of buttons, forms, tables, dialogs, empty/error/loading states, focus/keyboard, contrast, responsive 390x844 and desktop; no domain mutation.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
