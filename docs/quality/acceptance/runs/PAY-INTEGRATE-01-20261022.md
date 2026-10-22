# PAY-INTEGRATE-01 — lokale Payroll + D1-integratie

Datum: 2026-10-22
Verdict: **GO WITH CONDITIONS — alleen lokale codeconvergentie; geen release- of productieacceptatie.**

## 1. Uitgangsbranches en ancestry

| Branch | HEAD vóór integratie | Merge-base | Commits uniek aan die branch |
|---|---|---|---:|
| `work/BRANCH-SPLIT-PAYROLL-20261021` | `86386eed7dc41a8e11c8469614bb4d5706719fd9` | — | — |
| `work/PAYD1-K2-20261022` | `0c16aab218f2490d26e297cd11d365c2f7ad84be` | Payroll HEAD | 6 na Payroll |
| `work/BRANCH-SPLIT-PMUX-20261021` | `19656935a2f2d329f18157a9d2cd0c0fc88257d5` | `14803473c1157285b52cc234fbb6ac70860e9eb1` | 36 |
| `main` | `602ba2376ab453248f4d5f7121b2d35cb227b2d4` | `14803473c1157285b52cc234fbb6ac70860e9eb1` | 6 |

Paargewijze verschillen vanaf de merge-base: Payroll↔D1 `0/6`; Payroll↔PMUX `11/36`; Payroll↔main `11/6`; D1↔PMUX `17/36`; D1↔main `17/6`; PMUX↔main `36/6` (links/rechts commits vooruit). Payroll HEAD is dus al ancestor van D1. De integratieworktree is aangemaakt vanaf de exacte D1-HEAD; er waren geen cherry-picks of dubbele Payroll-commits.

Payroll- en PMUX-checkoutmappen waren niet rechtstreeks leesbaar. De refs en HEADs zijn veilig vanuit de toegankelijke D1-checkout gecontroleerd; hun lokale dirty status is daarom niet bevestigd. De oorspronkelijke D1-checkout had al één untracked readinessrapport; dat is niet naar de nieuwe worktree gekopieerd. De bestaande checkouts zijn niet door deze run bewerkt.

## 2. Commitinventaris

De 11 Payroll-featurecommits die al in D1 zitten:

| Commit | Onderwerp |
|---|---|
| `82558de1dd1f0439c99866de261b35cbf01b85b6` | fix(payroll): bound salary runs loading |
| `52b41c06d3da328f5f63d4ca84549f7e00af9310` | docs(payroll): record PAYRUN-ROUTE-01B acceptance |
| `689c6ae56a243efe3c04db49330dc98d199e47f8` | docs(payroll): record PAYRUN route security hold |
| `88da58e61fe3363ef1395893b09c01d437be3b79` | docs(payroll): record blocked Mars browser acceptance |
| `30c2223f4cdee640fec5ec97f6cc17e0824ea3dd` | PAYRUN-PERF-02: stream run list and batch references |
| `93ed009cebd17b4343fd63de27e2d9042facc428` | PAYRUN-PERF-02: record partial acceptance evidence |
| `b7718c2afd460334f73e11e4716cc9f457e56aa2` | PAYSEC-403-01: enforce employee grants for self API |
| `1be87827ce7119d22abd7ac723975d952a4a40ca` | PAYSEC-403-01: record auth regression acceptance |
| `568ffc38b4abec9366c52a4e88791c979674eb88` | feat(payroll): view stored finalized payslips |
| `3eb9b42f6875356831ecc22b2d48e2384f4c90bb` | docs(payroll): record D0 payslip acceptance |
| `86386eed7dc41a8e11c8469614bb4d5706719fd9` | docs(payroll): close out D0 mobile and security evidence |

De zes D1-commits sinds Payroll HEAD:

| Commit | Onderwerp | Bestanden gewijzigd |
|---|---|---:|
| `57a214f8d7e11898ae35cbcea64fe88f2d00ce94` | docs(payroll): record blocked Kinderopvang D1 evidence | 3 |
| `6d8563ec360b1cafaaf6f23ac659b70189619ebf` | Add synthetic PAYD1 Kinderopvang calculation case | 7 |
| `f39461d811684e8a35d4911e3effd55da943a38e` | feat(payroll): independently validate K2 source contract | 9 |
| `5f6c88e5252b49e31805f122414965ecad345802` | PAYD1-K2-04 add Core source readiness | 14 |
| `b32f43d39729e683ca22b3512191840554617471` | PAYD1-K2-05 reconcile Frits sources | 5 |
| `0c16aab218f2490d26e297cd11d365c2f7ad84be` | feat(payroll): complete synthetic Kinderopvang K2 case | 11 |

D1 wijzigt 26 bestanden sinds Payroll HEAD (`+3.492/-67` regels). De gecombineerde Payroll+D1-delta vanaf `14803473` is 58 bestanden (`+4.355/-152`).

