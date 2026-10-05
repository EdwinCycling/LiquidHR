# AA-NEXT — Short-Term Roadmap

Status: **ACTUEEL / LIVING**
Bijgewerkt: 2026-10-02

Deze roadmap bevat alleen de komende concrete productwaves. Detailrequirements staan elders.

**Latere ontwikkelhandoff (2026-10-04):** CAO-BENCH02 fase 2 is lokaal technisch gebouwd en blijft `PARTIAL` door één ontbrekende admin-isolatiefixture; niet opnieuw als nog-ongebouwde feature plannen. Eerst een expliciete PAY-CONVERGE-releasebeslissing en relevante gates volgens AA-REL. Zie [AA-OPEN](AA-OPEN.md) voor de resterende bewijs-, fixture- en besluitpunten. De gedateerde historische roadmap hieronder wordt tijdens de volgende gecontroleerde documentatieconvergentie integraal bijgewerkt.

## Actuele uitvoeringsvolgorde — besluitkader 2026-10-04

**Verifieer vóór uitvoering opnieuw de remote branch/SHA en lokale featureoverdracht.** Laatste in deze AA-docs verifieerbare remote `main`: `6349d02538351cd01fc51f298c6e6fa0ba88006c`, app `1.20261002.1`. ONE VERSION is volgens de aangeleverde release-ownerhandoff `TEST RELEASED / hosted acceptance GREEN`; onafhankelijke volledige evidence-review is nog PENDING. Voor niet-gepushte featurecommits tellen de lokale overdrachten als gemeld bewijs, niet als remote/geïntegreerde toestand. Historische scope- en releasepassages verderop blijven voor detail; gebruik **dit** kader en [AA-OPEN](AA-OPEN.md) voor de actuele volgorde.

1. **CONTROL02 — Draft PR review + doorlopende FINAL-build, parallel.** Draft PR #4 is remote geverifieerd open/draft/mergeable op snapshot `a5c056ba...` met 53 gewijzigde paden vanaf `main=6349d025...`. De lokaal gemelde FINAL-doorbouw (`495cd02...`) voegt strong-identifier matching, idempotente staging-completeness, verplichte audit-readback en recovery-hardening toe, maar is nog niet remote geverifieerd. Bouw verder in grote geïntegreerde slagen; gebruik PR #4 als centrale contract-/migratiereviewbestemming. Houd XML staging/finalization fail-closed totdat `C02-SEC-014` en `C02-CORE-015` zijn goedgekeurd. Heropen `C02-ACC-016` pas zodra een rechtmatige klantcontext bestaat; de ontbrekende historische `BSN_HASH_KEY` blijft `C02-ENV-012` en mag de overige veilige bouw niet opnieuw blokkeren.
2. **CORE + PAYROLL CONTRACT — gerichte gezamenlijke activeringspoort.** Beslis expliciet over canonieke IKV-identiteit/historische LhNr, datumsemantiek, protected groepsidentiteit, expliciete Employment-keuze en de twee relevante database-invarianten. Eén gezamenlijk besluit, één eigenaar per schemaobject, één gecontroleerde migrationlineage. Geen nieuwe separate wekenlange 'leesronde'; reeds lokaal opgestelde contractvoorstellen gericht beoordelen.
3. **CONTROL02-FINAL + acceptatie** — implementeer de volledige confirmed match-/Employment-/multi-IKV-/audit-/resumable-flow in de doorlopende grotere featurewave. Pas echte Core-domainwrites, migrations en integratie uitsluitend toe na de gedeelde poort. Heropen de volledige desktop/390-px/JWT-browseracceptatie pas zodra de juiste secret én rechtmatige testcontext bestaan; behoud bestaande gerichte bewijsstukken.
4. **PAY-CONVERGE (parallelle Payroll-integratiebeslissing).** Volgens lokale 2026-10-04-handoff zijn zeven CAO-BENCH02-scenario's persistent doorgerekend; fase 2 blijft `PARTIAL` wegens ontbrekende echte Mars-only → Jupiter admin-weigering. **Niet opnieuw CAO-BENCH02 als ongebouwde feature plannen.** Controleer de kandidaatcommits, migraties en die ene scopefixture, en beslis expliciet over eventuele beperkte synthetische TEST-release conform AA-REL. Rond niet stilzwijgend wettelijke afrondings- of algemene cao-/fiscale claims af. Zie `SEC-PAY-001`, `PAY-RULE-002`, `PAY-COVER-003`.
5. **APIAI-01 en vervolg parallel:** de afzonderlijke D0-/API-implementatiebranches en Draft PR blijven gescheiden. Bouw waar veilig achter gesloten interfaces, maar activeer niets extern zonder het gedelegeerde auth-/OAuth-/scope-/auditcontract en de toepasselijke veiligheidsacceptatie. Zie `API-DEC-009`.

