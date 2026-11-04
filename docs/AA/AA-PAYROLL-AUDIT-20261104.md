# Payroll code-audit en roadmapcheck — 4 november 2026

> **Actuele gecontroleerde baseline:** GitHub `main` op `fbe44908f0793519d4b712c26cf8ffa05cf872d1`. Vercel-project `liquidhr`, deployment `dpl_AZKwcU4sjn8UJGVYFzC8WaYbXwGv` **READY**; de canonieke alias `liquid-hr-hr-suite.vercel.app` wijst aantoonbaar naar die deployment en Git SHA. Dit is een *code- en metadata-audit*, geen nieuwe functionele of fiscale acceptatietest. Deze notitie vervangt voor de **actuele status** eerdere momentopnamen in AA-CURRENT, AA-NEXT en AA-ROAD; historische bewijsstukken blijven geldig op hun eigen SHA en datum.

## 1. Onderzoeksbasis en afbakening

- GitHub main-branch, volledige repositoryboom (4.788 bestanden), relevante Payroll-sources, packages, testpaden, documentatie en PR's #88, #89 en #90 rechtstreeks nagezien.
- PR #88 (2 november) integreerde C34, Payroll P0/P1 en WVP01, inclusief de ontwikkelde generieke `HOURLY_VARIABLE`-bronketen. PR #89 verbeterde de install-gate en isoleerde de Payroll Calendar-migratietest, en verhief Zod naar daadwerkelijk gelockte 4.6.7. PR #90 borgde hoofdzakelijk lokaal historisch herstelmateriaal: 297/300 gewijzigde paden staan onder `docs/quality/acceptance/recovery/`; dit is **geen bewijs** dat iedere historische patch actief productgedrag is geworden.
- Vercel-buildstatus en commitprovenance zijn gecontroleerd, maar geen nieuwe geauthenticeerde browser-run, volledige Payroll-berekening, belastingoracle of gehoste E2E-sessie uitgevoerd.
- Supabase-migratieregistraties zijn **read-only** gecontroleerd; er zijn geen databases, rollen, productbestanden of deploymentinstellingen gewijzigd.

## 2. Wat zit aantoonbaar in main?

| Gebied | Codebewijs in main | Status / begrenzing |
| --- | --- | --- |
| Payroll-engine | `packages/payroll-engine/src/engine/engine.ts` en contracten/tests | **Aanwezig**: deterministische berekening, componentversies, broncontroles, hashes. Geen algemene NL-complianceclaim. |
| Nederlandse 2026-regels | `packages/payroll-rules-nl-2026/` | **Aanwezig**: reguliere lonen, tijdvakken, loonheffing/pensioen-gerelateerde regels, onafhankelijke testgevallen. Bereik is scenario-afhankelijk. |
| Cao-/pensioenregels | `packages/payroll-rules-cao-bench02/`, `pension-calculation.ts`, `bpf-detailhandel-2026.ts`, `pfzw-2026.ts` | **Aanwezig**: Kinderopvang/retail-referenties. Werkgeverstoepasselijkheid, bronversies en bijzondere deeltijd-/deelmaandgevallen moeten apart bewezen worden. |
| Payroll-broncontract | `apps/hr-suite/lib/payroll/source/liquid-hr-source-provider.ts`, `source-readiness.ts` | **Aanwezig**: Core HR/contract, salaris, IKV, fiscaal, uren, werkgeversconfig, openingscumulatieven, pensioen, provenance en fail-closed gaps. |
| W04 Actual Work → variabel uurloon | `lib/actual-work/payroll-work-hours-service.ts`, provider en `employee-payroll-calculation-service.ts` | **In code ondersteund**: uitsluitend vrijgegeven WORK-uren met correcte mapping `PAYFULL02_VARIABLE_REGULAR_WAGE` en `HOURLY_RATE_X_HOURS`; geen fictief vast maandloon. Compleet gehost Jantje/Mars-bruto-nettobewijs niet aangetoond. |
| Specifieke on-call `HOURLY_VARIABLE` | `isSupportedOnCallHourlySource` en `variableHourlyPensionBasis` | **Aanwezig**: bruto uit goedgekeurde uren, aparte genormaliseerde pensioenbasis/FTE, maand vs samengesteld tijdvak gecontroleerd. **Mid-period pensioen** en onvolledige IKV-tijdlijnen blijven expliciete bron-/rekenblokkades. |
| Volledige individuele-/batchflow | `employee-payroll-calculation-service.ts`, `payroll-professional-run-service.ts`, `payroll-cycle-service.ts` | **Aanwezig**: OPEN periode, scoped medewerkers, preflight, calculate/review/finalize. Resultaten alleen geldig bij complete bronnen. |
| Payroll-UI | `app/(dashboard)/payroll/`, `payroll-lab/`, `payroll-components/` | **Aanwezig**: overzicht, medewerkers, runs, verschillen, correcties, instellingen, regelingen, componentbibliotheek en Lab. |
| Feature-toegang | `lib/payroll/feature-flag.ts` | **Globaal AAN:** `isPayrollLabEnabled()` geeft `true`; tenantmodules, administratiecapabilities, permissies en RLS bepalen verdere toegang. |
| Loonstrook/ESS | `payrun01-payslip-pdf.ts`, `app/api/payroll/runs/.../artifact`, `app/api/my-salary/payslips` | **Aanwezig**: PDF-rendering, artifact-/employee-routes; bestaande historisch bewezen DEMO-cases, maar geen nieuwe hosted E2E-acceptatie op deze SHA. |
| Externe providerintegratie | `app/api/payroll/providers/nmbrs/`, `lib/payroll/providers/`, `lib/payroll-import/` | **P0/P1-code aanwezig**: OAuth/connection/company binding, importontwerp en API. Externe Nmbrs-consent, sync en werkelijk P2-proces niet als gehost PASS aangetoond. |
| Commerciële/eindejaarscyclus | P2-uitvoerrequirements, deels algemene codebouwstenen | **Niet volledig bewezen**: jaaropgaaf voor ondersteunde doelgroep, uitgaande loonaangifte, pensioenaanlevering, SEPA, journaalposten, multi-IKV/TWK en volledige jaarovergang blijven harde aparte acceptatiefasen. |