<details>
<summary>Complete tracked path inventory van de Payroll+D1-delta (58 bestanden)</summary>

- `AGENTS.md`
- `apps/hr-suite/app/(dashboard)/employees/[employeeId]/employments/[employmentId]/page.tsx`
- `apps/hr-suite/app/(dashboard)/payroll/runs/[runId]/page.tsx`
- `apps/hr-suite/app/(dashboard)/payroll/runs/loading.tsx`
- `apps/hr-suite/app/(dashboard)/payroll/runs/page.tsx`
- `apps/hr-suite/app/api/payroll/runs/[runId]/artifact/[artifactType]/route.test.ts`
- `apps/hr-suite/components/employment/payroll-source-readiness-panel.tsx`
- `apps/hr-suite/components/payroll/payroll-stored-payslip-viewer.test.tsx`
- `apps/hr-suite/components/payroll/payroll-stored-payslip-viewer.tsx`
- `apps/hr-suite/lib/api-v1/core/protected-get.ts`
- `apps/hr-suite/lib/auth/permissions.test.ts`
- `apps/hr-suite/lib/auth/permissions.ts`
- `apps/hr-suite/lib/employment/pension-arrangement-service.test.ts`
- `apps/hr-suite/lib/payroll/component-library-access.test.ts`
- `apps/hr-suite/lib/payroll/payd1-k2-06-source-case.test.ts`
- `apps/hr-suite/lib/payroll/payroll-acceptance-scenario.test.ts`
- `apps/hr-suite/lib/payroll/payroll-acceptance-scenario.ts`
- `apps/hr-suite/lib/payroll/payroll-cycle-service.test.ts`
- `apps/hr-suite/lib/payroll/payroll-cycle-service.ts`
- `apps/hr-suite/lib/payroll/payroll-professional-run-service.ts`
- `apps/hr-suite/lib/payroll/payroll-professional-service.ts`
- `apps/hr-suite/lib/payroll/payrun01-k2-fixture.test.ts`
- `apps/hr-suite/lib/payroll/payrun01-k2-independent-oracle.ts`
- `apps/hr-suite/lib/payroll/payrun01-payslip-pdf.test.ts`
- `apps/hr-suite/lib/payroll/payrun01-payslip-pdf.ts`
- `apps/hr-suite/lib/payroll/payrun01-repository.test.ts`
- `apps/hr-suite/lib/payroll/payrun01-repository.ts`
- `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.test.ts`
- `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.ts`
- `apps/hr-suite/lib/payroll/source/source-readiness.test.ts`
- `apps/hr-suite/lib/payroll/source/source-readiness.ts`
- `apps/hr-suite/messages/en/employment.json`
- `apps/hr-suite/messages/en/payrollProfessional.json`
- `apps/hr-suite/messages/nl/employment.json`
- `apps/hr-suite/messages/nl/payrollProfessional.json`
- `docs/AA/AA-ACCEPT.md`
- `docs/AA/AA-CURRENT.md`
- `docs/AA/AA-NEXT.md`
- `docs/AA/AA-OPEN.md`
- `docs/AA/AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md`
- `docs/AA/AA-PAYROLL.md`
- `docs/AA/AA-TEST.md`
- `docs/quality/acceptance/PAYROLL-TEST-PERSONAS.json`
- `docs/quality/acceptance/PAYROLL-TEST-PERSONAS.md`
- `docs/quality/acceptance/runs/PAYD1-K2-01-20261022-BLOCKED.md`
- `docs/quality/acceptance/runs/PAYD1-K2-02-20261022.md`
- `docs/quality/acceptance/runs/PAYD1-K2-03-20261022.md`
- `docs/quality/acceptance/runs/PAYD1-K2-04-20261022.md`
- `docs/quality/acceptance/runs/PAYD1-K2-05-20261022.md`
- `docs/quality/acceptance/runs/PAYD1-K2-06-20261022.md`
- `docs/quality/acceptance/runs/PAYDOC-D0-20261021-LOCAL.md`
- `docs/quality/acceptance/runs/PAYRUN-PERF-02-20261021-LOCAL.md`
- `docs/quality/acceptance/runs/PAYRUN-ROUTE-01B-20261021-LOCAL.md`
- `docs/quality/acceptance/runs/PAYRUN-ROUTE-01C-20261021-LOCAL.md`
- `docs/quality/acceptance/runs/PAYRUN-ROUTE-01D-20261021-LOCAL.md`
- `docs/quality/acceptance/runs/PAYRUN-ROUTE-01E-20261021-LOCAL.md`
- `docs/quality/acceptance/runs/PAYSEC-403-01-20261021-LOCAL.md`
- `packages/payroll-rules-nl-2026/src/payrun01-composition.ts`

