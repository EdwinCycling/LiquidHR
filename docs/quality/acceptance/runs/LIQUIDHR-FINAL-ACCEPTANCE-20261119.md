# LiquidHR final acceptance gate — 19-11-2026

**Opdrachtgever:** Edwin
**Lokale integratiebranch:** `work/liquidhr-final-acceptance-20261119`
**Verified application source SHA:** `70948c5c80f75a79ed3b1e71366595af7eeaf209`
**Code-inputs:** WVP/Talent joint integration `a6b5337c78ae672b3a1139a8ad5c9ac3fc0a285a` (descendant of `f72c48576110127141cc96a6e703d14a636eed8d`), Talent completion `ffbea0dbb06e911778f10ae7f2cb141472821e7b`, WVP source `e90bd178842554e84838657811442068aad2be9a`
**Verdict:** local code candidate prepared; hosted acceptance OPEN; joint TEST release **NO-GO pending hosted gates and separate release mandate**.

## Runtime and Git convergence

- The fixed TEST URL and the supplied Vercel candidate URL resolve to READY deployment `dpl_799S2oXST6MgNzW96iBqUnhUQ1RK`, source SHA `69d29bbe80a5791cf31c1d4966347f756cd10130`. No Vercel deployment was found for WVP `e90bd178`, integration `f72c4857`, or Talent `ffbea0db`; hosted acceptance on the final local candidate has therefore **not** occurred.
- GitHub `main` read back as `dd730ffd43c3719fd041974b4e05bceedaab852d`. The existing central integration source `a6b5337c` is 17 commits ahead and 0 behind that main. Its 17 unique commits were preserved in this local candidate. The remote branch `work/liquidhr-final-20261116` does not exist; no central integration PR was found.
- The Vercel project reports `deploymentEnabled: false` in source configuration and no project webhook, but the effective project-level Git/Preview trigger state was not reliably confirmed. No push or PR was made. No alias or deployment was changed.

## Persona acceptance matrix

| Persona | WVP | Talent | Negative scope / API / RLS | Candidate result |
|---|---|---|---|---|
| HR Admin | Earlier limited smoke opened WVP; selected context showed no active dossier. No lifecycle/document mutation was run. | Earlier Talent list loaded; organization-wide report was not confirmed (the report showed direct-manager scope). | No post-CONTRACT candidate Data API/RLS probes. | OPEN — exact integrated candidate is not deployed. |
| Manager | Earlier limited smoke opened the existing direct-team WVP dossier and deadlines. | Earlier direct team and capability rows loaded. Talent service tests cover direct-team allow and peer/other HR-group denial. | No authenticated candidate probes for peer, other administration, HR group, or tenant. | OPEN — exact integrated candidate is not deployed. |
| Employee | Post-CONTRACT WVP self-dossier not tested. | Local tests prove self-plan creation and current-profile capability selection; altered capability IDs are rejected. | Management-report denial is service-tested; authenticated candidate API/RLS and evidence upload were not repeated. | OPEN — exact integrated candidate is not deployed. |

Hosted controls above are historical smoke on SHA `69d29bbe`, not acceptance evidence for the integrated changes. Existing synthetic TEST data has 8 non-archived plans, all with `capability_id = NULL`, and no non-archived verified-evidence record. It cannot demonstrate a live positive skillgap or capability-linked plan. No TEST writes, new accounts, fixtures, or migrations were made in this gate.

## WVP, Talent, and data compatibility

- WVP week-42 code reconciles the statutory deadline, 14-day preparation signal, and PMUX deadline on the canonical effective clock, including recovery gaps. Focused weekday, weekend, public-holiday, and recovery-gap cases passed. Forward-only migration `20261119120000_wvp_week42_pmux_deadline_contract` is registered once in Core TEST as `20261119160230`; WVP02 SEC01 and WVP05 were not rerun. The migration changes materialization for new week-42 steps and preserves existing snapshots, process rows, audit, and authorization. Live lifecycle acceptance remains OPEN.
- Talent TAL-INS01/02 now distinguish proven sufficient/insufficient levels from not assessed, missing level, missing evidence, and expired evidence. Missing/expired evidence does not become an insufficient level. Development plans match only on identical employee ID and capability ID; Continuous Appraisal actions remain unlinked context. The normal Employee flow can select a capability from the current profile. Lists/exports enforce source limits and preserve report/filter/CSV totals. No Talent schema migration is needed.
- SEC-101 CONTRACT migration `20261119161917` and WVP migration `20261119160230` are present in Core TEST readback. No migration was applied during this gate. Current global Supabase advisor readback is not zero: security/performance warnings remain, including SECURITY DEFINER grant categories and permissive-policy/RLS-initplan categories; health returned no findings. Scoped function review found the public recruitment routines guarded by publication state/proof or service-role checks. These project-wide findings are not established as WVP/Talent regressions, but they are not a substitute for the missing authenticated direct API/RLS probes.