6. **APIAI-02 — remote geverifieerd gebouwd, nu integreren.** Draft PR #5 is open/draft/mergeable op `ce6a2ea...`, base `6349d025...`. Shared Workforce-toolcatalogus, dispatcher, Employee/Manager/HR-projecties en interne BFF zijn gebouwd; `/api/v1` blijft ongemount. De finale code heeft 520/2.157 HR-tests GREEN plus build/type/lint/Pester; onafhankelijke review zonder P1/P2. Geen hosted Preview of externe API-releaseclaim. Integreer PR #3 (APIAI-01 foundation) en PR #5 bewust in één APIAI-convergencebranch; neem PR #2-documentbesluiten selectief mee. Bouw daarna APIAI-03 Remote MCP achter gesloten route/gate door, zonder externe activatie totdat `API-DEC-009` en APIAI-01 securitygates GREEN zijn. Zie `APIAI-BUILD-018`.

**Daarna in het algemene HR-productspoor:** WVP01 (verzuimcasemanagement), INS02 (rapportconsistentie + Headcount/FTE) en AI01-B (Liquid Credits/commerciële governance), ieder als één grotere duidelijk gescopeerde wave met werkende vertical slice, geïntegreerde tests en bugfixes. Nieuwe productideeën blijven in AA-ROAD; ontbrekend specifiek extern bewijs blijft in AA-OPEN en blokkeert niet automatisch de volgende onafhankelijke bouw.

### Overdracht na iedere grotere Codex-ronde

Gebruik steeds `Wat levert deze ronde ons op?` en `De beoogde volgende mijlpalen`, met heldere BEDOELD/GEBOUWD/GETEST/RELEASED-status, de exacte featurecommit, relevante test-/bugfixevidence, andere lopende sporen en alleen de AA-OPEN-ID's die de volgende stap werkelijk raken. Geen reeks aparte opdrachten om dezelfde al bekende acceptatieblokkade telkens opnieuw te bevestigen.

## Historische releasebeschrijving — ONE VERSION / PAYLAB00–04

De geïntegreerde PAYLAB00–04-kandidaat is MERGE-READY op `3ff38bdc4b145dbf1080cf8f0a7f4abd41c2eb96`; de huidige opdracht rondt de gecontroleerde TEST-release af met versie `1.20261002.1`. Er komt in deze release geen Payroll-feature, migratie, CAO-implementatie of nieuwe ontwikkelronde. Houd de reeds geaccepteerde desktop-/mobiele payroll-browserresultaten en hashes intact.

## Historische releasebeschrijving — CONVERGENCE01 post-release TEST-acceptatie

**Status: TEST RELEASED; beveiligingsacceptatie OPEN.**

App `1.20260928.1`; canonical `main` `cb73260ff0cd83d19fa29e44c9f0b93749fb10af`; Vercel `liquidhr` deployment `dpl_CANMAQydQcYGy9Xe7JhNm8grJuvH` READY.

Nu uitsluitend een **bounded follow-up**, niet nóg een brede convergence- of release-loop:
1. Control bestaande acteurs: AUDITOR write, invitation reuse/revoke, forged tenant/group/admin, tweede en cross-tenant bootstrap;
2. AI live: na sessiestart feature disable en scope revoke, plus noodzakelijke forged persona-negatives;
3. Bradford CSV-download echt parsen en rijscope/filter/formuleveiligheid vastleggen; resterende kritieke Insights-API/scope-gaten gericht testen;
4. Alleen echte gevonden defecten minimaal fixen met regression en afzonderlijke traceerbare commits; laat elk deel OPEN tot bewijs.

