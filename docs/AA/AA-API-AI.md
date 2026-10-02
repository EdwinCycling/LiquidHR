# AA-API-AI — LiquidHR API, MCP, WebMCP en ChatGPT-integraties

**Status:** DRAFT — inventarisatie en uitvoeringsplan; geen implementatieautorisatie  
**Datum:** 2026-10-02  
**Broncodebaseline:** EdwinCycling/LiquidHR, main @ cb73260ff0cd83d19fa29e44c9f0b93749fb10af  
**Werkbranch van dit document:** docs/aa-api-ai-20261002, rechtstreeks vanaf bovengenoemde main  
**Eigenaar productbesluiten:** Edwin / LiquidHR  
**Uitvoeringsgrens:** daadwerkelijk ontwikkelen pas na aantoonbare ONE VERSION GREEN en een afzonderlijke nieuwe worktree vanaf de dan geldige gezamenlijke main.

> Dit document beschrijft een apart product-/ontwikkelspoor in dezelfde LiquidHR-repository. Het is nog niet LEIDEND: de nieuwe AA-set is op de controledatum niet geïntegreerd in main. Markeer ontwerpkeuzen die nadere goedkeuring vereisen; behandel een eerder lokaal groen experiment niet als geïntegreerde productfunctionaliteit. Merge geen verouderde AA-branch. Wijzig geen gedeelde code of migraties vanuit dit documentspoor.

## 1. Bronnen, prioriteit en documentatieconvergentie

### Wel geverifieerd op main (2026-10-02)

