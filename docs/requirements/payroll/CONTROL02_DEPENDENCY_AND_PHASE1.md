# CONTROL02 — Dependency Matrix en zelfstandige eerste bouwslice

**Status:** DRAFT / uitvoeringsvoorbereiding, geen implementatie- of mergeautorisatie  
**Datum:** 2026-10-03  
**Baseline bij controle:** `EdwinCycling/LiquidHR` main `6349d02538351cd01fc51f298c6e6fa0ba88006c`, app `1.20261002.1`  
**Branch:** `docs/control02-planning-20261003` (alleen documentatie)  
**Eigenaar:** algemene LiquidHR-ontwikkeltrack CONTROL02  
**Parallel:** Payroll CAO-BENCH02 fase 1; API/AI heeft eigen read-first-/tooltrack; resterende CONVERGENCE01-securityacceptatie blijft apart.

**Belangrijk:** de nieuwe gezamenlijke Payroll-code en AA-set staan op remote main. Vercel heeft bij deze controle een READY-deployment `dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5` met `githubCommitSha=6349d025...`; het gedateerde ONE VERSION-acceptatierapport op main is nog niet bijgewerkt met volledige hosted acceptatie. De recente releaseoverdracht meldde bovendien ontbrekende Production-scoped Payroll-envnamen. Vóór een codeworktree start: actuele releasebeslissing en reële hosted functionaliteitsgate opnieuw bewijzen; Vercel READY of een matchende SHA alleen is onvoldoende. Vercel 'production' is ons gezamenlijk operationele TEST-deploymentkanaal.

## 1. Normatieve documenten en feitelijke reeds bestaande code

**Volg eerst de nieuwste versies op main:** `docs/AA/AA-NEXT.md`, `AA-REQ.md`, `AA-OP.md`, `AA-TEST.md`, `AA-REL.md`, `AA-CURRENT.md`, `AA-ACCEPT.md`; voor de raakvlakken ook `AA-PAYROLL.md`, `docs/decisions/ADR-0003-employee-employment-ikv-en-herintreding.md`, de actuele employment/multitenancy/authorizationrequirements en `docs/quality/acceptance/runs/CONTROL01-20260928.md`, `CONVERGENCE01-20260928.md` en `ONE-VERSION-20261002.md`. CONTROL01-detail: `docs/requirements/payroll/CONTROL01_LOONAANGIFTE_IMPORT.md`. Op de gecontroleerde main stond **geen apart definitief CONTROL02-detailrequirementbestand**; dit plan concretiseert alleen de reeds geaccordeerde AA-NEXT/AA-REQ-scope. Een niet reeds besloten veldmapping of businessregel wordt expliciet opengezet, niet verzonnen.

**Bestaand, verplicht hergebruiken en eerst testen:**
- `apps/hr-suite/lib/payroll-import/{model,source-adapter,matching,validation,mapping,service,database}.ts`;
- `apps/hr-suite/app/api/payroll/import/{analyze,stage,finalize}/route.ts`;
- `apps/hr-suite/app/(dashboard)/imports/loonaangifte/page.tsx`, `components/payroll-import/payroll-import-wizard.tsx`, NL/EN `payrollImport` strings;
- CONTROL01 staging-, grant- en IKV-read-migrations en hun contracttests;
- bestaande employee/employment/administration-, protected identifier-, Setup Assistant- en autorisatieservices; geen tweede implementatiespoor.

**Codegap op main:** `source-adapter.ts` retourneert voor `LOONAANGIFTE_XML` nu `REAL_XML_PENDING`; alleen synthetisch `INTERNAL_REPRESENTATIVE` heeft een adapter. De wizard heeft reeds stappen en recovery. `finalizePayrollImport` accepteert naast EXACT ook niet-MANUAL_REVIEW-rijen; verifieer de individuele gebruikersbevestiging van PROPOSED matches. De bestaande draft-flow roept `createEmployment` met defaults voor onder meer `contractType` aan. Dat is bestaande code, **niet** bewijs dat zulke velden uit de loonaangifte mogen worden afgeleid. Geen onbewezen automatische toewijzing of defaultuitbreiding in CONTROL02.

