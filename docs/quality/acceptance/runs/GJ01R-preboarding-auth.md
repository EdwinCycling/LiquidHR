# GJ01R — Authenticated Preboarding Completion

- **Run ID:** GJ01R
- **Name:** Authenticated future Employee preboarding completion
- **Status:** WAITING_FOR_DEV_MAIL
- **Execution mode:** SOLO
- **Mutation risk:** MEDIUM
- **Expected runtime:** LONG
- **Required personas:** Future Employee, HR Admin, Manager in scope
- **External dependencies:** Deterministic DEV Supabase Auth mail delivery, invitation/activation, Auth session, Journey, Focus, browser harness
- **Preferred branch name:** `work/acceptance-GJ01R-YYYYMMDD`
- **Fixture isolation strategy:** Reuse the established Test test100 future Employee only after mail preflight; one controlled invitation/activation identity; no repeated identities or invitation retries after an external blocker
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Boundary

Do **not** rerun full GJ01. Rerun only the previously unproven authenticated leg after a deterministic DEV mail preflight. If mail delivery is unavailable, classify `EXTERNAL_BLOCKER` before creating repeated invitations or identities and stop this run without changing the historical GJ01 verdict.

## Healthy-mail journey

Execute the canonical sequence:

`invite → mail capture → normal activation link → invitation acceptance → authenticated future Employee → pre-start Focus → onboarding task → HR/Manager progress → deny Team/Leave/Actual Work before start → canonical start-date transition → normal Employee Focus → post-start access checks`.

Prove the Employee can open Preboarding Focus before the start date, access only allowed tasks/documents/profile, perform the representative onboarding task, and see no Team, Leave, Actual Work, Manager or HR surface. Read back HR/Manager progress projections and the journey event/history. At the canonical start-date boundary prove transition to normal Employee Focus, then verify normal Employee self-service and denied HR/Manager/Team scope.

## Evidence matrix

Capture server-side invitation/activation readback, Auth identity linkage through the normal flow, journey/task state, audit/history, negative API probes, desktop evidence and 390x844 mobile evidence. Verify refresh/relogin, no duplicate task completion, no direct auth link, no service-role browser bypass and no permission broadening. Final verdict is GREEN only when the authenticated leg and start-date transition are actually proven.