- docs/architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md: interne /api/* is BFF, geen publiek versiecontract; apart /api/v1/* voorzien; externe auth, OpenAPI, rate limiting en idempotentie ontbreken bij die historische architectuurinventarisatie.
- docs/decisions/ADR-0010-ai-runtime-governance.md en FDR-0008-ai-capability-en-liquid-credits.md: bestaande AuthContext, server-only AI-runtime, onafhankelijk governance-/credit-/auditcontract en voorstel met menselijke beoordeling.
- docs/requirements/ai/ en docs/requirements/chatbot/HERA_AI_AGENT.md: uitvoerbare AI-foundation versus afzonderlijke HeRa-functionaliteit en bevestigingsflow.
- docs/quality/acceptance/runs/CONVERGENCE01-20260928.md: gedateerd bewijs inclusief TEST-release-update en openstaande security-/persona-/exportacceptatie.
- Bestaande codepaden en migrations genoemd in sectie 2. De code prevaleert voor wat daadwerkelijk is GEBOUWD; het acceptatierapport bepaalt wat GETEST is.

### Apart gelezen, maar nog niet canoniek

De documentatiebranch docs/aa-foundation-20260929 bevat AA-README, AA-REQ, AA-OP, AA-TEST, AA-REL, AA-NEXT, AA-ROAD, AA-CURRENT, AA-ACCEPT en AA-PAYROLL, plus docs/requirements/integrations/API_MCP_WEBMCP_CHATGPT_PROVIDER_DECISIONS_V1.md. GitHub-vergelijking op 2026-10-02: deze branch en main zijn gedivergeerd (53 commits ahead en 16 behind ten opzichte van main); de AA-map ontbreekt op main. Deze bestanden zijn **conceptreferenties, geen formeel aangenomen actuele standaarden**. Hun statuslabels binnen de bestanden overrulen dat niet.

**Na ONE VERSION-documentatieconvergentie:** herlees uitsluitend de dan daadwerkelijk op main goedgekeurde versies; actualiseer dit document waar nodig. Verwijs naar AA-REQ, AA-OP, AA-TEST, AA-REL, AA-CURRENT, AA-ACCEPT, AA-NEXT en AA-ROAD zodra die op main canoniek zijn. Herhaal hun algemene security-, werk-, test- of releaseregels hier niet. AA-PAYROLL is uitsluitend een referentie voor gedeelde grenzen; payrollproducten en fiscale ontwerpbesluiten blijven in hun eigen spoor. Neem het gestandaardiseerde AA-releaseproces pas over nadat zijn definitieve versie daadwerkelijk op main staat.

**Gesprekken:** eerder vastgelegde productscope en de aparte Payroll-/LiquidHR-gesprekken dienen als input voor ontbrekende productbesluiten, niet als bewijs van huidige code of acceptatie. De gedeelde ChatGPT-sharelinks waren tijdens deze inventarisatie niet volledig als bron op te halen; de op de documentatiebranch gereconstrueerde integratiebesluiten moeten daarom vóór implementatie tegen de oorspronkelijke besluiten worden afgevinkt.

## 2. Code- en contractinventarisatie op main

| Onderdeel | Gevonden op gecontroleerde main | Status en grens |
| --- | --- | --- |
| Auth/context | apps/hr-suite/lib/auth/permissions.ts; AuthContext, requirePermission, requireHrGroupId; context/server-context | GEBOUWD; enige bestaande sessie-/rol-/scopebron voor de webapp. Externe delegatie nog ontwerpen, niet nabootsen met browsercookie |
| Interne API | apps/hr-suite/app/api/ met bestaande /employees, /employments, /talent, /hera, /insights, /payroll/import, enz. | GEBOUWD; BFF, niet rechtstreeks publiek maken. Historische telling van 112 route handlers uit juli is geen actuele telling |
| HeRa | lib/hera/tool-registry.ts, read-tools.ts, action-drafts.ts, context.ts, orchestrator.ts; app/api/hera/* | GEBOUWD; expliciete bestaande read-tools o.a. zoeken medewerkers, zichtbaar dienstverband, organisatie en geaggregeerde salarisvraag. Niet automatisch veilig/publiek voor alle kanalen |
| AI Foundation | lib/ai/contracts.ts, runtime.ts, orchestrator.ts, feature-registry.ts, provider-resolver.ts, settings-service.ts, supabase-*, durable-recovery.ts | GEBOUWD; runtime/credits/governance/audit/safety hergebruiken waar een LiquidHR-AI-invocation plaatsvindt |
| Huidige featurecatalogus | improve-existing-hr-text, EMPLOYEE_SUMMARY, CONVERSATION_PREPARATION, DEVELOPMENT_GOAL_SMART, VACANCY_DRAFT, TEAM_SUMMARY | Registry bestaat; productbeschikbaarheid in code is geen volledige live personaacceptatie |
| AI-kanalen | employee AI summary/conversation/voice routes, team AI voice, HeRa-chat, instellingen/AI | GEBOUWD; nieuwe externe kanalen mogen geen tweede agentkern of memory-/permissionlaag introduceren |
| Nmbrs | migration 20260908203016_payroll_p1_nmbrs_connection.sql op main; generieke providerverbinding-/company-datafundering daarin zichtbaar | De expliciet op 'nmbrs' benoemde migratie is aanwezig; een volledige actuele Nmbrs runtime/OAuth/hosted E2E-acceptatie is hiermee niet bewezen. Scan alle generiek genaamde payrollprovider-services en relevante branches voordat iets wordt toegevoegd |
| Nieuwe externe API | Geen /api/v1/*-route aangetroffen in de complete git-tree-scan van deze main | NIET AANGETOOND; eerst contract- en route-inventaris, daarna pas nieuwe slice |
| MCP-server / geïntegreerde WebMCP / ChatGPT-app | Geen gelijknamige geïntegreerde productpaden aangetroffen op de gecontroleerde main; .mcp.json in repo is geen product-MCP-server | NIET AANGETOOND; aparte WebMCP Challenge-repo/-demo niet verwarren met geïntegreerde productacceptatie |
| Payroll Lab | packages/payroll-engine ontbreekt op main; in de aparte Payroll-worktree is de engine lokaal getest | Parallel bounded context; niet op basis van lokaal bewijs publiek ontsluiten |

### Status van ONE VERSION

Op 2026-10-02 staat main op cb73260ff0cd83d19fa29e44c9f0b93749fb10af met TEST-release 1.20260928.1 volgens de releasehandoff en de aparte AA-CURRENT-conceptstatus. Het op main aanwezige CONVERGENCE01-rapport kent nog een TEST-release-update met OPEN acceptance. Uitstaande bewijzen zijn onder meer Control forged scopes/invitations/AUDITOR, Insights directe API en CSV-inhoud, en AI live persona, enablement-toggle en scope-revocation. **ONE VERSION mag voor dit spoor niet als volledig GREEN worden aangemerkt totdat de actuele formele acceptatie dit expliciet bewijst.** Niet opnieuw de bestaande synthetic payrollfoundation onderzoeken.

## 3. Productsysteem: één servicegrens, meerdere kanalen

Overeengekomen ontwerpprincipe: één getypeerde catalogus van LiquidHR-businessoperaties, als dunne façade op de *bestaande* geautoriseerde domeinservices. De façade specificeert naam, semantiek, inputschema, outputprojectie, minimaal noodzakelijke permissions, tenant/HR-groep/administratie/subjectscope, dataclassificatie, errors, audit en eventueel bevestiging/idempotentie. **Inventariseer vóór creatie** welke HeRa-tools, bestaande services en contracts al volledig geschikt zijn; verplaats ze niet preventief.

Kanalen en vertrouwensgrenzen:

1. Interne LiquidHR-webapp: bestaande BFF, normale door de server geverifieerde browsersessie.
2. Reguliere externe API: eigen expliciet versiecontract onder /api/v1/*; externe client-/gebruikersautorisatie, gevalideerde actor/delegatie, minimale scopes; geen rechtstreeks doorgeven van een browsercookie als partneridentiteit.
3. Remote MCP: eigen transport-/clientidentificatie en OAuth-delegatie; tools mappen op dezelfde servicefaçade; verifieer actuele permissions **per toolcall**. De precieze MCP HTTP-transportvorm en autorisatie-/tokenmodel worden gevalideerd tegen de actueel ondersteunde specificatie.
4. WebMCP: browsergebaseerde, bij runtime ontdekte capabilities via de geldige geverifieerde LiquidHR-sessie. Browseragent/JS levert geen vertrouwde actor, employee- of HR-groepsscope; iedere uitvoering gaat alsnog door de bestaande serverautorisa­tie. Feature-detecteer de actuele WebMCP-browser-API; de community-draft is veranderlijk.
5. ChatGPT-app (Apps SDK): een extra UI- en conversatiekanaal op de remote MCP-tools, niet een tweede HeRa, niet een extra database-toegangspad en niet automatisch een browserextension. Exact OAuth/distributie, privacyafspraken en ondersteunde accounttypen eerst valideren.

Logisch pad: kanaaladapter -> inputvalidatie/clientauth -> bestaande identity/delegation naar gecontroleerde actor -> servicefaçade -> hergebruik domeinautorisatie en governance -> domeinservices -> alleen toegestane outputprojectie. Alle externe terugkoppeling en logging zijn dataminimaal. Modelinstructies en data uit documenten zijn nooit permission-granting input.

**Belangrijk onderscheid in creditgebruik:** als een read-only MCP/ChatGPT-tool alleen deterministische HR-data ophaalt, is niet automatisch een nieuwe Liquid-Credits-charge gerechtvaardigd. Als een LiquidHR-eigen AI-capability wordt aangeroepen, gaat die uitsluitend via de bestaande runtime en het bestaande creditscontract. Product-/commercieel besluit voor extern kanaalgebruik blijft open; geen nieuw prijsmodel verzinnen.

## 4. Gekozen functionele scope en uitgestelde voorstellen

### Eerste gemeenschappelijke read-only catalogus: Workforce Assistant

De eerdere functionele keuze is een bescheiden MVP met drie logisch getypeerde tools, niet het opnieuw publiceren van de hele interne /api/*:

- get_workforce_summary — samenvatting van *de op dat moment zichtbare* medewerkers-/teamscope, met gecontroleerde peildatum en filters;
- get_team_skills — toegestane teamvaardigheden, competenties en ontwikkelbehoeften, pas wanneer onderliggende Talent-data en bestaande autorisatie verifieerbaar beschikbaar zijn;
- get_development_plans — toegestane ontwikkelplannen met status/open acties; nooit plannen van buiten de actuele subject-/teamscope.

Antwoorden bevatten bron, zichtbare populatie, peildatum, filters, relevante onzekerheid en links naar geautoriseerde LiquidHR-schermen. Onderliggende velden, small-cell-privacy en rolgeschikte samenvattingen krijgen expliciete contractacceptatie vóór externe blootstelling. Als een Talent-onderdeel nog alleen gepland is, blijft de desbetreffende tool geblokkeerd of afgebakend; genereer geen fictieve data of nieuwe Talentfunctionaliteit om de integratie te vullen.

**ChatGPT MVP:** read-only Workforce Assistant met deze tools via dezelfde MCP-server. Interactieve kaarten/dashboards zijn een latere UX-slice, geen voorwaarde om ongemerkt schrijfrechten te introduceren. De app bewaart geen tweede LiquidHR-user-/HR-memory.

**Geïntegreerde WebMCP MVP:** dezelfde drie read-tools waar de webapp die al rechtmatig ondersteunt. De aparte historische Challenge-demo 'Prepare my development conversation' met find_employee -> get_development_context -> prepare_development_conversation -> add_follow_up_action en menselijke Review & save is een *latere* ontwerpoptie; zijn dynamische toolbeschikbaarheid is geen huidige geïntegreerde garantie. De laatste Save blijft een afzonderlijke menselijke actie.

**Niet in MVP:** willekeurige HR-writes, autonome HR- of salarisbeslissingen, een uitgebreide ChatGPT-sidebar, generieke agent met onbeperkt datatoegang, automatische ontwikkelplannen of gesimuleerde toekomstige modules.

### Externe payrollprovider

Nmbrs blijft provider #1. Beoordeel en hergebruik de bestaande generieke payrollproviderfoundation vóór nieuw werk. De eerder vastgelegde route is P0 generiek contract zonder externe calls; P1 OAuth + company discovery/binding/health, zonder medewerkers-/salarisdata; P2 handmatige read/compare; P3 afzonderlijk beoordeelde preview en gecontroleerde import; P4/later change detection, synchronisatie en eventuele outbound acties. Maximaal één actieve payrollprovider per HR-groep, deelname waar afgesproken per dienstverband. Loket, AFAS en Exact zijn uitbreidingsvoorbeelden, geen gekozen provider #2. Externe Nmbrs-integratie en de eigen Payroll Lab-engine mogen contractueel niet worden samengevoegd zonder nieuwe expliciete beslissing.

### Latere, afzonderlijk te besluiten scopes

Schrijfacties volgen uitsluitend servergebaseerde proposal -> review-/controlekaart -> expliciete *actuele* bevestiging -> herautorisatie -> bestaande domeinservice, met idempotentie, audit en veilige rollback/recovery. Webhooks/events, automatische agents, nieuwe providers en write-toolcatalogi zijn geen onderdeel van de eerste release.

## 5. Architectuurbesluiten die nog ontbreken

Blokkeer geen documentatie op deze vragen; **blokkeer wel de bijbehorende implementatieslice**:

| ID | Ontbrekend besluit / bewijs | Moet vaststaan vóór |
| --- | --- | --- |
| D-01 | Formele overname van de juiste, actuele AA-set in main en ONE VERSION volledige security-GREEN met bron-SHA | Alle nieuwe implementatie |
| D-02 | Werkelijke code-eigenaren/dependencygraph van HeRa, AI-runtime, talent, workforce en payrollprovider; welke bestaande service voor elk van drie tools | Servicefaçade of nieuwe routes |
| D-03 | Externe client-/delegatie-identiteit: user consent, tenant/group-administratiebinding, scopes, lifecycle, revoke, tokenopslag en OAuth-contract; geen tweede onafhankelijk HR-auth-model | Externe API en remote MCP |
| D-04 | Eerste /api/v1 read-resources en outputprojecties, OpenAPI-versiebeheer, paginering, foutcontract, filtering en privacy-/small-cell-regels | Externe API |
| D-05 | MCP-transport/OAuth-resource metadata, audience-check, tokenvernieuwing, client-testmatrix en Vercel request/streaminglimieten op actuele runtime | MCP live |
| D-06 | ChatGPT Apps SDK distributie/auth/privacy/tenantkoppeling en toepasselijke account-/regiobeschikbaarheid | ChatGPT app E2E |
| D-07 | WebMCP actueel ondersteund browseroppervlak en gekozen productjourney na de eerste read-tools | WebMCP activering |
| D-08 | Extern toolgebruik versus eigen AI-compute: wanneer exact Liquid Credits, toestemming/zichtbaarheid, beperkte logging en kostenplafonds | AI-toolcalling buiten webapp |
| D-09 | Nmbrs P0/P1 werkelijk op main versus eerdere branches en gedateerde acceptance; geen OAuth- of providercode dubbel bouwen | Nmbrs-wijzigingen |
| D-10 | Eerste externe writes, webhook-/eventsemantiek en provider #2 | Alleen latere fases |

Documenteer elk antwoord in de passende bestaande ADR/FDR/requirement na productgoedkeuring; deze tabel is het besluitregister, niet stilzwijgende goedkeuring.

## 6. Iteratieve uitvoeringsvolgorde en afhankelijkheden

| Iteratie | Levering en grens | Afhankelijk van | Acceptatie voor STOP |
| --- | --- | --- | --- |
| APIAI-D0 — discovery/documenten | Complete contractmatrix en bestaande code-/migrationinventaris; onderscheid BEDOELD/GEBOUWD/GETEST/RELEASED; dit document reconciliëren met uiteindelijk goedgekeurde AA-set | Huidige main lezen; geen GREEN nodig voor uitsluitend documentatie | Elk bestaand tool-/service-/permissionpad is expliciet herkend; open besluiten benoemd; geen code of gedeelde schemawijziging |
| APIAI-01 — API-fundament | Minimale, versieerbare externe read-only API met expliciet goedgekeurde clientauth, schema's, OpenAPI, scope, bounded paginering/errors, audit/rate limits | D-01 t/m D-04; eigen nieuwe externe worktree vanaf dan actuele main | Contract/golden/negative tests; forged tenant/group/admin/subject, stale/revoked scopes, auth-errors en geen PII-overexposure; werkende echte HTTP-tests |
| APIAI-02 — read-toolfaçade | Hergebruik geautoriseerde services; in-scope Workforce Assistant-toolset, desnoods kleiner totdat alle onderliggende features klaar zijn | APIAI-01 en actuele Workforce/Talent-data-/permissioncheck | Zelfde toegestane resultaten en scope in BFF versus toolfaçade; geen shadow auth; no-data/missing-capability correct; bron/filter/peildatum bewezen |
| APIAI-03 — remote MCP | Read-only server op goedgekeurde façade met gedocumenteerd transport/delegatie; geen nieuwe HR-/AI-businesslogica | APIAI-02, D-03/D-05, Vercel runtime proof | tools/list en echte tools/call via geauthenticeerde remote client; expired/revoked/wrong-audience tokens falen; cross-scope negatives; output-minimalisatie |
| APIAI-04 — ChatGPT Workforce Assistant | Apps SDK-integratie op dezelfde remote MCP, read-only functioneel MVP, links naar LiquidHR | APIAI-03, D-06, distributie-/privacyreview | Echte end-to-end test van drie toegestane vragen waar brondata bestaat; denied scenarios en disconnect/reconnect; geen tweede memory/auth, geen HR-mutaties |
| APIAI-05 — geïntegreerde WebMCP | In de LiquidHR-webapp geregistreerde browser-readtools, feature detection en veilige fallback; geen aparte browser-backend | APIAI-02, D-07, actuele browser-/agent-support | Echt browser-agentpad op één ondersteunde configuratie; scope bij iedere call opnieuw; uitgeschakelde capabilities verdwijnen/falen dicht; normale UI blijft bruikbaar |
| APIAI-06 — nieuwe writes/events (nog niet geaccordeerd) | Alleen na afzonderlijke product-/securityscope met menselijke review en idempotente uitvoering | Alle relevante voorgangers plus D-10 | Nieuwe, aparte acceptance- en releasegate; nooit automatisch doorwerken vanuit read-only |

**Parallel Nmbrs:** inventariseer bestaande providercontracten in D0; laat P0/P1 alleen als eigen, niet-conflicterende slice lopen. P2/P3 en APIAI-integraties met gedeelde Core-/Control-/dienstverband-/IKV-objecten vereisen een gezamenlijk dependencyplan en geserialiseerde integratie.

**Parallel Payroll Lab:** zijn pure engine en eigen Lab-database blijven bij Payroll. Geen direct lezen/schrijven in de Payroll Lab-database vanuit nieuwe externe kanalen; toekomstige payrollfacade uitsluitend na expliciete payroll-API/projectiecontracten. Geen wijziging van gedeelde architectuur, auth, Core-contracten of migrations zonder afstemming; ook niet 'even' voor een eenvoudiger MCP-call.

## 7. Security, privacy en Vercel als ontwerpgrenzen

- Elke kanaalactie valideert actor, tenant, HR-groep, administratie, rol/capability én record-/teamscope server-side bij uitvoering. De caller, het model, de browser en een eerder toegekende OAuth-scope kunnen die actuele controle niet overslaan. Een ingetrokken sessie/permission/feature geldt bij de eerstvolgende relevante toolcall.
- Bestaande RLS/grants en domeinservices blijven defense in depth. Er is geen rechtstreeks Supabase-kanaal voor MCP, ChatGPT of WebMCP. Service-role mag uitsluitend binnen de bestaande zorgvuldig afgebakende serverrepositories worden gebruikt.
- Voor read-only tools: filter responsevelden, begrens aantallen, vermijd gevoelige identifiers en blootstelling via aggregaties, voorkom indirecte recordenumeratie, registreer correlatie zonder prompts/HR-payloads/secrets.
- Voor LiquidHR-eigen AI-invocations: bestaande governance, quota, budget, reservation/settle/release, recovery en gescheiden technische usage/business audit blijven leidend. Verwerk onbekende documenten en modelinstructies uitsluitend als niet-vertrouwde data.
- Valideer MCP-/Apps-SDK-/WebMCP-versies opnieuw vlak vóór code: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization , https://developers.openai.com/apps-sdk/ en https://webmachinelearning.github.io/webmcp/. WebMCP is op deze peildatum een veranderende community-draft; geen verouderde browser-API zonder featuretest vastzetten.
- Host nieuwe kanalen bij voorkeur passend bij bestaande Vercel-monorepo maar kies een nieuw project/subdomein of bestaande HR-app-route pas na een concreet deployment-/auth-/transportbesluit. Bevestig per-connection overhead, requestduur, eventuele streaming, cold starts, logredactie en OAuth-callbacks in een werkende Vercel-proef. Geen ongeteste aanname dat remote MCP langdurige processen binnen serverless limieten kan uitvoeren.
- LiquidHR heeft één operationele synthetische TEST-omgeving; Vercel 'Production' is voor dit product een deploykanaalnaam. Product- of authrestricties mogen niet worden opgelost met een tweede onbeheerde omgeving.

## 8. Test- en acceptatiecontract

Gebruik na formele overname de dan canonieke AA-TEST en AA-ACCEPT; dupliceer hier geen algemeen testbeleid. Dit spoor voegt alleen de volgende kanaalspecifieke assertions toe:

1. Eén actor met toegestane context krijgt inhoudelijk overeenkomende, gescopeerde resultaten via de gereed zijnde kanalen; outputprojecties mogen bewust per kanaal verschillen.
2. Verkeerde tenant, HR-groep, administratie, actor, medewerker/team, ontbrekende permission, vervallen token en door de client vervalste scope weigeren op de echte serverroute en MCP-toolcall. Een verborgen UI-element is geen serverbewijs.
3. Feature-toggle of permission na een succesvolle sessiestart uitschakelen: de volgende toolcall weigert daadwerkelijk; trusted recovery/accounting van eerder uitgevoerde AI-acties blijft veilig mogelijk.
4. OpenAPI/typed schemas, backwards-compatible contractversies, begrensde filters/page limits, consistente errors en rate-/abuselimieten zijn met echte HTTP-calls getest. Idempotency is verplicht zodra mutaties later formeel worden toegevoegd.
5. De ChatGPT-app en ondersteunde WebMCP-browserflows krijgen echte consent-/auth-/scope-/disconnect-/regressiebewijzen. Een aparte Challenge-demo, unit-test of lokale mocks gelden niet als volledige geïntegreerde browser-E2E.
6. Voor eigen AI-aanroepen: gecontroleerde kosten/credits, providerfailures, redacted telemetry, business audit en duurzame recovery volgens bestaande AI-standaarden. Voor louter deterministische reads geen fictieve creditcharge toevoegen.
7. Security en privacy: geen raw HR-dumps, tokens, service-role-credentials, BSN, gezondheids-/verzuiminformatie, onnodige salarisdetails of prompts in tooloutput, logging of testfixtures.
8. Alleen expliciet aangetoonde in-scope groene resultaten heten GREEN; documenteer ontbrekend live bewijs als PARTIAL/ENVIRONMENT-GATED volgens de uiteindelijk goedgekeurde AA-regels.

## 9. Start-, stop- en releasevoorwaarden

**Nu toegestaan:** broninventaris, vergelijking huidige main en andere branches, deze documentatie voorbereiden, ontbrekende beslissingen benoemen, ontwerp/acceptatie specificeren; geen productiefeature of gedeelde migration uitvoeren.

**Startcode pas wanneer alle voorwaarden aantoonbaar gelden:**
- ONE VERSION heeft volledige, relevante GREEN-acceptatie; controleer aan de hand van een nieuw actueel main-SHA en gedateerd bewijs, niet alleen een READY TEST-deployment;
- definitieve AA-documenten zijn formeel geïntegreerd op main en deze conceptversie is daarop gereconcilieerd;
- scope, D-03/D-04 en eerste concrete toolcontracten zijn bevestigd;
- afzonderlijke externe worktree en branch vanaf de *nieuwe* gezamenlijke main zijn aangemaakt; Payroll-dependencies en eigenaarschap zijn gecontroleerd.

**Per featurebranch:** geen autonome main-merge, version bump, deploy of remote gedeelde migration. Alleen de goedgekeurde gebonden scope implementeren, relevante tests uitvoeren, bewijs/risico's rapporteren en stoppen. **Bij convergence:** uitsluitend het op dat moment formeel geaccordeerde AA-releaseproces hanteren, inclusief één gezamenlijke releasegate op de uiteindelijke productcode, remote migrationlineage en aantoonbare security-/personaacceptatie. Niet zelf de oude AA-branch mergen en nooit op een verouderde baseline een release uitvoeren.

## 10. Directe eerstvolgende documentatieacties

1. ONE VERSION-afronding afwachten als **implementatievoorwaarde**, niet als blokkade voor documentatie; vervolgens de goedgekeurde AA-bestanden op main vergelijken met dit concept.
2. D-02 code-/contractmatrix verdiepen per geselecteerde workforce/skills/plan-tool, plus generiek genaamde Nmbrs providerflows op alle relevante branches; expliciet labelen wat door deze eerste git-tree- en bestandsinventarisatie nog niet is aangetoond.
3. Open besluiten D-03 t/m D-09 afbakenen in bestaande ADR/FDR-/requirementstructuur en laten accorderen voordat de betrokken slice start.
4. Pas na de GREEN-gate de eerste implementatie-worktree vanaf de dan huidige main aanmaken. De huidige docs-branch is nadrukkelijk **geen** implementatieworktree.
