# APIAI-01 lokale acceptatie-run — 2026-10-03

## 1. Samenvatting

Status: **PARTIAL / ENVIRONMENT-GATED**. De lokale API-foundation heeft gerichte unit-, contract-, type-, lint-, volledige suite- en production-buildchecks doorstaan. De drie publieke APIAI-01-resources zijn bewust niet gemount. Er is dus geen positieve externe API- of bearer-authenticatiebewijs.

Kandidaatcode: `07f691c0d132bd48891bd61169d23ce671e0005a`, gemaakt vanaf baseline `6349d02538351cd01fc51f298c6e6fa0ba88006c` in een eigen worktree. De normale login is vanaf de lokale Production-mode TEST-runtime op poort 3014 voor alle drie synthetische TEST-persona's uitgevoerd. Na de bestaande contextselectie-UI gaf `/api/context` HTTP 200 voor elk account. De drie APIAI-routes bleven met die normale cookie-authsessies alle HTTP 404.

De repository bevat wel eerder vastgelegde login-, rolwissel- en persona-browserbewijzen voor bestaande LiquidHR-oppervlakken. Die bewijzen worden hieronder als **contextueel hergebruikt bewijs** vermeld. Ze bewijzen niet dat een gedelegeerde bearer bij APIAI-01 aan de actuele `AuthContext`, server-permissions en RLS wordt gebonden.

## 2. Dekking

| ID | Onderdeel | Wat ontbreekt | Waarom | Herstel | Regressie | Resultaat |
|---|---|---|---|---|---|---|
| APIAI-E-001 | Normale login | Nieuw uitgevoerd voor HR Admin, Manager en Employee met bestaande synthetische TEST-accounts; geen credentials in output | Lokale Production-mode runtime op exacte codekandidaat | Geen codefix | Browserlogin + bestaande contextselectie-UI | PASS — 3/3 |
| APIAI-E-002 | Beschermde dashboardroute en actieve UI-context | Anonieme dashboardredirect naar login is nieuw HTTP-getest; na normale login/contextselectie gaf `/api/context` HTTP 200 voor elk persona-account | Contextcookies zijn de bestaande productflow en zijn geen API-bearer | Geen codefix | `tests/api-v1/runtime-acceptance.test.ts` + browser | PASS voor normale UI-auth |
| APIAI-E-003 | Workforce Summary | Route nog niet gemount | AuthContext, limiter, audit en privacycontract worden eerst geïntegreerd | Geen route-aanpassing in deze testscope | Zelfde testbestand | OPEN |
| APIAI-E-004 | Team Skills | Route nog niet gemount | AuthContext, limiter, audit en privacycontract worden eerst geïntegreerd | Geen route-aanpassing in deze testscope | Zelfde testbestand | OPEN |
| APIAI-E-005 | Development Plans | Route nog niet gemount | AuthContext, limiter, audit en privacycontract worden eerst geïntegreerd | Geen route-aanpassing in deze testscope | Zelfde testbestand | OPEN |

De proef wordt alleen geactiveerd met `LIQUIDHR_API_V1_ACCEPTANCE=true` en een lokale `LIQUIDHR_ACCEPTANCE_BASE_URL` op loopback met poort >= 3000. Zonder die expliciete opt-in worden de runtimecases overgeslagen en tellen ze niet als acceptatiebewijs.

De opt-in HTTP-suite draaide tegen de officiële lokale runtime op poort 3014 en slaagde **5/5**. Zij controleerde het loginoppervlak, de anonieme dashboardredirect en dat de drie APIAI-paden zonder bearer niet toegankelijk zijn. Alle drie paden gaven 404, passend bij de bewust ongemountte toestand.

Deze 404's zijn de frameworkrespons voor niet-gemounte routes; ze bewijzen geen APIAI-foutomhulling, `no-store`-header of runtimegedrag van `NOT_FOUND`. Status 413 bestaat alleen in de niet-gepubliceerde OpenAPI-/unitcontractcontrole en is niet via een route uitgelokt.

## 2A. Bestaand bewijs dat alleen context geeft