## SEC-101 and Payroll

- SEC-101 issue [#101](https://github.com/EdwinCycling/LiquidHR/issues/101) remains **OPEN / P0**: historical cross-team raw fiscal-profile access was confirmed and emergency mitigations were applied, but the final post-migration Manager, Employee, and Tenant Admin Data API/RLS regression remains unproven. This is not cleared by catalog readback. The CONTRACT migration and effective column grants/RLS are present; authenticated profile/audit access is column-allowlisted and protected technical columns are not directly selectable. Metadata/fingerprint SECURITY DEFINER functions deny `anon` and perform authenticated scope checks. No new WVP/Talent regression was confirmed locally; security acceptance is not GREEN.
- Payroll product code was not changed by this Talent integration. The full local regression coverage below passed after isolating two default-timeout cases. No Payroll calculation or hosted Payroll acceptance was repeated after the SEC-101 CONTRACT. Existing Payroll source/employee acceptance limits remain as previously recorded.

## Checks

| Check | Result |
|---|---|
| Full HR Suite Vitest, `testTimeout=15000` | PASS — 4,272 passed, 8 skipped; 839 files passed, 4 skipped |
| Payroll calendar migration contract, `--pool=forks --maxWorkers=1 --testTimeout=15000` | PASS — 2/2 |
| Control Vitest | PASS — 11/11 |
| Payroll rules | PASS — 65/65 |
| Talent targeted regression | PASS — 62/62 on Talent source; included in final full suite |
| HR Suite type-check | PASS (`tsc --noEmit`) |
| HR Suite ESLint | PASS — zero errors; nine existing warnings in unrelated test files |
| NL/EN i18n | PASS — 43 namespaces, matching keys |
| Root type-check | PASS — HR Suite, Control, Payroll engine, CAO bench, and Payroll rules |
| Root ESLint | PASS — zero errors; nine existing warnings in unrelated tests |
| HR Suite production build | PASS — clean source SHA `70948c5c80f75a79ed3b1e71366595af7eeaf209`; compile/type phase, 359 static pages, Payroll client-boundary scanner, five PDF renderer traces, and function-trace policy passed |
| Diff check / generated files | PASS — no source diff after build; generated Focus widget restored; protected `next-env.d.ts` hash unchanged |

The default-timeout full-suite run had two tests exceed 5 seconds while running concurrently; each passed in isolation, and the complete HR Suite passed with a 15-second test timeout. Happy DOM emitted existing unsupported synthetic `blob:` iframe warnings. No assertions were suppressed or changed for these results.

## Release blockers and next action

1. The exact integrated source is not hosted. Candidate deployment and authenticated HR Admin, Manager, and Employee acceptance are required before the WVP/Talent live matrix can close.
2. Complete negative direct API/RPC/RLS checks for employee, direct-team, peer, administration, HR-group, and tenant boundaries, including SEC-101 post-CONTRACT probes.
3. If live Talent positive cases are required, request one bundled TEST-data mandate to add verified sufficient/insufficient evidence and an active/completed employee+capability-linked plan using existing personas/product flows. Keep the wrong-employee/wrong-capability cases negative and non-persistent. Do not create accounts or bypass product services.
4. The supplied Vercel runtime is older than the integrated source. If hosted acceptance requires a new candidate deployment, include it in the central release plan. Confirm effective automatic Git/Preview trigger settings before any push. Actual TEST deployment requires the separate exact mandate `RELEASE LIQUIDHR TEST`.

**Decision:** **NO-GO** for the joint TEST release now. The local suite, type-check, lint, i18n, and production build are green, but the integrated code is not hosted and the confirmed historical SEC-101 P0 lacks its required post-migration authenticated regression proof.
