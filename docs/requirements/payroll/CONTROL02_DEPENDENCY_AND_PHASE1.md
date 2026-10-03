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


## 8. Read-only contractreview 2026-10-03 — nieuwe concrete P0/P1-gates

**Provenance:** CONTROL02 read-only rapportage van 2026-10-03 11:53 UTC, aangevuld met een beperkte GitHub-codecontrole op `main=6349d02538351cd01fc51f298c6e6fa0ba88006c`. **Dit zijn analyses/reviewbevindingen, geen uitgevoerde nieuwe regressie-, remote migration- of hosted tests.** Twee onafhankelijke LUNA MAX-reviews zijn in de CONTROL02-overdracht gerapporteerd; de gevraagde afzonderlijke Payroll-eigenaarreview is nog **NIET** uitgevoerd of gedeeld. De lokale checkout van de uitvoerende agent liep achter en `.git/FETCH_HEAD` was niet schrijfbaar; maak geen codeworktree vanaf die verouderde checkout en wijzig geen gedeelde Git-permissies om dit te omzeilen.

### 8.1 Bevestigde bestaande codepaden met een onbesliste domeinbetekenis

| Gate | Aangetroffen code of gemelde schemacontractreview | Verplicht besluit/bewijs vóór shared writes |
| --- | --- | --- |
| IKV-key/unique | `matching.ts` / `validation.ts` gebruiken op batchniveau `LhNr:IKV` zonder bronpersoon; `service.ts` zoekt op tenant, administratie, employee, subnummer, IKV en bewaart `income.payroll_tax_number.slice(-2)`. De review meldt een actieve DB-unique op `(tenant, employee, ikv_number)`. | Payroll- en Core-eigenaar leggen samen de echte unieke identiteit en effectieve historie vast, inclusief bronpersoon, volledige LhNr vs subnummer, correcties en per-administratie-index. Geen door CONTROL02 zelf verzonnen sleutel. |
| Employment-link | Het canonieke importmodel heeft nog geen gekozen `employmentId`; huidige `finalizePayrollImport` maakt een Employment met defaults en eerste IKV-startdatum. | Niet automatisch Employment koppelen, aanmaken, publiceren of arbeidsvoorwaarden/salaris invullen vanuit alleen XML-datums; separaat expliciet bevestigde bestaande of veilige draft-relatie. |
| Datumsemantiek | Bestaande `service.ts` kopieert `income.ends_on` direct naar `employment_income_relationships.valid_until`; de overdracht meldt halfopen `[valid_from,valid_until)` in Core maar inclusive XML-broneinddatums zijn nog te bewijzen. | Per ondersteund jaar brondefinitie, Core halfopen periode en eventuele gecontroleerde omzetting specificeren/testen, met 1-daagse periode en einddatumgrenzen. Geen link-write vóór bewijs. |
| HR-groep en BSN | Productmodel: employee uniek per HR-groep. Review meldt tenantbrede BSN-fingerprint-unique; staging-FK voor `matched_employee_id` bevat `(tenant_id, matched_employee_id)`, geen `hr_group_id`. | Core/security-eigenaar definieert HR-groepidentiteit en geautoriseerde matchstrategie inclusief cross-group negatives, migratie-/constraintimpact en echte beschermde fingerprintberekening server-side. Geen klantfingerprint uit aangeleverde bron of client vertrouwen. |
| XML-writegrens | `source-adapter.ts` weigert momenteel `LOONAANGIFTE_XML`; `finalizePayrollImport` leest batch maar bevat geen expliciete `source_type`-weigeringsregel. `source_type`, `matched_employee_id` en matchstatus zijn niet per definitie onveranderlijk wanneer stagingwijzigingen toegestaan zijn. | **P1-securityvoorwaarde:** een actuele, server-side fail-closed check op opslaggebonden, niet-manipuleerbare bronherkomst/versie bij finalize, recovery en alle gerelateerde API-/RPC-paden. Staging-origin en bindende keuzes DB-side beveiligen of gelijkwaardig afdwingen; UI-disabling telt niet. |
| PROPOSED/NEW | `validation.ts` markeert `PROPOSED` als warning. De bestaande finalizer accepteert niet-blocking/geen MANUAL_REVIEW selectie; de wizard selecteert die rijen standaard. | Geen geautomatiseerde voorgestelde persoons- of employmentkoppeling; server-side duurzame menselijke bevestiging voor iedere niet-EXACT match en elke nieuwe Employment vóór volgende definitieve fase. |
| Historische LhNr-binding | `service.ts` kiest de primaire administratie-LhNr-binding met `new Date()` en actieve datumfiltering. | Readiness, parse en match controleren de volledige relevante bronperiode tegen geldige LhNr-binding en detecteren ambiguë overlap. Historisch jaar/tijdvak is beslissend, niet 'vandaag'. |
| Finalisatieherstel | CONTROL01 heeft bestaande recovery, maar afzonderlijke Employee-/Employment-/IKV-writes kunnen gedeeltelijk plaatsvinden. | Fase 2 ontwerpt expliciete atomiciteit of veilig resumable ledger, idempotency/races, immutable user decision binding, fail-state en database-readback. Groen batchresultaat maskeert geen ontbrekende kernrelaties. |