De volgende bewijzen bestaan al in [`docs/delivery/IMPLEMENTATION_STATUS.md`](../delivery/IMPLEMENTATION_STATUS.md) en de gekoppelde acceptatieruns:

- De sectie **Test Auth Harness — lokaal-only — 2026-09-27** registreert de normale `signInWithPassword`-flow met de bestaande synthetische Test HR Admin en de lokale rolwissel Test HR Admin → Test Manager → Admin → Test Medewerker → logout, inclusief negatieve toegangschecks. De gewone wachtwoord- en Google-login bleven intact.
- [`ONE-VERSION-20261002.md`](../quality/acceptance/runs/ONE-VERSION-20261002.md) registreert een lokale Test HR Admin-browser-smoke met de bestaande TEST-context en een anonieme dashboardredirect naar login. Dat is bestaand product-/runtimebewijs voor die release, geen APIAI-01-bearerbewijs.
- [`CONVERGENCE01-20260928.md`](../quality/acceptance/runs/CONVERGENCE01-20260928.md) en [`INS01-20260928.md`](../quality/acceptance/runs/INS01-20260928.md) registreren eerdere browserpersona's: HR Admin zag de bestaande Insights-populatie, Manager zag de bestaande toegestane subset en Employee zag geen managementrapporten. Een directe browser-API-navigatie werd in die run bovendien door de browserclient geblokkeerd en is niet als losse API-proef geteld.
- Dezelfde rapporten bevatten context-/RLS-/permissionreadbacks voor hun eigen domeinen. Zij zijn geen bewijs dat een APIAI-01 bearer-token door de nieuwe `/api/v1`-route aan de actuele `AuthContext`, HR-groep, administratie, tenant en RLS wordt gebonden.

Dit bestaande bewijs mag dus worden gebruikt als aanwijzing dat de algemene login- en rolwisselvoorziening eerder werkte. Het bewijst niet: OAuth-providerkeuze of consent, access-tokenvalidatie, issuer/audience/JWKS/clientbinding, directe revocatie, APIAI-scope mapping, APIAI-responsevelden, cross-tenant/RLS-isolatie via bearer, rate limiting of READ-audit.

## 2B. Exact ontbrekend APIAI-01-bewijs en blokkades

| ID | API-specifieke controle | Exacte blokkade | Status |
|---|---|---|---|
| APIAI-E-006 | Authorization Code + PKCE, consent, issuer/audience/JWKS/clientbinding, link/unlink en revocatie | Geen provider is goedgekeurd of geconfigureerd; er is geen gedelegeerde APIAI-bearer om te testen | OPEN — providergebonden |
| APIAI-E-007 | Bearer → actuele `AuthContext` → bestaande permissions/RLS voor HR Admin, Manager en Employee; tenant-, HR-groep- en administratie-negatives | Er is geen bearergebonden APIAI-route-/contextintegratie en dus geen bewijs van de huidige AuthContext/RLS-keten | OPEN — integratiegebonden |
| APIAI-E-008 | Positieve read-projectie en negatieve methode-/querycontroles voor Workforce Summary en self Development Plans; Team Skills blijft afzonderlijk open | De publieke routes zijn niet gemount; de Team Skills-resource is bovendien privacy-/contractueel uitgesteld | OPEN — routegebonden |
| APIAI-E-009 | Actor/client/resource rate-limit-buckets, begrensde `Retry-After`, fail-closed bij limiteronbeschikbaarheid | Rate-limitcontract en eventuele schema/RPC zijn kandidaatcode; geen goedgekeurde limiterconfiguratie of live routepad | OPEN — limitergebonden |
| APIAI-E-010 | Toegestane/geweigerde/rate-limited READ-audit met vastgesteld ID-contract en zonder ruwe HR-payload/entityfabricatie | Huidig `audit_logs`-schema heeft geen READ-actie, geen `hr_group_id` en verplicht `entity_id`; keuze tussen correlation-only en request + correlation ID is niet goedgekeurd | OPEN — auditschemagebonden |
| APIAI-E-011 | APIAI-resourcevelden, no-store, foutomhulling, scope mapping en privacy-/re-identificatie-negatives | Alleen het niet-gepubliceerde YAML-draft en contracttests bestaan; geen actieve endpoint-/bearerresponse om te bewijzen | OPEN — contract-/runtimegebonden |

