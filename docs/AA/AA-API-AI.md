# AA-API-AI — Externe API en AI-integraties

Status: **D0 DOCUMENTATION READY; LOCAL UNMOUNTED DEVELOPMENT PLANS CANDIDATE EXISTS; EXTERNAL ACTIVATION BLOCKED**
Bijgewerkt: 2026-10-04
Baseline: GitHub main SHA 6349d02538351cd01fc51f298c6e6fa0ba88006c; lokale APIAI-kandidaatcode commit 2bc99a210d4cfb4f73a47e47dff26c7bf2745891 in Draft PR #3
Applicatieversie: 1.20261002.1

> Deze notitie en de gekoppelde besluitvoorstellen zijn niet goedgekeurd en autoriseren geen externe provider, route-activatie, remote migratie, deployment, merge of release. Een lokale kandidaatimplementatie staat in de afzonderlijke Draft PR #3; de API-routes blijven ongemount en de database migration is niet toegepast.

## 0. APIAI-01 Final Integration Wave — actuele status

De lokale kandidaat bevat een exact bearergebonden RLS-client, actuele AuthContext/servicechecks en een self-only Development Plans-projector met uitsluitend periode, voortgang, status en voltooiing. Limiter- en audit-RPC-wrappers zijn aan dezelfde private bearerclient gebonden; draft databasecode en pgTAP-contractbron bestaan, maar zijn niet lokaal uitgevoerd of remote toegepast. De resource is nog niet veilig te mounten.

De code staat in PR #3 vanaf baseline 6349d02538351cd01fc51f298c6e6fa0ba88006c. Codecommit 2bc99a210d4cfb4f73a47e47dff26c7bf2745891; de officiële lokale Production-build/provenance is bewezen op 799f036d1f8dd874bdd6dcb54c425bfd1c2ce29c. Gerichte regressies 9 bestanden/75 tests; volledige suite 528 bestanden/2.246 tests; strict TypeScript, lint en 308/308 Production-build PASS. De drie publieke routes gaven lokale framework-404 en blijven ongemount.

