# GJ01R — Authenticated preboarding completion

- **Status:** READY (GJ01R: WAITING_FOR_DEV_MAIL)
- **Execution mode:** SOLO
- **Mutation risk:** MEDIUM
- **Expected runtime class:** MEDIUM
- **Required personas:** Future Employee, Manager, HR
- **External dependencies:** DEV Auth mail delivery, invitation/activation, Preboarding Focus
- **Preferred fixture isolation:** Run only after deterministic DEV mail preflight. Login future Employee; prove pre-start Focus, allowed tasks/documents/profile, denied Team/Leave/Actual Work/Manager/HR, onboarding task, HR/Manager projection, start-date transition, desktop/mobile and server-side negatives. Do not repeat already-proven preview leg.

## Harness and reporting

- Harness: [HARNESS-V2.md](../HARNESS-V2.md)
- Reporting: [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)
- Branch: work/acceptance-<run-id>-YYYYMMDD`n- Baseline: exact current origin/main SHA; DEV project wnpfloqpjvaacobppbpk`n
## Acceptance scope

Run only after deterministic DEV mail preflight. Login future Employee; prove pre-start Focus, allowed tasks/documents/profile, denied Team/Leave/Actual Work/Manager/HR, onboarding task, HR/Manager projection, start-date transition, desktop/mobile and server-side negatives. Do not repeat already-proven preview leg.

## Evidence and verdict

Record run ID, actor/subject, before/after persistence, negative probes, responsive evidence, quality gates, commit and remote SHA. Verdict is GREEN only when every in-scope assertion is proven; otherwise use PARTIAL/BLOCKED with one primary classification and the exact unproven boundary.
