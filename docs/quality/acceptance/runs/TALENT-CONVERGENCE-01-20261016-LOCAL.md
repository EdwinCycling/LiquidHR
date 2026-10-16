# TALENT-CONVERGENCE-01 — local acceptance follow-up — 2026-10-16

## Scope and provenance

- Local code integrated into local main: 1d175ae4ee6cece9b44c26f22ff728c9a75f1ea1. The integrated slice adds the tenant- and permission-gated profile-options API, profile creation dialog/context, and server-permission-filtered Workforce Talent route navigation.
- Main integration was local and fast-forward only. origin/main remained at its previously read-only baseline 0708d25190562e43a96417ba406648fd04207266. No push, PR merge, Vercel deployment, or version bump occurred.
- Supabase read-only identity: LiquidHR TEST project wnpfloqpjvaacobppbpk, ACTIVE_HEALTHY. Migration history head: 20261015182721. No migration was submitted in this follow-up, and no database records were written.
- Existing Continuous Appraisal acceptance remains CLOSED under TALENT-APPRAISAL-V2-TEST-020; this report adds local integration evidence and does not replace the historical TEST persona evidence.

## Local code checks on the integrated code SHA

| Check | Result |
| --- | --- |
| Full hr-suite suite | PASS — 632 files; 3,067 passed, 8 skipped |
| Strict type-check | PASS |
| Changed-file ESLint | PASS |
| i18n key parity | PASS — 43 namespaces |
| Production build | NOT RUN — the Next.js dev session generated a tracked apps/hr-suite/next-env.d.ts change. An attempt to restore that generated file was rejected by auto-review, citing the repository rule never to modify it and warning against discarding an uncommitted change. |

The generated next-env change remains excluded from commits and was not manually edited. Build evidence is therefore HOLD on this code SHA.

## Read-only browser observations

- The HR Admin results view showed the existing closed synthetic TALENT-FINAL-01-HYBRID-20261015 campaign, nine categories, and 3/3 submitted manager assignments. No record was created or changed.
- 9-grid layout was inspected at 1280 × 720 and 1024 × 768; all three columns were visible. At 390 × 844, the page body had no horizontal overflow and the matrix retained internal horizontal scrolling so the third column was reachable.
- LinkedHR light and Nacht dark themes were inspected; the original LinkedHR/light preference was restored.
- Continuous Appraisal displayed all six type tabs from the empty state. The new-item menu defaulted to Notitie and offered all six types. The form was canceled without submission.
- The Employee self-appraisal view showed 17 existing timeline items; direct Employee access attempts to /workforce/9-grid and /settings/talent returned the existing no-access state. No appraisal, profile, or campaign data was mutated.
- Browser console errors and warnings were empty during these observations.
- These browser checks preceded the final navigation-only server-permission filter. On the later dev-server restart, host-side TCP to 127.0.0.1:3020 succeeded but the in-app browser returned ERR_CONNECTION_REFUSED for both 127.0.0.1 and localhost. The final nav filter is not browser-verified.
- The browser environment did not expose reduced-motion emulation. Shared reduced-motion CSS exists, but runtime behavior was not demonstrated. Drag/drop and keyboard coverage are not complete enough to close the 9-grid matrix. Keep TALENT-9GRID-V2-TEST-021 OPEN.

## Verdict

**LOCAL CODE INTEGRATED; TYPE, LINT, I18N AND FULL SUITE PASS; BUILD AND FINAL BROWSER MATRIX HOLD.** Existing Supabase TEST migrations and data remain as previously accepted; this follow-up performed no remote write. No GitHub push or Vercel deployment occurred. This report is local evidence only and is not a hosted TEST release or Production acceptance.

Related evidence: [2026-10-15 recovery follow-up](TALENT-CONVERGENCE-01-20261015-RECOVERY.md), [2026-10-15 TEST rerun](TALENT-CONVERGENCE-01-20261015-RERUN.md), [current open points](../../../AA/AA-OPEN.md).