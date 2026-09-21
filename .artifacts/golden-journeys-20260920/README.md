# Overnight Golden Journeys — Release Baseline 1.20260920.1

Date: 2026-09-21
Canonical released main commit: `874098d9c0675d17774ad027c7a8b4fbadb37c39`
Overnight branch: `work/post-release-golden-journeys-20260920`

The branch was created from the exact released main commit. No merge to
`main`, Vercel deployment, Production Supabase mutation or force-push was
performed.

## Journey status

### GJ01 — Onboarding / Preboarding

**PARTIAL / EXTERNAL_BLOCKER at the authenticated preboarding leg by DEV Auth
mail delivery.**

The normal invitation/activation path was exercised with the existing future
Employee fixture and a single bounded DEV fixture-auth bootstrap attempt. Both
canonical invitation attempts returned HTTP 502 and were revoked. Readback is
two revoked invitations, one controlled Auth identity and zero employee Auth
links; the login correctly ends at `/geen-toegang`. No direct auth link,
service-role browser bypass or role broadening was used.

GJ01 code/DEV-preview gates are green, but the requested authenticated
preboarding Employee acceptance cannot be claimed. The exact remaining
blocker is DEV Supabase Auth mail delivery returning HTTP `502`. The endpoint
was reached correctly, the invitations were safely revoked, no Employee
`auth_user_id` link was fabricated, and the bootstrap identity did not gain
access. Authenticated preboarding and the canonical start-date transition
therefore remain unproven. This is the single unresolved overnight blocker;
GJ01R is a follow-up and was not performed during closure.

GJ01 commit/push: `a4e0af5 test: execute GJ01 onboarding acceptance`
Evidence: `.artifacts/golden-journeys-20260920/onboarding/`

### GJ02 — Documents / Document Studio / Signing

**GREEN.**

The existing active DG1 template completed the normal HR generation lifecycle:
one requested batch, one final snapshot, one dossier link and one signing
request. Employee Focus read/view/download and signing completed; generation,
HR direct signing and out-of-scope document reads remained denied. The final
signed request and prepared/signed events were read back from DEV.

GJ02 commit/push: `4d0bfdd test: execute GJ02 documents signing acceptance`
Evidence: `.artifacts/golden-journeys-20260920/documents/`

### GJ03 — Actual Work / Hours

**GREEN after the approved product-contract correction.**

Employee Focus → Uren now has the canonical `self:actual-work:write`
capability through the existing Actual Work service/RPC. The Employee created
exactly one own controlled row and corrected that same row once (`1.7500` →
`2.0000`). Own-only RLS and invoker authorization were read back in DEV; the
Employee foreign/team/insights probes, Manager mutation/read probes, HR
downstream projections, closed/future/inactive-type/Leave-overlap validation,
and desktop/mobile evidence are green.

The earlier HR baseline row from before the product correction remains in DEV
because no destructive cleanup was authorized. It is explicitly separated in
the evidence report and is not a duplicate Employee submission.

GJ03 evidence: `.artifacts/golden-journeys-20260920/actual-work/`
GJ03 product/evidence commit: `65f8abe test: complete GJ03 employee actual work acceptance`

## Combined quality gate

- targeted closure regression: 7 files / 20 tests passed, including GJ01
  preview, GJ02 viewer/audience, GJ03 service/UI/RLS/RPC contracts and the
  migration metadata guard;
- full Vitest with the established 30-second timeout: 438/438 files and
  1717/1717 tests;
- strict TypeScript, ESLint and 39-namespace NL/EN i18n check: green;
- Next production build: 296/296 static pages generated;
- DEV migration/readback, Supabase type generation and security/performance
  advisors: executed on `wnpfloqpjvaacobppbpk` only;
- DEV migration metadata was reconciled without rerunning SQL: exactly one
  `20260921100000 / actual_work_employee_self_service` row now exists and the
  old `20260921092305` identity is absent;
- Actual Work DEV data was unchanged by the metadata correction: 16 entries
  and 23 revisions, with before/after fingerprints unchanged;