## 2. Volledige afhankelijkheids-/ownershipmatrix vóór de eerste implementatie

| Contract / systeem | Bestaand bron-/serviceownership | CONTROL02 eerste slice: wat mag? | Parallelle eigenaar / conflictrisico | Gate voor gedeelde writes |
| --- | --- | --- | --- | --- |
| GitHub, branches, TEST en Vercel | Canonieke main, AA-OP/REL, centrale TEST-runtime | Nieuwe externe featureworktree vanaf **dan actuele bevestigde** main; docs/fixtures/tests/read-only services/UI | ONE VERSION/release-orchestrator; API/AI-worker | Geen CONTROL02-main-merge, version bump, release of ongevraagde envwijziging |
| Actuele securityacceptatie | CONTROL01/INS01/AI01-A en release-evidence | Hergebruik/honoreer bestaande permissions; behoud open-status van ongeteste negatives | Separaat securityacceptatiespoor | Geen nieuwe gevoelige hosted writes activeren zonder benodigde permissions-/RLS-evidence |
| Tenant → HR-groep → administratie | Core / Control; server-side actieve context | Readiness uit bestaande actuele server-side context; denied/forged checks | Control; mogelijk API/AI-auth | Geen nieuwe contextcookies, tenant-/group-/adminmodel of gedeelde migration |
| HR Admin / permissions | `payroll-import:read/write`, bestaande AuthContext/RLS/grants | UI en read-only readiness server-side scoped; HR Admin als hoofdpersona | Control/security; API/AI | Elke nieuwe route/RPC met directe actor-/scope-negatives |
| Loonheffingennummer (LhNr) | `administration_payroll_tax_numbers`, administration-specific effective dating | Check aanwezigheid/geldigheidsperiode bij actuele administratie, na XML-parse ook bron-/tijdvakmatch | Core/Control | Een binding wijzigen/toevoegen valt buiten fase 1 tenzij aparte goedgekeurde slice |
| Setup Assistant / HR Admin-stamdata | Bestaande completeness/readiness en administratieconfiguratie | Eén herbruikbare server-side readinessprojectie; geen handmatige checklist als bewijs, geen tweede Setup-engine | Core/Control en UX | Alleen reads, geen fictieve stamdata of automatische herstelmutaties |
| Employee-identiteit en secure BSN | Core employee-services; protected identifier/fingerprintarchitectuur | Bronidentiteit normaliseren in vertrouwde servergrens; voor matching slechts beschermd bestaand mechanisme, geen BSN in staging/logs/fixtures | Payroll benchmark gebruikt gekozen bestaande testmedewerkers | Geen `employees` writes in fase 1; nooit dupliceren of groepoverschrijdend matchen |
| Administration assignment | `ensureEmployeeAdministrationAssignment` en bestaande HR-ownership | Analyse of bestaande persoon al bij de doeladministratie hoort; toon benodigde vervolgactie | Payroll benchmark test-Core-koppelingen | Geen nieuwe assignment-writes vóór gezamenlijk contract/ownershipbesluit |
| Employment en effectivity | Core employment-service, halfopen datumperioden, dossier/contractownership | Geautoriseerde bestaande dienstverbanden bekijken en conflictsignalering; geen contracttype/-begin/-eind verzinnen | CAO-BENCH02 fase 1 gebruikt employment voor primaire regeling en salarysegments | Geen nieuwe of gewijzigde employments zolang gedeelde contracten niet gezamenlijk geaccordeerd zijn |
| Labor conditions / salary / salary structures | Bestaande Core-salaris- en arbeidsvoorwaardenservices | Alleen volledigheidsindicaties; ontbrekend is niet automatisch importblocking; markeer oranje draft/follow-up | CAO-BENCH02 fase 1 kan gericht benchmarktestloon- en regelingdata wijzigen | CONTROL02 wijzigt geen labor conditions, `salary_*` of assignment-/regelingcontracten |
| Canonieke IncomeRelationship / IKV | `income_relationships`; effectieve `employment_income_relationships` koppeling; ADR-0003 | **Expliciet read-only contract**: stabiele identifiers, scope, payer/subnumber, IKV, bronjaar/-tijdvak, effectieve historie, employee/employment-referenties en unieke matchregels inventariseren en gezamenlijk accorderen | CAO-BENCH02 Payroll en Core; Payroll Lab snapshots | Pas na gezamenlijk akkoord eventueel forward-only additive schema-/RPCwijzigingen en nieuwe domainwrites |
| Multi-IKV / overlap / herintreding | Core/IKV-model en CONTROL01 staging; één employee meerdere employments/IKV's | Analyse per bronpersoon en per IKV, distinct composite keys en human review bij ambigue koppeling; behoud overlapping historie | CAO-benchmark heeft specifiek multi-employment-/IKV-testgeval | Geen stilzwijgende IKV→employmentlink, onterecht employee-duplicaat of overschrijven |
| CONTROL01 staging / importbatch | `payroll_import_{batches,persons,income_relationships}`, source hash/idempotency en recovery | Gebruik huidige analyse-/stagingcontracts; in fase 1 geen nieuwe definitieve writeflow voor echte XML activeren | Core/Control importownership | Schema-uitbreidingen/migrations pas na remote migrationlineage + centrale afstemming |
| XML-adapter / formats / XSD | CONTROL01 `REAL_XML_PENDING`, jaaradapters ontbreken | Isolated server-only officiële jaar-/namespaceparser, formatdetectie, veilig validatie- en canonical mapping-contract | Geen schema/eigendomconflict zolang isolated | XSD-geldig uitsluitend op exact officieel jaar/namespace-schema met provenance |
| HR Admin-importwizard / NL/EN | Bestaande `/imports/loonaangifte` wizard en design system | Navigeer via Instellingen → Medewerkers & dienstverband; preflight, bronkeuze, analyse en veilige preview/read-only states in bestaande flow | Andere algemene UX-waves bij overlap | Geen tweede wizard; echte XML niet finalizable zolang write-contract niet goedgekeurd |
| Definitieve verwerking / recovery | Bestaande `finalizePayrollImport`, createEmployee/createEmployment, IKV-staging en retry | In fase 1 alleen huidige gedrag inspecteren, documenteren en regressietesten; nieuwe officiële XML-finalisatie feature-gaten achter gecontroleerde gate | Core, Control, Payroll en release | Afzonderlijke fase 2: review-/confirmcontract, atomic/resumable writes, dubbele calls/races, status/readback, preview=0 writes |
| API/AI en Nmbrs | Afzonderlijke API/AI- en payrollprovidertracks | Geen gedeelde externe API, MCP-tools, OAuth, providerbindings of HR-/Payroll-servicecontractwijziging | APIAI-D0/-01 en Nmbrs P0/P1 apart | Elke gedeelde auth-/Core-/servicewijziging gezamenlijk besluiten vóór codering |
| Testdata en browser | AA-TEST, bestaande testidentities, lokale TEST-runtime, gecontroleerde Preview | Synthetische XML + correct geanonimiseerde representatieve bronfixture; echte browser-/API-/scope-evidence | Release/team-TEST en Payroll-benchmark testcohort | Geen live klantdata, secretkopie, rol/escalatie, cross-track testdatamutatie of nieuwe TEST-migration |

