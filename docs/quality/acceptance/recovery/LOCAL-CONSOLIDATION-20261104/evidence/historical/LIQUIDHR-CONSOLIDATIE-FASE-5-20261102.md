# LiquidHR consolidatie fase 5 — 2026-11-02

## Besluit

**Lokale codebasis: HOLD voor PR/integratie.** De bestaande productfunctionaliteit en migratiehistorie zijn geconsolideerd of aantoonbaar vervangen; er is geen ontbrekende generieke HOURLY_VARIABLE-berekening gevonden. De enige voorgestelde runtime-uitbreiding in deze fase is de lokale `-BsnAcceptance`-modus. Die blijft onvoltooid: de bestaande PowerShell-contracttest faalt op verouderde launcher-verwachtingen en de centrale TEST-config mist de twee vereiste BSN-sleutels. Geen commit, push, deployment, databaseactie of cleanup uitgevoerd.

- Repository/worktree: `C:\Users\Edwin\Documents\Apps\LiquidHR-ONE-MAIN-20261102`
- Branch/HEAD: `work/one-liquidhr-final-20261102` / `d70949c36f60c0ac692ec31af03f31e6e8dd3b67`
- De 3 runner-/documentatiewijzigingen zijn unstaged; dit rapport is untracked; index schoon; `git diff --check` PASS; unmerged paths: 0.
- Eerdere audit: `docs/quality/acceptance/runs/LIQUIDHR-CONSOLIDATIE-34-20261031.md`; Payroll-deeltaak: `docs/quality/acceptance/runs/PAYROLL-HOURLY-VARIABLE-CONSOLIDATION-20261102.md`.

## Consolidatiematrix