### 8.2 Aangescherpte uitvoering CONTROL02-P1

De eerder beschreven read-only fase 1 blijft de productgrens. **Voor eventueel echte XML-staging is deze grens strikter dan uitsluitend 'geen finalize-knop':**

1. Implementatie vindt pas plaats vanaf de dan actuele, schrijfbaar gesynchroniseerde nieuwe main-worktree, wanneer de formele relevante ONE VERSION-releasegate daadwerkelijk is afgetekend. In de gecontroleerde repository staat `ONE-VERSION-20261002.md` nog op `RELEASE IN PROGRESS` met PENDING hosted-evidence ondanks dat de merge op main staat; central release-owner moet het juiste bewijs afronden.
2. Bepaal per ondersteund bronjaar/namespace de **daadwerkelijk ontvangen** officiële XML/XSD-archieven, checksum, releaseversie en technische herkomst. Op de gecontroleerde main ontbreekt een representatieve formele XML-/XSD-fixture; `SOURCE_GAP` mag alleen na concreet inventariseren. 2026-gegevensspecificatie is geen 2026-XSD; 2027-schema is geen 2026-schema. Geen aannames over elementpad, XML-betekenis of inclusieve datumgrenzen.
3. Stap 1: readiness en officiële XML-parser/normalizer als veilige *in-memory analyse* bovenop bestaande services; geen nieuwe payroll-/Core-schema- of domainwrites. Waar mogelijk kan read-only wizard-/preview-integratie alvast worden ontwikkeld zonder schema-aanpassing.
4. **Alleen als staging nodig is** voor gecontroleerde batchflow: bind `source_type`, bronjaar, namespace/schemaversie, veilige bronhash en relevante actor-/administratiescope aan een niet-manipuleerbare server-/DB-autoritatieve batch; zorg dat bron/type, matchstatus en gekozen employee niet ongeautoriseerd veranderbaar zijn. Bewijs server-side dat `LOONAANGIFTE_XML` niet door bestaande `finalize`, recovery, rechtstreeks API-/RPC-aanroep of stagingmanipulatie kan gaan zolang de fase-2-acceptatie ontbreekt. Geen remote migration in deze featurebranch zonder expliciete centrale toestemming.
5. Onderbouw time-effective LhNr-controle, tenant-/HR-groeps-isolatie en protected identifier-afleiding op echte serverrechten. Een externe bron kan een BSN geven, maar **geen reeds berekende 'vertrouwde' fingerprint** aanleveren. Bewaar/retourneer/log geen ruwe BSN's, XML of herleidbare identificatie.
6. Maak nul definitieve Employee-, assignment-, Employment-, IKV-, employment-IKV-link-, salary- en labor-conditionswrites via **alle** XML-paden. Behoud en regressietest het bestaande CONTROL01-synthetische gedrag; eventuele noodzakelijke reparaties daaraan zijn afzonderlijk af te bakenen, niet stilzwijgend nieuwe XML-finalisatie.
7. De onafhankelijke Payroll-ownerreview van het getypeerde IKV-/effectivitycontract blijft `OWNER_REVIEW_PENDING`. Draag uitsluitend de minimaal noodzakelijke, niet-persoonsgebonden contractvraag over na expliciete autorisatie voor een ander gesprek/werkspoor. Laat die review geen parallelle Core-write of automatische contractwijziging in deze branch veroorzaken.

### 8.3 Extra negatieve acceptatieclaims

- Forged `source_type`, mutable staging values, forged employee match en direct HTTP finalize/recovery op XML-batches resulteren altijd in bewezen **nul definitieve Core-writes**.
- Zelfde `LhNr:IKV` bij verschillende bronpersonen is niet op zichzelf een bewezen duplicaat totdat de canonieke key is vastgesteld; één bronpersoon met twee IKV's blijft één medewerker.
- Historisch geldige maar vandaag verlopen LhNr-binding wordt tegen het bronjaar/tijdvak beoordeeld; historisch ongeldige binding en overlappende conflicterende bindings worden veilig gemeld.
- Fake/cross-group `matched_employee_id` is geweigerd zowel in service-/routeautorisation als in relevante RLS/FK-/RPC-contracttests.
- Een 1-daagse IKV-periode, ontbrekende `employmentId`, bestaande parallelle Employments en PROPOSED-matches leiden **niet** tot een ongedocumenteerde link-, contract- of persoonswrite.
- Retry na geweigerde XML-finalisatie, herhaalde analyse en eventuele toegestane staging levert geen duplicaten of leakage op.
- Bewijs onderscheidt `GEBOUWD`, `GETEST` en `RELEASED`; de bestaande gerapporteerde LUNA MAX-analyses tellen als review, niet als nieuwe uitgevoerde tests.

