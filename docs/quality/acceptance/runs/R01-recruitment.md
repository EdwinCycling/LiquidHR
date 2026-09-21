# R01 — Recruitment

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** ISOLATED_FIXTURE
- **Mutation risk:** LONG
- **Expected runtime class:** LONG
- **Required personas:** Recruiter/HR, hiring manager, candidate, out-of-scope
- **External dependencies:** Vacancy, public intake, candidate, conversion
- **Preferred fixture isolation:** Create vacancy → public intake → screening → interview → decision → conversion. Test malformed/duplicate intake, privacy, no enumeration, unauthorized manager actions, idempotency and conversion readback.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Create vacancy → public intake → screening → interview → decision → conversion. Test malformed/duplicate intake, privacy, no enumeration, unauthorized manager actions, idempotency and conversion readback.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
