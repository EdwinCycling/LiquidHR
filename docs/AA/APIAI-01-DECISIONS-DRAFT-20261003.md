# APIAI-01 — Besluitvoorstellen voor externe alleen-lezen-API

**Datum:** 2026-10-03
**Status:** alle vijf onderdelen zijn **PROPOSAL / NOT APPROVED**.
**Scope:** voorbereiding van APIAI-01; dit document autoriseert geen implementatie, OAuth-configuratie, migratie, remote wijziging of publieke route.

Dit is een zelfstandige ontwerpbeoordeling op basis van de goedgekeurde ADR's/FDR's, de huidige autorisatie- en read-services en de bestaande audit- en securitypatronen. Het D0-document en PR #2 zijn ontwerpinput; daaruit volgt geen goedkeuring. De bestaande `AuthContext`, server-side permissiecontroles en RLS blijven de autoritatieve grenzen.

## Onderzochte uitgangspunten

- `docs/decisions/ADR-0001-tenant-en-administratiegrenzen.md`, `ADR-0007-talent-fase-2-eigendom-en-gegevensbescherming.md` en `ADR-0009-hr-groepen-als-zichtbaarheids-en-inrichtingsgrens.md` bepalen tenant-, administratie- en HR-groepsgrenzen.
- `docs/decisions/ADR-0010-ai-runtime-governance.md` en `docs/decisions/FDR-0008-ai-capability-en-liquid-credits.md` bevestigen dat server-side `AuthContext` de enige scopebron is en dat een externe identiteit geen tweede autorisatielaag mag worden.
- `apps/hr-suite/lib/auth/permissions.ts`, `lib/context/server-context.ts` en `lib/context/administration-context.ts` valideren de actieve context tegen toegankelijke contexten. De bestaande talentservices zijn `lib/talent/team-service.ts`, `employee-capability-service.ts` en `goal-service.ts`.
- `docs/architecture/API_LANDSCHAP_EN_EXTERN_INTEGRATIE.md` beschrijft `/api/v1/*` als een nog te ontwerpen extern contract. De bestaande `/api/*`-BFF-routes zijn geen partner-API.
- `apps/hr-suite/supabase/migrations/20260715121230_complete_employee_core.sql` en de daaropvolgende auditmigraties geven `audit_logs` als huidige auditbron. De tabel heeft nu geen `READ`-actie, geen `hr_group_id` en een verplicht `entity_id`.
- De kandidaatbestanden onder `apps/hr-suite/lib/api-v1/` voor projecties, rate limiting, audit en foutafhandeling zijn scaffolding en worden hieronder niet als bewijs of besluit behandeld.

## P-01 — Externe OAuth en gedelegeerde toegang — **PROPOSAL / NOT APPROVED**

### Voorgestelde keuze

Gebruik voor menselijke gedelegeerde toegang een provider-neutrale Authorization Code-flow met PKCE en dwing daarbij `S256` af. Kies een concrete provider pas nadat de capability, redirect-lifecycle en goedgekeurde TEST-configuratie aantoonbaar zijn gecontroleerd. Een API-client krijgt een eigen geregistreerde identiteit en verleent toegang aan een bestaande LiquidHR-gebruiker; de externe identiteit wordt uitsluitend gekoppeld via een unieke, gevalideerde combinatie van issuer en subject aan één bestaande `auth.users.id`.

Valideer bij ieder verzoek de issuer, audience, clientbinding, handtekening en toegestane algoritmen, tijdclaims en revocatie-/unlink-status volgens de gekozen provider. Laad daarna de actuele LiquidHR `AuthContext` en voer de normale server-side permissie- en RLS-controles uit. Een token-scope is een bovengrens en verleent nooit zelfstandig toegang. Gebruik geen browsercookie als partneridentiteit, ID-token als API-bearer, e-mailmatching, gedeelde API-key of client-credentials-flow voor een menselijke actor.

### Onderbouwing

Dit houdt één identiteits- en autoriteitsbron in stand, zoals vereist door ADR-0010 en HERA's externe-kanaalregels. Het voorkomt dat een oude token, een gewijzigde rol of een onbeheerde context buiten de bestaande LiquidHR-grenzen valt. De API-landschapsdocumentatie vereist voor externe toegang een afzonderlijke `/api/v1/*`-laag met API-client- en scopesemantiek, niet het hergebruik van interne BFF-routes.

