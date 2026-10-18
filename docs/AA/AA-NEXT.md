# AA-NEXT — Short-Term Roadmap

Status: **ACTUEEL / LIVING**
Bijgewerkt: 2026-10-18 (STAR-V2-04D-2C; Core-volgorde ongewijzigd)

Deze roadmap bevat alleen de actuele volgorde van concrete productwaves. Detailrequirements staan elders.

## Eerstvolgende Core-volgorde — besluit 2026-10-14

1. **WVP01 — Wet verbetering poortwachter Case Management (VOLGENDE CORE-WAVE).** PERF01-B2 is geleverd; bouw bovenop de bestaande absence-/taak-/milestonefoundation. Controleer vóór implementatie de actuele wettelijke bronset en bewaak case-manager-/HR-groepscope.
2. **INS02 — Report Consistency + Headcount/FTE (DAARNA).** Eén consistente rapportagestandaard, dezelfde querysemantiek voor KPI/chart/tabel/drilldown/export en het Headcount/FTE-referentierapport.
3. **AW02 — Actual Work vervolg (LATER).** Herprioriteer op actuele requirements na de bovenstaande Core-waves.

**PERF01-status en bewijsgrens:** AA-LEAN-02 is ingevoerd. PERF01-B1a en PERF01-B (dashboardqueries en aggregaties) zijn geïntegreerd en als synthetische TEST-release geleverd; de representatieve end-to-end-tijdmeting blijft OPEN onder `PERF01-B-019`. PERF01-A2 (HeRa-chat/geschiedenis, Team AI-data en voicechunks pas bij gebruik laden) is reeds in de actuele code aanwezig; geen nieuwe A2-bouwrun nodig, maar bundle-/request-/latencywinst is niet gemeten. PERF01-B2 is geïntegreerd op `main` `8c585f8397e059070e2107cdbec57ab7fbe3757e`, Vercel TEST READY. De gebruiker rapporteerde een ingelogde `/employees`-browser-smoke met **7/7 PASS** op 2026-10-14. Afzonderlijke Manager-browser-negatives en end-to-end-latency zijn niet door deze run bewezen. Zie [PERF01-B2 handmatige acceptatie](../quality/acceptance/runs/PERF01-B2-20261014-MANUAL-EMPLOYEES.md).

**Parallelle planningen blijven ongewijzigd:** NMBRS-02 blijft een aparte read-only employee-synchronisatiepreview, met eigen provider- en acceptatieafhankelijkheden; geen employee writes, matching/apply, payroll export of externe payrollmutaties. Bescherm `work/payroll-p0-p1` en unieke P2-readinessdocumentatie. AI, Payroll en Nmbrs worden inhoudelijk vanuit hun eigen threads bijgewerkt; het Core-besluit herschikt deze sporen niet.

**Security/persona-evidence blijft OPEN:** SEC-01 hosted positives/negatives en bestaande Control-, Insights- en AI-persona-negatives staan in [AA-OPEN](AA-OPEN.md). Vercel READY bewijst dit niet.

**Talentparallelstatus 2026-10-18:** STAR-V2-04D-1 — centrale Insights-categorie **Talent & Ontwikkeling**, STAR-V2-04D-2A — Functieprofiel & skillgaps, STAR-V2-04D-2B — POP-dekking & ontwikkelvoortgang en STAR-V2-04D-2C — 9-gridbeweging & campagnehistorie — zijn lokaal geaccepteerd op de actuele target-checkout. 04D-2C gebruikt alleen expliciete vorige-campagnerelaties en de bestaande finalized 9-gridmapping; de live TEST-data bevat geen vergelijkbaar paar en toont daarom correct een lege historie. HR Admin, Manager direct-team en Employee-deny zijn bewezen; er is geen nieuwe permissie, schemawijziging, databasewrite of fixturevulling uitgevoerd. 04D-2D blijft een afzonderlijke volgende slice en de Core-volgorde WVP01 → INS02 blijft ongewijzigd.

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
