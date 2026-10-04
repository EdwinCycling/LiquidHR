# APIAI-01 — besluitvoorstellen

**Status: VOORSTELLEN, NIET GOEDGEKEURD**
Datum: 2026-10-03
Repositorybasis: GitHub main 6349d02538351cd01fc51f298c6e6fa0ba88006c

Dit document maakt vijf concrete keuzes bespreekbaar voor APIAI-01. Het is geen ADR/FDR, productbesluit, securitygoedkeuring of implementatie-autoriteit. De eigenaar moet de voorstellen formeel aannemen, aanpassen of afwijzen voordat afhankelijke code start. De codebase en goedgekeurde besluiten blijven leidend tot die goedkeuring.

**Follow-up 2026-10-04:** De geïsoleerde Keycloak 26.8-proef is uitgevoerd en staat beschreven in de [APIAI-01-acceptatierun van PR #3](https://github.com/EdwinCycling/LiquidHR/blob/work/apiai-01-build-20261003/docs/AA/APIAI-01-ACCEPTANCE-RUN-20261003.md). Dit verandert geen enkel voorstel in een goedkeuring en kiest geen provider. De lokale kandidaat in Draft PR #3 heeft de bearer/RLS-seam en self-only Development Plans-projector geïntegreerd; externe routes blijven ongemount en databasecode blijft unapplied.

## P-01 — Externe OAuth en gedelegeerde toegang

**Voorgestelde keuze**

Gebruik, als de gekozen Supabase Auth-configuratie de vereiste resource-audience en lifecycle kan afdwingen, Authorization Code met PKCE S256 als delegated-user flow. OAuth vertegenwoordigt een bestaande LiquidHR-gebruiker en geeft geen zelfstandige service- of tenantbevoegdheid. Gebruik geen client credentials, gedeelde API-key, browsercookie, ID-token als API bearer of e-mailmatching. Registreer clients afzonderlijk per omgeving/kanaal met exacte redirect-URI's en minimale TTL's.

Koppel een geverifieerde issuer + subject-combinatie aan precies één bestaande auth.users.id; weiger ontbrekende, dubbele of ambigue koppelingen. E-mail mag uitsluitend als display-/contactveld dienen en nooit als linkbewijs. Valideer bij iedere aanvraag issuer, audience/resource, client, handtekening/JWKS, algoritme, expiry en de actuele status van het gedelegeerde grant/token. Alleen JWT-handtekening en expiry controleren trekt een eerder uitgegeven bearer niet direct in. Directe intrekking vereist geteste tokenintrospectie of een vertrouwde grant-livenesscontrole bij iedere aanvraag; test daarbij dezelfde bearer vóór en na intrekking. Laad ook steeds de actuele LiquidHR AuthContext en herhaal autorisatie; scopes zijn hoogstens een bovengrens. Behandel revoke, unlink, accountuitschakeling en rol-/contextwijziging als actuele toegangswijzigingen.

Supabase OAuth server staat in de geraadpleegde documentatie als public beta. Beschikbaarheid, tenantconfiguratie, claims, revocation en resource-audience voor de bedoelde TEST-omgeving zijn niet in deze run bewezen. Bevestig deze punten vóór providerkeuze; zie de [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows), [setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started) en [token security](https://supabase.com/docs/guides/auth/oauth-server/token-security) documentatie.

**Alternatieven**

- Een andere OAuth/OIDC-provider met bewezen delegated-user, audience, JWKS-rotatie en revoke-semantiek.
- Bestaande LiquidHR-login/OAuth alleen wanneer die aantoonbaar een aparte, server-verifieerbare API access token levert; de huidige browsercookie is geen alternatief contract.
- Client credentials alleen voor een later, apart service-accountproduct met expliciete non-human authority en eigen tenant-/permissionmodel; buiten APIAI-01.

**Impact op APIAI-01**

Dit bepaalt clientregister, tokenvalidator, subject-link opslag, consent/revoke-flow en veilige AuthContext-bootstrap. Als identity linking of tokenlifecycle een tabel vereist, volg schema → route, RLS/policies/grants en types volgens repo-instructies; remote apply blijft apart geautoriseerd.

**Expliciete goedkeuring nodig**

- **Product:** provider, clienttypes, toestemmingstekst, redirectbeheer, omgevingenscheiding, account-link/unlink-ervaring en token/refresh-TTL.
- **Security:** issuer/audience/client-binding, alg/JWKS-rotatie, revoke- en replaygedrag, account recovery, CORS, logging en fail-closed beleid.
- **Platform/security-eigenaar:** of Supabase public-beta OAuth geschikt is voor deze TEST-/Preview-doelstelling en hoe de feature daar wordt geconfigureerd.

## P-02 — Mapping van externe scopes naar LiquidHR-autorisatie

**Voorgestelde keuze**

Houd standaard OpenID Connect-scopes en API-resource-scopes gescheiden van interne canonieke permissions. `openid`, `profile` en `email` ondersteunen identity-/loginclaims en verlenen op zichzelf geen API-resourceauthority. API-resource-scopes zoals hieronder begrenzen hoogstens wat een client kan aanvragen; zij verlenen nooit LiquidHR-rechten. Resolveer per request de geverifieerde actor, actuele AuthContext, tenant/HR-groep/administratiecontext, modulestatus en bestaande service-/permissionguards. Database-RLS blijft defense-in-depth. Verwerp context- of subjectfilters die de servercontext kunnen verbreden.

| Externe scope (voorstel) | Vereiste interne controle (voorstel) | Begrenzing |
|---|---|---|
| workforce.summary.read | employee:read; voeg voor organisatie-/afdelingsuitsplitsing ook department:read en organization-placement:read toe | Eerste response bevat geen uitsplitsing; populatie blijft server-afgeleid. |
| team.skills.read | talent-team:read en ingeschakelde TALENT-module | Hergebruik listTalentTeamMatrix; behoud directe-teambeperking tenzij bestaande autorisatie talent:manage toestaat. |
| development-plans.self.read | self:talent-goal:read | Alleen eigen doelen; AuthContext bepaalt employee-scope. Dit is de enige Development Plans-scope in de eerste v1-slice. |
| development-plans.team.read (later, buiten eerste v1-slice) | talent-goal:read | Pas na service-uitbreiding die actuele directe managerrelaties server-side afleidt en positieve/negatieve service- en RLS-tests heeft. Geen client-mode of employeeId. |

Deze namen zijn voorstellen voor het externe consentcontract, geen nieuwe canonieke LiquidHR-permissions. Een aanvraag slaagt alleen als zowel de effectieve API-scope als de bestaande interne checks slagen. Het verwijderen van een scope uit clientconfiguratie voorkomt niet vanzelf dat een al uitgegeven token die scope blijft dragen. Grant-/tokenintrekking werkt pas voor dezelfde bearer bij de eerstvolgende aanvraag als de route tokenstatus of grant-liveness controleert; anders kan een geldig, stateless JWT tot expiry bruikbaar blijven. Rol-, membership-, context- en modulewijzigingen worden onafhankelijk daarvan bij elke aanvraag opnieuw geautoriseerd. Manager- en admin-Development Plans zijn niet in v1: de huidige route accepteert clientgestuurde mode/employeeId en listTalentGoals filtert managerdoelen alleen op employeeId wanneer die is meegegeven. Een toekomstige manager-scope moet directe reports binnen de service/context afleiden en RLS-negatives bewijzen.

**Alternatieven**

- Eén scope per resource, zoals hierboven.
- Kleinere scopes per gevoelig veld/handeling, alleen indien consent-UX en onderhoud dat aantoonbaar rechtvaardigen.
- Eén brede workforce.read-scope wordt afgeraden omdat zij least-privilege en intrekbaarheid verzwakt.

**Impact op APIAI-01**

Een dunne adapter mag permissions niet dupliceren. De scope-map roept bestaande services aan; route-, parameter- of OAuth-claims vervangen AuthContext en servicechecks niet. Voeg geen nieuwe interne permissionstrings toe zonder afzonderlijk besluit.

**Expliciete goedkeuring nodig**

- **Product:** scopegranulariteit en wat de beheerder/gebruiker bij consent kan begrijpen.
- **Security:** mapping per actor/context, directe revocation, module-uitgeschakeld gedrag en negatieve tenant-, groep-, administratie- en subjecttests.
- **Domeineigenaar:** bevestiging dat de genoemde bestaande servicechecks en veldpopulaties voor externe delegated access geschikt zijn.

## P-03 — Eerste read-only resources en veldcontracten

**Voorgestelde keuze**

Beperk v1 tot GET en onderstaande expliciete response-allowlists. Dit zijn kandidaatcontracten, geen gevonden externe API of bestaand OpenAPI-schema. Houd filters, sortering en paging uit de eerste slice tenzij clients ze nodig hebben en ze afzonderlijk begrensd zijn.

| Resource (voorstel) | Veldallowlist (voorstel) | Autorisatie- en uitsluitingsgrens |
|---|---|---|
| Workforce Summary | asOfDate; activeEmployeeCount uitsluitend voor de volledige zichtbare populatie en alleen bij n≥5 | Populatie server-afgeleid. Bij minder dan vijf: aantal weglaten of generiek onderdrukken. Geen afdelings-/kleinegroepuitsplitsing, namen, employee-ID's, salaris of personeelsdetail. De drempel zelf vereist privacygoedkeuring. |
| Team Skills | Alleen een kandidaatprojectie van capabilityCode, capabilityType, status, validFrom en validUntil na expliciete privacy-/productgoedkeuring en aantoonbare niet-linkability | Kandidaatroute: /api/v1/team-skills zonder teamId; de bestaande service leidt scope af uit AuthContext. V1 bevat geen subjectRef/teamRef, employee-ID/nummer/naam, evidence-/bron-/certificaatpayload, vrije tekst of interne metadata. Als een veilige niet-linkbare projectie niet kan worden aangetoond, blijft de resource buiten v1. |
| Development Plans | periodStart, periodEnd, progressPercent, status, completedAt | Alleen self in de eerste slice, gekoppeld aan development-plans.self.read en server-afgeleid via AuthContext; geen externe mode- of employeeId-parameter. Manager-scope is uitgesteld totdat listTalentGoals directe report-scope server-side afdwingt en service/RLS-negatives dit bewijzen. Geen planRef, title, description/vrije tekst, employee/database-ID, capabilitybewijs, source/version/archive-internals, subjectRef of admin mode. |

Voor Development Plans v1 bevat het externe contract dus uitsluitend periode (`periodStart`, `periodEnd`), voortgang (`progressPercent`), status en voltooiing (`completedAt`). Titels en beschrijvingen blijven uitgesloten als vrije tekst.

Veldnamen en beschikbare waarden moeten vóór OpenAPI-freeze tegen de actuele service/types worden gevalideerd. Remote TEST readback bevestigde alleen dat public.talent_development_goals bestaat met RLS aan; er zijn geen records gelezen. Lokale migratie-/schema-lineage en Preview-schema-provenance blijven implementatievoorwerk, geen reden om nu een tabel te wijzigen.

**Alternatieven**

- Start uitsluitend met Workforce Summary en voeg Team Skills/Development Plans toe na afzonderlijke privacy- en productacceptatie.
- Exposeer opaque subject references voor team-/managerresultaten. Dit blijft persoonsgegeven/linkable data en vraagt expliciete noodzaak, rotatie-/scopebeleid en goedkeuring.
- Exposeer interne employee-ID's of onbewerkte service-DTO's wordt afgewezen.

**Impact op APIAI-01**

Maak per resource een typed response projector boven de bestaande service en leg voor ieder veld bron, permission, actor-scope, classificatie, omit-gedrag en testfixture vast. Pas bestaande interne DTO's niet rechtstreeks als extern contract toe. Geen mutations, webhooks of AI-acties.

**Expliciete goedkeuring nodig**

- **Product:** v1-resources; definieer active (actieve employee versus actief dienstverband), peildatum/populatie, deduplicatie bij meerdere dienstverbanden, planstatussen/drafts en pagingbehoefte.
- **Privacy/security:** bewijs dat een eventuele Team Skills-projectie niet-linkbaar is; manager- en kleinepopulatiepresentatie; Development Plans-veldclassificatie; bewaartermijn en clientcache. Individuele subjectRef/teamRef en planRef zijn buiten de eerste slice.
- **Domeineigenaar:** betekenis, datatype en volledigheid van elk veld; veilige omit- versus null-semantiek; veilige self-only Development Plans-mapping en eventuele latere manager-service-uitbreiding.

## P-04 — Dataminimalisatie, aggregatie en privacygrenzen

**Voorgestelde keuze**

Gebruik vaste per-resource allowlists en minimale responseprojecties. Sluit salaris, BSN, contactgegevens, documenten, ziekte-/verzuim- en medische gegevens, vrije tekst, volledige evidence/certificaatdetails, prompts, tokens en providerpayloads uit APIAI-01 uit. Beperk responses standaard met Cache-Control: no-store; geen client-/CDN-cache van HR-data zonder afzonderlijk besluit.

Schakel gefilterde en uitgesplitste aggregaties in APIAI-01 standaard uit. Het enige voorstel voor een MVP-aggregaat is de scalaire activeEmployeeCount van Workforce Summary voor de volledige server-afgeleide zichtbare populatie; geef deze alleen vrij bij n≥5 en laat het aantal anders weg of onderdruk het generiek. Ook deze drempel is een voorstel en vereist privacygoedkeuring; Privacy kan een hogere grens of geen telling eisen. Gebruik geen door de client gekozen peildatum, filters of historische tellingen voor deze resource; herhaalde requests blijven rate-limited en auditable. De bestaande Team Skills aggregate policy is DISABLED. FDR-0003 stelt minimaal vijf vast voor toekomstige Team Talent-/vergelijkingsuitkomsten, maar verleent geen toestemming voor API-aggregaten. Als andere aggregaten later expliciet worden goedgekeurd, eis dan daarnaast complementary suppression, begrensde dimensies/filters, bescherming tegen differencing/herhaalde queries en aantoonbare heridentificatietest. Een team- of capabilitycombinatie kan ook boven vijf personen identificerend zijn.

**Alternatieven**

- Alleen individuele records aan een expliciet geautoriseerde gebruiker leveren, na data-classificatie en minimale veldprojectie.
- Een privacy-beoordeelde aggregate-only resource later toevoegen met bewezen populatie- en differencingbeheersing.
- Geen externe toegang tot een resource wanneer veilige projectie niet mogelijk is.

**Impact op APIAI-01**

Privacy is een resourcecontract- en testvereiste, geen post-processing. Filtercombinaties mogen geen record/populatie ontdekken via verschil, telling, foutstatus of responsegrootte. Logs, audit, traces, error details en caches volgen dezelfde dataminimalisatie.

**Expliciete goedkeuring nodig**

- **Product/privacy:** resourceclassificatie, toegestane doelen/populaties, retention en eventuele clientopslag.
- **Security/privacy:** linkability- en differencingrisico, minimumgroepsregels, suppression, querybudget en bewijs dat filters geen bypass geven.
- **Domeineigenaar:** of status-, datum- en capabilityvelden gevoelige arbeids-/ontwikkelingsinformatie bevatten in de gekozen context.

## P-05 — Rate limiting, audit en foutafhandeling

**Voorgestelde keuze**

Gebruik een gedeelde, atomische server-side limiter die minimaal op tenant + HR-groep + OAuth-client + gedelegeerde actor + resource kan begrenzen; voeg burstbeperking toe. Administratiecontext kan als extra dimensie gelden waar quota dat vereisen. Een kortlevende HMAC van een vertrouwde client-IP-identiteit kan alleen een secundaire abuse-sleutel zijn; IP bepaalt nooit actor of tenant. Gebruik geen process-memory limiter en geen IP-only sleutel. Het bestaande HMAC/atomic-RPC recruitment-intakepatroon is alleen een voorbeeld van atomiciteit, geen generieke API-component.

Als startwaarde voor load-/misbruikreview (niet als goedgekeurde productquota): 60 requests/minuut per actor/client/resource met burst 10 en 600 requests/uur per client/tenant; review 30/minuut voor Team Skills indien privacy-/recordrisico dat vraagt. Stel uiteindelijke waarden per resource en tenantbelasting vast. Retourneer 429 met een begrensde Retry-After. Als de limiter geen betrouwbare beslissing kan nemen, weiger fail-closed met 503 en registreer een privacy-safe operationeel event. Geen retry die een request ongemerkt alsnog uitvoert.

Gebruik audit_logs als kandidaat canonieke bron overeenkomstig ADR-0007; bewijs eerst of schema, policies en grants externe READ-events veilig kunnen opslaan. De huidige schema-lineage vereist entity_id uuid NOT NULL, heeft geen hr_group_id-kolom en kent geen READ-actie (base: apps/hr-suite/supabase/migrations/20260715121230_complete_employee_core.sql; actie-uitbreiding: 20260802175914_talent_reporting_and_export.sql). Workforce summary/list-reads hebben niet vanzelf een entity_id; besluit of de audit per resultaatobject wordt geschreven of een goedgekeurde resource-level schema-/policy-uitbreiding nodig is. Verzín geen entity-ID. Voeg geen tweede auditwereld toe. Tot expliciete goedkeuring en eventueel migration bestaat geen bewezen externe read-auditcontract. Leg waar toegestaan vast: request/correlation-ID, actor, client, goedgekeurde tenant/HR-groep-/administratiecontext, minimale scope, resource, actie, autorisatie-uitkomst, rate-limitresultaat, status, begrensde resultaatcount en tijd. Log nooit access-/refresh-token, Authorization-header, volledige HR-payload, prompt, evidence of standaard ruwe IP. Retentie en toegang op auditregels moeten worden besloten.

Gebruik een stabiel foutobject met error.code en requestId, zonder stack, query, token of verborgen-recordbestaan te onthullen. Voorgestelde statusklassen: 401 niet geldig/ontbrekende credentials; 403 onvoldoende scope/permission; generieke 404 voor niet-zichtbaar object; 400/422 ongeldige invoer; 405 methode niet toegestaan; 413 te groot; 429 limiter; 503 veilige tijdelijke dependency-uitval; 500 generieke fout. Geef geen onderscheidende foutdetails voor records buiten scope.

**Alternatieven**

- Limiter in bestaande gedeelde externe gateway indien die atomiciteit, tenant/user/client-keying en observability bewijst.
- Per-resource quota pas na synthetische load- en misbruikmeting.
- Audit naar bestaande veilige auditservice indien audit_logs geen immutable, read-auditable contract kan bieden; geen ad-hoc logs met HR-data.

**Impact op APIAI-01**

Rate limiting, read audit en response-errors zijn onderdeel van route-acceptatie. Als de limiter of read-audit ontbreekt, moet de slice stoppen of de noodzakelijke gedeelde infrastructuur als afzonderlijk goedgekeurde dependency behandelen. Geen wijzigingen aan gedeelde securitycode of audit-schema in deze D0-voorbereiding.

**Expliciete goedkeuring nodig**

- **Product/operations:** quota, burst, requestkosten, clientcommunicatie en incident-/alertdrempels.
- **Security:** keys, atomic storage, fail-closed gedrag, auditvelden, toegang/retentie, statusmapping en redaction tests.
- **Data-/database-eigenaar:** of bestaande audit-schema/policies de externe read-events ondersteunen; een benodigde migration heeft aparte review en remote apply-goedkeuring.

## Referentiegrondslag

- Tenant-/administratiegrenzen: ADR-0001.
- HR-groep als zichtbaarheids-/inrichtingsgrens: ADR-0009.
- AI-authcontext, business permissions, providergrenzen en minimale context: ADR-0010.
- Liquid Credits en AI invocation: FDR-0008; gewone REST-GET is geen AI-charge.
- Bestaande authorization/services: apps/hr-suite/lib/auth/permissions.ts, apps/hr-suite/lib/talent/team-service.ts, apps/hr-suite/lib/talent/goal-service.ts.
- Privacy/acceptatie: docs/AA/AA-REQ.md, AA-OP.md, AA-TEST.md, AA-REL.md, AA-ACCEPT.md; docs/decisions/FDR-0003-talent-fase-2-assessment-en-evidencebeleid.md en ADR-0007-talent-fase-2-eigendom-en-gegevensbescherming.md.
- Dit document is voorstelmateriaal; elk aangenomen punt moet als goedgekeurde ADR/FDR of formeel requirement worden vastgelegd vóór afhankelijk werk.