</details>

De integratiebranch voegt één lokale codecommit toe: `0d21f02869a617fa6ba5d5bf296f13d232f943d9` — verplaatst de foutgrens rond de PAYRUN-workspace dataread zodat JSX buiten `try/catch` staat. De getoonde foutstate en succesvolle render blijven gelijk. De volledige ESLint-run had deze bestaande fout in `30c2223f` aangetoond. Alleen deze gerichte lintfix is een codewijziging van de integratieslice.

## 3. Wijzigingsinventaris en compatibiliteit

| Gebied | In de kandidaat | Integratiebevinding |
|---|---|---|
| PAYRUN-performance | Runlijst eerst renderen, workspace onder eigen boundary, gescopeerde batchread van bronreferenties | Bestaande scope- en hashcontroles blijven aanwezig; geen run of berekening aangepast. |
| PAYSEC-selfpermission | Strikte Employee-selfpermission via delegated RLS voor self-only handlers | Gerichte API-, permission- en autorisatietests slagen; geen grant gewijzigd. |
| D0-payslips | Opgeslagen artifactread, HR Admin-/Employee-viewer, loading/error/retry en hashcontroles | Geen berekening of PDF opnieuw opgeslagen; bytegedrag blijft via bestaande regressies afgedekt. |
| D1-broncontract | `payroll-source-contract-v1`, geversioneerde bronreferenties en readinessstatus; ontbrekende/tegenstrijdige versies blijven `SOURCE_GAP` | Generieke provider; geen Kinderopvang-hardcoding in de engine. |
| K2-componenten | Generieke bruto-aanvulling, PAWW/VCR en drie `included`-basisvlaggen | Bestaande standaardcompositie blijft leidend; gerichte compositie-, VCR- en oracle-tests slagen. |
| UI/taal | HR Admin-bronreadiness op bestaande dienstverbandpagina; NL/EN-labels | 43 vertaalnamespaces hebben gelijke sleutels. |

`apps/hr-suite/next-env.d.ts` is buiten scope gebleven: Payroll en D1 hebben dezelfde blob `ce4e94a6b10f160ee021fe18939af160d2927dcf`; na de build is de oorspronkelijke SHA-256 `1B59D4C6B83807DB275D43F3CF2CC8E9323F465FAB764EEA091CC5BECD5BAD37` behouden.

## 4. PMUX-conflict- en eigenaarrisico

PMUX is niet opgenomen: geen PMUX-commit, code of werkboom is gewijzigd. De PMUX-HEAD `19656935` heet `cleanup(pmux): remove R7 local persona sign-in`. De branchdocumentatie meldt `PMUX-04R6` als **PARTIAL / HOLD**: 94/94 gerichte tests, ESLint en i18n PASS; TypeScript bleef OPEN na sandbox-weigering van `.tsbuildinfo`. De bestaande HR Admin-flow is getest, maar Manager/Employee-browseracties en live RLS-scope blijven OPEN. De R7-cleanup verwijderde de onvoltooide Manager/Employee-loginopties en helper/tests; de bestaande owner-only switcher bleef staan.

De branchdeltas van D1 en PMUX overlappen op vier bestanden, allemaal documentatie: `docs/AA/AA-ACCEPT.md`, `AA-CURRENT.md`, `AA-NEXT.md` en `AA-OPEN.md`. Er is geen D1/PMUX productcodepad-overlap gevonden. `AA-CURRENT`, `AA-NEXT` en `AA-OPEN` zijn op deze integratiebranch aangevuld met expliciete scheiding en de actuele open status; PMUX-geschiedenis blijft op de PMUX-branch. `AA-ACCEPT.md` is hier niet opnieuw geschreven omdat het de accepted baseline beschrijft. Bij een latere PMUX-integratie moeten alle vier gedeelde documentbestanden handmatig worden gereconcilieerd.

`main` is niet opgenomen. Main en D1 lopen uiteen vanaf `14803473`; deze kandidaat is geen main-mergebasis of deploymentkandidaat.

## 5. Kwaliteitsgates

