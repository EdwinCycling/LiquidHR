# PAY-INTEGRATE-02 — gerichte integratie-QA

- Datum: 22-10-2026
- Branch: integration/PAYROLL-D1-20261022
- Start-HEAD: a650fd353496f1d8e9fd67c35b6ae309288559b0
- Eindbesluit: HOLD voor verdere integratieacceptatie

## 1. Centrale TEST-runtime

De melding dat de centrale runtimeconfiguratie ontbrak was onjuist. In deze sandbox verwees LOCALAPPDATA naar een geïsoleerd Packages-pad, terwijl de bestaande beschermde runtime staat onder C:\Users\Edwin\AppData\Local\LiquidHR\TestRuntime. De centrale .env.local bestaat daar en is een hardlink naar de canonieke apps/hr-suite/.env.local. Configuratie-inhoud is niet gelezen of getoond; er zijn geen secrets gekopieerd of aangepast.

Met LOCALAPPDATA voor het ondersteunde child-process op de echte gebruikersmap slaagde de bestaande preflight:
scripts/start-test-worktree.ps1 -Mode Development -Port 3020 -PayrollAcceptance -PayrollPersonaAcceptance -PreflightOnly
De runtimevelden en persona-configuratie voldeden; de preflight startte geen server.

De ondersteunde serverstart bereikte Next “Ready”, maar bij de daaropvolgende start faalde de /login-compilatie met EPERM bij het maken van .next/dev/static/chunks/app/login. De requests uit de eerste integratiesessie waren wel bruikbaar. Een lege lokale login-cachemap die tijdens diagnose was aangemaakt, is verwijderd; het loste de fout niet op. next-env.d.ts is byte-identiek teruggezet en bleef buiten de wijziging.

## 2. De zeven eerder geïdentificeerde time-outs

De zeven seriële kandidaten zijn elk apart met één worker en de bestaande 5s-time-out opnieuw uitgevoerd. Alle zeven slaagden; 16 niet-geselecteerde tests bleven overgeslagen. Gemeten testduur:

| Test | Resultaat |
| --- | --- |
| lib/auth/local-payroll-persona-link-migration.test.ts — eenmalige Jupiter-employee-link en immutable audit-event | PASS — 1.651 s |
| lib/document-generation/pdf.test.ts — DG1, multipagina Work Sans A4-PDF | PASS — 1.907 s |
| lib/employment/employment-salaries-manager-scope-migration.test.ts — manager directe reports/afdelingen binnen administraties | PASS — 1.726 s |
| lib/payroll/payroll-calendar-migration.test.ts — legacy periods, scopes en historie | PASS — 1.919 s |
| lib/payroll/payroll-calendar-migration.test.ts — grenzen voor ondersteunde periodiciteiten | PASS — 1.623 s |
| lib/payroll/separate-database-migrations.test.ts — Core fiscale migratie en securitycontract | PASS — 1.641 s |
| lib/startpage/service.counts.test.ts — telling met 10.001 employees en 20.002 employments | PASS — 0.950 s |

De testfase en testhook zijn bereikt; dit waren geen collectiefouten. Inspectie vond PGlite-sluiting in finally-blokken en Chromium-sluiting in de PDF-renderer. Er is geen gedeelde achtergebleven fixture/resource aangetoond. Individuele tests blijven onder 5s; parallelle belasting is een plausibele verklaring voor suite-time-outs, maar niet bewezen. Er is geen timeoutlimiet verhoogd of assertion afgezwakt.

## 3. Eenmalige volledige HR Suite

De volledige suite is eenmaal voltooid op de integratieworktree met de normale time-outinstellingen:

- Tests: 3.486 totaal; 3.466 PASS, 12 FAIL, 8 SKIP, 0 TODO.
- Testbestanden: 1.516 totaal; 1.494 PASS, 22 FAIL, 0 pending.

Elf testgevallen liepen tegen de bestaande 5s-time-out; de geregistreerde tijden omvatten ook teardown. De twaalfde fout is een directe UI-assertion:

