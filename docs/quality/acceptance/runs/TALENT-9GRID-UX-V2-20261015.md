# TALENT 9-grid V2 — acceptance run 2026-10-15

**Status: HOLD — Supabase migration session authorization**
**Branch:** work/TALENT-9GRID-UX-V2-20261014
**Base:** verified origin/main 0708d25190562e43a96417ba406648fd04207266
**Scope:** synthetic Supabase TEST project wnpfloqpjvaacobppbpk only

## Result

The V2 implementation remains an uncommitted local code candidate. Local engineering checks passed, but the authorized schema migration and all schema-dependent acceptance gates remain unproven. The official Supabase migration connector returned INVALID_ARGUMENT / invalid_request_state: “Invalid or expired requestState”. The read-only migration-history check afterward still showed 551 migrations with head 20261014210811 and no candidate version. No migration was registered and no alternate SQL or connector path was used. No post-failure row fingerprint was collected, so this report makes no post-attempt data-change claim.

Candidate migration: 20261015053733_talent_review_ux_v2_modes_and_audit.sql
SHA-256: 9F2CF458EF8618D9371EC8E4BA6A815ADFD2BEE81977D89F255D95418F8D8F45
This hash matches the reviewed source fingerprint supplied for the original candidate.

## TEST preflight captured before the rejected apply

| Table | Rows | ID fingerprint |
| --- | ---: | --- |
| talent_review_campaigns | 4 | d0db47a7c7bea29d2b77c276e9100c02 |
| talent_review_assignments | 8 | 7722f8512af732cb6bc2382cc26eb270 |
| talent_review_assignment_members | 31 | f8bb1d102e84f144d2a5d8cb3b2dda83 |
| talent_review_scores | 15 | df5e371d96e7737deff00259ee484980 |

All four tables had RLS enabled. Existing policies, grants, dependent functions/triggers and audit state were recorded in the preflight. Existing audit rows included 4 campaign creates / 9 updates, 8 assignment creates / 56 updates, and 15 score creates / 44 updates. No before/after claim is made for row fingerprints because the authorized migration did not complete.

## Local engineering evidence

- Focused 9-grid tests: 3 files, 15 tests passed.
- Full HR suite on this branch: 630 test files passed, 4 skipped; 3,032 tests passed, 8 skipped; four-worker cap; 72.00 seconds.
- TypeScript: passed.
- ESLint on changed Talent TypeScript files: passed.
- Full HR ESLint: failed on the existing unrelated prefer-const error at lib/document-generation/distribution-read-service.test.ts:47; 8 warnings were also reported in unrelated files.
- NL/EN i18n: passed, 43 namespaces with matching keys.
- Production build: passed, including TypeScript, 323 generated static pages, payroll client-boundary scanner, PDF runtime trace preparation/size checks and build provenance. The generated provenance names only base SHA 0708d251; the feature candidate itself has no commit SHA.
- git diff --check: passed; Git emitted only line-ending normalization notices.

## Still blocked

The SQL contract has not been run against the migrated TEST schema. Post-migration RLS/RPC/grant checks, Supabase advisors, generated DB-type verification, compatibility smoke against the existing hosted TEST app, authenticated browser acceptance for Maya Bos, Yara Meijer and Noah Hendriks, desktop/laptop/mobile inspection, and console/network review were not performed. No local main merge or browser server was started.

Resume only after the official Supabase session is refreshed through its supported connection flow. Recheck the migration head, apply this migration first through the official migration connector, then complete every post-migration gate before considering the Continuous Appraisal migration or a local-main merge.