De gerichte APIAI-tests zijn uitgevoerd met `npm.cmd run test --workspace=@liquid-hr/hr-suite -- lib/api-v1 tests/api-v1`: **9 bestanden geslaagd, 1 runtimebestand overgeslagen; 91 tests geslaagd, 5 runtimechecks overgeslagen**. De vijf overgeslagen runtimechecks vereisen de expliciete lokale opt-in en zijn geen acceptatiebewijs.

De afzonderlijke `openapi-contract.test.ts`-suite bevat **5/5 geslaagde tests**. Deze controleert uitsluitend het YAML-draft: `servers: []`, `NOT-PUBLISHED`, de huidige draftpaden, lege parameterlijsten, allowlistvelden, foutreferenties, `no-store` en traceheaders. Zij valideert niet de volledige OpenAPI-semantiek en bewijst niet dat een route bestaat of bereikbaar is.

## 2C. Afbakening ten opzichte van andere ontwikkelsporen

Openstaande controles uit CONVERGENCE01, CONTROL01, INS01 en AI01-A blijven in hun eigen acceptatieruns staan. Voorbeelden zijn Control invitation/reuse/forged-context, INS01 export-/filterscope en AI01-A live persona-/toggle-/scope-revocationchecks. Deze administratieve of domeinspecifieke open punten zijn geen directe voorwaarde voor het APIAI-01-fundament en blokkeren dat fundament niet.

APIAI-01 heeft wel zijn eigen, hierboven genoemde security- en integratiegates. Een bestaand productbewijs uit een ander spoor mag geen ontbrekend APIAI-01-bearer-, provider-, limiter- of auditbewijs vervangen.

## 3. Personamatrix

| Persona | Normale login | Bestaande rolwissel | APIAI-01-resourcecontroles |
|---|---|---|---|
| HR Admin | Nieuw: normale login PASS; contextselectie PASS; `/api/context` 200 | Test Role Switcher niet beschikbaar in Production-mode; Development-start geblokkeerd door Node/Next-runtimeprobleem | Drie APIAI-paden 404 via cookie-auth; bearer/API-resourceacceptatie OPEN |
| Manager | Nieuw: normale login PASS; contextselectie PASS; `/api/context` 200 | Test Role Switcher niet beschikbaar in Production-mode; Development-start geblokkeerd door Node/Next-runtimeprobleem | Drie APIAI-paden 404 via cookie-auth; bearer/API-resourceacceptatie OPEN |
| Employee | Nieuw: normale login PASS; contextselectie PASS; `/api/context` 200 | Test Role Switcher niet beschikbaar in Production-mode; Development-start geblokkeerd door Node/Next-runtimeprobleem | Drie APIAI-paden 404 via cookie-auth; bearer/API-resourceacceptatie OPEN |

De browserproef gebruikte de bestaande normale e-mail-/wachtwoordlogin en selecteerde voor iedere identiteit een door de UI aangeboden tenant en HR-groep. Dit wijzigde uitsluitend de lokale sessiecontext; er is geen identity of rol aangemaakt. Wachtwoorden en context-ID's zijn niet gelogd. Bestaand Test Role Switcher-bewijs blijft contextueel; deze nieuwe run bewees geen rolwisseling, omdat de officiële Development-start faalde met `--env-file= is not allowed in NODE_OPTIONS` op Node 22.14.0 / Next.js 16.3.6. Er is geen alternatieve handmatige serverstart gebruikt.

## 4. Functionele resultaten

De HTTP-runtimeproef is vanaf de APIAI-01-buildworktree uitgevoerd nadat de codekandidaat was vastgelegd:

```powershell
$env:LIQUIDHR_API_V1_ACCEPTANCE = 'true'
$env:LIQUIDHR_ACCEPTANCE_BASE_URL = 'http://127.0.0.1:3014'
npm.cmd run test --workspace=@liquid-hr/hr-suite -- tests/api-v1/runtime-acceptance.test.ts
```

Deze run gebruikt uitsluitend echte HTTP-verzoeken. De logincontrole controleert een normaal e-mail-/wachtwoordformulier en de Google-loginoptie. De dashboardcontrole controleert een server-side redirect voor een anoniem verzoek. De API-controles accepteren alleen `404` zolang de route gesloten is of `401` nadat de route gemount is. In deze run bleven de routes ongemount en gaven zij `404`.

## 5. Negatieve en securityresultaten

- Geen bearer-token of testwachtwoord is in de testcode opgenomen.
- Geen externe URL wordt door de test geaccepteerd; de basis-URL moet loopback zijn.
- Een gemounte API-route zonder bearer moet `401` teruggeven met `Cache-Control: no-store` en een UUID `X-Request-Id`.
- Een nog niet gemounte route mag tijdelijk `404` blijven; dat is gesloten oppervlak, geen bewijs van API-bouwgereedheid.
- Scope-, tenant-, HR-groep-, administratie-, privacy-, rate-limit- en READ-auditcontroles blijven OPEN totdat de complete routeketen aanwezig is. De drie cookie-authsessies kregen alleen de gesloten routegrens te zien; dit bewijst geen bearerbinding of RLS.
- Geen enkele bestaande rolwissel- of persona-browsercheck wordt als bearer-, APIAI-scope- of RLS-proof hergebruikt.

## 6. Mobiele en responsive resultaten

Desktop-browsertests bevestigden de normale login- en contextselectieflow voor de drie persona's op 1440 px. Er is geen responsive APIAI-scherm, bearerresource of 390px-routeflow getest; er is geen APIAI-UI-route gemount.

## 7. Data-/database-readback

Er is geen handmatige database-readback of fixturemutatie uitgevoerd en geen schema- of remote wijziging gemaakt. De normale login- en contextselectieflow is via de bestaande applicatie uitgevoerd en kan daarbij de reguliere contextread-services gebruiken. Contextselectie heeft alleen de lokale sessiecontext bijgewerkt.

## 8. Kwaliteitsgates

- APIAI-gerichte suite: **91 PASS, 5 SKIP** (runtimecases zijn apart uitgevoerd via opt-in).
- OpenAPI-draftcontract: **5/5 PASS**, structurele contractcontrole; het draft bevat nu ook de bestaande foutstatussen 404 en 413.
- HR Suite TypeScript-check: **PASS** (`npm.cmd run type-check --workspace=@liquid-hr/hr-suite -- --incremental false`).
- HR Suite lint: **0 errors, 7 warnings** in bestaande Payroll-testbestanden buiten APIAI-01.
- Volledige HR Suite: **521 testbestanden geslaagd, 4 overgeslagen; 2.201 tests geslaagd, 8 overgeslagen** met `--no-file-parallelism --maxWorkers=1`. Een eerdere parallelle run had twee resourcegevoelige time-outs; de Payroll-boundary- en PDF-bestanden slaagden geïsoleerd en in de sequentiële volledige run.
- Lokale Production-build, provenance, Production-preflight en lokale Development-preflight: **PASS** op codekandidaat `07f691c0d132bd48891bd61169d23ce671e0005a`.
- Officiële lokale Production-mode TEST-runtime op poort 3014: **PASS**. Normale login + contextselectie zijn browsermatig voor HR Admin, Manager en Employee uitgevoerd; `/api/context` gaf 200 voor elk.
- Drie ongemounte APIAI-routes gaven voor elk van deze cookie-authsessies 404. Dit is alleen bewijs voor gesloten routes.
- Officiële lokale Development-start: **BLOCKED BY ENVIRONMENT**. Next.js 16.3.6 zet Node `--env-file` uit de launcher door naar `NODE_OPTIONS`; Node 22.14.0 weigert `--env-file=` daar. De bestaande test-rolwisselaar vereist Development-mode.
- Vercel Preview en hosted acceptatie zijn niet uitgevoerd.