- branch push: normal non-force push only;
- `main` remains at the exact release baseline; no deployment was performed.

## Fixed during run

| ID | Journey | What broke | Root cause | Fix | Regression | Result | Commit |
|---|---|---|---|---|---|---|---|
| GJ01-001 | GJ01 | Focus preview rejected a valid database UUID | RFC-only validation was stricter than the PostgreSQL fixture format | Use canonical `databaseUuid` validation | Preview route regression | GREEN | `a4e0af5` |
| GJ02-001 | GJ02 | Employee Focus document viewer/download was missing/incorrect | Focus did not reuse the secure dossier capability | Reuse employee-scoped viewer/download service and route | Focus document and audience/security tests | GREEN | `4d0bfdd` |
| GJ03-001 | GJ03 | Employee Actual Work create returned 403 | Approved self-write capability was missing from Employee role | Add `self:actual-work:write` to canonical global Employee role | Migration contract/service tests | GREEN | `65f8abe` |
| GJ03-002 | GJ03 | Service authorization rejected approved self-write | Service projection only accepted HR write | Add own-employee self permission to service authorization | Actual Work service regression | GREEN | `65f8abe` |
| GJ03-003 | GJ03 | RPC/database path lacked bounded self contract | RPC/grants/policies did not enforce the approved path | Keep security-invoker RPC, authenticated execute and own-employee checks | RLS/RPC migration contract tests | GREEN | `65f8abe` |
| GJ03-004 | GJ03 | Employee own row was not writable through RLS | RLS only covered HR/group writes | Add own-row read/insert/update and retain HR-only delete | RLS and foreign-denial checks | GREEN | `65f8abe` |
| GJ03-005 | GJ03 | Employee could not correct own entry in Focus | Hours projection/form lacked correction state and reason | Add own-entry listing and correction UX | Focus hours form tests/browser readback | GREEN | `65f8abe` |
| GJ03-006 | GJ03 | Focus permission projection hid self capability | `canEdit` did not recognize self permission | Align Focus section projection | Focus/service tests | GREEN | `65f8abe` |
| GJ03-007 | GJ03 | Permission/correction copy and coverage were incomplete | NL/EN keys and regression assertions were missing | Add translations and tests | i18n parity plus targeted suite | GREEN | `65f8abe` |
| GJ03-008 | Closure | Local/DEV migration identity differed | DEV recorded `20260921092305` for the canonical migration | Prove equivalence and change only metadata to `20260921100000`; add guard | Metadata guard and post-change readback | GREEN | `eb0dcf2` |

The fixes preserve tenant scope, own-row privacy, server-side validation and
Manager/HR projection rules. Prior tests missed the product defects because
they did not assert the approved Employee self-service contract, Focus
correction UX or exact remote migration identity. Downstream Focus, document,
Actual Work, Leave and reporting projections were rechecked in the journey
evidence.

## Environment-gated

GJ01 remains an external environment gate, not a product defect. The normal
`POST /api/invitations/employee` endpoint was reached correctly, DEV Supabase
Auth mail delivery returned HTTP `502`, invitations were revoked, no Employee
Auth link was fabricated, and the bootstrap identity did not gain access.
Authenticated preboarding and the start-date transition remain unproven.
Recommended follow-up is `GJ01R — Authenticated Preboarding Completion`; it
was not executed during closure.

## Recorded follow-ups (not executed)

- `GJ01R` — Authenticated Preboarding Completion
- `DOC02` — Document Template Rendering Torture Test
- `AW02` — Actual Work Rules & Concurrency

## Final verdict

**OVERNIGHT ACCEPTANCE COMPLETE — GJ01 EXTERNAL BLOCKER ONLY — READY FOR
RELEASE REVIEW**

GJ02 and the corrected GJ03 are GREEN and complete. GJ01 must be rerun only
after DEV Auth mail delivery or an equivalent existing canonical invitation
fixture mechanism is available; no further product or authorization change is
inferred from this report. This is the only remaining blocker.
