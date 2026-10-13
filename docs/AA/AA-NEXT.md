# AA-NEXT — Short-Term Roadmap

Status: **ACTUEEL / LIVING**
Bijgewerkt: 2026-10-13 (Core/PERF en parallelle Payrolltrack)

Deze roadmap bevat alleen de actuele volgorde van concrete productwaves. Detailrequirements staan elders.

## Eerstvolgende Core-volgorde — besluit 2026-10-13

1. **PERF01-B2 — server-side medewerkerpagination (LOOPT / CONTROLLED).** Nieuwe, correct gescopeerde RPC/migratie voor 50 medewerkers per pagina, exact totaal en server-side zoeken/filteren/sorteren; toepassing op synthetische Supabase TEST is expliciet geautoriseerd. Niet als afgerond markeren vóór een bewezen Codex-oplevering en vereiste autorisatie-/releasegates.
2. **WVP01 — Wet verbetering poortwachter Case Management (VOLGENDE CORE-WAVE).** Direct na PERF01-B2. Bouw bovenop de bestaande absence-/taak-/milestonefoundation; geen herbouw van bestaande services. Controleer vóór de implementatie de actuele wettelijke bronset en bewaak case-manager-/HR-groepscope.
3. **INS02 — Report Consistency + Headcount/FTE (DAARNA).** Eén consistente rapportagestandaard, dezelfde querysemantiek voor KPI/chart/tabel/drilldown/export en het Headcount/FTE-referentierapport.
4. **AW02 — Actual Work vervolg (LATER).** Herprioriteer op actuele requirements na de bovenstaande Core-waves.

**PERF01-status en bewijsgrens:** AA-LEAN-02 is ingevoerd. PERF01-B1a en PERF01-B (dashboardqueries en aggregaties) zijn geïntegreerd en als synthetische TEST-release geleverd; de representatieve end-to-end-tijdmeting blijft OPEN onder `PERF01-B-019`. PERF01-A2 (HeRa-chat/geschiedenis, Team AI-data en voicechunks pas bij gebruik laden) is reeds in de actuele code aanwezig; geen nieuwe A2-bouwrun nodig, maar bundle-/request-/latencywinst is niet gemeten. PERF01-B2 loopt en is nog niet als RELEASED bevestigd.

**Parallelle planningen blijven ongewijzigd:** NMBRS-02 blijft een aparte read-only employee-synchronisatiepreview, met eigen provider- en acceptatieafhankelijkheden; geen employee writes, matching/apply, payroll export of externe payrollmutaties. Bescherm `work/payroll-p0-p1` en unieke P2-readinessdocumentatie. AI, Payroll en Nmbrs worden inhoudelijk vanuit hun eigen threads bijgewerkt; het Core-besluit herschikt deze sporen niet.

**Security/persona-evidence blijft OPEN:** SEC-01 hosted positives/negatives en bestaande Control-, Insights- en AI-persona-negatives staan in [AA-OPEN](AA-OPEN.md). Vercel READY bewijst dit niet.

AA-CURRENT beschrijft de actuele main-/deploymentbaseline. De ONE VERSION-2026-10-10 voorstatus blijft historisch in het acceptance report; die geldt niet als huidige releasebeslissing.

## VOLGENDE CORE-WAVE — WVP01 (na PERF01-B2)

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

## PARALLELLE PAYROLLTRACK — actuele status 2026-10-13

**Roadmapbron:** [PAYROLL-ROADMAP-20261013](../payroll/PAYROLL-ROADMAP-20261013.md) voor volledige statusmatrix, SHAs, TEST-/branchgrenzen, acceptatiegaten, lifecycle-ontwerp en technische afhankelijkheden. Houd deze Payroll-track parallel aan de overige LiquidHR-sporen; geen autonome merge, migratieapply of TEST-release.

**Afgerond en uitgerold op synthetische TEST:**
- PAYCOMP editor/bibliotheek, inclusief paginering/versies/provenance; concept-forks worden niet operationeel geactiveerd.
- PAYLAB-UX-01: proefrunstart, runcontext, validaties, componentnavigatie; main `f7db482b19b81d9c5aa5517c66394faa5f628e1b`, Vercel READY `dpl_5b3db54pGakfcGWRKywr861N5xCM`, 12/12 gerichte tests, geen OPEN in die slice.
- PAYDOC-STD-01A: LiquidHR Standard A4-loonstrook, immutable PDF, scoped preview/download; beperkte TEST-release `73cb3705...`, PDF-browserflow en live bedragcontrole blijven OPEN wegens Mars- versus Jupiter-administratiescope.