| Onderdeel | Classificatie | Besluit en bewijs / exacte vindplaats |
|---|---|---|
| C34 Focus-resource | **REEDS GEÏNTEGREERD** | Buildguardcommit `4c9197055076fcaf02d7fe1ef98416d7d33ab8c7` is ancestor van HEAD. De lokale wijziging in `C:\Users\Edwin\Documents\Apps\LiquidHR\apps\hr-suite\lib\workforce-tools\mcp\focus-widget-resource.ts` heeft bij EOL-genormaliseerde vergelijking geen functionele delta; bestand blijft onaangeroerd. |
| C34 release-evidence | **BEHOUDEN BUITEN RELEASE** | `C:\Users\Edwin\Documents\Apps\LiquidHR\docs\quality\acceptance\runs\LIQUIDHR-CONSOLIDATIE-34-FINAL-RELEASE-20261101.md` en de gewijzigde AA/CURRENT_CONTEXT/IMPLEMENTATION_STATUS-bestanden blijven in de oorspronkelijke checkout. Dit is een gedateerde snapshot met toenmalige B/C-status; niet hergebruiken als actuele hosted-acceptatie. |
| C34 `next-env.d.ts`, `output/wvp01/` | **GEGENEREERD** | Beschermd en behouden in de oorspronkelijke checkout; niet gestaged of gekopieerd. |
| PMUX-04, R4/R8 | **REEDS GEÏNTEGREERD** voor code; **BEHOUDEN BUITEN RELEASE** voor bewijs | PMUX-branch HEAD `8776c202ba6dbb7d9f16f4b778dd3999964d8bfa` is ancestor. Bewijs blijft in `C:\Users\Edwin\.codex\worktrees\branch-split-pmux-20261021\LiquidHR\docs\quality\acceptance\runs\PMUX-04-20261021-TEST-ACCEPTANCE.md` plus de R4/R8-addenda. Die addenda bewijzen geen volledige Manager/Employee-, tenant-/team-negative of exportacceptatie; de genoemde migratie-/CLI-side-effects zijn hier niet opnieuw op Core TEST gecontroleerd. |
| PAYD1 readiness | **BEHOUDEN BUITEN RELEASE** | Code-HEAD `0c16aab218f2490d26e297cd11d365c2f7ad84be` is ancestor. `C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\PAYD1-K2-20261022\docs\quality\acceptance\runs\PAYD1-INTEGRATION-READINESS-01-20261022.md` is een untracked, historische readiness-notitie; eerdere 214 lokale PASS maakt live RLS/persona/source-acceptatie niet groen. |
| Stash 2: salary structures | **REEDS GEÏNTEGREERD** | De huidige catalogus/read-scope gebruikt `salary_structure_ids` en `salaryStructureRevisionIdsForStructures` in `apps/hr-suite/.../employment-settings.ts`, `lib/salary-structures/catalog-read-scope.ts` en bijbehorende service/tests. Geen stash-apply; oude diagnostische tekst niet als productcode teruggezet. |
| Stash 3: generieke BSN-testmodus | **BLOKKADE** | Een smalle, unstaged kandidaat staat in `scripts/start-test-worktree.ps1`, `scripts/start-test-worktree.contract.ps1` en `docs/delivery/TEST_RUNTIME_AND_VERCEL_PREVIEW.md`. Bestaande Node/Next/package/workspace-dependency-preflight blijft vóór runtimeconfig staan. Normale Development-preflight PASS; BSN-preflight HOLD wegens ontbrekende `BSN_HASH_KEY` en `EMPLOYEE_PII_ENCRYPTION_KEY` in de centrale config. Waarden zijn niet gelezen of getoond. De originele stash blijft onaangeroerd. |
| Stash 5: PAYCASE/pensioen/salaris | **VERVANGEN** / **BEHOUDEN BUITEN RELEASE** | Oude pensioeninstellingenroute is vervangen door `/payroll/arrangements`; de eenmalige FTE-1,00 `salary-actions.ts` is data-specifiek. Oude IDs `20261017090000`, `20261017110000`, `20261017130000` zijn vervangen door huidige canonical IDs `20261017063451`, `20261017072011`, `20261017075639`; blobs zijn inhoudelijk gelijk. Oude reports/fixtures blijven in `stash@{5}`. Geen migratie-ID opnieuw ingevoerd. |
| Stash 6: PAYCONVERGE | **VERVANGEN** / **BEHOUDEN BUITEN RELEASE** | Oudere migration-ID-mappings zijn vastgelegd in de fase-4 audit. De stashed Payroll Lab fixturemigraties `20261008170000` en `20261009100000` verschillen van de huidige bestanden uitsluitend door één afsluitende lege regel; SQL-statementinhoud is gelijk. Bestaande IDs/bronnen blijven leidend; stash blijft intact. |
| Stash 8 en 10 | **BEHOUDEN BUITEN RELEASE** | PAYLAB oracle-/bronteksten in stash SHA `e146b40f99b3dcd90015f448ca73d5db1fde0a10` zijn bronarchief, niet productcode. BRAND01-historische kandidaatcijfers in `b65aca660699000c4059efef55a3002d8a6e49b1` zijn geen actuele acceptatie. Beide refs behouden. |
| Stash 11 / APIAI-09 | **BEHOUDEN BUITEN RELEASE**; productcode **REEDS GEÏNTEGREERD/VERVANGEN** | `stash@{11}` SHA `a3a8b82f79fd577d155f8d038b7f3e7d43cc5fcd` behouden. 23 brand-logo-bestanden zijn byte-identiek aan HEAD. De 17 `public/model/`-foto's, twee referentiebladen en `public/model/README.md` ontbreken in HEAD en hebben geen aangetoonde herkomst/licentie; niet opnemen. MSS/APIAI-code is aanwezig of door actuele routes vervangen; oud releaseverslag zegt acceptance OPEN. |
| Jantje/Mars-pensioen en fixtures | **BEHOUDEN BUITEN RELEASE** | Vijf dirty bestanden blijven in bronworktree `C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\LIQUIDHR-MAIN-SYNC-20261029`: `pension-arrangement-service.ts` en test, employment pension page, `messages/en/employment.json`, `messages/nl/employment.json`. Niet gevalideerde fixture-/tarief-/franchise-/providersemantiek; geen generieke uitbreiding bewezen. Fail-closed guard `PENSION_PARTIAL_MONTH_PRORATION_UNVERIFIED` en `INCOME_RELATIONSHIP_TIMELINE_GAP` behouden. |
| Generieke HOURLY_VARIABLE | **REEDS GEÏNTEGREERD** | Featurecommit `6f26f352e7a39d22e15c673fffeb4bd650df7f6b` is in de huidige lijn; huidige berekening/provider en regressietests zijn nieuwer dan de dirty bronworktree. Geen bestand integraal gekopieerd. |
| Twee losse Payroll-folders zonder `.git` | **VERVANGEN**; caches/output **GEGENEREERD** | `...\PAY-W02-W03-W04-INTEGRATION-20261025` matcht alle 23 niet-generated bestanden exact met historische ref `433565bf389472066cf2aa80bc61d6b522e5cc7f`; `...\PAYROLL-D1-20261022` matcht alle 23 met `bfcfce6a398dcc56cf652aa958fda55d22b942a1`. Afwijkingen t.o.v. HEAD zijn alleen de oudere `packages/db/types.ts`/`scripts/check-test-personas.browser.mjs` en bij D1 ook oudere `package-lock.json`/`vercel.json`; die bestanden zijn door huidige versies vervangen. `node_modules/` en `output/` zijn gegenereerd. Beide folders blijven staan. |

