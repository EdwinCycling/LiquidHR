# ADR-0011 — APIAI-09 Manager MCP consentversie

- **Status:** Goedgekeurd voor de lokale APIAI-09-kandidaat; hosted TEST-activering blijft gated
- **Datum:** 2026-10-12
- **Besluitnemer:** LiquidHR product- en securitygate; uitvoering op keuze van Edwin voor optie 1
- **Scope:** APIAI-09 Manager Remote MCP-tools en bestaande ChatGPT Workforce OAuth-verbinding

## Context

De Manager Self-Service-catalogus voegt gevoelige teamgegevens toe aan een bestaande OAuth/MCP-client. Supabase kan een al goedgekeurde grant direct terugsturen zonder de bijgewerkte consentpagina te tonen. De bestaande scopes `openid email offline_access` binden de OAuth-token niet aan de Manager-toolcatalogus of de nieuwe datacategorieën. Een bestaande grant mag daarom op zichzelf geen Manager-toegang openen.

## Besluit

1. De huidige Manager-consentversie is `apiai09-manager-mcp-v1`. De server bewaart die versie in vertrouwde Supabase Auth `app_metadata`, onder een metadata-key die is gebonden aan het gevalideerde OAuth `client_id`.
2. Manager-consent wordt alleen gezet na een aparte, expliciete bevestiging op `/oauth/connections`. De server verifieert de LiquidHR-sessie, het actuele ChatGPT-grant en exact één actuele Direct Manager-context; Employee-self, HR-only, ontbrekende, ambigue of onbeschikbare context is onvoldoende. De bevestiging toont de zes Manager-datacategorieën, read-only aard en scopegrens.
3. Iedere Manager MCP-request verifieert het bearer-token, haalt de actuele Auth-user op en leest met datzelfde bearer de actuele user-scoped OAuth-grants. Vóór RLS-binding, Manager-contextresolutie of Workforce-datatoegang moeten zowel de actuele ChatGPT-grant met hetzelfde OAuth-client-ID als de vertrouwde `app_metadata`-marker met exact de huidige consentversie aanwezig zijn. Een ontbrekende grant/marker geeft HTTP 403; een onleesbare grants-service faalt gesloten met HTTP 503. Dit vangt ook het venster waarin een reeds uitgegeven stateless access JWT geldig blijft nadat een OAuth-grant is ingetrokken. User metadata, browserinput en gecachete JWT-metadata zijn geen bewijs van toestemming.
4. Gewone OAuth-goedkeuring zet geen Manager-consent. De OAuth-scopes, Employee-toolroute, canonieke permissions, Manager-resolver, bearer-gebonden RLS, audit en limiter veranderen niet. Een bestaand grant zonder expliciete Manager-consent houdt Employee-toegang en krijgt geen Manager-toegang.
5. De LiquidHR-grantbeheeractie verwijdert en verifieert eerst de Manager-consentmarker en trekt daarna het ChatGPT-grant in. Een externe grant-revoke wordt per Manager-call ontdekt via de actuele grantlijst, ook wanneer een eerder uitgegeven access JWT nog niet is verlopen. Elke nieuwe OAuth-goedkeuring verwijdert de oude Manager-marker vóór een nieuw grant wordt uitgegeven. Als Supabase een eerder goedgekeurde aanvraag zonder consentpagina terugstuurt, wist de server ook vóór de redirect de marker van de actuele ChatGPT-grant(en); bij mislukte readback volgt geen redirect. Reconnect met hetzelfde client-ID herstelt Manager-consent dus niet automatisch.
6. Bij een wijziging aan Manager-datacategorieën, output of capability wordt de consentversie verhoogd. Oude markers voldoen dan niet meer en vereisen expliciete hernieuwde toestemming.
7. Gebruik uitsluitend de bestaande Auth Admin API voor de expliciete consentmarker. Voeg geen OAuth-scope, client, hook, tabel, schema of migratie toe. Voer geen handmatige TEST-user/Auth-write uit als onderdeel van implementatie of test.

## Gevolgen

### Positief

- Een eerder goedgekeurde OAuth-grant kan de vernieuwde consentpagina overslaan zonder daarmee Manager-data te ontsluiten.
- De gate wordt bij iedere Manager-call opnieuw tegen actuele Auth-user- en OAuth-grantstatus gecontroleerd; externe revoke sluit een bestaand access JWT af en markerverwijdering sluit een bestaande bearer onmiddellijk af.
- In-app revoke wist de marker vóór grant-intrekking; een nieuwe OAuth-goedkeuring wist haar opnieuw vóór uitgifte. Manager-toegang vereist na reconnect een nieuwe afzonderlijke opt-in.
- Employee blijft op de bestaande scope- en authorization-flow werken, los van Manager-consent.
- Dataminimalisatie, actuele Direct Manager-scope, tenant-/HR-groep-/administratiegrenzen, RLS en bestaande audit-/limiterketen blijven de bron van data-autorisatie.
- De gate gebruikt bestaande Auth-opslag en introduceert geen schema- of permissionwijziging.

### Kosten en beperkingen

- Een Manager-call vereist een succesvolle live Auth-user lookup; een verifierfout blijft fail-closed.
- Deze ADR specificeert de toestemmingsgrens, geen hosted acceptatie. Oude access-/refresh-tokenprobes, alle zes Manager-reads en negatieve persona-/scopeprobes, Employee-regressie, audit/limiter-readback, Preview-isolatie en READY-SHA-bewijs blijven verplichte releasegates.
- De consentmarker is per gebruiker en OAuth-client. Een externe grant-revoke verwijdert geen LiquidHR `app_metadata`; daarom controleert iedere Manager-call ook de actuele user-scoped grantlijst. Een nieuw OAuth-clientverzoek met al-goedgekeurde redirect wist de bestaande marker vóór terugkeer. Hosted revoke/reconnect-acceptatie moet dit gedrag nog met de echte provider-flow bevestigen.
- Geen TEST-authmetadata is door deze implementatierun gewijzigd. De eerste markerwrite ontstaat uitsluitend wanneer een gebruiker de Manager-opt-in zelf bevestigt nadat de kandidaat veilig is gedeployed.

## Afwijzingen

- **Bestaande OAuth-scope hergebruiken als Manager-consent:** afgewezen; scopes binden de dataautorisatie niet aan de nieuwe Manager-catalogus.
- **Manager-tools activeren op basis van een bestaande grant of de gewone OAuth-goedkeuring:** afgewezen; de bestaande grant kan de bijgewerkte consentpagina overslaan en Employee-toegang moet onafhankelijk blijven.
- **Nieuwe scope, OAuth-client of auth-hook:** afgewezen voor deze slice; dit zou de bestaande OAuth-configuratie uitbreiden en vereist afzonderlijke review.
- **Databasekolom of migration voor consentversie:** afgewezen zolang bestaand vertrouwd Auth `app_metadata` voldoende is.
- **Alleen UI-verberging of consentcontrole op JWT-metadata:** afgewezen; de server controleert actuele Auth-data per Manager-request.

## Vervangen besluiten

- Geen. Deze ADR formaliseert de nieuwe APIAI-09 Manager-consentgrens.
