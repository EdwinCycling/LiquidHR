# PAYRUN01 — Phase 1 release and persona readiness — 2026-10-05

## Verdict

**PARTIAL / NOT RELEASE-READY — recommendation: NO-GO for merge, push, version bump, or deployment at this checkpoint.** The local candidate integration and source-level gates pass. The guarded TEST build, integrated six-cell browser matrix, and local production safety smoke are blocked because the configured central TEST runtime file is absent. Hosted candidate proof is also absent, and Vercel currently has no Preview deployment.

This closes only Phase 1 readiness. PAYRUN01 payroll implementation, Core writes, persona provisioning, and new payroll runs remain for a later authorized phase.

## Candidate provenance

- Worktree: `Integration-PAY-CONVERGE-20261004`
- Branch: `integration/pay-converge-20261004`
- Baseline: `origin/main` read-only verified at `6349d02538351cd01fc51f298c6e6fa0ba88006c`
- Local TEST-HARNESS01 integration commit: `162e3c019c87d417a29de1be0d6530fdcbc550a5`; parent commits are the prior PAY-CONVERGE candidate `060ca2f01ad8d920588c72d0e1b8b65bc1322e36` and harness documentation commit `f0ca2e25ff4f6d17416b47d09374339e360f168c`.
- Local test-assertion follow-up: `65ccfedea623295c4ec20b3191185b19ef848bad` (`test(auth): assert safe local login return path`). This updates the login-form test for the safe return-path field and keeps its credential-exposure assertions.
- Exact candidate source-code HEAD: `65ccfedea623295c4ec20b3191185b19ef848bad`; its worktree was clean when the code gates ran.
- App version remains `1.20261002.1`. Proposed version after a separate explicit GO remains `1.20261005.1`.
- GitHub PR status is unverified: the read-only `gh pr list` query returned HTTP 401.
- The latest Production deployment is `dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5`, `READY` on main `6349d02538351cd01fc51f298c6e6fa0ba88006c`, with canonical alias `liquid-hr-hr-suite.vercel.app`; a current read-only Vercel query returned zero Preview deployments for `liquidhr`. No candidate SHA is hosted.

No `main` merge, push, deployment, version bump, database migration, account provisioning, or business-data write was performed. Seven expected Payroll Lab migration versions were confirmed in an earlier read-only ledger check; this run added no migration and did not reapply them.

## Local source gates on the exact candidate

| Gate | Result |
|---|---|
| Full HR-suite, Node 24.19.0, serial (`--no-file-parallelism`) | PASS — 523 test files; 2,213 passed; 3 skipped |
| Strict TypeScript, `apps/hr-suite` | PASS |
| Strict TypeScript, `payroll-rules-cao-bench02` | PASS |
| ESLint, `apps/hr-suite` | PASS — zero errors; six existing warnings in `payroll-import/service.test.ts` |
| NL/EN i18n | PASS — 41 namespaces with matching keys |
| `start-test-worktree.contract.ps1` | PASS |
| PDF renderer regression | PASS as part of the full suite under Node 24; this does not prove the authenticated export API or Vercel serverless runtime |
| `git diff --check` | PASS before the candidate code commit; documentation diff check also passes before closeout commit |

The parallel full-suite attempt timed out only the existing Chromium PDF test at its 5-second default. The documented serial run passed on the exact final code SHA; no timeout was widened.

## Runtime-gated checks

The guarded launcher expects `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local`. The file-existence check returned `false`; the launcher reported that the central TEST config is missing. No file was opened, copied, created, or replaced; no alternate configuration or placeholder values were used.

| Gate | Result |
|---|---|
| Guarded Production build and exact build provenance | BLOCKED BY ENVIRONMENT — central TEST config absent |
| Integrated HR Admin / Manager / Employee browser matrix, desktop + iPhone 16 | BLOCKED BY ENVIRONMENT — candidate preflight returned `TEST_RUNTIME_PREREQUISITE_UNAVAILABLE`; no server started |
| Local anonymous Production route/safety smoke | NOT RUN — same prerequisite; no server started |
| Hosted candidate READY/SHA/canonical-alias and security smoke | OPEN — no candidate deployment; the latest Production remains on old main |
| Isolated Preview deployment | OPEN — current Vercel query returned none |

The standalone harness branch previously reported 6/6 browser cells, but that evidence is not reused as proof for this merged candidate. The integrated six-cell matrix must pass after the central runtime configuration is restored.

## Read-only TEST persona readiness

The Core TEST records were inspected without exposing BSN, complete IBAN, credentials, or secret values, and without changing records:

| Persona | Source readiness for an individual run |
|---|---|
| Jan | Active employment overlaps the inspected October 2026 window, but salary and schedule intervals overlap. No Auth identity is linked. The interval ambiguity must be resolved before a run can be built. |
| Lisa | Active employment and one salary/schedule interval each. An Auth identity exists, but effective Payroll permission was not proven. A bank record is present; account contents were not read. |

Neither employment has a Payroll Lab source snapshot and arrangement assignment directly keyed to it. The current source adapter requires `salary:read` and `contract:read`, marks the income relationship unsupported, has a tax-profile source gap, does not fetch bank/IKV inputs, and rejects interval overlap as unsupported. The exact requested payroll period is also still unspecified. **Neither persona is ready for a complete individual payroll calculation.** No login, run, snapshot, arrangement assignment, or write was created.

For 2026 Kinderopvang inputs, the official CAO states 8% holiday allowance, an 8% year-end allowance from 1 January 2026, and a 1.5% salary-scale increase from 1 September 2026: [holiday allowance](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/vakantietoeslag), [year-end allowance](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering), [salary changes](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen). PFZW publishes 2026 parameters of 25.9% basis premium, €17,283 franchise, €137,800 full-time salary cap, and 3.4% WIA-excess premium with a €79,409 franchise: [PFZW rates](https://www.pfzw.nl/werkgevers/premie-en-factuur/premiepercentages-en-franchises.html). These are reference inputs, not a calculated deduction or a determination that the employer is mandatorily covered; employer activities/participation and each contract's hours and pensionable salary must be established first ([PFZW scope](https://www.pfzw.nl/werkgevers/pensioen-bij-ons/klant-worden/moet-of-mag-ik-aansluiten.html), [calculation inputs](https://www.pfzw.nl/werkgevers/premie-en-factuur/premie-berekenen/hoe-bereken-ik.html)).

## Remaining decisions and next gates

- Keep `SEC-PAY-001`, `PAY-RULE-002`, `PAY-COVER-003`, `PAY-CORE-004`, and `ENV-PREVIEW-010` visible as OPEN. Do not claim full CAO/tax acceptance.
- Restore the approved central local TEST runtime file, then rerun the guarded build, integrated six-cell matrix, and local anonymous safety smoke on a clean exact candidate.
- AA-REL §8's Preview exception and any limited synthetic TEST release require Edwin's explicit decision. Even after local gates pass, do not merge to `main`, push, change the app version, or deploy until the user supplies GO.
- After a separately authorized release, verify exact deployed SHA, `READY`, canonical alias, public Test Auth/role-switch/capture route safety, and protected Payroll authentication on the hosted environment.
- Only after the release checkpoint may Phase 2 address Jan/Lisa interval cleanup, approved identity/permission evidence, source snapshots/arrangements, complete tax/pension inputs, and the specific pay period.