## 9. Tijdens deze run opgelost

OpenAPI-draft en contracttest lopen nu gelijk met de bestaande 404/413-foutmapping. De acceptatienotitie is bijgewerkt met exacte build-, runtime-, login- en omgevingsevidence. Het auditvoorstel verduidelijkt dat de huidige scaffolding alleen correlationId doorgeeft en dat requestId-opslag nog expliciet moet worden besloten.

## 10. Omgevingsgebonden (ENVIRONMENT-GATED)

- Lokale TEST-runtime vereist de centrale configuratie en de launcher `scripts/start-test-worktree.ps1`.
- De officiële Development-start blijft omgevingsgeblokkeerd door de Node/Next `--env-file`/`NODE_OPTIONS`-interactie; rolwisselbewijs uit deze run is daarom niet beschikbaar.
- Vercel Preview is niet ingezet. Er is geen Preview-backendconfiguratie aangemaakt of gewijzigd.
- Production-mode hier betekent de officiële lokale Production-runtime met centrale TEST-configuratie; er is geen deployment uitgevoerd.

## 11. Productbesluiten

De test implementeert geen productbesluit. De routegrens volgt de bouwopdracht: publieke APIAI-01-routes blijven dicht totdat providerverificatie, actuele LiquidHR-AuthContext, resource-scope, rate limiting, privacy en READ-audit samen bewezen zijn.

## 12. Nog niet opgelost

- Geen nieuwe Test Role Switcher-/rolwisselresultaten door de Development-runtimeblokkade; eerdere rolwisselresultaten blijven contextueel.
- Geen positieve/negatieve API-resource-matrix.
- Geen externe OAuth/provider-, limiter-, privacy- of auditacceptatie.
- Geen bearergebonden `AuthContext`/RLS-bewijs voor HR Admin, Manager of Employee.
- Geen bewijs van directe access-tokenrevocatie, scope-intrekking of clientbinding voor APIAI-01.

## 13. Lessen en patronen

- Een mock-provider of unit-test bewijst geen normale login, bearer-validatie of hosted OAuth.
- Een `404` op een nog niet gemounte route bewijst alleen dat het oppervlak gesloten is.
- Elke API-leesacceptatie moet echte HTTP-status, `Cache-Control`, request-/correlation-id en responsevelden vastleggen; geen secrets of ruwe interne DTO's in het rapport. De huidige auditwriter ontvangt alleen correlationId; keuze over requestId-opslag staat open in P-05.

## 14. Commits en remote HEAD

- Buildbranch: `work/apiai-01-build-20261003`.
- Baseline bij aanmaak: `6349d02538351cd01fc51f298c6e6fa0ba88006c`.
- Codekandidaat/build-SHA: `07f691c0d132bd48891bd61169d23ce671e0005a`.
- Document-/testcorrecties worden als afzonderlijke commit aan dezelfde branch toegevoegd; Production-build wordt daarna opnieuw aan de definitieve HEAD gekoppeld.
- GitHub `main` stond bij de controle op baseline `6349d02538351cd01fc51f298c6e6fa0ba88006c`; D0-PR #2 was open en niet gemerged. Vercel Production/TEST was READY op diezelfde baseline. Deze branch is nog niet gepusht en heeft nog geen eigen PR.
- Geen merge, deployment, Preview-configuratie of remote migratie uitgevoerd.

## 15. Eindbeoordeling

**PARTIAL / ENVIRONMENT-GATED.** De lokale foundation is reproduceerbaar getest; normale login/contextselectie werkt voor de drie synthetische persona's en APIAI-01 blijft gesloten met 404. Dit is geen bewijs voor externe API-bouwgereedheid. Provider, bearergebonden AuthContext/RLS, goedgekeurde scopemapping, database-atomiciteit van limiter/audit en positieve/negatieve bearerproeven blijven echte bouw- en securitygates. De Development-runtimeblokkade verhindert hier uitsluitend de aanvullende Test Role Switcher-run.