## Behoud: actuele worktrees en stashes

Read-only herinventaris: **13 geregistreerde worktrees**, alle HEADs zijn ancestors van integratie-HEAD; **12 stashes**, allemaal behouden. Dirty files zijn niet aangeraakt, behalve de drie expliciete wijzigingen in de integratieworktree hierboven.

| Worktree | HEAD | Beschermde/dirty inhoud bij controle |
|---|---|---|
| `C:\Users\Edwin\Documents\Apps\LiquidHR` | `4c9197055076fcaf02d7fe1ef98416d7d33ab8c7` | Focus, `next-env.d.ts`, AA/CURRENT_CONTEXT/IMPLEMENTATION_STATUS, C34-evidence, `output/wvp01/` |
| `C:\Users\Edwin\.codex\worktrees\branch-split-payroll-20261021\LiquidHR` | `86386eed7dc41a8e11c8469614bb4d5706719fd9` | `next-env.d.ts` |
| `C:\Users\Edwin\.codex\worktrees\branch-split-pmux-20261021\LiquidHR` | `8776c202ba6dbb7d9f16f4b778dd3999964d8bfa` | `next-env.d.ts`, PMUX-04, R4/R8 evidence |
| `C:\Users\Edwin\.codex\worktrees\payroll-p0-p1\LiquidHR` | `4f99b04eab6cc7a79fd86048ccad1cd3dafc3cbe` | schoon; beschermde Payroll P0/P1/Nmbrs-ref |
| `C:\Users\Edwin\.codex\worktrees\pmux-auth-hardening-20261026\LiquidHR` | `9145e7cedc96a2964fe4be36d59ca97928ca68e6` | `next-env.d.ts` |
| `C:\Users\Edwin\.codex\worktrees\wvp01-safe-integration-02\LiquidHR` | `7a13e7e22b08720ae66db17d838bd056e146bd89` | `next-env.d.ts` |
| `%TEMP%\LIQUIDHR-CONSOLIDATIE-34-BUILD-c7dc67ba` | `c7dc67ba153053fc1c657ee5bcfc3dc483877712` | detached; Focus en `next-env.d.ts` |
| `C:\Users\Edwin\Documents\Apps\LiquidHR-ONE-MAIN-20261102` | `d70949c36f60c0ac692ec31af03f31e6e8dd3b67` | deze fase: 3 unstaged bestanden |
| `C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\LIQUIDHR-MAIN-SYNC-20261029` | `5e47832123bc90e197b38dc511bd658904e62c96` | 5 Jantje/Mars-bestanden, 4 oudere HOURLY_VARIABLE-bestanden, `next-env.d.ts` |
| `C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\ONE-LIQUIDHR-MERGE-01` | `9e2e354422c8b591ed161f58e640de4f913ae4b9` | detached; Focus |
| `C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\PAY-W04-HR-HOURS-TO-PAYROLL-01-20261026` | `58a0fdf76e4327a27ecde00086dac6f078ca1970` | Focus, `next-env.d.ts`, `.tool-home/` |
| `C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\PAYD1-K2-20261022` | `0c16aab218f2490d26e297cd11d365c2f7ad84be` | untracked PAYD1 readiness-report |
| `C:\Users\Edwin\Documents\Apps\LiquidHR-Payroll\PAYROLL-MERGE-20261022` | `8ec2c43e2063a0c9ff2ce83557d6a99df5eef3be` | `next-env.d.ts` |

All 12 stash object IDs remain in the main repository, un-applied and un-dropped:

| Stash | Full object ID | Preserved content |
|---|---|---|
| `stash@{0}` | `e38125c67ca5f0ed3e7926278a4618f97185fbfc` | official payroll PDF/XLSX source archive |
| `stash@{1}` | `f8f5742a4fe211b9d06bffc9b7e537e829e7dc09` | PAYCONVERGE Vitest config |
| `stash@{2}` | `f8f1326e03b67ae584254dc8a4cfce32899607c6` | PAYINTEGRATE local code/source-provider snapshot |
| `stash@{3}` | `bf40784bf25a9faf272ca9692a141b61d03aea42` | BSN/runtime docs and original launcher snapshot |
| `stash@{4}` | `4075ed94bd7c5ee64fce0a8684aeda4ba6f1e612` | PAYFULL oracle, calculation, pension and persona tests |
| `stash@{5}` | `526a1689d9147541869af006e28b145bedfb3266` | PAYCASE code, old migration names and evidence |
| `stash@{6}` | `a607c070a0cf9c1cd169ef7683d74eab0841f1d0` | PAYCONVERGE code/docs/migrations |
| `stash@{7}` | `4dece5b15b669341eb5391ac4aa42cf02fd749c1` | historical `apps/hr-suite/AGENTS.md` |
| `stash@{8}` | `e146b40f99b3dcd90015f448ca73d5db1fde0a10` | PAYLAB oracle/source documents |
| `stash@{9}` | `61360d4ffbb3fcd01aa1d0c33e3728fb5e73f16b` | STAR V2 local code snapshot |
| `stash@{10}` | `b65aca660699000c4059efef55a3002d8a6e49b1` | BRAND01 local evidence/edits |
| `stash@{11}` | `a3a8b82f79fd577d155f8d038b7f3e7d43cc5fcd` | APIAI-09 code, logo/model assets and report |

## Verificatie en blockers

| Gate | Resultaat |
|---|---|
| Root workspace tests | **PASS** — HR Suite 4,143 PASS / 8 SKIP; Control 11 PASS; Payroll Rules 61 PASS. Totaal 4,215 PASS / 8 SKIP / 0 FAIL; gelijk aan baseline. |
| Gerichte Payroll/pensioen/WVP/PMUX/security regressies | **PASS** — 10 files, 134 tests PASS. |
| TypeScript | **PASS** — `npm.cmd run type-check -- --incremental false`, alle geconfigureerde workspaces. |
| i18n | **PASS** — 43 NL/EN namespaces gelijk. |
| Diff-/conflict-/indexcontrole | **PASS** — diff-check schoon, geen conflictmarkers in gewijzigde bestanden, 0 unmerged, niets staged. |
| BSN standaard-preflight | **PASS** in Development; bestaande dependency-preflight aanwezig en eerst uitgevoerd. |
| BSN acceptance-preflight | **HOLD** — centrale TEST-config mist `BSN_HASH_KEY` en `EMPLOYEE_PII_ENCRYPTION_KEY`; config niet aangepast. Synthetische configprobe accepteerde geldige en weigerde ongeldige voorbeeldwaarden, maar is geen persona-/runtimeacceptatie. |
| PowerShell contracttest | **HOLD/FAIL** — `scripts/start-test-worktree.contract.ps1` faalt na de nieuwe BSN-assertions op de bestaande, oudere lifecycle-/redirectverwachting (`different Windows null-device targets`). De huidige launcher (commit `cdb393e29624fc746343a25d78b09b741b0d51c6`) is een foreground runner; de contracttest verwacht nog lifecycle-/process-code uit `dfb752ee917f2f138d5dce79d5232b6508738c03`. Een poging om die gate conditioneel over te slaan is door automatische review afgewezen; de gate is niet omzeild. |
| Productiebouw | **NIET UITGEVOERD** — repositoryinstructie verlangt een schone, vastgelegde kandidaat voor de productiebuild; deze kandidaat heeft unstaged wijzigingen en de runnercontractgate is HOLD. Dit is geen gerapporteerde buildfailure. |
| Database/hosted acceptatie | **NIET UITGEVOERD** — geen database- of externe actie binnen deze fase; oude PMUX/PAYD1/C34-evidence is geen actuele readback of hosted PASS. |

Geen Payroll-unit-/integratietests faalden. De enige falende relevante gate is de launcher-contracttest; die wijst op stale test expectations versus de huidige runner en moet inhoudelijk worden gereconcilieerd. De ontbrekende BSN-variabelen zijn een TEST-configuratiebronblokkade.

## Eindadvies

**NO-GO voor één integratie-PR op dit moment.** Houd de drie lokale BSN-runnerwijzigingen unstaged en behoud alle bronnen. Volgende noodzakelijke stap: herstel de launcher-contracttest inhoudelijk tegen de huidige foreground-runner zonder lifecycle/security-assertions over te slaan; daarna valideer Edwin de bestaande BSN TEST-config via het normale beveiligde configuratieproces. Draai vervolgens de vereiste productiebuild op een schone, vastgelegde kandidaat. Hosted/databasegates en releasebesluit blijven afzonderlijk.