| Bestand | Test | Duur / uitkomst |
| --- | --- | --- |
| components/payroll/payroll-payslip-pdf-artifact-action.test.tsx | bestaande PDF lezen en artifact-ID/hash/bytes tonen | FAIL — 49 ms; UI bleef “PDF wordt opgeslagen…” tonen in plaats van de verwachte Artifact-ID |
| lib/auth/local-payroll-persona-access-migration.test.ts | eenmalige Jupiter Employee access-repair | TIMEOUT — 5.795 s |
| lib/auth/local-payroll-persona-link-migration.test.ts | Local Payroll persona link migration | TIMEOUT — 5.791 s |
| lib/auth/payfull02-demo002-persona-link-migration.test.ts | Mars DEMO-002 persona link en geverifieerde HR Admin-autorisatie | TIMEOUT — 6.103 s |
| lib/document-generation/pdf.test.ts | DG1 gecontroleerde HTML naar multipagina Work Sans A4-PDF | TIMEOUT — 5.012 s |
| lib/employment/employment-salaries-manager-scope-migration.test.ts | manager directe reports/afdelingen binnen toegankelijke administraties | TIMEOUT — 6.161 s |
| lib/payroll/payd1-k2-06-source-case.test.ts | volledige synthetische K2-06-case via READY source contract | TIMEOUT — 5.013 s |
| lib/payroll/payroll-calendar-migration.test.ts | legacy months/scopes/periods/history bewaren | TIMEOUT — 6.370 s |
| lib/payroll/payroll-calendar-migration.test.ts | databasegrenzen voor iedere payrollperiodiciteit | TIMEOUT — 6.102 s |
| lib/payroll/payrun01-payslip-pdf.test.ts | PAYRUN01 opgeslagen resultaat als A4-PDF renderen | TIMEOUT — 5.015 s |
| lib/payroll/separate-database-migrations.test.ts | Core fiscale migratie en securitycontract | TIMEOUT — 7.351 s |
| lib/payroll/validation-pack-pdf.test.ts | CAO-BENCH02-validatiepakket als PDF renderen | TIMEOUT — 5.025 s |

De UI-assertion lijkt mogelijk een async test-wachtrace rond digest/rendering, maar een productdefect is niet bewezen. Er is daarom geen test- of productcode voor die fout aangepast. Zes van de zeven oorspronkelijke kandidaten time-outten opnieuw in de volledige suite; de grote startpage-telling slaagde. De volledige-suite-time-outs blijven open.

## 4. Read-only live acceptatie

De bestaande lokale Test HR Admin-handoff en contextselectie slaagden binnen tenant De Sterren holding. De sessie toonde HR-groep Planeten en selecteerbare administraties; Jupiter BV en daarna Mars BV zijn gebruikt voor de passende read-only controles.

- /payroll/runs antwoordde HTTP 200. Eerste zichtbaarheid: 22.364 s; complete load/network-idle: 22.625 s; hoofdtekst circa 21.902 tekens. Dit is lokale dev-/compilatie-inclusieve tijd, geen productiebenchmark.
- Het bestaande Mars D0 FINALIZED-run 48f47ffd-191c-5cbb-a22a-9061a2b7e5c3 en artifact 94cc630b-f8f0-4085-99ce-3126bcce893d bleven ongewijzigd. HR Admin-read van PAYSLIP_PDF gaf HTTP 200, application/pdf, 513.406 bytes, SHA-256 51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977.
- Bestaande DEMO-002 Employee-selfroute /my-salary gaf 200; payslip 2026-10 gaf 200 en dezelfde artifact-ID, lengte en SHA-256.
- DEMO-002 naar Lisa: salary API 403; document API gaf een lege verzameling. Andere bestaande persona-checks dekten eigen routes en cross-employee-negatives; de UI/persona-matrix zelf is niet volledig groen.
- Employee cross-administration-denial is live aangetoond binnen dezelfde tenant. Live Manager-denial bleef OPEN omdat geen bestaande geautoriseerde Manager-persona beschikbaar was in de switcher. Live cross-tenant-denial bleef OPEN omdat geen bestaande foreign-tenant-identiteit/context beschikbaar was. Er zijn geen accounts of grants toegevoegd.
- Geen run, finalisatie, Core-data, PDF-bytes of rechten zijn gewijzigd.

## 5. Gates, wijzigingen en besluit

De eerdere ongewijzigde typecheck, ESLint, i18n- en productiebuildresultaten van PAY-INTEGRATE-01 zijn hergebruikt. Voor de gewijzigde browserhelper slaagden node --check en git diff --check; de gerichte ESLint-configuratie negeert dit script buiten haar app-root. De volledige suite hierboven is de enige volledige herhaling. De aanpassing aan scripts/check-test-personas.browser.mjs volgt de actuele lokale sign-in-, contextselectie- en persona-switchroutes. Geen productcode, grants of PMUX-bestanden gewijzigd.

Besluit: HOLD. De centrale TEST-runtime is teruggevonden en de gecontroleerde live PDF/Employee-selfreads zijn geslaagd. De resterende volledige-suite-fouten en de dev-server EPERM na herstart verhinderen een volledig lokale QA-GO. Manager- en foreign-tenant-live-negatives blijven afzonderlijk OPEN. /payroll/runs is wel gemeten, maar deze ontwikkelmeting is geen productie-SLO-bewijs.

Volgende eigenaren:
- Runtime/Test-infra: herleid de .next/dev EPERM onder de ondersteunde startscriptflow.
- Eigenaren van de elf timeoutende testgevallen: meet seriële en suite-resourcebelasting; wijzig geen generieke limiet zonder oorzaakbewijs.
- Payslip UI-testowner: controleer de asynchrone artifactstatusassertion; geen bewezen productdefect.
- Test Auth/Payroll QA: voer Manager- en foreign-tenant-negatives uit zodra bestaande geautoriseerde persona/context beschikbaar is.
- Payroll performance-owner: beoordeel /payroll/runs met een expliciete lokale/browserbaseline.

Geen PMUX-integratie, main-merge, push of deployment.