| Gate | Resultaat |
|---|---|
| Payroll/API/D0/K2/autorisatie | 26 bestanden, 242 tests PASS |
| PAYRUN-workbench/cycle na lintfix | 2 bestanden, 7 tests PASS |
| Payroll NL-regelpakket volledige suite | 6 bestanden, 48 tests PASS |
| HR Suite TypeScript (`--incremental false`) | PASS na lintfix |
| Payroll-regelpakket TypeScript | PASS |
| ESLint hele HR Suite | PASS, 0 fouten; 8 waarschuwingen (7 ongebruikte testdeclaraties in bestaande tests, 1 ongebruikte `PayrollSetupRepository`-import in de D1-bronprovider) |
| i18n | PASS, 43 namespaces |
| HR Suite volledige suite | **FAIL / OPEN** — 711 bestanden: 698 PASS, 4 SKIP, 9 bestanden met time-out; 3.486 tests: 3.466 PASS, 8 SKIP, 12 time-outs, geen assertion- of auth-statusfouten |
| Gerichte herhaling timeoutbestanden | **OPEN** — 9 bestanden; 32 PASS, 7 time-outs. Ondanks `--testTimeout=20000` bleef de repo-limiet 5s actief. Bekende calendar-, startpage-count-, manager-scope- en persona-linkfamilies kwamen terug; enkele PDF-/migratietests bleven ook boven de limiet. Geen oorzaak buiten de timeout is vastgesteld. |
| Productiebuild op codecommit `0d21f028` | PASS — Next.js 16.4.0, 337 routes, client-boundary negative control + 174 assets, function-trace- en PDF-runtime-allowlistchecks PASS; buildprovenance noemt `0d21f028`. |
| Browser/live TEST/RLS | **OPEN / niet uitgevoerd** — `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` ontbrak; geen centrale TEST-config gekopieerd of runtime gestart. |

Node was `v22.14.0`; `@sparticuz/chromium@149` meldt dat het `^22.17.0` of hoger vereist. Dat is een omgevingafwijking en een mogelijke test-/PDF-risicofactor, geen bewezen oorzaak van de time-outs.

Van de 12 full-suite-time-outs waren vijf niet meer timeout in de seriële herhaling; daarin slaagden onder meer de twee PAYFULL-02-personalinktests, de helper-scopecase en de PAYRUN01-/validation-pack-PDF-tests. De repo had calendar-, startpage-count-, manager-scope- en persona-link-time-outs al eerder als timeoutgevoelige families vastgelegd. Zeven seriale time-outs bleven in de lokale-persoonlink, PDF-rendering, manager-scope, calendar, Core-fiscalemigratie en 10.001-employee-count. Dit zijn time-outs, geen mislukte assertions; de volledige suite blijft niettemin FAIL/OPEN.

## 6. Mars- en K2-data-integriteit

De eerder geaccepteerde PAYDOC-D0-bewijsregel voor de Mars DEMO-002 2026-10 FINALIZED-PDF blijft 513.406 bytes, SHA-256 `51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977`. Deze integratierun kon de opgeslagen bytes niet opnieuw live lezen omdat de TEST-runtimeconfig ontbreekt. De bestaande viewer-/artifact-/scope-regressies zijn lokaal groen; er is geen opgeslagen historische Core/TEST-run of PDF live gelezen, geschreven, herberekend of gefinaliseerd.

K2-06 blijft één in-memory, synthetische novembercase: bruto €2.513,78, werknemer-/werkgeverpensioen €201,74/€203,30, PAWW €2,51, fiscaal loon €2.309,53, loonheffing €120,92, netto €2.188,61 en werkgeverskosten €3.520,32. Dat is geen Frits-run of productieacceptatie. Frits’ 24/36-salarisregel versus 32/36-rooster, officiële persoonskoppelingen, werkgever/PFZW-besluiten en betaalde cumulatieven blijven bronhouderbesluiten uit K2-05.

## 7. Resterende blockers en eigenaren

- **Volledige suite en timeoutbeleid — Payroll QA / CI-runtimebeheer:** 12 time-outs in de eerste full suite, waarvan 7 in de seriële timeoutherhaling. Vereist een geldige gecontroleerde testruntime en afzonderlijk geaccepteerde full-suite-uitkomst.
- **Live browser, RLS en scope — Test Auth / Security QA:** centrale TEST-config ontbreekt; geen persona-, tenant-/administratie- of Employee-liveprobe uitgevoerd.
- **Historische Mars-artifactreadback — Payroll QA / Test Auth:** eerder opgeslagen byte-/SHA-bewijs bestaat, maar de artifactstore is hier niet opnieuw gelezen.
- **PMUX-04 — PMUX owner / PMUX QA:** browseracties Manager/Employee, live JWT/RPC-negative scope en de open TypeScript-gate blijven op de eigen PMUX-branch.
- **Echte Frits-berekening — HR/werkgever/PFZW-bronhouders:** los contract-/salarisconflict en ontbrekende deelname-, werkgevers-, fiscale en cumulatievenbevestiging blijven onveranderd.

## 8. Grenzen en conclusie

Alleen de nieuwe integratieworktree en lokale documentatie/codecommit zijn gebruikt. Geen Core- of andere databasewrite, payrollrun, FINALIZED-status, PDF-mutatie, grant, push, merge of deployment. **GO WITH CONDITIONS** geldt alleen voor het lokaal samengevoegde Payroll+D1-codepakket; de full-suite-, live-scope-, historische artifactreadback-, Frits-bron- en PMUX-gates blijven afzonderlijk OPEN.
