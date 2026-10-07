# APIAI-06 — Controlled Actions

Status: **lokale Employee-, Manager- en HR Admin-acceptatie en regressies geverifieerd; shared-TEST deployment/hosted smoke pending; HeRa-provideracceptatie afzonderlijk open**
Datum: 2026-10-07
Baseline: `38ccbcac6423824a1dba7075f022f68771edf087`
Implementation: `c37646e3e6033368080d0fad60a8bad9cdc91907` on `work/apiai-06-controlled-actions-20261006`

## Doel

HeRa en de lokale MCP-adapter mogen alleen beperkte Talent-mutaties uitvoeren via één gedeeld, server-side action-contract. Iedere mutatie volgt:

`Prepare → Preview → Confirm → Execute → Readback`

Dit document verleent geen toestemming voor publieke APIAI-01-routes, een publieke MCP-server, ChatGPT-registratie, remote databasewijzigingen of deployment.

## Toegestane acties

De eerste iteratie ondersteunt uitsluitend bestaande Talent-services:

1. `talent.development-goal.create` via `createTalentGoal`.
2. `talent.goal-check-in.create` via `createTalentGoalCheckIn`.

Server-side Zod-validatie, de bestaande Talent-autorisatie, tenantmodulecontrole en servicefuncties blijven de gezaghebbende grens. Een adapter mag geen eigen permissionsysteem of directe domein-DML toevoegen.

## Lifecyclecontract

- **Prepare:** valideer action-ID, payload, eigenaar/tenantconversatie en UUID-idempotency key; autoriseer de domeinactie; sla een servergegenereerde preview, payload en previewhash op. Een draft verloopt na 15 minuten.
- **Preview:** lees de eigenaargebonden draft terug en herhaal autorisatie en previewberekening. Een hash bindt payload, preview, tenant, actor, HR group, administratie, rollen en permissions.
- **Confirm:** vereist expliciete bevestiging met de verwachte draftversie en previewhash. De write is compare-and-set.
- **Execute:** herhaalt autorisatie en hashcontrole, claimt de draft atomair, voert uitsluitend de bestaande domeinservice uit en schrijft daarna de definitieve status. Een onbekende transportuitkomst blijft `EXECUTING` en mag niet automatisch opnieuw uitvoeren.
- **Readback:** geeft na succes alleen een beperkte, opnieuw geautoriseerde projectie terug. Readbackfouten herhalen de business-write niet.
- **Cancel:** alleen een nog niet bevestigde/uitgevoerde draft kan worden geannuleerd.

De idempotency key is eigenaar- en tenantgebonden. Hergebruik met andere inhoud geeft conflict; een voltooide herhaling geeft uitsluitend readback en voert de domeinactie niet opnieuw uit. Correlation ID blijft gelijk over de lifecycle.

## Opslag, RLS en audit

De bestaande `ai_action_drafts`-tabel wordt hergebruikt. De migratie:

- breidt de bestaande action/tool-allowlists uit met alleen de twee hierboven genoemde acties;
- behoudt eigenaargebonden reads;
- laat legacy drafttypen hun bestaande authenticated eigenaarsschrijfpaden behouden;
- reserveert insert/update/delete voor de twee controlled actiontypen aan de bestaande server-only `createAdminClient`-route na serverautorisatie;
- auditeert prepare, confirm, start, success, failure en cancel in `audit_logs`, met correlation ID en zonder action-payload/body;
- trekt directe execute op de interne triggerfunctie in.

De Admin-client wordt uitsluitend in de server-only controlled-actionservice gebruikt. Mutaties worden aanvullend begrensd op tenant, eigenaar, draft-ID, status, verwachte versie en vervaltijd. De conversation wordt met de gewone RLS-client op tenant en eigenaar gevalideerd vóór de privileged insert. De domeinmutaties zelf blijven via de bestaande geautoriseerde Talent-services lopen.

De remote TEST-database bevat deze SQL-wijziging al onder migration history version `20261007054728_apiai06_controlled_actions`. De lokale migratiefile en contracttest zijn op die versie afgestemd en de SQL-inhoud is na normalisatie byte-identiek behouden. Voer deze SQL niet opnieuw uit, maak geen duplicaat en gebruik geen drop/recreate. De read-only geverifieerde RLS-, type-, advisor- en auditresultaten en resterende acceptatiegates staan in het [acceptatierapport](../../quality/acceptance/runs/APIAI-06-20261006.md). Deze TEST-migratie verleent geen toestemming voor productie-, publieke of externe activatie.

## Integraties en grenzen

- **HeRa:** gebruikt de gedeelde service via authenticated interne routes; modeltekst kan geen uitgevoerde status voorspiegelen vóór bevestiging.
- **Lokale MCP:** Prepare, Preview, Confirm, Cancel, Execute en Readback gaan door dezelfde service; de adapter blijft local-only en fail-closed buiten development/test.
- **ChatGPT MCP:** blijft read-only; geen registratie of muterende action-tool wordt gepubliceerd.
- **Publieke APIAI-01:** blijft ongemount en fail-closed.
- Geen nieuwe provider, externe authorisatie, databasecontract, infrastructuur of kostenveroorzakende dienst.

## Acceptatiegates

Lokale unit-, route-, migratiecontract-, type-, lint-, i18n-, volledige regressie- en productiebuildgates zijn vereist. Tests moeten positieve en negatieve autorisatie voor Employee, Manager en HR Admin afdekken. Hosted personaacceptatie gebruikt dezelfde drie bestaande identiteiten en mag geen auth-bypass inzetten. De 2026-10-07 lokale acceptance gebruikte eerder de officiële launcher en bestaande runtime; de protected canonical `.env.local` is niet gelezen, gekopieerd of gewijzigd. Een latere herstartpoging kon niet door preflight; de bestaande metadata-only provisioner weigerde een bezette bestemming te overschrijven die niet als canonical hardlink kon worden geverifieerd. Geen runtimefile veranderde en een extra logout/stale-context-browserrecheck blijft open. HeRa-provideracceptatie vereist de reeds bestaande providerconfig; voeg hiervoor geen dienst of kosten toe. Wanneer die configuratie ontbreekt, moet HeRa fail-closed blijven (`503 HERA_PROVIDER_UNAVAILABLE`) en mag geen mutation plaatsvinden zonder de expliciet geautoriseerde provider/tool lifecycle. Deze providercheck is een afzonderlijke integratiegate en blokkeert lokale convergence niet zolang dit fail-closed gedrag intact blijft.

Lokale convergence is ready na afgeronde Employee/Manager/HR Admin-acceptatie, exacte product-code regressies en fail-closed probes. De remote TEST-migratie is al toegepast en geverifieerd; die stap mag niet worden herhaald. De shared-TEST deployment en hosted personaacceptatie blijven aparte release gates; de actuele gebruiker heeft de deployment van de gemergde exacte main-SHA naar het bestaande `liquidhr` Production-target als gezamenlijke TEST expliciet geautoriseerd. Publieke APIAI-01, publieke MCP en ChatGPT-registratie blijven buiten APIAI-06-scope. Zie het [acceptatierapport](../../quality/acceptance/runs/APIAI-06-20261006.md) voor actuele status.
