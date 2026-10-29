# AA-NEXT — Short-Term Roadmap

> **29-10-2026, na INS-02 merge.** **Nieuwe uitvoervolgorde:** INS-01 Headcount/FTE [#57](https://github.com/EdwinCycling/LiquidHR/pull/57) en INS-02 Instroom/Uitstroom [#60](https://github.com/EdwinCycling/LiquidHR/pull/60) zijn **MERGED** in `main` `cc6d4b56f3ed4705012aac88a57cbccccef0b608`. INS-02: 37/37 gerichte tests PASS; full typecheck heeft bestaande `.next`-generated-type-blokkade. **Volgende ontwikkelstap INS-03: verzuim- en WVP-inzichten** — vóór implementatie eerst bestaande rapportcatalogus, verzuim/WVP-databronnen, autorisaties/privacy, historische noemers, definities en beschikbare tests **read-only inventariseren**. Hergebruik Insights-catalogus, typed URL-filters, canonieke KPI/trend/detail/CSV en fail-closed teamscope; geen tweede rapportageframework. Daarna pas een begrensde implementatiebranch/PR. De gezamenlijke Vercel TEST-deployment, Engelse live-UI, hosted rol/RLS/browser en brede regressie worden op Edwins verzoek **later gezamenlijk** uitgevoerd; dit is een **release-HOLD**, geen retroactieve merge-HOLD. PMUX/WVP taakactie en P10-classificatie ([#54](https://github.com/EdwinCycling/LiquidHR/issues/54)) en Payroll/W04 blijven afzonderlijk. Geen nieuwe DB-writes, migraties of deployment zonder expliciet mandaat.


> **Uitvoervolgorde 29-10-2026 — Insights.** **Eerst** Draft [INS-01 PR #57](https://github.com/EdwinCycling/LiquidHR/pull/57) inhoudelijk reviewen op HEAD `2a172885e3ff8df490cc23bd2656651fb88d5bba`, met gerichte controle van historische FTE/plaatsingen, scope en exportpariteit. Code-integratie GO voor review; **merge niet uitgevoerd of geautoriseerd door deze docs-update**, release/hosted acceptatie apart. De ontbrekende Engelse live-UI is een gedocumenteerd release-restpunt, niet automatisch een integratie-HOLD; voorkom daarvoor TEST-databasewrites. **Daarna INS-02 instroom/uitstroom en uitstroompercentage**: eerst bron-/noemercontract, historiek en scope verifiëren, daarna bestaande Insights-architectuur hergebruiken; geen parallel rapportageframework. INS-00 inventaris [issue #55](https://github.com/EdwinCycling/LiquidHR/issues/55), INS-01 [issue #56](https://github.com/EdwinCycling/LiquidHR/issues/56). PMUX/WVP positieve native taakactie en P10 HTTP 400 blijven onafhankelijk release-HOLD ([issue #54](https://github.com/EdwinCycling/LiquidHR/issues/54)); Payroll/W04 blijft onafhankelijk. Geen automatische deployment of volgende wave zonder passend mandaat.



> **CANONIEKE ACTUELE STATUS — 24 oktober 2026 (vervangt gedateerde 'actueel'-koppen hieronder).** Edwin heeft één gedeelde synthetische LiquidHR TEST-app; Vercel gebruikt hiervoor technisch het target `production`, maar dit is geen commerciële payroll-GA. GitHub en gerapporteerde lokale `main` staan op `1c4eb3d1bfe75d8145b87484125fcfcb6605aacf` (PR #45 productintegratie, PR #46 documentatie). Appversie `1.20261023.1` is op **24-10-2026 daadwerkelijk uitgerold**: Vercel deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` **READY**, exact dezelfde GitHub-SHA en alle drie bestaande aliassen gekoppeld; anonieme homepage-smoke HTTP 200. Vorige `dpl_CuyAgvBwHr5z9bXNv52Np7SaTxb9` blijft READY als rollback. Vercel automatische Git-deploytriggers staan uit; releases gebeuren op expliciet mandaat.
>
> **Database:** Supabase LiquidHR Core bevat **578 geregistreerde migraties**: PMUX-03A en alle acht daaropvolgende PMUX 03B/05/05C/06A/06B/06B.1/06C/07A eenmaal toegepast en read-only gecontroleerd. De vijf bestaande HR-groepen gebruiken `Europe/Amsterdam`. Payroll Lab blijft een afzonderlijke database met 17 migraties, zonder extra Payroll D2 SQL. Edwin heeft deze synthetische TEST-migraties uitdrukkelijk toegestaan **zonder voorafgaande backup**; dit is bewust aanvaard herstelrisico, niet een algemeen veiligheidsbeleid. De eerdere database-/release-HOLD is hiermee afgesloten voor deze versie.
>
> **Technische gate:** finale HR Suite 3.652 PASS, 8 SKIP; TypeScript en beide productiebuilds PASS. Payroll D2 Retail R1 en PMUX 02–07A zijn geïntegreerd, ook onderdelen waarvan de volledige geauthenticeerde desktop-/390px-browseracceptatie nog OPEN is. R2 bruto-netto, echte fiscale/pensioenbronbevestiging en commerciële payroll-GA blijven OPEN/HOLD voor reële salarisverwerking. SLA's met `businessDays: true` blijven fail-closed; de bestaande Leave-recipe met twee werkdagen blijft ongewijzigd totdat **PMUX-06A.1 canonieke werkkalender** wordt gebouwd en aanvaard. Dagelijkse cron: recruitment `0 3 * * *`, PMUX-reminders `0 6 * * *` UTC; `CRON_SECRET` aanwezig als geheime Vercel Production-variabele. Maximaal vijf reminderjobs per run, vertraging/achterstand mogelijk; een echte cronafleverproef is nog OPEN.
>
> **Postrelease:** CLEANUP-11 is door Edwin gestart en **loopt nog**; claim geen verwijdering van branches/PR's/worktrees zonder eindbewijs. Bescherm unieke ref/stashes, de dirty AI/MCP Focus-wijziging, historische acceptance evidence en de rollback-deployment. De aparte Payroll/Nmbrs-herstelwerkboom mist de historische 519-byte `.env.local` en blijft daarvoor een eigen herstelpunt. In *nieuwe* besluiten, opdrachten en statuskoppen: noem de opdrachtgever **Edwin** in plaats van ‘de eigenaar’. Historische originele rapportteksten blijven onveranderd.
>
> **Bronnen:** [PR #45](https://github.com/EdwinCycling/LiquidHR/pull/45), [PR #46](https://github.com/EdwinCycling/LiquidHR/pull/46), [03B-evidence](../quality/acceptance/runs/LIQUIDHR-RELEASE-03B-20261023.md); Vercel deployment `dpl_EoR4bf4pjsuJA53aRwQ1nDfcME8K` en de afzonderlijke Supabase-migratiereadback (24-10-2026).


> **ACTUELE UITVOERVOLGORDE 23-10-2026:** gezamenlijke Payroll D2 + PMUX-kandidaat staat op `work/one-liquidhr-merge-01-20261023`, gebaseerd op `origin/main` `77c9bd54`; details staan in [ONE-LIQUIDHR-MERGE-01](../quality/acceptance/runs/ONE-LIQUIDHR-MERGE-01-20261023-LOCAL.md). Releasetag: `1.20261023.1`. De vijf HR-groepen zijn goedgekeurd voor `Europe/Amsterdam`; de waarde wordt pas met de 06A-schemamigratie vastgelegd. De eigenaar heeft de gedeelde TEST-schemawijzigingen voorwaardelijk vrijgegeven, maar herstelbare backup/restore blijft onbewezen en dus migratie-HOLD. PMUX 03A is al toegepast; de acht volgende Core-migraties staan klaar; Payroll D2 heeft geen SQL en Payroll Lab blijft gescheiden van Core. De PMUX-cron staat eenmaal per dag op 06:00 UTC; recruitment blijft ongewijzigd. Cron-secret ontbreekt in de Vercel-envinventaris en de route faalt gesloten. De scheduler verwerkt hoogstens vijf jobs per run; actuele Core-telling vond nul `PROCESS_REMINDER`-jobs, dus huidige backlog nul; na migratie opnieuw meten en boven vijf beschikbare jobs per dag kan backlog groeien. BEFORE/AT/BREACH zijn niet realtime. De effectieve Vercel Git-deploymenttrigger is uitgeschakeld en read-back bevestigd; de Git-koppeling blijft staan. Na code-, DB- en releasegates volgt één TEST-deployment, daarna gezamenlijke geauthenticeerde browseracceptatie. De Leave-recipe met twee werkdagen blijft ongewijzigd; workday-SLA's blijven fail-closed tot een proceskalender bestaat. Geen echte salarisverwerking of automatische vervolg-wave.

**Overige onafhankelijke open sporen (volgorde ondergeschikt aan de gezamenlijke releasegates):**
1. **CONFIG-RECOVERY-01 — BLOCKED, onderzoeksrun afgerond:** oorspronkelijke 519-byte `.env.local` van `work/payroll-p0-p1` niet gevonden na gerichte archief-/worktree-/Prullenbak-/File History-controle; originele hash onbekend, VSS zonder administrator ontoegankelijk. **Geen nieuwe zoekrun plannen.** Alleen als deze Payroll/Nmbrs-runtime nodig is: eigenaar herstelt uit oorspronkelijke beveiligde bron of autoriseert een **nieuwe** minimale configuratie met bronwaardeverificatie en afzonderlijke runtimeacceptatie. Geen centrale config blind kopiëren. Onafhankelijke nieuwe functies niet blokkeren.
2. **PAYDOC-D0 lokaal — PARTIAL (21-10):** DEMO-002s bestaande Mars FINALIZED-PDF blijft via HR Admin en Employee-selfservice byte-/SHA-pariteit PASS. Employee mobiel 390×1079 is nu PASS: viewer, download en terugnavigatie; oude Mars-only-hold gesloten onder het tenantbrede contract. D0 artifact-/autorisatieregressies zijn opnieuw meegenomen in PAY-QA-FIX-01 (13 bestanden/79 tests samen met D1 K2 PASS). PAY-QA-FIX-01 bronkandidaat: 3.478 PASS/8 SKIP/0 FAIL; de gecombineerde mergekandidaat sloot af met 3.487 PASS/8 SKIP/0 FAIL. De oude 3.443/8/21 blijft uitsluitend historische D0-runbewijs. Live Manager/Lisa/foreign-tenant-probes blijven OPEN; de /payroll/runs-werkplekmeting is geen productie-SLO. Zie [D0-bewijs](../quality/acceptance/runs/PAYDOC-D0-20261021-LOCAL.md), [QA-closeout](../quality/acceptance/runs/PAY-QA-FIX-01-20261022.md) en [mergehandoff](../quality/acceptance/runs/PAYROLL-MERGE-HANDOFF-20261022.md).
3. **Gerichte hosted bewijsresten:** Employee FINALIZED payslip passende actor; HeRa/MCP/Focus echte host-, consent- en revocationacceptatie; provenance via betrouwbare artifactbron als haalbaar.
4. **PAYROLL-MERGE-HANDOFF — HOLD voor main-integratie:** de lokale mergebranch heeft finale suite 3.487 PASS / 8 SKIP / 0 FAIL, maar productiebuild/security blijft OPEN. Next.js 16.4.0 is volgens de officiële 14-10-2026-update kwetsbaar; 16.4.1 is de gepatchte 16.4-versie. Voer een aparte, geautoriseerde dependency-patch uit en bewijs daarna build op ondersteunde Node/Windows-runtime voordat de coördinator main-integratie voorstelt. PMUX blijft bij de eigen eigenaar. Zie [handoff](../quality/acceptance/runs/PAYROLL-MERGE-HANDOFF-20261022.md). Geen push/deployment in deze slice.
5. **Nieuwe niet-Payroll features mogen beginnen:** Core **WVP01 → INS02 → AW02 later**; PMUX-02A staat lokaal op de main-basis (26/26 gerichte tests, TypeScript, ESLint en i18n groen), maar browser-/geauthenticeerde TEST-readback blijft OPEN. PMUX-02B (WYSIWYG-formulierenbouwer) en PMUX-03 (ESS/MSS-runtime en procesdossier) blijven losse geplande waves onder de PMUX-eigenaar; de PMUX-featurebranch is niet in de Payroll+D1-kandidaat opgenomen. Employee UX-upgrade blijft een losse wave. AI-uitbreiding pas na herprioritering/hostacceptatie. Payroll-status: synthetische K2-case is lokaal compleet; de echte Frits-bronreconciliatie en wettelijke/productieacceptatie blijven OPEN. Een volgende Payroll-wave vereist een afzonderlijke opdracht en bevoegde bronhouderbevestiging; geen GA-claim.

**PAY-QA-FIX-01 integratiegrens:** `integration/PAYROLL-D1-20261022` is op code-commit `ed2a3b3acce2a985d7d44105a4d30517d06fbab8` lokaal **LOCAL INTEGRATION READY**. UI-race-test en bounded-workerfix zijn gecommitteerd; gerichte D0/K2-, TypeScript- en ESLint-gates slagen, en de complete suite is 3.478 PASS/8 SKIP/0 FAIL. De kandidaat is niet geïntegreerd naar main en niet vrijgegeven. Manager-/foreign-tenant-live-negatives en `.next/dev`-EPERM voor browserhervatting blijven afzonderlijk OPEN. PMUX blijft onder de eigen eigenaar op `work/BRANCH-SPLIT-PMUX-20261021` (`64c3e91`); neem geen PMUX-commits mee zonder afzonderlijke eigenaarsafstemming. Geen push, merge of deployment. Zie [PAY-QA-FIX-01](../quality/acceptance/runs/PAY-QA-FIX-01-20261022.md). Er start geen automatische vervolgwave.

De onderstaande oudere productwaves blijven als gedateerde ontwerp-/acceptatieplanning staan en zijn **niet** de actuele releasepositie.

Status: **ACTUEEL / LIVING**
Bijgewerkt: 2026-10-22 (PAY-QA-FIX-01 lokaal; historische productwaves hieronder)

Deze roadmap bevat alleen de actuele volgorde van concrete productwaves. Detailrequirements staan elders.

## HISTORISCHE Payroll-planning na PAYFULL-02 — besluit 2026-10-16 (niet de actuele eerstvolgende run)

**Bewezen in TEST, niet gemerged/deployed:** twee volledige Mars-maandcases voor oktober 2026 zijn `FINALIZED` (DEMO-001 netto €2.181,49; DEMO-002 netto €2.141,36), met werknemerspensioen, tabelmatige loonheffing, werkgeverspremies, reserveringen, cumulatieven, 32/32 PASS-controles en twee in Payroll Lab TEST teruggevonden persistente PDF-artifacts. Extra +€500 regulier-variabel-looncase is alleen `CONCEPT`. Een algemene NL-payroll-complianceclaim is niet onderbouwd. De bekende Jupiter-persona's Lisa/Jaap/Frits zijn **niet** alle drie full-net PAYFULL-02-testcases.

**Volgorde binnen het zelfstandige Payroll-spoor:**
1. **PAYFULL-02D (P0, PARTIAL):** twee persistente PDF-artifacts bevestigd; ESS-route serveert na self-autorisatie de opgeslagen bytes. Inline viewer geeft na timeout foutmelding + retry, maar zichtbaar PDF-renderen is nog OPEN. DEMO-001 eigen ESS en overige live negatieve probes blijven OPEN; geen wijziging aan bestaande Edwin/TENANT_ADMIN-Auth-koppeling. Laatste PAYFULL-02D-bewijs: 7 bestanden / 61 gerichte tests PASS; in-app attachment-URL geblokkeerd.
2. **PAYCASE-03 (P1):** nieuwe volledige rekenproeven (LHK aan, deeltijd/gebroken tijdvak, bijzondere vs reguliere variabele beloning, meerdere IKV's) met onafhankelijke wettelijke rekenoracles; géén externe pakketintegratie.
3. **PAYRUN-03 (P1):** robuuste periodieke cyclus, revisie/TWK en payroll by exception.
4. **PAYDOC-02 / 2027 (P2):** jaaropgaaf en nieuwe fiscale jaarpakket na officiële bronnen; betaling en officiële aangifte apart besluiten.

**TEST-berekeningen, run-ID's, looncomponenten en exacte status:** [PAYFULL-02 validatie en roadmap](../payroll/PAYFULL-02-VALIDATIE-EN-ROADMAP-20261016.md). Historisch bewijs: [PAYFULL-02 closeout](../quality/acceptance/runs/PAYFULL-02-20261016-CLOSEOUT.md). De oudere sectie 'na PAYLAB04' hieronder is een historisch productvoorstel en vervangt dit actuele PAYFULL-02-besluit niet.

## Eerstvolgende Core-volgorde — besluit 2026-10-14

1. **WVP01 — Wet verbetering poortwachter Case Management (VOLGENDE CORE-WAVE).** PERF01-B2 is geleverd; bouw bovenop de bestaande absence-/taak-/milestonefoundation. Controleer vóór implementatie de actuele wettelijke bronset en bewaak case-manager-/HR-groepscope.
2. **INS02 — Report Consistency + Headcount/FTE (DAARNA).** Eén consistente rapportagestandaard, dezelfde querysemantiek voor KPI/chart/tabel/drilldown/export en het Headcount/FTE-referentierapport.
3. **AW02 — Actual Work vervolg (LATER).** Herprioriteer op actuele requirements na de bovenstaande Core-waves.

**PERF01-status en bewijsgrens:** AA-LEAN-02 is ingevoerd. PERF01-B1a en PERF01-B (dashboardqueries en aggregaties) zijn geïntegreerd en als synthetische TEST-release geleverd; de representatieve end-to-end-tijdmeting blijft OPEN onder `PERF01-B-019`. PERF01-A2 (HeRa-chat/geschiedenis, Team AI-data en voicechunks pas bij gebruik laden) is reeds in de actuele code aanwezig; geen nieuwe A2-bouwrun nodig, maar bundle-/request-/latencywinst is niet gemeten. PERF01-B2 is geïntegreerd op `main` `8c585f8397e059070e2107cdbec57ab7fbe3757e`, Vercel TEST READY. De gebruiker rapporteerde een ingelogde `/employees`-browser-smoke met **7/7 PASS** op 2026-10-14. Afzonderlijke Manager-browser-negatives en end-to-end-latency zijn niet door deze run bewezen. Zie [PERF01-B2 handmatige acceptatie](../quality/acceptance/runs/PERF01-B2-20261014-MANUAL-EMPLOYEES.md).

**Parallelle planningen blijven ongewijzigd:** NMBRS-02 blijft een aparte read-only employee-synchronisatiepreview, met eigen provider- en acceptatieafhankelijkheden; geen employee writes, matching/apply, payroll export of externe payrollmutaties. Bescherm `work/payroll-p0-p1` en unieke P2-readinessdocumentatie. AI, Payroll en Nmbrs worden inhoudelijk vanuit hun eigen threads bijgewerkt; het Core-besluit herschikt deze sporen niet.

**Security/persona-evidence blijft OPEN:** SEC-01 hosted positives/negatives en bestaande Control-, Insights- en AI-persona-negatives staan in [AA-OPEN](AA-OPEN.md). Vercel READY bewijst dit niet.

**Talentparallelstatus 2026-10-18:** STAR-V2-04D-1 — centrale Insights-categorie **Talent & Ontwikkeling**, STAR-V2-04D-2A — Functieprofiel & skillgaps, STAR-V2-04D-2B — POP-dekking & ontwikkelvoortgang, STAR-V2-04D-2C — 9-gridbeweging & campagnehistorie en STAR-V2-04D-2D — Continuous Appraisal Insights — zijn lokaal geaccepteerd op de actuele target-checkout. 04D-2D gebruikt alleen bestaande Continuous Appraisal-readmetadata; live TEST heeft beperkte statusvariatie en de overige gevallen zijn geïsoleerd getest. HR Admin, Manager direct-team en Employee-deny zijn bewezen; er is geen nieuwe permissie, schemawijziging, databasewrite of fixturevulling uitgevoerd. De Core-volgorde WVP01 → INS02 blijft ongewijzigd.

AA-CURRENT beschrijft de actuele main-/deploymentbaseline. De ONE VERSION-2026-10-10 voorstatus blijft historisch in het acceptance report; die geldt niet als huidige releasebeslissing.

## VOLGENDE CORE-WAVE — WVP01 (PERF01-B2 geleverd)

**Wet verbetering poortwachter Case Management**

Niet opnieuw foundation bouwen. Bestaand:
- `absence_tasks`;
- generator/completion RPC;
- milestonecodes;
- task templates;
- case managervelden;
- absence lifecycle/effective clock.

Doel:
- template- en actual-tasklagen convergeren;
- versieerbare SYSTEM milestones;
- custom/recurring tasks;
- future projection timeline;
- exacte case-managerautorisatie;
- werkvoorraad;
- Overzicht / Tijdlijn / Acties / Dossier / Re-integratie / Historie;
- RIV-readiness;
- reminders/reports;
- optioneel per HR-groep;
- veilige backfill actieve cases.

Voor implementatie actuele main opnieuw scannen en actuele wettelijke bronset verifiëren.

## DAARNA — INS02

**Report Consistency + Headcount/FTE reference report**

Doel:
- bestaande rapporten inventariseren tegen één Report Consistency Contract;
- waar nodig harmoniseren: header, definities, filters, chips/reset, KPI, chart, table, drilldown, export, states, scope;
- KPI/chart/table/drill/export exact dezelfde querysemantiek;
- eerste nieuwe referentierapport: Headcount & FTE Trend;
- Manager dezelfde structuur maar scoped;
- Employee geen management Insights.

## THEN — AI01-B

**Liquid Credits & Commercial Governance**

Doel:
- huidige AI-runtime niet herbouwen;
- allowance/quota;
- charge catalog;
- extra credits/validity;
- usage/budget inzicht;
- admin warnings;
- capabilitymodel verfijnen;
- commerciële tierwaarden pas vastleggen na expliciet productbesluit.

## PARALLELLE PAYROLLTRACK — na PAYLAB04

PAYLAB00–04 zijn geïntegreerd en geaccepteerd; de bestaande source-/featureworktrees blijven behouden. CAO-BENCH02 is voorbereid maar niet geïmplementeerd en valt buiten de ONE VERSION-release. Voor een volgende Payroll-productwave wordt de dan actuele main-baseline eerst bewust gereconcilieerd, zonder blind te mergen.

Voorgesteld volgende productonderwerp, pas definitief maken na expliciete scopekeuze:

- PAYLAB05 (later): eventuele component Designer bovenop de bestaande veilige engine/DSL; geen designer is onderdeel van PAYLAB04;
- PAYLAB05 (later): component Designer bovenop de bestaande veilige engine/DSL;
- CAO-BENCH01/02: **drie primaire testregelingen**: twee publieke cao's (Kinderopvang 2025–2026, Retail Non-Food 2026–2027 module Mode) én een synthetische bedrijfseigen regeling met **open schalen/bandbreedtes, configureerbaar midpoint en compa-ratio zonder treden**. Codex richt alle drie zelfstandig in; **zeven** gepseudonimiseerde/synthetische Lab-scenario's (twee per regeling). De eerder geverifieerde vier complete Test Operations/Jupiter-profielen zijn slechts potentiële gescopeerde Core-brondata; selecteer eerst de door Edwin bedoelde 'Test'-achternaamprofielen als compleet, en vul zonodig met puur synthetische scenario's aan. Test administratie→beschikbare primaire regelingen→één regeling per employment, cao-versieovergangen, company-bandgrenzen, fulltime-equivalent compa-ratio, payrollcomponenten, onafhankelijke oracles en manager-scope. Na PAYLAB04 zijn **gerichte benchmark-testloon-/inrichtingswrites in Core expliciet toegestaan**, voorafgegaan door scope-/referentie-inventaris en veilige rollback; geen ongerelateerde Core-writes, Core-schema-/CONTROL02-wijzigingen of algemene volledige cao-supportclaim. Het demo-open-bandpakket gebruikt echte publieke januari-/juli-2026 bruto-uurbanden A–J uit de cao Passagiers- en Bagageafhandeling Luchtvaart (Staatscourant 11183) maar is expliciet **geen derde cao**.
- PROFORMA00/01: aparte, gescopeerde pro-forma-scenario's bovenop dezelfde engine; eerst synthetische full-month what-if + onderbouwde bruto-naar-netto en netto-naar-bruto-inversie. Na live Core-to-IKV-proof en bredere rules volgen HR-kopie bestaande medewerker en medewerker-selfservice; geen kopie van niet-geautoriseerde salarisdata.
- PAYDOC00/01: loonstrook- en jaaropgaaf-contract + LiquidHR Standard loonstrook/PDF met beperkte klantbranding, verplichte veldvalidatie en scoped ESS-inzage zodra finalization/delivery veilig beschikbaar is.
- PAYDOC02: officiële jaarlijkse loonstaataggregatie en jaaropgaaf-PDF na bewijs van volledige jaarlijkse werknemersverzekering-/Zvw-/arbeidskortinggegevens en werkgever/IKV-groepering.
- PAYDOC03: optionele veilige Custom Document Designer met veldcatalogus, wettelijke required-field validator en versiebare klanttemplates. **Geen** volledige designer in lopende PAYLAB04.
- Medewerker salaris-cockpit: apart later uit te werken; niet vooruitbouwen zonder productscope.
- PAYMENT00/01: gescopeerde `PayableProjection` en afzonderlijke PaymentInstruction/Batch/statuscontracten; daarna officieel gevalideerde SEPA Credit Transfer XML-export uit gefinaliseerde payroll met expliciete klantgoedkeuring. Zolang payrollfinalisatie niet accepted is: uitsluitend synthetic export/preview, geen live betaalclaim.
- PAYMENT02: split payments, TWK/recovery, bankstatusimport en reconciliation; geen negatieve SEPA-instructies.
- PAYMENT03: optionele directe bankkoppeling (bank-/PSP-adapter, toestemming, autorisatie door klant, veilige retries). Handmatige SEPA blijft fallback, maar **nooit** blind bij onbekende banksubmitstatus.
- PAYMENT04: afzonderlijke loonheffingen-/pensioenbetalingen uit geaccepteerde aangifte-/fondsverplichtingen, met actueel betalingskenmerk en ontvanger, niet simpelweg som loonstroken.
- In LiquidHR één sidebar-item `Payroll Lab`; voeg tegel `Betalingen` pas toe als functioneel. Geen projectwijde paymentuitvoering in PAYLAB04.
- De bedoelde oorspronkelijke vier QA-medewerkers zijn inmiddels geverifieerd in **Planeten → Jupiter BV → Directie**: Jan, Frank, Piet en manager Lisa Test. Zij vervangen de eerdere foutieve aanname over Test Operations. Jan heeft een salaris-/roostergrens op 2026-10-01; Piet twee employments/IKV's; Frank einddatum 2026-10-01; Lisa heeft een auth-linked account maar geen bewezen Payroll-managerrechten. Eric Oproeper rapporteert ook aan Lisa maar mist een salarisrecord. Voer de gerichte cao-testreset uit op deze cohort met expliciete employment- en tijdvakselectie, waar nodig aangevuld met zuiver synthetic Lab-cases; zie CAO-BENCH02 §13.
- CAO-BENCH02 aanvullende toepasselijkheid: CEO-scenario C1 met individuele directieregeling binnen dezelfde bedrijfseigen primaire regeling (**buiten de cao**, niet automatisch Metalektro HP); aparte geïsoleerde HP-eligibility fixture H1 voor Metalektro senior specialist, zonder derde volwaardige cao-run. Jupiter Directie/BOARD heeft 5 organisatorisch gekoppelde profielen, maar geen aantoonbaar CEO-functielabel; Codex benoemt gericht een **test-CEO** na inventarisatie zonder auth/DGA/KvK-writes. Officiële Metalektro HP sluit bestuurders/beleidsbepalers uit (Staatscourant 2026 nr. 22083).
- afzonderlijke fiscale vervolgslices: pensioen, werkgeverspremies/VCR, Zvw, bijzondere beloning en overige 2026-situaties op basis van officiële bron- en compliancecases;
- CONTROL02/Core IncomeRelationship-integratie en de bijbehorende multi-IKV-acceptatie zijn CANCELLED; herstart vereist een nieuw projectbesluit;
- iteratieve clusters en gedeelde IKV-grondslagen blijven gereserveerde architectuurinvarianten totdat een afgesproken slice ze implementeert.

Geen van deze onderwerpen is reeds geaccepteerd door PAYLAB03.

## THEN — PAY-CONVERGE

Reconcile bestaande payrollworktrees en migrationlineage tegen dan-actuele main.

- niet blind cherry-picken;
- unieke commits/data-contracten behouden;
- obsolete experimenten expliciet markeren;
- Payroll Lab niet behandelen als standalone gebruikersapp: behoud de bounded-contextarchitectuur binnen LiquidHR, met pure engine package en aparte Payroll-database;
- behoud PAYLAB02 M0 componentengine/ownership/expression-contracten;
- PAYLAB03 versie van de afgebakende NL-2026 fiscale maandcase behouden, met onafhankelijke oracle en officiële tabelankers; overige NL-situaties apart plannen.

## THEN — AW02

Vervolg Actual Work na bovenstaande productwaves, op actuele requirements en accepted baseline.

## Onderhoud

Dependency/security maintenance is een aparte bounded wave en wordt niet opportunistisch in productfeatures gemengd.
