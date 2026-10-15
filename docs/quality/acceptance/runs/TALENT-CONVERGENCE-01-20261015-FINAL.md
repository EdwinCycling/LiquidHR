# TALENT-CONVERGENCE-01 — combined closeout — 2026-10-15

**Verdict: LOCAL MAIN INTEGRATED / ENGINEERING GREEN / FULL ACCEPTANCE HOLD**

## Delivery and provenance

- Local main was fast-forwarded from the verified origin/main baseline 0708d25190562e43a96417ba406648fd04207266.
- 9-grid merge: 9e9acc55cf4bb337b9ae6ce025c5825b3d47ac32; Continuous Appraisal merge: 151c2d7ee5ac2a79f22f62953e967ebe58bfc152.
- Final product-code commit: 44ab1d8bbb8ba601557c3aec41cd9627fc7a57c5 (fix(talent): keep 9-grid readable on mobile).
- No GitHub push, PR merge, Vercel deployment, app-version bump or business-record write occurred.

## Supabase TEST

Project wnpfloqpjvaacobppbpk was ACTIVE_HEALTHY. Read-only preflight confirmed migration head 20261015125424. The official Supabase connector then registered, in order:

| Migration | Registered version | Source SQL SHA-256 |
| --- | --- | --- |
| Talent 9-grid V2 | 20261015163728_talent_review_ux_v2_modes_and_audit | 9F2CF458EF8618D9371EC8E4BA6A815ADFD2BEE81977D89F255D95418F8D8F45 |
| Continuous Appraisal V2 | 20261015163934_continuous_appraisal_status_soft_delete_grants | 11F8766A01A0723CE746D5E3E2BED474FFBDD6E4F410A159A427F167F1C5F8D5 |

The remote head is now 20261015163934; local migration filenames use these registered versions. No other migration was applied and no history row was rewritten.

Post-migration readback confirmed the 9-grid mode/return/acting-reason contract, Continuous Appraisal status and soft-delete fields/policy, RLS, grants, generated DB types and both SQL contract tests. The seven relevant row-ID fingerprints were unchanged: 9-grid campaign/assignment/member/score counts 4/8/31/15; Appraisal item/comment/attachment counts 32/6/2. Authenticated has no effective DELETE or TRUNCATE on continuous_appraisal_items; anon remains denied and intended service_role access remains. The authenticated SECURITY DEFINER advisor count rose from 114 to 121 (+7); each new Talent routine was checked for scoped checks, search_path and restricted EXECUTE grants, including no anon/public execution. Existing project-wide advisor findings remain outside this slice.

## Local engineering gates

- Full hr-suite on exact code SHA 44ab1d8: 632 test files passed, 4 skipped; 3,066 tests passed, 8 skipped (2 workers; 54.52 s).
- TypeScript passed in the production build. check:i18n passed with 43 matching NL/EN namespaces. Changed-file ESLint and focused talent-review-workspace.test.tsx passed (5/5).
- Full ESLint remains red on the pre-existing unrelated prefer-const error at apps/hr-suite/lib/document-generation/distribution-read-service.test.ts:47, with eight unrelated warnings. It was not modified.
- The canonical launcher’s default Turbopack build path had the known shared node_modules-junction resolution fault. The validated Webpack fallback, using the central synthetic TEST config without displaying values, passed on exact code SHA 44ab1d8. It generated 323 static routes; the Payroll client-boundary scan (675 browser assets), PDF function-trace preparation/size gate and allowlist passed. Build ID: ARm4-7-_mWX870TUN0ucz. The canonical Production preflight passed. apps/hr-suite/next-env.d.ts remained at SHA-256 1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37.
- Two preliminary four-worker full-suite runs hit unrelated 5-second test timeouts (three PDF renderers during concurrent TypeScript work, then the existing 10,001-employee count test). After stopping the local server and running the final suite with two workers, all tests passed; no unrelated test was changed.

## Browser smoke — local Production-mode TEST runtime

The exact build was opened on loopback at 390×844 and 1280×720. The existing authenticated Manager session was used read-only.

- /workforce/9-grid: at 390 px the focusable role=region grid has a 317 px viewport and 512 px content, with three approximately 135 px cells; the document itself remains 390 px wide. All nine cells fit at 1280 px (567 px grid content). The existing campaign remained at 0/4 placed; submit was disabled. No placement, submission or score change occurred.
- /workforce/continuous-appraisal: 390 px page width remained within the viewport; all six category tabs selected correctly, with the observed timeline empty for the selected employee. No item, status or deletion action was performed.
- Browser dev-console logs contained 0 errors on both routes. No network trace was captured. The temporary viewport override was reset.

## Remaining acceptance gates

The requested named Maya/Yara/Noah persona sessions were not available in the existing Manager session. Therefore the HR Admin/Manager/Employee positive and negative scope matrix, cross-scope denial evidence, 9-grid placement/submit/return lifecycle, Appraisal create/status/soft-delete lifecycle, populated-timeline browser flow under the final build, and network evidence remain OPEN. No account, password or permission was created or changed to simulate those personas.

Keep TALENT-9GRID-V2-TEST-021 and TALENT-APPRAISAL-V2-TEST-020 OPEN in docs/AA/AA-OPEN.md. This result proves the authorized schema migrations, local implementation, engineering gates and limited read-only smoke; it is not full acceptance GREEN or a TEST release.