### Officiële Supabase-verificatie — conditionele kandidaat

De officiële Supabase-documentatie is op 2026-10-03 gecontroleerd. Supabase Auth OAuth 2.1 Server ondersteunt Authorization Code met PKCE en refresh tokens; client-credentials en password grants worden niet ondersteund. De OAuth-flow vereist een eigen implementatie van de authorization/consent-UI en is niet als OAuth-serverfunctionaliteit beschikbaar via `@supabase/supabase-js`. Supabase Auth voert wel de protocolverwerking uit nadat de eigen UI de aanvraag goed- of afkeurt. Zie [OAuth 2.1 Flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows).

De capability is volgens [Getting Started with OAuth 2.1 Server](https://supabase.com/docs/guides/auth/oauth-server/getting-started) beta. Dezelfde documentatie beschrijft expliciete clientregistratie, exacte redirect-URI's en een voorkeur voor asymmetrische JWT-sleutels. Dit maakt Supabase Auth OAuth Server een **conditionele kandidaat**, geen providerkeuze of configuratiebesluit.

De beschikbare Supabase-scopes zijn standaard OIDC-scopes (`openid`, `email`, `profile`, `phone`). Volgens [Token Security and Row Level Security](https://supabase.com/docs/guides/auth/oauth-server/token-security) bepalen deze scopes welke OIDC/UserInfo-gegevens beschikbaar zijn; zij geven geen resource- of API-permissions en custom scopes worden momenteel niet ondersteund. De access token bevat wel een `client_id`-claim en bestaande RLS blijft gelden. De voorgestelde LiquidHR-scopes (`workforce.summary.read`, `team.skills.read` en `development-plans.self.read`) kunnen daarom niet als native Supabase-scopes worden aangenomen. Zij vereisen aanvullende, server-side applicatie-enforcement en een nog goed te keuren koppeling met `AuthContext`/RLS, of een andere goedgekeurde provider-/gatewayarchitectuur.

Bij Supabase zijn `aud` en `client_id` afzonderlijke claims: de gedocumenteerde access token gebruikt `aud: authenticated` en een aparte `client_id`, terwijl een OIDC ID-token `aud: client-id` gebruikt. De provideradapter moet daarom de access-token-audience en clientbinding afzonderlijk valideren; een ID-token mag geen API-bearer worden. Supabase documenteert zowel `S256` als `plain` als mogelijke PKCE-methode. APIAI-01 moet `plain` weigeren en `S256` afdwingen, ook wanneer de gekozen provider dat ruimer toestaat. Zie [OAuth 2.1 Flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows).

Supabase beschrijft `revokeGrant(clientId)` als het ongeldig maken van actieve sessies en refresh tokens en het verwijderen van die refresh tokens. De documentatie levert daarmee nog geen APIAI-01-bewijs dat een reeds uitgegeven, nog niet verlopen access token onmiddellijk door iedere route wordt geweigerd. Een TEST-proef moet daarom expliciet bewijzen dat zo'n token na `revokeGrant` wordt afgewezen, naast het gedrag bij unlink, rolwissel en contextwijziging. Dit blijft een afzonderlijke Security-gate.

### Alternatieven

- Een andere OAuth/OIDC-provider met dezelfde verificatie- en lifecycle-eisen.
- Supabase Auth OAuth 2.1 Server als conditionele kandidaat wanneer beta-aanvaarding, de custom authorization-UI, app-level resource-scope-enforcement, asymmetrische tokenverificatie en directe revocatie aantoonbaar zijn goedgekeurd.
- Alleen browserlogin met een afzonderlijk, kortlevend en expliciet API-access-token; dit is alleen acceptabel als de tokenbinding en revocatie gelijkwaardig aantoonbaar zijn.
- Client credentials voor niet-menselijke integraties in een latere scope; dit valt buiten de eerste gedelegeerde gebruikersflow.

Een gedeelde API-key, e-mailmatching of rechtstreekse browsercookie-doorgifte is geen aanvaardbaar alternatief.

### Impact op APIAI-01

Er zijn een provider-adapter, clientregistratie, link/unlink-levenscyclus, redirect/callback-beleid en server-side tokenverificatie nodig voordat een publieke route kan worden geactiveerd. Er wordt nu geen provider gekozen en geen OAuth-secret/configuratie of callback-route toegevoegd. Wijzigingen in gebruiker, rol, tenant, HR-groep of context moeten bij een nieuw verzoek opnieuw uit `AuthContext` worden afgeleid.

### Expliciete goedkeuring vereist

- **Product:** gekozen provider, typen clients, consent-tekst, link/unlink- en intrekkingsgedrag, redirectdomeinen en ondersteuning voor menselijke versus machine-identiteiten.
- **Security:** tokenvalidatie, issuer/audience/JWKS- en algoritmebeleid, replay/revocatie, CORS/redirectbeperkingen, logging-redactie en incidentgedrag; bij Supabase specifiek het onderscheid tussen standaard OIDC-scopes en LiquidHR-resource-scopes, `client_id`-binding in RLS en bewijs van directe access-tokenrevocatie.
- **Privacy/platform:** gegevensverwerking door de provider, TEST/Preview-secretbeheer, bewaartermijnen, beta-aanvaarding en aantoonbare provider-capabilities; Supabase wordt niet geconfigureerd voordat deze beoordeling is afgerond.

## P-02 — Mapping van externe scopes naar bestaande LiquidHR-autorisatie — **PROPOSAL / NOT APPROVED**

### Voorgestelde keuze

Houd externe OAuth-scopes los van interne permissions en map iedere scope server-side naar bestaande, canonieke permissions. De volgende minimale mapping wordt voorgesteld:

| Externe scope | Bestaande LiquidHR-grens | Voorgestelde eerste betekenis |
| --- | --- | --- |
| `workforce.summary.read` | `employee:read` | Alleen een privacy-goedgekeurde workforce-samenvatting binnen de actuele tenant/HR-groep/context. |
| `team.skills.read` | `talent-team:read` + actieve `TALENT`-module | Dezelfde teamscope als `listTalentTeamMatrix`; een manager blijft bij de door de service afgeleide directe scope, terwijl `talent:manage` de bestaande bredere scope kan geven. |
| `development-plans.self.read` | `self:talent-goal:read` + actieve `TALENT`-module | Alleen de plannen van het `employeeId` uit `AuthContext`; geen door de client gekozen medewerker. |
| `development-plans.team.read` (later) | `talent-goal:read` | Alleen na een bewezen server-side direct-reportfilter en aparte goedkeuring; geen onderdeel van de eerste contractset. |

De client mag geen `tenantId`, `hrGroupId`, `administrationId`, `employeeId`, `teamId` of `mode` aanleveren om de scope te verruimen. De server kiest de context en de RLS-policy bepaalt de uiteindelijke dataset. Ontbrekende context, module, permission of actor-link resulteert in fail-closed gedrag.

De namen in deze tabel zijn APIAI-01-scopeconcepten en worden niet als native Supabase OAuth-scopes gepresenteerd. Bij een Supabase-implementatie is voor deze resourcegrenzen aanvullende server-side applicatie-enforcement en een goedgekeurde scope-adapter nodig; standaard OIDC-scopes bepalen alleen de OIDC/UserInfo-gegevens.

De mapping is pas uitvoerbaar wanneer de bearer aan dezelfde RLS-scope wordt gebonden als de geladen `AuthContext`. De huidige `createClient()` gebruikt een cookie-gebonden `@supabase/ssr`-client en `createAdminClient()` gebruikt service-role; geen van beide is een toegestane gedelegeerde API-reader. Supabase adviseert voor header-authenticatie een aanroepergebonden `@supabase/server`-client die RLS respecteert, maar die adapter en package zijn nog niet in de huidige APIAI-01-code aanwezig. Er zijn daarom eerst een getypeerde bearer-gebonden reader en negatieve tenant-, HR-groep-, administratie- en subjecttests nodig. Tot dat bewijs bestaat, blijft de route ongemount en mag een service-role fallback niet worden toegevoegd. Zie [Which Supabase server package to use](https://supabase.com/docs/guides/auth/choosing-a-server-package).

### Onderbouwing

ADR-0001 en ADR-0009 maken tenant, administratie en HR-groep tot harde grenzen. `permissions.ts` maakt de bestaande permission- en self-resolution server-side afdwingbaar. De huidige talentservices gebruiken al `talent-team:read`, `talent:manage`, `self:talent-goal:read` en `talent-goal:read`; nieuwe interne permissionnamen zouden de bestaande autorisatiematrix onnodig dupliceren. De huidige goal-service verdient eerst een aparte scopecontrole voordat een teamvariant wordt aangeboden.

### Alternatieven

- Eén brede externe scope zoals `workforce.read`; dit is minder least-privilege en maakt consent en revocatie minder precies.
- Eén scope per veld of filter; dit geeft te veel contractcomplexiteit zonder extra bewijs in de eerste release.
- Alleen `workforce.summary.read` starten en de twee talentresources later toevoegen; dit is de veilige fallback wanneer de service- of privacyreview niet rond is.

### Impact op APIAI-01

Er is een expliciete scope-adapter nodig die eerst externe scope, actor-link en actuele `AuthContext` controleert en daarna bestaande `requirePermission`-/modulechecks aanroept. Er komen geen nieuwe interne permissions, geen clientgestuurde contextkeuze en geen omweg om RLS heen. Team-plannen blijven buiten de eerste externe API totdat de directe-reportgrens in de service aantoonbaar is.

### Expliciete goedkeuring vereist

- **Product:** namen en betekenis van externe scopes, consent-tekst, welke populatie een partner verwacht en of `talent:manage` ooit extern tenantbreed mag werken.
- **Security:** volledige scope-to-permissionmatrix, contextkeuze, tokenrevocatie en fail-closed gedrag bij ontbrekende of verouderde context.
- **Domein/privacy:** populatie- en velddefinities per resource, inclusief de vraag of HR-groep, administratie en tenant in elk antwoord voldoende afgeschermd blijven.

## P-03 — Eerste alleen-lezen-resources en veldcontracten — **PROPOSAL / NOT APPROVED**

### Voorgestelde keuze

Start uitsluitend met GET-readers en typed allowlist-projecties. De kandidaatcontracten zijn:

1. **Workforce Summary** (`workforce.summary.read`): `asOfDate` en, pas na P-04-goedkeuring, `activeEmployeeCount`. De telling is alleen toegestaan wanneer de volledige server-afgeleide zichtbare populatie voldoet aan de goedgekeurde minimum- en suppressieregels. Er worden geen namen, employee-ID's, salarissen of uitsplitsingen opgenomen.
2. **Team Skills** (`team.skills.read`): uitsluitend een privacy-goedgekeurde projectie van `capabilityCode`, `capabilityType`, `status`, `validFrom` en `validUntil`. `teamId`, employee-ID, naam, personeelsnummer, `subjectRef`, bewijs, certificaatcode, document en vrije tekst blijven buiten het eerste contract. Als een bruikbare niet-herleidbare projectie niet kan worden bewezen, blijft deze resource `DEFERRED`.
3. **Development Plans — self** (`development-plans.self.read`): `periodStart`, `periodEnd`, `progressPercent`, `status` en nullable `completedAt`. De actor wordt uitsluitend uit `AuthContext.employeeId` gehaald. Geen `planId`, employee-ID, capability-ID, titel/omschrijving, bron-, versie- of archiveervelden.

Alle drie responses zijn versieerbare, expliciet getypeerde projecties; interne DTO's van `team-service.ts`, `employee-capability-service.ts` en `goal-service.ts` worden nooit rechtstreeks geserialiseerd. De semantiek en enumwaarden van `status` worden niet stilzwijgend uitgebreid.

### Onderbouwing

De bestaande services leveren bredere interne modellen met identificeerbare medewerkers, organisatiegegevens, evidence- en certificaatmetadata. ADR-0007 en FDR-0003 vereisen afzonderlijke self/manager/HR-projecties en verbieden het automatisch delen van raw evidence, scores of aggregaten. De kandidaatprojector onder `lib/api-v1/resources/` is nuttig als technische richting, maar is geen goedgekeurd veldcontract of acceptatiebewijs.

### Alternatieven

- Alleen Workforce Summary starten totdat Team Skills een aantoonbaar niet-herleidbare projectie heeft.
- Een stabiele opaque `subjectRef` voor Team Skills of `planRef` voor self-plans; alleen na een aparte linkability-review en expliciete productvraag.
- De bestaande service-DTO's doorgeven; dit is uitgesloten wegens overexposure en onduidelijke contractstabiliteit.

### Impact op APIAI-01

Er zijn per resource typed projectors, schema-validatie en contracttests nodig. De services blijven de bron voor autorisatie en filtering; de API-laag mag geen eigen databasequery of contextfilter introduceren. De Team Skills-route kan functioneel worden uitgesteld zonder de andere twee resources vrij te geven.

### Expliciete goedkeuring vereist

- **Product:** resourcevolgorde, betekenis van `asOfDate`, teller/status/periodedata en de vraag of titel of opaque referenties nodig zijn.
- **Security/privacy:** herleidbaarheid van iedere veldcombinatie, minimumgroottes, eventuele subject- of planreferenties en verbod op vrije tekst/evidence.
- **Domeineigenaar:** geldige statuswaarden, datum- en nullabilityregels en de precieze populatie achter elke bestaande service.

## P-04 — Dataminimalisatie, aggregatie en privacygrenzen — **PROPOSAL / NOT APPROVED**

### Voorgestelde keuze

Gebruik per resource een vaste server-side allowlist en `Cache-Control: no-store`. Neem in API-responses, foutdetails, auditvelden en applicatielogs geen BSN, salaris, contactgegevens, medische of verzuimdetails, documenten, evidence-inhoud, vrije tekst, prompts, providerpayloads, tokens, secrets of onnodige interne identifiers op. De eerste API-versie accepteert geen clientgestuurde peildatum, willekeurige filters, sortering of uitsplitsingen die een populatie kunnen verkleinen.

Aggregaten en vergelijkingen blijven uitgeschakeld totdat een afzonderlijk privacybesluit is genomen. De minimumgroepgrootte 5 uit FDR-0003 is slechts een ondergrens voor een mogelijke latere productfunctie; zij autoriseert op zichzelf geen API-telling. Een later aggregate-besluit moet ten minste suppressie van kleine groepen, bescherming tegen differencing door herhaalde queries, begrensde querymogelijkheden en een passende audit-/retentiecontrole bevatten.

### Onderbouwing

ADR-0007 verbiedt brede tabeltoegang, raw evidence en onbesliste aggregate-/matchscores. FDR-0003 scheidt self/manager/HR-projecties en behandelt de groep-5-regel als toekomstig beleid. `TalentTeamMatrix` markeert aggregatebeleid momenteel als `DISABLED`. De API-architectuur noemt strikte dataminimalisatie en sluit BSN, salaris, documenten en medische data als defaults uit.

### Alternatieven

- Alleen individuele self-data aanbieden en alle populatie- of teamdata uitstellen.
- Een privacy-reviewed aggregate-resource later toevoegen met een eigen contract en querybudget.
- Team Skills volledig uitstellen wanneer zelfs de allowlist niet voldoende tegen herleiding beschermt.

### Impact op APIAI-01

De projectors moeten allowlist-first zijn en mogen geen `select *` of raw service-JSON doorgeven. Caching en observability moeten aantoonbaar geen HR-payloads bewaren. De eerste release bevat geen count- of breakdownbelofte voordat P-04 en P-03 beide zijn goedgekeurd.

### Expliciete goedkeuring vereist

- **Product/privacy:** toegestane velden, doelbinding, bewaartermijn, client-side opslag en betekenis van iedere aggregate-uitkomst.
- **Security:** re-identificatie-, linkability- en differencinganalyse, redactie in logs/audit en `no-store`/cachecontrole.
- **Domein:** classificatie van status-, datum- en capabilityvelden en de vraag welke historische/archived records überhaupt in een toekomstige populatie mogen vallen.

## P-05 — Rate limiting, audit en foutafhandeling — **PROPOSAL / NOT APPROVED**

### Voorgestelde keuze

Gebruik één gedeelde, atomische server-side limiter met een sleutel die minimaal tenant, HR-groep, gedelegeerde actor, OAuth-client en resource bindt. Een eventuele administratiecomponent kan aanvullend worden gebruikt wanneer die voor de resource relevant is. Een IP-adres mag alleen als secundaire, gehashte abuse-sleutel dienen en nooit als autoriteitsbron. Gebruik geen process-memorylimiter en geen service-role fallback voor normale gedelegeerde verzoeken.

Als startpunt voor lokale synthetische belastingtests kan `60/minuut` per actor/client/resource met burst `10` en `600/uur` per client/tenant worden onderzocht. Dit zijn **test- en ontwerpparameters, geen goedgekeurde productquota**. Bij onbeschikbaarheid van de limiter wordt fail-closed `503` gebruikt; overschrijding geeft `429` met een begrensde `Retry-After`.

Gebruik `audit_logs` als enige auditbron, maar alleen na een goedgekeurde, additive uitbreiding of een goedgekeurde auditservice-adapter voor resource-level READ-events. De huidige tabel kan dit niet rechtstreeks representeren: er is geen `READ`-actie of `hr_group_id` en `entity_id` is verplicht terwijl een resource-read geen natuurlijke entity hoeft te hebben. Verzin daarom geen entity-ID en maak geen tweede ad-hoc audit-tabel. Een goedgekeurd auditontwerp moet minimaal correlation/request-id, actor, client, tenant/HR-groep/administratiecontext, resource, actie, uitkomst en status kunnen vastleggen, zonder token, headers, raw HR-data, prompt, providerpayload of onnodig IP. De huidige APIAI-scaffolding geeft alleen `correlationId` aan de auditwriter door; `requestId` wordt nog niet opgeslagen. Product en Security moeten expliciet kiezen of correlation-only voldoende is of dat beide IDs worden vastgelegd.

Gebruik een stabiele externe foutomhulling met `error.code` en `requestId`. Houd statusklassen voorspelbaar (`400/422`, `401`, `403`, generieke `404`, `405`, `413`, `429`, `503`, `500`) en lek geen interne permissie-, query- of providerinformatie. `401`/`403`/`404` moeten ook geen verborgen populatie bevestigen.

### Onderbouwing

De recruitment-intake heeft een atomische databasebeperking, maar is een specifieke service-role/proof-flow en geen patroon voor normale APIAI-actoren. De bestaande auditmigraties staan alleen goedgekeurde, gescopeerde writes toe en bevatten nog geen resource-level READ-contract. De kandidaatmodules onder `lib/api-v1/security/` zijn richtinggevend maar missen onder meer een gedelegeerde actorbinding en vormen geen goedkeuring.

### Alternatieven

- Een edge/gateway-limiter als aanvullend abuse-mechanisme, mits de serverlimiet en actorbinding behouden blijven.
- Per resource afzonderlijke quota na load- en privacyonderzoek; niet als eerste ongeteste productbelofte.
- Een bestaande auditservice-adapter wanneer een additive `audit_logs`-uitbreiding niet verenigbaar blijkt met de huidige RLS/grants; de auditbron blijft dan nog steeds één goedgekeurd systeem.

### Impact op APIAI-01

Geen publieke route is bouw- of acceptatiegereed zonder atomische limiter, actorbinding, fail-closed gedrag, een goedgekeurd READ-auditcontract en stabiele foutcodes. Een eventuele schemawijziging vereist de normale RLS/grant-, advisor- en typegencontrole; remote toepassen blijft een afzonderlijke expliciete goedkeuring. De voorgestelde aantallen mogen niet als quota in documentatie of code worden vastgelegd voordat Product en Operations ze hebben vastgesteld.

### Expliciete goedkeuring vereist

- **Product/Operations:** quota, burst, kosten-/misbruikbeleid, alerting, clientcommunicatie en uitzonderingsprocedure.
- **Security:** sleutelbinding, atomiciteit, fail-closed gedrag, actor-/contextwissels, auditredactie, foutlekken en abuse-monitoring.
- **Data/DB-eigenaar:** representatie van READ-events in `audit_logs`, RLS/grants, retention, correlatie-idbeleid en eventuele migratie/typegen/advisorstappen.

## Gebruik van dit document

Deze vijf punten zijn beslisinvoer voor APIAI-01. Geen enkel punt is goedgekeurd door opname in D0-documentatie, door PR #2 of door kandidaatcode. Na expliciete Product-, Security- en waar genoemd Privacy/Platform-goedkeuring moeten de gekozen besluiten eerst als formele ADR/FDR of aanvullend goedgekeurd contract worden vastgelegd; pas daarna kunnen routes, schema's, providerconfiguratie en externe acceptatietests worden gebouwd.
