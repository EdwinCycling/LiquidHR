# TALENT Continuous Appraisal V2 — acceptance run 2026-10-15

**Status: HOLD — Supabase migration session authorization**
**Branch:** work/continuous-appraisal-ux-v2-20261014
**Base:** verified origin/main 0708d25190562e43a96417ba406648fd04207266
**Scope:** synthetic Supabase TEST project wnpfloqpjvaacobppbpk only

## Result

The V2 implementation remains an uncommitted local code candidate. Local engineering checks passed, but the 9-grid migration was refused by the official Supabase connector with INVALID_ARGUMENT / invalid_request_state: “Invalid or expired requestState”. The migration sequence therefore stopped before Continuous Appraisal. The read-only migration-history check still showed 551 migrations with head 20261014210811 and no candidate versions. This migration was not attempted or applied. No alternate SQL or connector path was used.

Candidate migration: 20261015053740_continuous_appraisal_status_soft_delete_grants.sql
SHA-256: 11F8766A01A0723CE746D5E3E2BED474FFBDD6E4F410A159A427F167F1C5F8D5
Contract test SHA-256: 9D505EEC1B680C034D5906BC8AFB6AC5FEA4A573D560AE42E4A7A55856814A25

## TEST preflight captured before migration work

| Table | Rows | ID fingerprint |
| --- | ---: | --- |
| continuous_appraisal_items | 32 | f11ef24986db19d2516fd2ca9c465fac |
| continuous_appraisal_item_comments | 6 | 37b85d4accfb546ad2e21f7d80fd3a25 |
| continuous_appraisal_attachments | 2 | 6631f4026823544f3f56ef79c4636319 |

All three tables had RLS enabled. Existing policies, grants, dependencies and audit state were captured. Audit baseline included 32 item creates / 12 updates, 6 comment creates and 2 attachment creates. Before migration, authenticated had effective DELETE and TRUNCATE privileges on continuous_appraisal_items; anon had neither. The prepared candidate revokes both DELETE and TRUNCATE from authenticated and preserves the required service_role grants. The post-migration privilege assertions have not run.

Preflight advisor baseline was recorded: 11 RLS-without-policy INFO notices, 4 anon and 114 authenticated SECURITY DEFINER WARN notices, and one leaked-password-protection warning; performance baseline included 146 unindexed-FK INFO notices, 1 auth RLS init-plan warning, 383 unused-index INFO notices and 35 multiple-permissive-policy warnings. These are pre-migration results, not evidence for the candidate’s post-migration advisor state.

## Local engineering evidence

- Focused Continuous Appraisal tests: 4 files, 38 tests passed.
- Full HR suite on this branch: 632 test files passed, 4 skipped; 3,062 tests passed, 8 skipped; four-worker cap; 72.46 seconds.
- TypeScript: passed.
- ESLint on changed Talent TypeScript files: passed.
- Full HR ESLint: failed on the existing unrelated prefer-const error at lib/document-generation/distribution-read-service.test.ts:47; 8 warnings were also reported in unrelated files.
- NL/EN i18n: passed, 43 namespaces with matching keys.
- Production build: passed, including TypeScript, 323 generated static pages, payroll client-boundary scanner, PDF runtime trace preparation/size checks and build provenance. The generated provenance names only base SHA 0708d251; the feature candidate itself has no commit SHA.
- git diff --check: passed; Git emitted only line-ending normalization notices.

## Still blocked

The SQL contract has not been run against the migrated TEST schema. Post-migration DELETE/TRUNCATE assertions, RLS/API/grant/security-function checks, Supabase advisors, database type generation/verification, role-based browser acceptance, attachment/status/soft-delete flows, tenant/team negative tests, desktop/mobile inspection, and console/network review were not performed. The local application was not started because the required final browser target is the combined local-main candidate, which cannot be produced before the migration sequence is accepted.

Resume after the official Supabase session is refreshed through its supported connection flow. Recheck the migration head, apply and verify the 9-grid migration first, complete its post-migration gates, then apply and verify this migration and complete the combined acceptance before local-main integration.