De geïsoleerde Keycloak 26.8-proef bewijst de providerflow tot en met afwijzing van dezelfde bearer na logout op Keycloak UserInfo. Zij bewijst geen LiquidHR-auth/RLS-pad en keurt geen provider goed. P-01 t/m P-05 blijven voorstellen; lokale PostgreSQL/pgTAP/concurrency/RLS/grants/advisors/typegen en audit-RPC-provenance-negatives blijven OPEN. Volledig bewijs staat in [APIAI-01-acceptatierun PR #3](https://github.com/EdwinCycling/LiquidHR/blob/3a02911f8f48a9e743574ba4c98212dc45220f50/docs/AA/APIAI-01-ACCEPTANCE-RUN-20261003.md) en [APIAI-01-security-integratierapport PR #3](https://github.com/EdwinCycling/LiquidHR/blob/3a02911f8f48a9e743574ba4c98212dc45220f50/docs/AA/APIAI-01-SECURITY-INTEGRATION-20261004.md).
## 1. Doel en statuslegenda

Dit spoor voegt meerdere integratiekanalen toe boven bestaande server-side geautoriseerde LiquidHR-domeinservices. Het introduceert geen tweede autorisatie-, AI- of businesslogica-engine. De eerste mogelijke externe tools zijn Workforce Summary, Team Skills en Development Plans, maar alleen waar bestaande brondata en actuele autorisatie dit veilig ondersteunen.

Gebruik de statussen afzonderlijk per capability:

- **BEDOELD** — productrichting; geen bewijs van implementatie.
- **GEBOUWD** — code of contract bestaat in de genoemde checkout; geen bewijs van acceptatie of release.
- **GETEST** — gedrag bewezen op de vermelde testlaag. Historische unit-tests bewijzen geen huidige hosted acceptatie.
- **RELEASED** — exacte code-SHA uitgerold naar het aangewezen kanaal en de genoemde release-smoke bewezen. Dit maakt bredere security-/persona-gates niet automatisch GREEN.

## 2. Baseline en actuele release-evidence

### Repository en conceptbronnen

- GitHub-repository: EdwinCycling/LiquidHR.
- Actuele GitHub main en gecontroleerde origin/main: 6349d02538351cd01fc51f298c6e6fa0ba88006c. Dit is de ONE VERSION-mergecommit van 2026-10-02. De opgegeven baseline is op deze peildatum nog actueel.
- Applicatieversie: 1.20261002.1, gedefinieerd in apps/hr-suite/lib/app-version.ts.
- D0-documentatie is in een geïsoleerde managed worktree gestart vanaf exact deze SHA. De root-checkout op main staat nog op cb73260ff0cd83d19fa29e44c9f0b93749fb10af en is niet gewijzigd; gebruik voor deze run de actuele GitHub/origin-main-baseline in de documentatieworktree.
- Conceptbron API-AI: branch docs/aa-api-ai-20261002, HEAD 6a30f098dc9b6a3175981045cb1e45e44e414b27. Niet gemerged.
- Conceptbron masterroadmap: branch docs/aa-master-roadmap-20261002, HEAD b98224dc46d70f9350bdbe1d8ffb3dcf003c170b. Niet gemerged; roadmapbestand is ongewijzigd.

### ONE VERSION en huidig TEST-kanaal

Read-only controle op 2026-10-03 vond:

- Vercel-project liquidhr heeft voor SHA 6349d02538351cd01fc51f298c6e6fa0ba88006c een READY deployment met ID dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5.
- Bestaande LiquidHR-aliases zijn gekoppeld; aliasError was null. De Vercel-targetnaam production blijft volgens AA-REL het enige synthetische TEST-kanaal en is geen productclaim over Production.
- De deployment-loginpagina gaf HTTP 200. Een anonieme aanvraag op een beschermde dashboardroute werd naar login omgeleid. Test Auth was niet zichtbaar of ingeschakeld in de geleverde loginpagina.
- Dit bewijst geen geauthenticeerde hosted feature-, persona- of API-acceptatie.
- docs/quality/acceptance/runs/ONE-VERSION-20261002.md beschrijft nog de fase waarin merge, hosted smoke en finale closeout open waren. Het rapport is niet achteraf aangevuld met dit nieuwe deploymentbewijs. De actuele rolloutstatus en bestaande open securityacceptatie worden daarom apart vermeld.
- Bredere status blijft **TEST RELEASED; security-/persona-acceptatie OPEN**. Onder meer Control invitation/revoke en forged-context-negatives, INS01 export/scope-inhoud en AI01-A feature-/scope-revocationnegatives zijn volgens de bestaande releaseacceptatie nog open. D0 verklaart die niet GREEN. De actuele AA-ACCEPT-, exact-SHA Vercel- en anonieme hosted-smokebewijzen bestaan ook al staat ONE-VERSION-20261002.md nog op de eerdere pending-closeouttekst. Die administratieve achterstand maakt geen nieuwe APIAI-01 lokale bouwblokkade.

Bronnen: docs/quality/acceptance/runs/ONE-VERSION-20261002.md, docs/AA/AA-ACCEPT.md, docs/AA/AA-REL.md en read-only GitHub/Vercel-controle van 2026-10-03. De bestaande rapportage blijft de gedetailleerde bewijsbron.

## 3. Contractinventarisatie

### 3.1 Externe API en interne BFF

| Onderdeel | BEDOELD | GEBOUWD | GETEST | RELEASED | Scope, hergebruik en gat |
|---|---|---|---|---|---|
| Interne Next.js API | Interne serverroutes voor de LiquidHR-app | 384 route.ts-handlers onder apps/hr-suite/app/api op de vastgepinde checkout. Het architecture-overzicht telt 112 op inventarisatiedatum 2026-07-29 en is geen actuele telling. Geen extern /api/v1-contract gevonden. | Tests zijn domein- en routegebonden; zij vormen geen partnercontract. | Bestaande routes zijn onderdeel van de app, maar geen vrijgegeven externe API. | Globale proxy laat /api door. Iedere route/service moet zelf authenticatie en actuele autorisatie uitvoeren. De interne routes zijn geen publieke security boundary. |
| OAuth/API-clients | Externe gedelegeerde toegang | Geen partnerclientregister, OAuth-clientregistratie of extern bearer-tokencontract gevonden. | Geen partnerauth-matrix. | Geen externe API-release. | Clientidentity, userdelegatie, issuer, audience, linking, consent, scopes en token lifecycle moeten worden besloten. |
| OpenAPI, foutcontract en paging | Versieerbare externe contracten | Geen OpenAPI v1-specificatie of uniform extern fout-/cursorcontract gevonden. | Geen externe contracttests. | Niet van toepassing. | Per collectie moeten begrensde filters, sortering en paginering vaststaan vóór clientgebruik. |

Bestaande interne endpoints, browsercookies, Supabase-sessies of client-ingestelde tenant-/employee-ID's mogen niet als externe identity of autorisatiebron worden hergebruikt.

### 3.2 Authenticatie, autorisatie en scope

| Onderdeel | BEDOELD | GEBOUWD | GETEST | RELEASED | Scope, hergebruik en gat |
|---|---|---|---|---|---|
| AuthContext | Vastgestelde LiquidHR-actor en actuele context | apps/hr-suite/lib/auth/permissions.ts levert AuthContext met userId, tenantId, optioneel hrGroupId, administrationId, employeeId, actieve rollen, permissions en portalcontext. Context komt server-side uit geverifieerde claims en actuele membership/contextgegevens. | Bestaande route-/permissiontests gelden voor interne flows. Externe actorlinking is niet bewezen. | Intern gebruikt; geen externe bearer-tokenadapter. | Na veilige identity linking is dit de bestaande LiquidHR authority-bron. Tokenclaims/requestparameters vervangen dit contract niet. |
| Permission check | Iedere domeinactie server-side autoriseren | requirePermission controleert actuele sessie/context, canonieke permissions en ESS/preboarding-grenzen. | Interne tests; externe scopevertaling ontbreekt. | Intern. | Hergebruik bestaande permissions. Verzin geen API-permissionnamen en vertrouw niet alleen op OAuth scopes. |
| Tenant-, HR-groep-, administratie- en subjectscope | Alleen expliciet toegankelijke grenzen | server-context.ts en administration-context.ts laden toegankelijke contexten; actieve dienstverbanden en directe-managerrelaties leveren waar passend subjectscope. | Interne context/RLS-gates bestaan; externe actor-, request- en revocationmatrix ontbreekt. | Intern. | ADR-0001 maakt Tenant de harde klant-/RLS-grens; ADR-0009 stelt HR-groep in als zichtbaarheids-/inrichtingsgrens. Clientcontext is onbetrouwbaar; serverchecks en RLS blijven verplicht. |
| Externe accountkoppeling | Externe actor aantoonbaar aan bestaande LiquidHR-user koppelen | Geen provider-subject-to-auth.users-contract gevonden. | Geen. | Geen. | Unieke subject-link, consent, accountverwijdering, recovery en ambiguïteit moeten worden besloten. Geen email-only matching. |

Vereiste keten voor een latere API: valideer extern token en client; laad veilig gekoppelde bestaande user; controleer bij iedere aanvraag de actuele status van grant/token; laad de actuele LiquidHR AuthContext; valideer geselecteerde context tegen server-side membership; voer bestaande permission- en domeinservicechecks uit; behoud database/RLS-defense-in-depth. Alleen JWT-handtekening en expiry controleren trekt een eerder uitgegeven JWT niet direct in: daarvoor is per-request tokenintrospectie of een vertrouwde grant-livenesscontrole nodig. Bewijs dit met dezelfde bearer vóór en na intrekking. Herlaad daarnaast elke aanvraag met actuele rol-, context-, module- en accountstatus. Claim geen directe revocation zolang de gekozen provider- en grantketen dit niet bewijst.

Begripsafbakening: de OpenID Connect-scopes `openid`, `profile` en `email` horen bij identity-/loginclaims en zijn geen API-resourcepermissies. API-specifieke scopes zoals `development-plans.self.read` horen bij het afzonderlijke gedelegeerde API-contract en begrenzen hoogstens wat de client mag aanvragen; zij vervangen nooit actuele LiquidHR-permissions, serviceguards of RLS.

Dit is aanvullend op [ADR-0002](../decisions/ADR-0002-authenticatie-i18n-en-persoonlijke-themas.md); ADR-0002 beschrijft de bestaande first-party login en keurt de hier onderzochte externe OAuth- en API-scopecontracten niet goed.

### 3.3 HeRa en Workforce Summary

| Onderdeel | BEDOELD | GEBOUWD | GETEST | RELEASED | Scope, hergebruik en gat |
|---|---|---|---|---|---|
| HeRa typed read tools | Begrensd lezen met kleine tools en serverchecks | apps/hr-suite/lib/hera/read-tools.ts en tool-registry.ts bevatten analyze_salary_threshold, search_visible_employees, get_visible_employment en get_visible_organization. Strict Zod-schema's; registry weigert onbekende tools. | Interne tool- en guarddekking; geen externe hosted-clientacceptatie. | Beschikbaar binnen HeRa, niet als publieke REST-API. | Voorbeeld van minimaal geautoriseerde reads. Niet rechtstreeks publiek exporteren: HeRa heeft eigen actor-, response-, privacy- en providercontext. |
| Workforce Summary | Compacte samenvatting van de zichtbare workforce | AI registry bevat EMPLOYEE_SUMMARY en TEAM_SUMMARY; HeRa heeft employee/employment/organization reads. Geen dedicated extern gecontracteerde summary-service gevonden. | Featurecode bewijst geen persona-, projectie- of hosted API-acceptatie. | Geen externe release. | Metrics, populatie, peildatum, filters, managergrens, kleine groepen en velden moeten worden goedgekeurd. Geen nieuwe HR-inferentie of brede employee-export. |
| HR-bronvermelding | Resultaat begrenzen tot de werkelijk zichtbare populatie | HeRa data-contracten noemen bron, populatie, filters, peildatum en onzekerheid. | Intern HeRa-contract; geen uniform REST-responsecontract. | Alleen bestaande HeRa-flow. | Ontwerpinput voor responsemetadata, niet een bestaand REST-contract. |

Huidige HeRa-readtoolpermissions:

- analyze_salary_threshold vereist salary:read.
- search_visible_employees vereist employee:read én contract:read.
- get_visible_employment vereist contract:read en valideert doelgroep/context.
- get_visible_organization vereist department:read én organization-placement:read.

Salaris- of brede medewerkerdetails zijn niet automatisch onderdeel van Workforce Summary. Publiceer alleen velden en populaties die in een goedgekeurd extern contract en actuele autorisatie passen.

### 3.4 Talent, Skills en Development Plans

| Onderdeel | BEDOELD | GEBOUWD | GETEST | RELEASED | Scope, hergebruik en gat |
|---|---|---|---|---|---|
| Team Skills | Gedelegeerd lezen van zichtbare teamvaardigheden | apps/hr-suite/lib/talent/team-service.ts en team-model.ts implementeren listTalentTeamMatrix. De service vereist talent-team:read en de TALENT-module; zonder talent:manage beperkt de service de matrix tot de huidige directe teamrelatie. Resultaat bevat employee-identiteit, functie/afdeling en capability-/certificaat-/evidence-statusvelden. | Interne tests bewijzen geen externe contract- of privacyacceptatie. | Interne module, geen externe route. | Aggregate policy is DISABLED. aggregateMinimumGroupSize: 5 is geen vrijgave van anonieme aggregatie. Geen aggregatie of identificeerbare teamdata naar externe clients vóór formeel privacybesluit. |
| Persoonlijke capability records | Eigen of HR-geautoriseerde records | employee-capability-service.ts kent self:talent-record:read en talent-record:read met module-/policychecks. | Interne servicegrenzen; geen externe. | Intern. | Certificaatcodes, evidence-status en identifiers zijn gevoelige inhoud; alleen goedgekeurde velden projecteren. |
| Development Plans / doelen | Eigen, manager- of beheerderscope | apps/hr-suite/lib/talent/goal-service.ts listTalentGoals ondersteunt self, manager en admin. Canonieke permissions: self:talent-goal:read, talent-goal:read en talent-goal:manage; TALENT-module en subject/teamguards blijven actief. | Service-/routegedrag intern getest; geen externe GET-contractacceptatie. | Interne /api/talent/goals en verwante routes; geen /api/v1. | Bestaande output kan title, description, periods, progress, status, capability- en sourcevelden bevatten. De huidige route accepteert clientgestuurde mode/employeeId; listTalentGoals dwingt manager-doelscope niet af wanneer employeeId ontbreekt. Extern v1 is daarom self-only via AuthContext. Stel manager-/admin-exposure uit tot een service-uitbreiding directe reports server-side afleidt en service-/RLS-negatives dit bewijzen. |
| Talentmutaties | Niet onderdeel van eerste externe read-slice | Interne POST-/check-in-/writepaden bestaan. | Geen externe write-acceptatie. | Niet vrijgegeven extern. | APIAI-01 is GET-only. Link niet door naar bestaande muterende /api/talent/* handlers. |

Alle clientselectors zijn onbetrouwbaar en kunnen nooit authority verlenen. Team Skills v1 heeft geen teamId: het bestaande filtercontract kent dat veld niet en de service leidt TEAM/TENANT-scope zelf af uit AuthContext. Development Plans v1 is self-only en leidt employee uit AuthContext af; accepteer extern geen mode of employeeId. Voeg andere filters pas toe wanneer de bestaande service ze veilig binnen de al toegestane scope valideert. Bij ontbrekende brondata, ambiguïteit of ontoereikende autorisatie faalt de aanvraag gesloten.

Team Skills blijft voorbereid, niet afgerond: de eerste APIAI-01-slice bevat geen subjectRef, teamRef, naam, employee-ID, evidence, certificaatdetails of vrije tekst. Externe Team Skills-toegang blijft uitgesteld tot een afzonderlijk goedgekeurde projectie aantoonbaar niet-linkbaar is; anders wordt de resource uit v1 gelaten.

### 3.5 AI Foundation, governance, audit en Liquid Credits

| Onderdeel | BEDOELD | GEBOUWD | GETEST | RELEASED | Scope, hergebruik en gat |
|---|---|---|---|---|---|
| AI-runtime | AI-capabilities binnen LiquidHR-governance | apps/hr-suite/lib/ai/contracts.ts, runtime.ts, orchestrator.ts en feature-registry.ts definiëren server-side invocation, feature- en providercontracten. | Runtime-/durabilitytests bestaan; live persona-/scope-/toggle-negatives blijven in bredere AI01-A-releaseacceptatie OPEN. | Intern AI-platform; geen externe Workforce API. | ADR-0010 maakt AuthContext de identity-/scopebron en vereist business permission plus ai:use, fail-closed governance/credits, minimale providercontext en gescheiden audits. |
| Audit en durability | Minimale governance- en herstelregistratie | Repositories, durable recovery, governance en technische/business-audit-sinks bestaan onder apps/hr-suite/lib/ai. | Bestaande technische tests/evidence; extern REST-auditcontract ontbreekt. | Intern. | API-audit bewaart geen bearer token, volledige HR-payload, prompt of response. Definieer actor/client/resource, autorisatie-uitkomst, request-ID en beperkte resultaatmetadata. |
| AI-creditbeleid | Modelverzoek begrenzen en verrekenen | FDR-0008 legt Liquid Credits, reserveren vóór providercall, settle bij valide output, release bij failure en idempotente retry vast. Main bevat AI-runtime/credit-adaptercode; dat keurt externe requests niet automatisch als AI-charges goed. | Runtime-evidence staat los van externe klant-/clientattributie. | Geen nieuw extern creditcontract. | Deterministische REST-read is geen AI-invocation en wordt niet automatisch belast. AI-samenvatting moet via bestaande AI-runtime, actuele business permission en creditsgate lopen. Externe quota/kosten/toestemming vergen besluit. |
| AI-features | Geregistreerde HR-capabilities | Registry bevat onder andere improve-existing-hr-text, EMPLOYEE_SUMMARY, TEAM_SUMMARY, CONVERSATION_PREPARATION en DEVELOPMENT_GOAL_SMART. | Registry-aanwezigheid bewijst geen live persona-acceptatie. | Geen externe tool-API. | APIAI-02 mag geen featurestatus omzeilen of eigen AI-executielaag toevoegen. |

Een gewone REST-read roept geen model aan. Als later een tool AI compute gebruikt, blijft dat onderscheiden van de brondata-read en volgt het de actuele business permission, ai:use, feature enablement, Liquid Credits en bestaande server-runtime. Geen directe provider- of service-role-aanroep vanuit externe routes.

### 3.6 Payroll, Control en externe providers

| Onderdeel | BEDOELD | GEBOUWD | GETEST | RELEASED | Scope, hergebruik en gat |
|---|---|---|---|---|---|
| Payroll Lab | Bounded context in dezelfde LiquidHR-app met aparte Lab-database en pure engine | PAYLAB00–04 zijn onderdeel van main na de merge. Code staat onder packages/payroll-engine, packages/payroll-rules-nl-2026 en apps/hr-suite/lib/payroll. | Geaccepteerde synthetische scenario's zijn begrensd; zie AA-PAYROLL en integratierapport. | In de TEST-release op SHA 6349d...; dit is geen algemene payrollcomplianceclaim. | Geen externe API-doorsteek naar Payroll Lab, Core of Control. Payroll/salaris blijft buiten APIAI-01 totdat data-, tenant-, scope- en privacybesluiten bestaan. |
| Core- en Control-grens | Geen tweede employment-/IKV- of importcontract | Payroll source snapshots/providers zijn server-side bronadapters; Payroll-records blijven volgens bestaande boundary gescheiden. | Synthetische cases bewijzen geen alle IKV-, fiscale of live-acceptatie. | Volgens AA-REL. | CONTROL02 werkt aan officiële Loonaangifte XML/XSD en raakt Control/Core-/IKV-contracten. APIAI heeft geen eigenaarschap over die bestanden, migrations of contracten. |
| Nmbrs-contract op main | Gecontroleerde connectie-/OAuth-state-grens | Migration apps/hr-suite/supabase/migrations/20260908203016_payroll_p1_nmbrs_connection.sql beschrijft provider-/connectionmetadata en server-side OAuth-state-hash; aanvullende P0/P1-migrations leggen private RPC-/grant-/indexgrenzen. Geen complete publieke provider-read/sync API in main gevonden. | Migration-/boundarycode bewijst geen live Nmbrs OAuth, company discovery of payrollsync. | Geen extern client API-contract. | Connectionmetadata is geen Workforce OAuth-protocol of generieke API-clientstore. |
| Nmbrs providerwerk buiten main | Mogelijke parallelle provider-implementatie | Checkout work/payroll-p0-p1 staat op lokale HEAD 4f99b04, één commit voor op remote-tracking branch. Bevat o.a. lib/payroll/providers/nmbrs/client.ts en provider.ts. Checkout was clean op peildatum. | D0 heeft de provider niet uitgevoerd of geaccepteerd. | Niet in main; niet APIAI-eigendom. | Eerst owner-/dependency-/acceptancecoördinatie en exacte diff/migrationlineage. Niet overnemen of dupliceren. |

Payroll API's, Payroll-verrijking van Workforce Summary, Control/Loonaangifte-mutaties en Nmbrs-sync zijn buiten APIAI-01. CAO-BENCH02 heeft een eigen worktree en mogelijke gescopeerde Payroll/Core-testinrichting; houd die stream gescheiden.

### 3.7 MCP, ChatGPT en WebMCP

| Onderdeel | BEDOELD | GEBOUWD | GETEST | RELEASED | Scope, hergebruik en gat |
|---|---|---|---|---|---|
| Remote MCP | APIAI-03 als later kanaal boven bestaande geautoriseerde services | Geen product MCP-server of geïntegreerd MCP-endpoint/library gevonden. | Geen MCP-client- of hosted MCP-acceptatie. | Geen. | Bouw pas na APIAI-01/02. AuthN/AuthZ blijft per request; bestaande LiquidHR-contracten blijven leidend. |
| ChatGPT Workforce Assistant | APIAI-04 als afzonderlijke clientintegratie | Geen ChatGPT OAuth-/toolserverimplementatie gevonden. | Geen. | Geen. | Niet vermengen met APIAI-01. Clientregistratie en OAuth-vereisten opnieuw verifiëren bij start. |
| WebMCP | APIAI-05 als browsercontext-tooladapter | Geen product WebMCP-implementatie gevonden. | Geen browseracceptatie. | Geen. | WebMCP-document is Draft Community Group Report van 2026-09-28, geen definitieve W3C Recommendation. Later feature-detecten en fallback testen. |
| Plugin Extensions / sidebar / sidepanel / deeplinks / onboarding | UX-uitbreidingen uit eerder concept | Niet gevonden als geïntegreerd APIAI-productcontract. | Geen APIAI-acceptatie. | Geen. | Optioneel/later. Deeplinks autoriseren nooit zelfstandig toegang tot een record. |

Veranderlijke primaire platformbronnen opnieuw controleren bij latere iteraties: [OpenAI Plugin Authentication](https://developers.openai.com/plugins/build/auth), [OpenAI MCP server bouwen](https://developers.openai.com/plugins/build/mcp-server), [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [WebMCP draft](https://webmachinelearning.github.io/webmcp/), [Vercel Function duration](https://vercel.com/docs/functions/configuring-functions/duration) en [Next.js Route Segment Config](https://nextjs.org/docs/15/app/api-reference/file-conventions/route-segment-config). Controleer actuele versies/runtime/clientondersteuning opnieuw; een platformvoorbeeld is geen LiquidHR-besluit.

## 4. Bevestigde architectuur en hergebruikgrenzen

Goedgekeurde basisbesluiten:

- ADR-0001: Tenant is absolute klant-/RLS-grens; administratiecontext is expliciet; clientcontext/cookie is onbetrouwbaar; siblings zijn niet impliciet toegankelijk.
- ADR-0002: beschrijft de bestaande first-party Google-/wachtwoordlogin, uitnodigingsgrens en persoonlijke voorkeuren. Dit besluit keurt geen externe OAuth-provider, gedelegeerd API-bearercontract, API-scopes of tokenrevocatiemodel goed; die keuzes blijven open.
- ADR-0009: HR-groep is zichtbaarheids- en inrichtingsgrens. Salaris-, dienstverband- en administratiegegevens blijven aan hun passende domeinscope gekoppeld.
- ADR-0010: nieuwe AI blijft een server-side LiquidHR-capability. Gebruik AuthContext, actuele business permission en ai:use, fail-closed governance/credits, minimale providercontext en gescheiden technische/business audit.
- FDR-0008: AI-invocation en Liquid Credits volgen het goedgekeurde reserveer-, settle-, release- en retrybeleid. Dit bepaalt niet zelfstandig kostenbeleid voor gewone REST-reads of externe AI-clients.
- AA-REL: exact-SHA provenance, isolated synthetic Preview, passende browser/securityacceptatie en hosted TEST-smoke zijn aparte releasegates.

Doelarchitectuur:

1. APIAI-01 maakt een smalle REST-adapter en goedgekeurd extern readcontract.
2. APIAI-02 maakt de gedeelde typed Workforce-toolfaçade boven bestaande services.
3. APIAI-03 remote MCP, APIAI-04 ChatGPT Assistant en APIAI-05 WebMCP zijn adapters boven dezelfde authority chain; elk kanaal behoudt clientauthenticatie maar creëert geen scope.
4. Bestaande services en RLS blijven leidend. Een facade mag services later structureren, niet dupliceren of omzeilen.

## 5. Geactualiseerde vijf iteraties

| Iteratie | Beoogde oplevering | Afhankelijkheden en acceptatie |
|---|---|---|
| APIAI-01 | Secure, versioned, GET-only externe REST API voor uitsluitend goedgekeurde Workforce Summary, Team Skills en Development Plans-projecties. | Geblokkeerd tot §7-besluiten en §10-buildgate gesloten zijn. OpenAPI, gedelegeerde actor, actuele re-autorisatie, privacy, rate limit, audit en Preview/securitymatrix. Geen writes/webhooks/autonome acties. |
| APIAI-02 | Shared Workforce-toolfaçade boven typed bestaande domeinservices. | Bestaande resourceprojecties en service permissions blijven leidend. Eén projectie per capability; geen duplicatie in kanaaladapters. Positieve en negatieve tenant/group/admin/subjecttests. |
| APIAI-03 | Remote MCP-server met goedgekeurde façade-tools. | APIAI-02 GREEN; actuele MCP transport/auth-spec opnieuw controleren; issuer/audience/scope en autorisatie per toolcall; runtime/streamingkeuze hosten en testen. Geen writes. |
| APIAI-04 | ChatGPT Workforce Assistant. | APIAI-03 en client-/account-/OAuth-besluiten GREEN; registratie, consent, token revoke, audience, tool-level read-only policy en privacy bevestigd. Geen commerciële geschiktheidsclaim zonder verificatie. |
| APIAI-05 | Geïntegreerde WebMCP-interface in LiquidHR. | APIAI-02-facade en UX/securitybesluit; draft/API actueel controleren; feature detection en gewone paginafallback; serverauth en per-call autorisatie. Browsercapability is geen authority. |

Plugin Extensions, sidebar/sidepanel, beveiligde deeplinks en begeleide onboarding blijven mogelijke latere aanvullingen; geen APIAI-01-vereiste. Iedere deeplink blijft achter gewone login en objectpermissie.

## 6. Parallelle sporen, dependencies en conflictmatrix

### Repositorystatus op de peildatum

- GitHub current main: 6349d02538351cd01fc51f298c6e6fa0ba88006c. GitHub API gaf tijdens controle 2026-10-03 geen open pull requests terug.
- Andere GitHub-branches omvatten docs/aa-api-ai-20261002, docs/aa-foundation-20260929, docs/aa-master-roadmap-20261002, docs/control02-planning-20261003, integration/payroll-foundation-20261002, work/acceptance-F02-20260922, work/acceptance-T01-20260922, work/acceptance-T01R-20260927, work/convergence-focus-workflow-20260918, work/focus-completion-act-as-20260918 en work/payroll-p0-p1. Een branch bewijst geen actuele thread-owner of akkoord voor hergebruik.
- Lokale worktree-inventarisatie vond checkouts voor ABS02, AI01-A, CONTROL01, CONVERGENCE01, convergence-release/build, INS01, payroll-p0-p1, payroll-p2-preview, payroll-reconciliation en geïntegreerde PAYLAB.
- Afzonderlijke relevante checkouts:
  - work/cao-bench02-20261003 heeft een eigen CAO-BENCH02 execution-planbestand.
  - work/payroll-p0-p1 is clean maar één lokale documentatiecommit ahead van origin/work/payroll-p0-p1; bevat Nmbrs provider/clientwerk.
  - work/paylab00 staat lokaal ahead 7 / behind 33 en is dirty in next-env.ts, Payroll Supabase .temp en tmp. Niet aanraken en niet als basis gebruiken.
  - work/CONVERGENCE01-20260928 heeft untracked packages/db/types.remote-generated.tmp.
  - Detached ONE VERSION-build checkout heeft untracked .pw-daemon/.
  - Andere genoemde checkouts waren clean volgens git status op de peildatum. Dit is een statusmomentopname, geen uitspraak over thread- of producteigenaarschap.

### Overlap

| Spoor | Overlap met APIAI | Regel |
|---|---|---|
| CONTROL02 / Control-Core / IKV | Identity, employment-/importcontracten; shared Core-/migrationoppervlak | APIAI wijzigt geen Control-, XML/XSD-, Core-, IKV-, migration- of providercontracten. Overlap eerst afstemmen en serialiseren. |
| Payroll Lab / PAYLAB / CAO-BENCH02 | Salary/Payroll-data en providercontracten zijn buiten APIAI-01; actuele testtrack staat apart | Geen Payroll-data projecteren en geen branchcode cherry-picken. Volg AA-PAYROLL en afgescheiden Lab/Core-grens. |
| AI Foundation / AI01-A | AuthContext, AI-permissions, invocation, feature settings, credits en audit | AI01-A heeft open live feature/toggle/scope-revocation-negatives. Geen parallelle wijziging aan AI Foundation/auth/credit schema/runtime zonder coördinatie. |
| HeRa | Zelfde HR-domeinen, ander AI-actor-, tool-, response- en privacycontract | Hergebruik typed domeinservices waar AuthContext past; exporteer HeRa-handlers niet ongewijzigd. |
| Shared Core / auth / RLS | APIAI heeft delegated auth en tenant/group/admin/subjectscope nodig | Auth-, RLS-, permission-, schema- of Core-wijziging is cross-cutting en vraagt expliciete coördinatie en gates. |
| AA-documentatiebranches | APIAI- en masterroadmap-concept staan los van current main | Niet blind mergen. D0 staat in aparte exact-main-documentatieworktree; latere integratie blijft afzonderlijke handeling. |

Iedere substantiële implementatieslice start in een nieuwe geïsoleerde worktree vanaf dan actuele goedgekeurde origin/main; inventariseer branches/worktrees/PR's opnieuw. APIAI krijgt geen impliciet eigenaarschap over gedeelde infrastructuur. De D0-documentatiebranch/PR raakt alleen de hieronder opgesomde documenten; er vindt geen merge plaats.

## 7. Besluitregister

Onderstaande voorstellen zijn geen product- of securitybesluiten. De concrete keuzes, alternatieven, impact en vereiste goedkeuring staan in [APIAI-01-DECISION-PROPOSALS-20261003.md](APIAI-01-DECISION-PROPOSALS-20261003.md). Open keuzes moeten als goedgekeurde ADR/FDR of expliciete requirement worden vastgelegd voordat afhankelijke code start.

| ID | Besluit | Status en benodigde uitkomst |
|---|---|---|
| D-01 | Actuele releasebaseline | **TEST RELEASED; bredere security-/persona-acceptatie OPEN.** Exact main SHA, READY Vercel deployment, bestaande AA-ACCEPT-status en anonieme hosted smoke zijn vastgelegd. ONE-VERSION-20261002.md heeft een administratieve closeoutachterstand. Niet-overlappende Control/INS01/AI01-A OPEN-items blokkeren geen geïsoleerde lokale APIAI-implementatie; concrete overlap of APIAI-specifieke bevindingen kunnen dat wel doen. AA-REL-gates blijven gelden voor merge/release. |
| D-02 | Externe clientidentity en OAuth-flow | **OPEN.** Besluit vaste/registered/CIMD client, delegated-user flow, issuer, resource audience, JWT/opaque en lifecycle. OAuth 2.1 Authorization Code + PKCE S256 is kandidaat, geen goedkeuring. Client credentials simuleert geen individuele HR-user. |
| D-03 | Identity linking, consent en account lifecycle | **OPEN.** Unieke stabiele provider-subject-link naar bestaande LiquidHR-user; consent/revoke, unlink, multi-provider, duplicate/ambiguous match en recovery. Geen email-only link. |
| D-04 | Context- en subjectselectie | **OPEN voor extern contract; intern kader goedgekeurd.** Besluit tenant/HR-groep/administratie/subjectselectie, multi-context en actuele membership/revocation per request. Client kiest geen authority. |
| D-05 | Resources, velden en classificatie | **OPEN.** Bevestig summary metrics/populatie/filters/peildatum, Team Skills-projectie en Development Plans/POP. Formaliseer privacy/retention/clientcacheclassificatie, aggregatie en small-cell regels. Team Skills aggregate policy is DISABLED. |
| D-06 | OAuth-scopes versus app permissions | **OPEN.** Map elke externe scope naar minimale bestaande canonieke permissions/servicechecks. Geen nieuwe permission strings zonder besluit. Token scope is hoogstens ceiling; actuele business permission blijft nodig. |
| D-07 | OpenAPI en HTTP-contract | **OPEN.** Versiebeheer, resources, response/error schema, statusmapping, max page size, cursor/offset, filter-/sortallowlists en compatibility. |
| D-08 | Rate limit, quota en audit | **OPEN.** Kies opslag, actor/client/resource keys, thresholds, retry, retention en alerts. Geen generieke rate-limitlaag gevonden; verzin geen codewaarden. |
| D-09 | Runtime en deployment | **OPEN voor deze API.** Bevestig actuele Next/Vercel Node/Edge-runtime, duration/region/streaming, connections, preview en monitoring. Bestaande routehandlers zijn geen automatische runtimegoedkeuring. |
| D-10 | Liquid Credits en AI-kosten | **OPEN voor externe callers.** REST GET wordt niet automatisch als AI-charge behandeld. AI compute gebruikt bestaande runtime, business permission, ai:use en FDR-0008. Besluit externe cost attribution/consent. |
| D-11 | MCP/ChatGPT clientauth | **LATER / OPEN voor APIAI-03/04.** Verifieer actuele clientregistration, OAuth metadata/audience, consent en readOnly-policy bij die iteratie. |
| D-12 | Workforce databeschikbaarheid | **OPEN.** Bevestig per resource bestaande service/projectie, bevoegdheden, identifiers en behavior bij onvolledige data. Ontbrekende/onveilige data leidt tot scopeverkleining of stop; geen businessregels in API-plaklaag. |

Formeel goedgekeurd zijn alleen de genoemde ADR-/FDR-contracten en toepasselijke AA-REL-procedure. Externe OAuth, API permissions, routes, skills projections/aggregatie en AI external charging zijn niet stilzwijgend goedgekeurd.

## 8. Bespreekvoorstel APIAI-01 contract — geen bestaand contract

Geen van de routes, scopes of responses hieronder bestaat op main. Gebruik ze pas na besluitvorming over D-02 tot en met D-09 en resourceprojecties. De Team Skills- en Development Plans-paden hieronder zijn bijgewerkt naar de veilige kandidaat-scope; manager-Development Plans blijven uitgesteld.

Mogelijke GET-only resourcevorm:

- GET /api/v1/workforce/summary
- GET /api/v1/team-skills (actor-/AuthContext-afgeleide scope; geen teamId in v1)
- GET /api/v1/development-plans (self-only in v1; manager/admin uitgesteld)

Velden blijven per goedgekeurde projection allowlisted. Team Skills gebruikt in v1 geen teamId-selector: listTalentTeamMatrix leidt TEAM/TENANT af uit AuthContext en het huidige filtercontract kent geen teamId. Development Plans is self-only via AuthContext; de huidige manager-mode is niet veilig als externe selector omdat de route mode/employeeId van de client accepteert en de goalquery managerdoelen niet zonder meegegeven employeeId begrenst. Manager-scope blijft uitgesteld tot service-/RLS-aanpassing en negatieve tests zijn goedgekeurd. Standaard uitgesloten: salaris, BSN, contactgegevens, documenten, ziekte-/verzuimdata, volledige capability-evidence payloads, provider tokens en prompts. Geaggregeerde workforce-data vereist minima tegen kleine groepen en indirecte identificatie.

Leg vóór OpenAPI-freeze vast:

- Version in path (/v1) of ander expliciet compatibility scheme.
- JSON response metadata met request-ID, data en paging metadata waar nodig.
- Consistent foutformaat zonder stack, query, token of verborgen-recordbestaan te lekken.
- Allowlisted filters/sort, stabiele sortorder, servermaximum en cursorsemantiek per collectie.
- GET-only eerste release; geen POST/PATCH/PUT/DELETE, event, webhook, Payroll-import, AI-action of mutation alias.
- No-store/cachebeleid; geen persoonsgegevenscache bij clients zonder besluit.

## 9. Gerichte wijzigingslijst voor de living roadmap

De geldige lange-termijnroadmap in deze baseline is [AA-ROAD.md](AA-ROAD.md). `docs/AA/AA-MASTER-ROADMAP.md` bestaat niet in deze baseline en is niet gewijzigd; eventuele roadmapredactie blijft een afzonderlijke wijziging.

1. Vervang verouderde uitgangsbaseline cb73260... door current main 6349d02538351cd01fc51f298c6e6fa0ba88006c, appversie 1.20261002.1 en geverifieerde TEST-deployment-ID. Houd deployment READY gescheiden van securityacceptatie OPEN.
2. Markeer PAYLAB00–04 als geïntegreerd in main en TEST-released, niet als volgende of nog MERGE-READY activiteit. Behoud begrensde synthetic acceptance en geen algemene payrollcomplianceclaim.
3. Verwijder oude formuleringen dat AA-docs niet op main staan pas na bewuste integratie van definitieve bestanden; vermeld dat docs/aa-api-ai-20261002 en docs/aa-master-roadmap-20261002 geen current baseline zijn.
4. Maak andere streams' OPEN acceptatie geen automatische blokkade voor een geïsoleerde lokale APIAI-01-start. Vereis concrete dependency-/security-overlap als blocker; houd APIAI-eigen securitybewijs en AA-REL-gates verplicht voor merge/release. Deployment READY alleen volstaat niet als hosted acceptance.
5. Voeg vaste iteratievolgorde toe: APIAI-01 REST read API, APIAI-02 shared Workforce facade, APIAI-03 remote MCP, APIAI-04 ChatGPT Assistant, APIAI-05 WebMCP. Houd Plugin Extensions/sidebar/sidepanel/deeplink/onboarding optioneel/later.
6. Label Workforce Summary-, Team Skills- en Development Plans-projecties als bedoeld/conditioneel tot resourcevelden, externe auth, permission mapping, privacy/aggregatie en HTTP-contract besloten zijn.
7. Houd Payroll/Nmbrs, CONTROL02/Core/IKV, AI Foundation en HeRa expliciete dependencies/ownership boundaries. Geen parallelle APIAI-wijziging aan hun schema, permissions, routes of providercontract.
8. Registreer afzonderlijk DOCUMENTATION READY, lokale BUILD START READY na besluiten P-01 t/m P-05 en controle op concrete overlap, en RELEASE READY na APIAI-specifieke contract/security/hosted acceptatie. Niet-overlappende OPEN-statussen zijn geen algemene lokale buildgate.
9. Zet API/MCP/WebMCP/ChatGPT niet als gebouwd of released neer. D0 vond bestaande interne BFF, services en AI-runtime maar geen extern /api/v1, product MCP of WebMCP-route.
10. Synchroniseer bij latere roadmapredactie AA-CURRENT/AA-NEXT, releasehandoff, repo README en IMPLEMENTATION_STATUS met dezelfde main/version/deployment evidence; behoud historische snapshots als gedateerde historie.

## 10. D0-conditionele bouwopdracht voor APIAI-01 — historisch template

### Vrijgavepoort

D0 is documentatiegereed; de voorstellen zijn nog niet goedgekeurd. Start APIAI-01-code pas nadat:

1. De dan actuele GitHub origin/main, open PR's en worktrees opnieuw zijn vastgesteld en de implementatie in een eigen geïsoleerde worktree vanaf die exacte baseline start.
2. Product- en security-eigenaren de toepasselijke keuzes P-01 t/m P-05 uit APIAI-01-DECISION-PROPOSALS-20261003.md formeel hebben aangenomen of aangepast. Leg de uitkomst vast als goedgekeurde ADR/FDR of requirement. Een voorstel geldt niet als toestemming.
3. Voor iedere gekozen resource de OpenAPI-/veldprojectie, actuele AuthContext/service-permissionmapping, privacyclassificatie en geldige actor-/subjectscope formeel vaststaan.
4. Geen onopgeloste concrete overlap bestaat met actieve auth-, security-, RLS-, database- of gedeelde-infrastructuurwijzigingen. OPEN-acceptatie uit niet-overlappende Control-, INS01- of AI01-A-sporen is op zichzelf geen lokale buildblokkade. Stop wel bij aangetoonde gedeelde kwetsbaarheid die APIAI gebruikt of verergert.
5. De implementatie gerichte APIAI-auth-, scope-, privacy-, rate-limit-, audit-, error-redaction- en negatieve autorisatietests krijgt. Geen securitygate wordt GREEN zonder bijbehorend bewijs.
6. De goedgekeurde synthetische runtimeconfiguratie en een vrije lokale poort beschikbaar zijn. Preview/runtime moet veilig zijn ingericht vóór hosted API-acceptatie; die Preview-inrichting blokkeert de lokale implementatie niet.
7. Remote schemawijzigingen aparte expliciete toestemming hebben. Deze documentatieopdracht geeft die niet. Houd schema → route aan en voer geen remote apply uit.

Bredere ONE VERSION closeout is geen extra voorwaarde voor lokale APIAI-code wanneer de actuele releasebron TEST RELEASED is en er geen concrete gedeelde dependency/blocker is. Voor merge en release blijven de dan toepasselijke AA-REL-, exact-SHA-, APIAI-specifieke security- en hosted-acceptatiegates verplicht.

### Kopieerbare bouwopdracht na goedkeuring

Voer APIAI-01 uit volgens docs/AA/AA-API-AI.md, docs/AA/APIAI-01-DECISION-PROPOSALS-20261003.md, uitsluitend de formeel goedgekeurde beslissingen en de actuele repositoryinstructies. Deze opdracht geldt pas nadat P-01 t/m P-05 voor de gekozen resources expliciet zijn besloten. Begin in een nieuwe geïsoleerde worktree vanaf de dan actuele goedgekeurde origin/main. Noteer exacte SHA, appversie, branch/worktree, open PR's en overlappende streamowners. Wijzig de bestaande D0-worktree niet voor featurecode.

**Scope:** bouw alleen een versieerbare, GET-only externe API voor de formeel goedgekeurde subset van Workforce Summary, Team Skills en Development Plans. Gebruik alleen de goedgekeurde OpenAPI-, veld-, error-, paging-, privacy-, OAuth- en quota-contracten. Geen POST/PATCH/PUT/DELETE, webhooks, events, autonome acties, Payroll, Control, Nmbrs of tweede AI-runtime. Een deterministische GET is geen Liquid Credits AI-invocation. AI-werk blijft buiten deze slice tenzij later apart besloten.

**Architectuur en uitvoering:**

1. Herlees de toepasselijke repo-instructies, goedgekeurde ADR/FDR/requirements en actuele branch-/PR-/worktreestatus. Bevestig dat de actieve wijzigingen geen concrete afhankelijkheidsconflicten opleveren.
2. Bevries OpenAPI en een veldmatrix: per veld bronservice, permission, actor/tenant/HR-groep/administratiescope, classificatie, omit/null-gedrag, pagingbound en testfixture. Houd externe scopes apart van canonieke interne permissions. Gebruik voor Team Skills AuthContext-afgeleide scope zonder teamId; houd Development Plans self-only en leid self uit AuthContext af, nooit uit mode/employeeId-parameters.
3. Implementeer alleen de goedgekeurde bearer/clientvalidatie en gedelegeerde identity-linking. Valideer issuer, audience/resource, client, handtekening/JWKS, algoritme, expiry en revoke volgens het goedgekeurde providercontract. Koppel uitsluitend op de goedgekeurde stabiele subject-link; nooit op e-mail.
4. Laad per aanvraag de actuele server-side AuthContext en bestaande module-, permission-, context-, domeinservice- en RLS-checks. OAuth-scope, route- of queryparameters verlenen geen authority. Geen service-role queries, parallelle permissionlogica of directe doorvoer van interne DTO's.
5. Implementeer de smalle typed response-projecties boven de bestaande goedgekeurde services. Verwijder interne IDs, salaris, BSN, contact, documenten, vrije tekst, evidence, tokens en niet-goedgekeurde subjectrefs. Exposeer geen aggregatie of veld buiten de goedgekeurde privacyregel.
6. Voeg begrensde input, stabiele paging waar besloten, no-store, server-generated request-ID, foutredactie, gedeelde atomische limiter en privacyveilige audit toe. Log nooit Authorization-header, token, prompt, volledige HR-payload, evidence of ruwe IP. Faal gesloten op onbetrouwbare auth-, permission-, limiter- of auditbeslissing.
7. Voeg unit-, route-, OpenAPI-contract-, integratie- en relevante HTTP-/securitytests toe. Minimaal de negatieve matrix hieronder; gebruik alleen bestaande synthetische accounts/data. Auth-/Test Auth uitsluitend lokaal. Gebruik voor lokale start de officiële scripts/start-test-worktree.ps1-procedure en een vrije poort vanaf 3000; voer normale login en bestaande rolwisselingen uit.
8. Draai de kleinste relevante checks na iedere wijziging. Volg volledige AA-REL-gates wanneer gedeelde auth/routing/schema/securitycode wijzigt of wanneer merge/release wordt voorbereid. Werk CURRENT_CONTEXT en IMPLEMENTATION_STATUS bij met bewijs, OPEN-items en exacte SHA.
9. Hosted Preview/API-acceptatie, push, merge, deployment en activatie gebeuren alleen binnen expliciet geautoriseerde vervolgscope. Een READY-deployment zonder actor/persona/API-bewijs maakt geen securitygate GREEN.

**Vereiste negatieve matrix:**

- Ontbrekende/malformed/expired bearer, ongeldige signature/JWKS, verkeerd issuer/audience/client/algoritme, revoked grant/token, ongekoppelde/ambigue subject-link, disabled account en email-only match.
- Geldige OAuth-scope zonder actuele interne permission; ingetrokken rol/context/module; uitgeschakelde TALENT-module; geen actieve AuthContext; ongeldige contextkeuze.
- Forged tenantId, hrGroupId, administrationId, employeeId, teamId, mode, filter, sort, cursor, fields of paging; cross-tenant/group/admin/subject actor; manager buiten directe-teamgrens.
- Prohibited response fields, free text, evidence/certificate details, interne identifiers, verborgen recordbestaan via status/error, ongeautoriseerde Workforce-count of disclosure onder de goedgekeurde privacydrempel.
- Herhaalde filters/querydifferencing, oversized response, onbekende properties, unsupported method en een GET zonder side effect.
- Limiter 429/Retry-After, limietuitval met veilige fail-closed response, gelijktijdige requests en juiste scheiding per tenant/groep/client/actor/resource.
- Auth-, audit-, limiter-, logger- en errorpaden bevatten geen tokens, secrets, prompt of ruwe HR-payload; verborgen records geven geen onderscheidende fout.

**Definition of Done:**

- Alleen formeel goedgekeurde resources, velden en scopes bestaan; OpenAPI, route en tests komen daarmee overeen.
- Bestaande servercontext, interne permissions, modules, domeinservices en RLS blijven authority-bron; stale grants/rollen en forged selectors falen gesloten.
- Gerichte lokale tests en type/lint voor gewijzigde code zijn groen; relevante bredere AA-REL-gates zijn alleen als GREEN gemarkeerd met hun eigen bewijs.
- Exacte lokale/Preview-SHA, gebruikte persona, route/status/request-ID en bevindingen zijn vastgelegd zonder secrets of persoonsgegevenspayload. Hosted eisen zijn niet uit lokale tests afgeleid.
- Geen ongoedgekeurde gedeelde auth/security/schemawijziging, remote migration, push, merge, deployment of externe activatie.
- CURRENT_CONTEXT en IMPLEMENTATION_STATUS geven actuele status en resterende handmatige acties.

**STOP** bij ontbrekende P-01 t/m P-05-goedkeuring, onduidelijke veld-/privacyclassificatie, niet-unieke subject-link, onvoldoende actuele re-autorisatie, concrete overlap met gedeelde securitycode, onveilige testconfiguratie, falende relevante gate of verzoek om een niet-geautoriseerde remote mutatie.

## Aanvullende scope en referenties

In-scope voor D0: documentatie, code-/contractinventarisatie, actuele statuscontrole, dependencyanalyse, vijf niet-goedgekeurde besluitvoorstellen en de daarvoor geautoriseerde eigen documentatiebranch/commit/push/PR naar main.

Historische D0-afbakening op 2026-10-03: API-implementatie, schema/permission/OAuth-client, externe API-test, merge en deployment vielen buiten die toenmalige documentatietaak. De latere, afzonderlijk geautoriseerde Final Integration Wave heeft de lokale kandidaat in PR #3 opgeleverd; de overige route-, database- en externe activatiegrenzen gelden nog steeds.

Repositorybronnen:

- docs/AA/AA-REQ.md, AA-OP.md, AA-TEST.md, AA-REL.md, AA-CURRENT.md, AA-ACCEPT.md, AA-NEXT.md en AA-PAYROLL.md.
- docs/architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md en ENVIRONMENT_AND_AI_RULES.md.
- docs/requirements/ai/LIQUIDHR_AI_FOUNDATION_WAVE_0.md en docs/requirements/chatbot/HERA_AI_AGENT.md.
- docs/decisions/ADR-0001-tenant-en-administratiegrenzen.md, ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md, ADR-0010-ai-runtime-governance.md en FDR-0008-ai-capability-en-liquid-credits.md.
- apps/hr-suite/lib/auth/permissions.ts; lib/context/server-context.ts; lib/context/administration-context.ts.
- apps/hr-suite/lib/hera/read-tools.ts, tool-registry.ts, tools.ts en data-contract.ts.
- apps/hr-suite/lib/ai/contracts.ts, runtime.ts, orchestrator.ts, feature-registry.ts, supabase-liquid-credits.ts, supabase-governance.ts en durable-recovery.ts.
- apps/hr-suite/lib/talent/team-service.ts, team-model.ts, employee-capability-service.ts en goal-service.ts; apps/hr-suite/app/api/talent/team-matrix en goals.
- Payroll source/provider boundaries onder apps/hr-suite/lib/payroll, packages/payroll-engine en genoemde Nmbrs-migrations.
- AA-REL en docs/quality/acceptance/runs/ONE-VERSION-20261002.md voor release gates/evidence.

Deze notitie vervangt voor deze inventarisatie de verouderde APIAI-baseline en historische readiness-aannames. Zij merge, delete of herschrijft geen historische decision artifacts.

## 11. Direct uitvoerbare vervolgopdracht voor APIAI-01

Ga verder vanaf de bestaande lokale kandidaat in de geïsoleerde worktree op branch work/apiai-01-build-20261003. Controleer eerst actuele PR #2/#3-heads, main-baseline, worktree-eigenaars en Vercel no-deployment-guard. Herbouw de foundation niet en raak geen andere worktrees aan.

**Doel:** maak de self-only Development Plans GET lokaal volledig bewezen. Laat alle publieke APIAI-routes ongemount totdat toepasselijke Product-, Security-, Privacy-, Data- en Operations-besluiten formeel zijn vastgelegd en de bearer-, database-, privacy- en auditgates aantoonbaar slagen.

1. Leg P-01 t/m P-05 vast als aangenomen, aangepast of afgewezen ADR/FDR/requirement. Kies provider en dezelfde-bearer-intrekkingsgarantie; map API-scopes alleen als bovengrens op bestaande LiquidHR-permissions/modules/AuthContext; bevestig de Development Plans-allowlist; houd Workforce Summary en Team Skills buiten de afgeronde scope totdat hun contract/privacygrenzen zijn goedgekeurd; besluit quota, fouten, auditbron, IDs, retentie en auditprovenance.
2. Behoud uitsluitend listSelfDevelopmentPlans en de velden periodStart, periodEnd, progressPercent, status en completedAt. Geen mode/employee/contextselector, title, vrije tekst, subjectref of interne identifiers.
3. Bewijs in een geïsoleerde lokale providerstack issuer, audience, client, PKCE S256, subjectlink en onmiddellijke intrekking van dezelfde nog geldige bearer. Bind die bearer aan de actuele LiquidHR AuthContext en dezelfde Supabase RLS-client. Test positieve self-read en tenant-, HR-groep-, administratie-, actor-, permission-, module- en revocation-negatives. Geen cookie- of service-rolefallback.
4. Start alleen lokale PostgreSQL via de officiële worktree-runtime. Voer de draft migration, 36 pgTAP-asserties, limiter-capacity/concurrency, RLS/grants/readback, advisors en typegen uit. Voeg een directe audit-RPC-negative toe die vervalste ALLOWED/status/correlation afwijst, of ontwerp en toets een vertrouwde route-only write-path. Niets remote toepassen.
5. Mount hoogstens Development Plans wanneer approvals en alle relevante security/privacychecks groen zijn. Test echte loopback HTTP-verzoeken met normale login/rolwisseling, no-store, foutredactie, veldallowlist, limiter en persistente audit. Laat Workforce Summary en Team Skills ongemount.
6. Herhaal gerichte regressies, volledige suite, strict TypeScript, lint, officiële Production-build en onafhankelijke LUNA MAX-review na alle correcties. Noteer exacte SHA, poort, testlaag en bewijsgrenzen.
7. Stop vóór Preview/deployment, remote migratie, externe provideractivatie of merge. Push alleen als de actuele opdracht dit expliciet toestaat en na controle van PR-heads en no-deployment-guard.