**Stopcriterium:** zonder immutable provenance + daadwerkelijk geteste server-side XML-writegrens geen XML-staging of live XML-bronacceptatie activeren. Zonder geaccordeerd gedeeld IKV-/employee-/employment-/datumcontract **geen** CONTROL02 fase-2-domainwrites. Gemis aan een officiële bron blijft `SOURCE_GAP`, niet een generiek groen XML-label.


## 9. Vergrote CONTROL02-bouwslag — expliciete productuitvoeringskeuze 2026-10-03

**Deze sectie vervangt uitsluitend het oude organisatorische stopmoment 'P1 opleveren en daarna een aparte bouwopdracht voor fase 2'.** De veiligheidsvoorwaarden uit §2–§8 blijven onverkort geldig. Uitvoeringsscope is nu **één substantiële CONTROL02-featurebranch met parallelle LUNA MAX-subagents**, met gescheiden contractgates *binnen* dezelfde uitvoeringsronde, niet een eindeloze read-only oplevercyclus. Uitvoering alleen wanneer de actuele gezamenlijke releasebeslissing volgens AA-REL is aangetoond; een verouderd pending-rapport en een technisch aantoonbare deployment moeten door de releaseowner worden gereconcilieerd.

Orchestrator verdeelt de parallelle arbeid over: (A) officiële bron-/jaaradapter en XML-beveiliging; (B) server-side readiness en historische LhNr-binding; (C) matching, multi-IKV en veldconflicten; (D) HR Admin-wizard, responsive NL/EN en bestaande autorisatie-aware UI; (E) onafhankelijke security/QA/browseracceptatie. Eén integrator beheert gedeelde importservices en het eventueel latere finalisatiepad; twee agents schrijven nooit tegelijk dezelfde Core-/service-/migrationbestanden. Alle gespecialiseerde subagents worden expliciet op **LUNA MAX** ingesteld.

**Fase-gates binnen deze ene grotere branch:** bouw eerst A–D parallel met echte read-only parsing/preview en server-side veilige XML-finalisatieblokkade. Bij aantoonbare immutable source-provenance, geverifieerde bron/XSD-versie, beschermde identiteit, secure staging en uitsluitend na gedeelde **Payroll-/Core-ownerreview** van IKV-key/effectivity/HR-groepidentiteit mag dezelfde orchestrator fase-2-implementatie van menselijke matchbevestiging, gekoppelde Employment-keuze, atomische of veilig resumable writes, audit en recovery laten bouwen. Ontbreekt ownerakkoord, voorkom dan dat alleen dat onderdeel de overige bouw-, test- en UI-stappen stopt: bouw de onafhankelijke werking af, test de volledige veilige previewflow en rapporteer finalization als **WAITING FOR SHARED CONTRACT** in plaats van een onterechte algemene GREEN.

**Testen en defectherstel horen in de bouwslag zelf:** kies met PowerShell de eerste vrije loopbackpoort in 3013–3099 en laat het bestaande `scripts/start-test-worktree.ps1 -Mode Development -Port <port> -PreflightOnly` deze onafhankelijk bevestigen; start vervolgens op exact die poort. Geen bestaande processen stoppen. De launcher leest uitsluitend de centraal goedgekeurde `%LOCALAPPDATA%\\LiquidHR\\TestRuntime\\.env.local` en onthult geen geheime waarden. Gebruik de bestaande normale lokale TEST HR Admin-auth; gebruik de bestaande rolwisselaar alleen wanneer de development-/canonical-TEST-/featurechecks en echte rolrechten slagen. Test Manager/Employee/forged scopes anders via reeds aanwezige harness/API-negatives; geen nieuwe fake-rollen of afwijkende identityflow. Desktop en 390 px, directe API, relevante migratie-/RLS-contracttests, betrouwbare synthetische en geanonimiseerde fixtures, één echte browsertest voor de werkende flow. Voer bij defecten reproduce → root cause → minimale fix → gerichte regressie → opnieuw browsercontrole uit. Eén full suite uitsluitend bij bewezen brede blast radius of pas in de centrale convergence/release volgens AA-TEST. Schone featurecommit, gedateerd bewijs en onafhankelijke LUNA MAX-review.

**Nog altijd verboden:** autonome merge naar `main`, version bump, Vercel-deployment, ongeautoriseerde gedeelde remote migration, tests op Payrolls actieve benchmarkcohort of onbewijsbare XML-/complianceclaims. Fase-2-writes niet inschakelen wanneer een P0-contract of noodzakelijke beveiligingsassertion ontbreekt.
