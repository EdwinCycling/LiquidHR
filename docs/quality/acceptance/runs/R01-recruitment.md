# R01 — Recruitment

- **Run ID:** R01
- **Name:** Recruitment lifecycle and public intake acceptance
- **Status:** READY
- **Execution mode:** ISOLATED_FIXTURE
- **Mutation risk:** MEDIUM
- **Expected runtime:** LONG
- **Required personas:** HR Admin/recruiter, Manager in scope, Manager out of scope, Public candidate, Employee/out-of-scope observer
- **External dependencies:** Vacancy/requisition, public intake, candidate records, email/notifications, documents and Employee conversion when implemented
- **Preferred branch name:** `work/acceptance-R01-YYYYMMDD`
- **Fixture isolation strategy:** One disposable vacancy and one controlled candidate identity/email; unique public ID and no shared active requisition mutation
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Discovery and lifecycle

Discover actual implemented vacancy/requisition lifecycle, required fields, publication/intake, candidate record, stage/status, notes/documents, evaluation, Manager review, reject/close and candidate-to-Employee conversion. Record every route/page/API/RPC/action, permission, list/detail, projection and audit/history state before mutation.

## Acceptance journey

Create a vacancy/requisition, validate required fields, publish it, submit one public candidate intake, read back the candidate, advance stage/status, add permitted notes/documents, perform Manager review, reject or close according to the implemented contract, and convert to Employee only when supported. After each step verify UI, API and canonical DB/read model. Conversion must produce exactly one Employee, retain and audit the candidate, avoid duplicate Employee creation and hand off correct onboarding/employment data.

## Public and Manager negatives

Test malformed intake, duplicate intake, idempotent replay, no candidate enumeration, no administrative field injection, no tenant leakage, unknown/expired public ID, out-of-scope Manager access and unauthorized stage/review/conversion actions. Every denial must have no leak or mutation. Verify HR and Manager in-scope/out-of-scope projections after refresh/relogin.