## 3. IncomeRelationship-/IKV-contract: verplichte ontwerpuitkomst vóór fase 2

Lever een aparte leesbare contracttabel met per veld: bestaande Core-tabel/servicekolom, eventuele bestaande payrollsourceadapter, bron-XML-element + jaar/namespace, betekenis, scope, wijzigingseigenaar, validiteitsperiode, nullability, constraint en transformatie. Leg minimaal vast:
- `Employee` is uniek binnen de relevante HR-groep, maar een persoon kan meerdere administratiekoppelingen en een onbeperkt aantal onderscheiden dienstverbanden/IKV's hebben binnen de ondersteunde regels.
- `Employment` is een contractuele, administratiegebonden relatie; `IncomeRelationship` is een fiscale IKV. De bestaande effectieve koppeltabel verbindt ze, niet een gegokte één-op-één-identiteit.
- Identificeer de juiste samenstellende IKV-matchidentiteit binnen administratie/LhNr(subnummer)/IKV/effective periode, het bestaande unique- en overlapcontract en hoe broncorrecties/herintreding worden onderscheiden. Verzin de precieze sleutel niet vóór database-/serviceverificatie.
- Inkomen-/contract-/cao-/salarisbronvelden zijn **geen** toestemming tot upsert van labor conditions of automatische contractpublicatie.
- Nieuwe employees, assignments, IKV's of employments krijgen bij ontbreken van bewezen mapping uitsluitend de reeds afgesproken veilige draft/review-uitkomst; bestaand HR-masterdata niet blind overschrijven.
- Leg ook de inputgrens richting immutable PayrollSourceSnapshot vast: Core geeft op geautoriseerde aanvraag source-referenties/effectieve brondata; CONTROL02 schrijft niet rechtstreeks naar Payroll Lab-database.
- Laat de parallelle Payroll-eigenaar het contract **read-only beoordelen en akkoord geven** vóór elke nieuwe Core-/IKV-/employment-/salary-/labor-conditionswrite of gedeelde migration. Een betwiste mapping blijft OPEN en mag de read-only fase 1 niet blokkeren.

