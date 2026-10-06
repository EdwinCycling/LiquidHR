# AA-NEXT — Short-Term Roadmap

Status: **ACTUEEL / LIVING**
Bijgewerkt: 2026-10-06

Deze roadmap bevat alleen de komende concrete productwaves. Detailrequirements staan elders.

## Current release — ONE VERSION / PAYLAB00–04

PAYLAB00–04 is technisch als ONE VERSION TEST-release uitgevoerd: `main` mergecommit `6349d02538351cd01fc51f298c6e6fa0ba88006c`, GitHub deployment `6815434828` success, Vercel `dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5` READY, appversie `1.20261002.1`. Hosted desktop-/mobiele acceptatie is GREEN volgens release-evidencecommit `238a285e0d976b508230d6ac900c4e606e2d89e9` van release-eigenaar Edwin; de onafhankelijke review van het volledige bewijs blijft PENDING. Er is geen nieuwe releaseopdracht.

## CURRENT — CONVERGENCE01 post-release TEST-acceptatie

**Status: TEST RELEASED; beveiligingsacceptatie OPEN.**

App `1.20261002.1`; canonical `main` `6349d02538351cd01fc51f298c6e6fa0ba88006c`; Vercel `liquidhr` deployment `dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5` READY. Remaining CONVERGENCE01 acceptance stays OPEN independently of ONE VERSION release state.

Nu uitsluitend een **bounded follow-up**, niet nóg een brede convergence- of release-loop:
1. Control bestaande acteurs: AUDITOR write, invitation reuse/revoke, forged tenant/group/admin, tweede en cross-tenant bootstrap;
2. AI live: na sessiestart feature disable en scope revoke, plus noodzakelijke forged persona-negatives;
3. Bradford CSV-download echt parsen en rijscope/filter/formuleveiligheid vastleggen; resterende kritieke Insights-API/scope-gaten gericht testen;
4. Alleen echte gevonden defecten minimaal fixen met regression en afzonderlijke traceerbare commits; laat elk deel OPEN tot bewijs.

De synthetische payrollfinalisatie is runtime-bewezen (employee + conceptemployment + twee IKV's), dus **niet opnieuw onderzoeken**. Officiële XML/XSD-support blijft CONTROL02.

**Integratiegrens:** bevries de releasebaseline voordat Payroll Lab/CONTROL02 shared Control/Core code aanraken. Eerst diff/migrationlineage/dependencyplan, nooit blind mergen of bestaande TEST-migrations opnieuw toepassen.

**Parallelstrategie:** pure `packages/payroll-engine`/losse Payroll Lab database-experimenten kunnen na branchinventaris parallel met onafhankelijke tracks. Shared Control, payrollimport, employee/employment/IKV en migrations blijven geserialiseerd totdat expliciet geïntegreerd.

## CURRENT — CONTROL02 gerichte acceptatie- en afrondingsgates

**Status: PARTIAL / NIET MERGE-KLAAR.** De bestaande 2026 v2.0 read-only parser valideert lokaal tegen de gehashte officiële XSD. De bounded hardening hieronder werkt uitsluitend de bestaande finalization-kandidaat verder uit; gedeelde contracten en definitieve Core-writes blijven bij de eigenaren.

### 2026-10-06 — CONTROL02 finalization build candidate

In de geïsoleerde branch `work/CONTROL02-MEGA-20261006` zijn per-action state-proof/expected-version contracts, dependency-aware planner/ledgeracties, owner/token-hash/expiry fencing, centrale veldconflictregels en een server-derived plan/recovery summary gebouwd achter de gesloten execution gate. De ledgermigratie is een gewijzigde lokale candidate en niet toegepast. De writer heeft nog geen gedeelde Core transaction adapter; echte Core freshness/conditional-write-, JWT-, migration-catalogue/advisor- en browserbewijzen ontbreken. De volledige lokale hr-suite slaagde (539 bestanden, 2.282 tests; 3 overgeslagen), TypeScript/lint/i18n slaagden en de productiebuild genereerde 308 routes. De Core/Payroll besluitvoorstel staat ter review in de enige reviewbestemming Draft PR #6. Onafhankelijke subagentreview is niet gedaan omdat de huidige bouwopdracht delegatie verbood.

Concrete open gates en mijlpalen:

1. **BSN-key:** alleen bevoegde beheerder kan historische Core TEST-key herkomst bevestigen en veilig provisionen; anders besluit over een afgescheiden synthetische backend. Geen Production/Preview-key hergebruiken.
2. **TEST-context:** een al bestaande, normaal bevoegde HR Admin-context voor de synthetische administratie beschikbaar maken; geen rol- of toegangsverruiming.
3. **Database/contractbesluiten:** expliciete eigenaarstoestemming voor de exacte scope-invariantmigratie, plus gezamenlijke Core/Payroll-goedkeuring van het IKV-/Employment-/datum-/transactionele write-contract. De ledgerkandidaat blijft eveneens unapplied.
4. **Databaseproof:** na die toestemming uitsluitend de goedgekeurde forward migration toepassen en werkelijke history/schema/grants/RLS/triggers/provenance/staging/JWT-negatieven, advisors en typegen bewijzen.
5. **Browser en release review:** zodra key/context bruikbaar zijn, volledige normale-sessie XML-flow met XSD, matching, multi-IKV, conflicten en preview op desktop en 390px; daarna onafhankelijke acceptatiereview. Core-finalisatie blijft uitgeschakeld tot alle contract- en writegrenzen zijn goedgekeurd.

Read-only live TEST pre-state, migratielineage en exact readbackplan staan in `docs/quality/acceptance/runs/CONTROL02-XML-20261003.md`. XSD-herkomst en validatorgrens staan in `docs/requirements/payroll/CONTROL02_XML_SOURCE_MATRIX_V1.md`.

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
