# Local LiquidHR consolidation recovery bundle — 2026-11-04

This folder preserves reviewed, unique local material that is not being activated wholesale in the product. It is an archival recovery bundle, not an installable feature package. Patch files and snapshots must be reviewed against current `main` before any future application.

## Provenance

- `SOURCE-MAP.md` and `EXTRA-MAP.tsv` map staged files and patch payloads to their source stash, branch, worktree, or local checkout and record SHA-256 digests.
- `patches/` contains unique branch and per-file change payloads, including unique PMUX, WVP, Payroll, pension, API, and documentation work. Patch inclusion preserves source without claiming the older implementation is current or safe to activate.
- `snapshots/stashes/` contains selected safe files from the preserved local stash refs. All original stash refs remain in the local source repository.
- `evidence/` contains historical C34, PMUX, PAYD1, WVP01 and APIAI evidence. These documents describe their historical run and do not establish acceptance on the current `main` SHA.
- `assets/APIAI-09/model/` contains the unique model images and reference sheets from stash 13. They are preserved here and are not wired into the live app by this archive.

## Scope notes

- Jantje/Mars Payroll and pension changes, fixtures, and tests are preserved as patch/snapshot material. They are not enabled as active Payroll behavior in this consolidation because the corresponding source/legal and regression gates have not been re-run on this baseline.
- PMUX, WVP, C34, PAYD1 and Focus changes/evidence are preserved with origin references. Content already present in `main` is not duplicated as product code.
- The local BSN launcher change is active only in `scripts/start-test-worktree.ps1` and its contract test. It is limited to Development, refuses build mode, requires the existing local PII key preflight, and does not alter application routes or database behavior.
- No new Nmbrs Payroll implementation is included. Existing Nmbrs files in `main` are unchanged by this archive; this bundle does not assert that every existing Nmbrs route is technically disabled.
- APIAI-09 media is retained as recovery assets, not copied into the app's public runtime directory.

## Kept outside Git

The following sources remain available at their original local refs and were withheld from this bundle because they contain or may contain personal identifiers, environment configuration, generated output, or third-party source material:

- `stash@{2}`: payroll/reference PDFs and spreadsheets; potential third-party/copyright source material.
- `stash@{8}`: `docs/payroll/acceptance/PAYRUN01-IMPLEMENTATION-CHECKPOINT-20261006.md`; flagged for a non-test email address.
- `stash@{10}`: payroll oracle JSON and official handbook/source text; third-party/source material.
- `stash@{8}`: generated `next-env.d.ts` and local build/cache output; reproducible/local-only.
- PAYLAB00 source `apps/hr-suite/lib/payroll/supabase-client.test.ts`: flagged for a non-test email address; original branch ref retained.
- PAYLAB00 source `.env.example`: omitted by the path filter without asserting it contained a secret; original branch ref retained.
- Historical snapshots generated in `output/` and `.tool-home` caches remain local and were not included.

No credential, token, real BSN, IBAN, or private session file was intentionally included. Original worktrees, branches, and all 14 stash refs remain untouched.

Additional withheld evidence and source payloads:

- Payroll performance evidence from branch commit `82f384f804e77f0e190215bd4a195a1c4466e8d8` and INS-RELEASE-01 evidence from `ca4a303e62f263b035499f147c6a99383f9ac18e` contained non-test email addresses. Their original refs remain in the local repository (`origin/work/liquidhr-performance-recovery-01-20261028` and `external/ins01`).
- Stash 8's complete patch and the individual `apps/hr-suite/app/api/auth/test-role-switch/route.test.ts` patch contained non-test email addresses. The original `stash@{8}` remains locally unchanged; safe per-file snapshots and patches remain in this bundle where available.