**Controle op volledigheid:** de essentiële Payroll-packages, services, routes en tests staan in `main`. Dit is **geen** bewijs dat alle bedachte waves of alle lokaal gearchiveerde patches volledig productklaar zijn. PR #90 archiveerde ook historisch uniek werk zonder het automatisch te activeren; beoordeel voor nieuwe functionaliteit eerst of een concreet ontbrekend contract daadwerkelijk bestaat.

## 3. Test-, build- en deploymentbewijs

- **PR #88:** op de exacte integratiekandidaat 4.215 PASS / 8 SKIP / 0 FAIL, TypeScript/i18n/build PASS volgens vastgelegde lokale evidence; dit was vóór latere main-wijzigingen.
- **PR #89:** `npm ci`, 4.227 PASS / 8 SKIP / 0 FAIL; TypeScript en 43 NL/EN-i18n-namespaces PASS; audit van productdependencies op high-level 0 kwetsbaarheden; alle Zod-resoluties volgens PR naar 4.6.7. Dit is het meest recente gedocumenteerde volledige testbewijs **vóór PR #90**.
- **PR #90:** borgde launcher en recovery-archief; de PR vermeldt expliciet **geen test-suite uitgevoerd**.
- **Vercel op baseline `fbe44908`:** `READY`, branch `main`, correcte canonieke alias. Dit bewijst bouw/deploy, **niet** volledige geauthenticeerde Payroll-acceptatie.
- Het enige geconstateerde GitHub Actions-workflowbestand `.github/workflows/payroll-linux-build.yml` triggert op `integration/PAYROLL-MERGE-20261022`, **niet op main**. Vercel-status is geen vervanging voor een volledige centrale regressiegate.
- In deze audit zijn geen tests lokaal uitgevoerd; conclusies over testresultaten zijn afkomstig uit PR-/acceptatie-evidence, niet uit een nieuwe test-run.

## 4. Database- en migratiegrens

| Databron | GitHub SQL-bestanden | Supabase geregistreerde migraties | Bevinding |
| --- | ---: | ---: | --- |
| Core TEST `wnpfloqpjvaacobppbpk` | 582 | 594 | Aantallen wijken af; een eenvoudige versie-/naamvergelijking leverde 18 niet-direct-matchende remote registraties op, grotendeels historische CONTROL02-benamingen. Geen bewijs dat ontbrekende schemafunctionaliteit bestaat of dat deze migraties opnieuw moeten draaien. **Eerst lineages/mapping reconciliëren.** |
| Payroll Lab TEST `jhgeriucbkfarxiudzfy` | 17 | 17 | Registraties matchen op versie of naam met de SQL-bestanden in de huidige repository; geen live re-executie uitgevoerd. |

Geen migraties herhalen, historische remote registraties verwijderen of SQL direct gebruiken om applicatieautorisatie te omzeilen.

## 5. Roadmap — herijking na consolidatie

