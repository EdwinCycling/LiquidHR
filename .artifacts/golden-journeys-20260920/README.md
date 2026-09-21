# Overnight Golden Journeys — Release Baseline 1.20260920.1

Date: 2026-09-21
Canonical released main commit: `874098d9c0675d17774ad027c7a8b4fbadb37c39`
Overnight branch: `work/post-release-golden-journeys-20260920`

The branch was created from the exact released main commit. No merge to
`main`, Vercel deployment, Production Supabase mutation or force-push was
performed.

## Journey status

### GJ01 — Onboarding / Preboarding

**BLOCKED at the authenticated preboarding leg by DEV Auth mail delivery.**

The normal invitation/activation path was exercised with the existing future
Employee fixture and a single bounded DEV fixture-auth bootstrap attempt. Both
canonical invitation attempts returned HTTP 502 and were revoked. Readback is
two revoked invitations, one controlled Auth identity and zero employee Auth
links; the login correctly ends at `/geen-toegang`. No direct auth link,
service-role browser bypass or role broadening was used.

GJ01 code/DEV-preview gates are green, but the requested authenticated
preboarding Employee acceptance cannot be claimed. This is the single
unresolved overnight blocker.

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

## Combined quality gate

- GJ03 focused tests: 17/17;
- full Vitest with the established 30-second timeout: 437/437 files and
  1714/1714 tests;
- strict TypeScript, ESLint and 39-namespace NL/EN i18n check: green;
- Next production build: 296/296 static pages generated;
- DEV migration/readback, Supabase type generation and security/performance
  advisors: executed on `wnpfloqpjvaacobppbpk` only;
- branch push: normal non-force push only;
- `main` remains at the exact release baseline; no deployment was performed.

## Final verdict

**OVERNIGHT ACCEPTANCE BLOCKED — GJ01 DEV Auth mail delivery after bounded
canonical invitation attempts**

GJ02 and the corrected GJ03 are GREEN and complete. GJ01 must be rerun only
after DEV Auth mail delivery or an equivalent existing canonical invitation
fixture mechanism is available; no further product or authorization change is
inferred from this report.