## 4. Officiële bron- en parsermatrix

Bronnen: geanonimiseerde eerdere echte, Exact-achtige 2025 XML uit de gescopeerde bronbestanden; de [officiële Gegevensspecificaties aangifte loonheffingen 2026](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/gegevensspecificaties-aangifte-loonheffingen); de aangeleverde 2027 XSD uitsluitend voor daadwerkelijk ondersteunde 2027-XML; de [Belastingdienst ODB Salarisproductpublicaties](https://odb.belastingdienst.nl/salaris/) voor officiële release-/schemaherkomst. Bronbestanden die niet lokaal beschikbaar zijn worden als **SOURCE_GAP** gerapporteerd, niet geïmiteerd.

1. Inventariseer bestanden met veilige bestandsnaam, jaar, versie, namespace, checksum en herkomst; toon geen raw XML met identificeerbare werknemersdata in log, issue of commit.
2. Definieer een extensibele `year + namespace → parser + normalizer + validation profile`-registry. Begin met het complete beschikbare, bewijsbaar juiste contract, niet met generieke XML-guessing.
3. Beveilig parsing tegen DTD/XXE/externe entiteiten, oversize input, ongewenste nesting/entity expansion en onbetrouwbare numerieke of datumnotaties. Houd de bestaande routegroottebegrenzing of leg een geaccordeerde wijziging vast.
4. Scheid schemavalidatie van semantische importvalidatie. Rapporteer `UNSUPPORTED_YEAR`, `UNSUPPORTED_NAMESPACE`, `XSD_UNAVAILABLE`, `XML_MALFORMED`, `SOURCE_CONTRACT_UNSUPPORTED` e.d. als onderscheidbare fail-closed UI-status.
5. Alleen het juiste officiële XSD voor precies dat bronjaar/de namespace mag als formele XSD-validatie worden aangemerkt. De 2027 XSD **niet** gebruiken om 2026-XML te 'valideren'. De 2026 gegevensspecificatie is **geen** 2026 XSD.
6. Vertaal alleen daadwerkelijk gedocumenteerde importrelevante XML-velden naar de canonieke person-/IKV-structuren, behoud veldprovenance/conflictstatus; onbekende velden mogen geen onbedoelde Core-writes opleveren. Werknemers- en collectieve gegevens onderscheiden; geen aangiftegeneratie of fiscale berekeningen toevoegen.

## 5. Product- en UX-contract fase 1

Bestaande navigatie/wizard hergebruiken. De HR Admin krijgt vóór upload een server-side readinesspaneel met actuele bestaande stamdata, directe herstel-/instellingslinks indien aanwezig en korte uitleg van een eenmalige import. Minimaal:
- `GREEN`: bestaande benodigde inrichting en importpermission aanwezig;
- `ORANGE`: import/preview kan, maar onvolledige niet-blokkerende contract-/arbeidsvoorwaardeninrichting leidt later uitsluitend tot veilige draft/follow-up;
- `RED`: ontbrekende actieve HR-groep/administratie, noodzakelijke importrechten, of na parsing onjuiste LhNr-binding/onondersteund jaar/broncontract/veiligheidsfout;
- `GREY`: niet nodig of vóór bestand nog niet te beoordelen, zonder groen te veinzen.

Readiness wordt **op de server uit actuele brondata** berekend: refresh bij relevante stamdataverandering en vóór bevestiging/finalisatie opnieuw beoordelen. Afdelingen, functies, kostenplaatsen en salarisstructuur zijn geen automatische blockers. Leg per check status, uitleg, brontabel/-service, mogelijke correctieactie en fase (pre-upload/post-parse) vast; maak geen tweede setupengine.

Na upload: bron-/jaar-/tijdvakdetectie → veilige officiële parser → werknemers-/IKV-analyse → kandidaatmatches `EXACT / PROPOSED / MANUAL_REVIEW / NEW` → veldverschillen per medewerker/IKV → rij-/veldselectie → read-only preview. Een PROPOSED match wordt **niet** stilzwijgend een importbestemming; expliciete menselijke beoordeling en duurzame binding zijn onderdeel van fase 2. Geen first name uit initialen, geen onzichtbare defaultcontracten en geen vermenging van één persoon/twee IKV's met twee personen.

**Fase-1-non-goals:** nieuwe live officiële XML-domainwrites, salarisschalen/arbeidsvoorwaarden muteren, Payroll Lab snapshotwrites, migration op gedeelde TEST-DB, actieve CAO-bench-testcohort muteren, nieuw identity-/permissionmodel, integratie met Nmbrs/MCP, nieuwe Payroll-calculations en productie-/Vercel-deployment. Een read-only nieuwe route of UI mag bestaand CONTROL01-staging-/finalisatiegedrag voor de interne synthetische fixture niet breken.

## 6. Zelfstandige eerste uitvoeringsslice: CONTROL02-P1

**Startgate:** ONE VERSION heeft een actueel gedateerd releasebesluit dat de relevante hosted checks afdekt; exacte remote `origin/main`-SHA en Vercel-sha/provenance gecontroleerd. Controleer of eerder gemelde Payroll-Production-envblokkade daadwerkelijk is opgelost. OPEN CONVERGENCE01-securityassertions blijven apart; raak bij blocker alleen noodzakelijke CONTROL02-code aan en presenteer geen ontbrekend bewijs als GREEN. Gebruik bij afwijking READ-ONLY PREP en STOP vóór nieuwe featurewrites.

**Verplichte output bij start (D0):**
- [ ] Volledige, tegen de **dan actuele** main-codegeverifieerde afhankelijksheidsmatrix met feitelijk geraakte paden/schema's en concrete gewijzigde/ongerichte eigenaars.
- [ ] Officiële bron-/schema-inventaris en bronvalidatiematrix met SOURCE_GAP wanneer van toepassing.
- [ ] Geformaliseerd en door parallelle Payroll-eigenaar beoordeeld read-only IncomeRelationship-/IKV-contract.
- [ ] Diff- en migrationlineage-check voor bestaande import-, Core-, benchmark- en acceptatieworktrees; raak andermans worktrees niet aan.
- [ ] Een eigen `work/CONTROL02-P1-<YYYYMMDD>` externe worktree vanaf exact geverifieerde main, met vastgelegde SHA, scope en grenzen.

**Uitvoering na D0:** minimale server-side readinessprojectie + gerichte unit-/permissiontests; jaar-/namespaceadapter voor echt beschikbare formele broncontracten + veilige parser- en semantische tests; bestaande HR Admin-wizard integreren zonder tweede module; analyse-/match-/previewtests die zero definite domain writes aantonen. Houd fase-2-finalisatie voor officiële XML fail-closed totdat contract, gezamenlijke migraties, reviewbinding en scoped TEST-writeacceptatie geaccordeerd zijn.

**Definition of Done voor CONTROL02-P1:**
1. Readiness klopt met actuele HR-groep/administratie/LhNr/periode-/permissiongegevens vóór en na relevante wijzigingen, inclusief GREEN/ORANGE/RED/GREY en correct ontbrekende nonblockers.
2. Een werkelijk beschikbaar officieel jaarschema/broncontract is veilig geparsed en aantoonbaar correct tegen zijn **eigen** versie; anders SOURCE_GAP met zinvolle fail-closed implementatie, nooit vals XSD-GREEN.
3. Een geanonimiseerd realistisch en een synthetisch multi-IKV-voorbeeld tonen één persoonsrij, meerdere afzonderlijke IKV's, correcte matching/conflicten/preview en **nul nieuwe definitieve Core-writes**.
4. Actor/scope- en direct-API-negatives: HR Admin permitted; manager, employee, cross-tenant, HR-groep-/adminforgery en stale permissions afgewezen; geen raw BSN/XML/log-/response-lekkage.
5. Bestaande CONTROL01 synthetic regressietests blijven slagen; gerichte nieuwe tests, typecheck, i18n, relevante lint, browser desktop/narrow + echte API-requests volgens AA-TEST. Geen onnodige volledige suite, behalve wanneer bewezen gedeelde blast radius dat vereist.
6. Indien benodigde officiële bronnen ontbreken: implementeer het aantoonbaar veilige deel, rapporteer exact geblokkeerde assertions `SOURCE_GAP`/`PARTIAL`, zonder modelwaarden of derdejaars XSD te substitueren.
7. Maak een schone, eigen commit en onafhankelijk LUNA MAX security-/domeinreviewverslag met bewijs, gewijzigde bestanden, open beslissingen en begrensde fase 2. Alle gespecialiseerde subagents **LUNA MAX**; geen stille downgrade als niet beschikbaar.
8. **STOP:** geen autonome main-merge, version bump, shared migration apply of Vercel-deployment.

**Fase 2** wordt pas afzonderlijk gestart na vastgesteld gedeeld IncomeRelationship-contract én expliciete coördinatie met CAO-BENCH02. Fase 2 omvat menselijke match-/veldkeuze, staged preview/confirm, safe atomic/resumable employee/assignment/employment-draft/IKV writes, audit, idempotency/races/readback, gerichte remote schemaacceptatie waar nodig en gezamenlijke convergence.

## 7. Documentatie/release-handoff

- Dit bestand en de gereconcilieerde `AA-MASTER-ROADMAP.md` zijn **concepten op een eigen docs-branch**, geen nieuwe canonieke AA-standaard. De codeworker kan ze als input gebruiken, maar checkt bij ieder inhoudelijk conflict de actuele AA op main.
- Alleen bij centraal goedgekeurde documentatieovername: selectieve file-/hunk-cherry-pick of handmatige diff boven de actuele main. **Geen volledige oude docs-branchmerge**; raak parallel `docs/aa-api-ai-20261002` niet aan.
- Schrijf het feitelijke nieuwe CONTROL02-slicebewijs bij de featurebranch in `docs/quality/acceptance/runs/`; de onafhankelijke review benoemt expliciet `BEDOELD/GEBOUWD/GETEST/RELEASED`. De releaseorchestrator bepaalt later de feitelijke shared TEST-release.
