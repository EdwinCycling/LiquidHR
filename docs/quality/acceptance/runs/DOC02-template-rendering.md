# DOC02 — Template rendering

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** ISOLATED_FIXTURE
- **Mutation risk:** MEDIUM
- **Expected runtime class:** MEDIUM
- **Required personas:** HR, Manager, Employee
- **External dependencies:** Template editor, renderer, storage, dossier, signing
- **Preferred fixture isolation:** Use a dedicated acceptance template, not a product template. Test placeholders, missing/invalid data, render/PDF/hash/storage, audience/privacy, filename/content type, idempotency and viewer/download/signing readback.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Use a dedicated acceptance template, not a product template. Test placeholders, missing/invalid data, render/PDF/hash/storage, audience/privacy, filename/content type, idempotency and viewer/download/signing readback.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