**Gebouwd maar nog niet uitgebracht:**
- **PAYESS-01 Mijn salaris**: multi-perioden, grafieken, periodevergelijking, eigen definitieve PDFs plus bestaand geïmporteerd loonstrokendossier via één gedeelde lijst en afgeschermde self-only download. Remote branch `work/PAYESS-01-20261013`, head `8d96dd4cba86d2b90ba3649d0fd55ddaa77f0fe6`; 55 gericht/3.027 volledige HR-suite tests PASS. **CONTROLLED authenticated TEST-acceptatie OPEN; geen merge/deploy**.
- **PAYCALC-REAL-01**: lokaal idempotent PayrollCycle OPEN, runwerklijst en Core source reconciliation, oude FINALIZED-runs behouden. Commit `a23c197bc05710f963aefeb5554093a4a88220cc` alleen lokaal gerapporteerd; **PARTIAL/HOLD** door ontbrekende geaccepteerde fiscale Core-bron en ontbrekende generieke reken-/persistflow.

**Geprioriteerde volgende Payroll-werkpakketten:**

1. **PAYESS-01 FINAL ACCEPTANCE:** huidige main non-force reconciliëren; met een bestaande geautoriseerde Employee TEST-identiteit beide documentbronnen, download, responsiviteit en echte scope-negatives bewijzen. Auth sign-in/out afzonderlijk autoriseren als die buiten het bestaande mandaat valt. Daarna expliciet TEST-releasebesluit, geen automatische merge.
2. **PAYCALC-REAL-01B:** in bestaande PAYCALC-branch een echte generieke Core-backed bruto→loonheffing→netto-berekening voor de expliciet ondersteunde NL-2026-case opleveren, met versioned fiscaal profiel, source snapshot, persistente CONCEPT-revisie, idempotente herberekening en negatieve auth-/source-/IKV-tests. Remote migraties/writes alleen met afzonderlijk mandaat. Een schema of werklijst zonder salarisresultaat voldoet niet.
3. **PAYFLOW-01:** één PayrollCycle met meerdere werknemers, meerdere immutable CONCEPT-revisies bij een DRAFT/OPEN-periode, één actuele kandidaat per context, actionable uitzonderingen, gecontroleerde REVIEWED/FINALIZED en successor-correctie. Geen herschrijven van FINALIZED.
4. **PAYFLOW-02:** gerichte, idempotente herberekening bij events of ingestelde reconciliatie, stale-markering, scheduler/retries en volgende periode; geen voortdurende Vercel-worker, geen automatische finalisatie of betaling.
5. **PAYMUT-01 / PAYRUN-FINISH / fiscale dekking:** variabele uren/toeslagen/vergoedingen; Jaap/Frits- en PFZW-opvolgeracceptatie; cao-/belasting-/IKV-gaps aantoonbaar oplossen met officiële regels. Niet als generieke NL-compliance claimen.
6. **PAYDOC02/jaaropgaaf, PROFORMA, PAYMENTS/SEPA en externe integraties:** afzonderlijke vervolgsporen na bron-, jaar-/cumulatief- en finalisatiebewijs. De officiële CONTROL02/Loonaangifte-XML-import blijft **CANCELLED**.

**Bewust geparkeerd:** PAYLAB-COMPARE-01 (opgeslagen run A versus run B); niet uitvoeren voordat opnieuw gekozen. Onze huidige vergelijkings-UI met handmatige externe bedragen is niet hetzelfde.

**UX-/securityregel:** production-grade UX, test-safe execution. Geen overbodige `Synthetische TEST`/demo-labels in de gebruikersinterface; wél echte technische TEST-isolatie, zichtbare inhoudelijke onzekerheid en strikte permissions/RLS/audit. P0/P1 zijn geen vrije toestemming voor remote writes, identity-aanpassingen, merge of deploy. Houd PAYESS- en PAYCALC-branches strikt gescheiden.

**CAO-BENCH02 en bronverleden:** de historische plannen voor Kinderopvang, Retail Mode, bedrijfseigen bands/CEO en 7 benchmarkcases blijven vastgelegd in [AA-PAYROLL](AA-PAYROLL.md) en `docs/payroll/acceptance/`; deze referentiecases bewijzen geen volledige cao-/fiscale dekking. De oorspronkelijke CONTROL02/IncomeRelationship-integratie is geannuleerd; Payroll moet een eigen geaccepteerde source-/IKV-contractscope kiezen en mag CONTROL02 niet impliciet herstarten.

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