De synthetische payrollfinalisatie is runtime-bewezen (employee + conceptemployment + twee IKV's), dus **niet opnieuw onderzoeken**. Officiële XML/XSD-support blijft CONTROL02.

**Integratiegrens:** bevries de releasebaseline voordat Payroll Lab/CONTROL02 shared Control/Core code aanraken. Eerst diff/migrationlineage/dependencyplan, nooit blind mergen of bestaande TEST-migrations opnieuw toepassen.

**Parallelstrategie:** pure `packages/payroll-engine`/losse Payroll Lab database-experimenten kunnen na branchinventaris parallel met onafhankelijke tracks. Shared Control, payrollimport, employee/employment/IKV en migrations blijven geserialiseerd totdat expliciet geïntegreerd.

## CONTROL02 productscope uit oorspronkelijke planning (nu deels lokaal gebouwd)

**Loonaangifte XML Import V1 + Readiness UI**

Doel:
- HR Admin importscherm onder **Instellingen → Medewerkers & dienstverband → Loonaangifte XML importeren**;
- server-side readiness-paneel dat actuele stamdata controleert;
- groen = gereed, oranje = import kan met draft/follow-up, rood = veilige import geblokkeerd, grijs = niet vereist;
- readiness minimaal voor actieve HR-groep, actieve administratie, importrechten en na parsing LhNr/jaar/tijdvak/source support;
- arbeidsvoorwaarden/contractinrichting mogen als oranje ontbreken en leiden dan tot veilige draft/follow-up;
- afdelingen, functies, kostenplaatsen en salarisstructuur zijn niet automatisch blockers;
- upload → detect → analyse → matching → preview → confirm → result;
- bestaande medewerkers veilig herkennen en aanvullen: EXACT / PROPOSED / MANUAL REVIEW / NEW;
- bestaande medewerker nooit dupliceren omdat dezelfde persoon opnieuw via XML binnenkomt;
- bron-/LiquidHR-verschillen op veldniveau zichtbaar maken; niet blind overschrijven;
- één persoon met meerdere IKV's correct behandelen;
- geen voornaam uit initialen verzinnen;
- BSN uitsluitend via bestaande secure identifier/fingerprintarchitectuur;
- geen fictieve stamdata aanmaken;
- preview = nul definitieve domain writes;
- ontbrekende niet-blokkerende inrichting leidt tot draft/follow-up;
- jaar-/namespaceadapterarchitectuur;
- representative synthetic XML + geanonimiseerde real-world fixture;
- formele XSD-validatie alleen claimen voor jaren met de bijpassende officiële XSD;
- volledige gerichte import/security/UI acceptance, inclusief readiness-statussen en refresh na stamdatawijziging.

Belangrijke input:
- bestaande CONTROL01 stagingtabellen/services;
- echte Exact-achtige 2025 Loonaangifte;
- 2026 gegevensspecificatie;
- 2027 XSD;
- officiële 2026-XSD is volgens de lokale CONTROL02-overdrachten gepind en gericht gevalideerd; actuele commit/bronhash vóór verdere releaseacceptatie controleren.

## THEN — WVP01

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

## THEN — INS02

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

## Historisch Payroll-productbereik — verifieer tegen de actuele lokale CAO-BENCH02-handoff

PAYLAB00–04 zijn geïntegreerd en geaccepteerd; de bestaande source-/featureworktrees blijven behouden. CAO-BENCH02 is volgens de latere lokale overdracht deels gebouwd en gericht getest, maar de onafhankelijke autorisatieacceptatie is nog OPEN; herimplementeer de fase niet op basis van deze oudere tekst. Voor een volgende Payroll-productwave wordt de dan actuele main-baseline eerst bewust gereconcilieerd, zonder blind te mergen.

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
- CONTROL02/Core IncomeRelationship-contract expliciet vastleggen vóór echte multi-IKV-integratie;
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