**P0 — Nu: één stabiele geïntegreerde TEST-versie (main/deployment gelijk).**
- **Code-integratie en Vercel-alias: DONE.**
- Verifieer op deze exacte deployed baseline een compacte hosted HR Admin/Manager/Employee-scope- en Payroll-smoke, waaronder Mars en Jantje, en leg bron/resultaat-hashes vast wanneer daadwerkelijk berekend.
- Activeer voor `main` een herhaalbare gecombineerde CI-gate (tests, type, security, build) als aparte gerichte wijziging; voorkom blind vertrouwen op Vercel READY.
- Reconcileer Core TEST-migratiegeschiedenis read-only met 582 SQL-bestanden en 594 remote registraties; behoud beide databases.

**P1 — End-to-end betrouwbare maandverloning.**
- PFAST-01/W04: **bron- en berekenondersteuning geïntegreerd**; echte rolgeautoriseerde, volledige end-to-end-casus, uren/TWK, pensioengrondslag, vierweekstijdvak en mid-period pensioenproratering blijven waar toepasselijk afzonderlijk te accepteren.
- R1/R2 Retail en K2 Kinderopvang: historische synthetische engine- en oracletests behouden; bewezen actuele Core-bronnen, pensioen-/cao-toepasselijkheid, meerdere periodes, cumulatieven en afwijkingen nog apart accepteren.
- PFAST-02 (eenmalige periodieke toewijzing vanuit catalogus per medewerker), PFAST-03 (effectieve componenttemplates bij onboarding), PFAST-04 (read-only pro-forma): **niet in deze audit als complete product-UI/API/E2E bewezen**; blijven concrete productbacklog, ook al zijn component- en enginebouwstenen aanwezig.
- Werkgever-/fiscale-/IKV-/cumulatievenreadiness voor meer medewerkers aantoonbaar maken; geen ontbrekende persoonsgegevens of officiële normen verzinnen.

**P2 — Wettelijk complete Nederlandse cyclus.**
- Bijzondere beloningen, multi-IKV, volledige TWK, jaargrens/jaaropgaaf, uitgaande loonaangifte, pensioenbestanden, SEPA en financiële journaalposten, met onafhankelijke fiscal/legal review en meerperiodenacceptatie.
- Tot P2 GO: alleen synthetische TEST-demo/berekeningen, geen claim van wettelijk complete commerciële payroll.

**P3 — Pilot en onderscheidende UX.**
- Eerst parallelverloningspilot met gecontroleerde verschillen en toezicht. Daarna Payroll Flightdeck/Evidence Graph (G1), Time Machine (G2), approval-first AI Payroll Copilot (G3) en schaaluitrol (S1), zoals nader uitgewerkt in `AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md`.

**Andere productroadmaps:** WVP01 en INS03A/B zitten als code in de geïntegreerde main; oude AA-ROAD/AA-NEXT-koppen zijn historische snapshots. Functionele release, RLS/browseracceptatie en eventuele normatieve WVP-status moeten per onderdeel nog aan de actuele testbasis worden getoetst.

## 6. Besluit / Definition of Done

1. **Eén repository/main/Vercel-app**, met Core TEST en Payroll Lab als twee gescheiden bestaande databases.
2. **Code aanwezig ≠ contracttest PASS ≠ gehoste functionaliteit PASS ≠ wettelijk compliant.** Gebruik de vier afzonderlijke statussen consequent.
3. Alle gebouwde Payroll-functionaliteit staat normaal beschikbaar voor bevoegde TEST-gebruikers; geen nieuwe globale off-switch. Onvolledige bronketens blijven fail-closed, geen automatische FINALIZED-run.
4. Herstel concrete defecten **in dezelfde main**, maak geen parallelle actieve Payroll-versie.
5. Lees deze checkpoint eerst; behandel alle oudere 'actueel', 'HOLD' en 'niet gemerged'-koppen als historisch indien ze met deze geverifieerde baseline botsen.

### Verwijzingen
- [PR #88 — C34, Payroll P0/P1 en WVP01](https://github.com/EdwinCycling/LiquidHR/pull/88)
- [PR #89 — test/build-gates en Zod](https://github.com/EdwinCycling/LiquidHR/pull/89)
- [PR #90 — herstelarchief en lokale launcher](https://github.com/EdwinCycling/LiquidHR/pull/90)
- [Historisch bewijs HOURLY_VARIABLE](../quality/acceptance/runs/PAYROLL-HOURLY-VARIABLE-CONSOLIDATION-20261102.md)
- [Commercial Payroll Roadmap](AA-PAYROLL-COMMERCIAL-ROADMAP-20261019.md)
- [Bestaande P2-integratieblueprint](../requirements/payroll/LIQUIDHR_PAYROLL_INTEGRATION_BLUEPRINT_V0.3.md)
