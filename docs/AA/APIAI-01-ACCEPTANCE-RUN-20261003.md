# APIAI-01 lokale acceptatie-run — 2026-10-03

## 1. Samenvatting

Status bij aanmaak: **PARTIAL / ENVIRONMENT-GATED**.

Deze run bevat uitsluitend lokale HTTP-proeven voor de normale login, de bestaande beschermde dashboardroute en de gesloten APIAI-01-routegrens. De drie publieke APIAI-01-resources zijn op dit moment nog niet gemount; daarom is er geen externe API- of bearer-authenticatiebewijs.

De repository bevat wel eerder vastgelegde login-, rolwissel- en persona-browserbewijzen voor bestaande LiquidHR-oppervlakken. Die bewijzen worden hieronder als **contextueel hergebruikt bewijs** vermeld. Ze bewijzen niet dat een gedelegeerde bearer bij APIAI-01 aan de actuele `AuthContext`, server-permissions en RLS wordt gebonden.

## 2. Dekking

| ID | Onderdeel | Wat ontbreekt | Waarom | Herstel | Regressie | Resultaat |
|---|---|---|---|---|---|---|
| APIAI-E-001 | Normale login | Deze run niet uitgevoerd; bestaand lokaal Test Auth-/browserbewijs is contextueel herbruikbaar | APIAI-runtime moet vanaf een vastgelegde kandidaat worden gestart | Geen codefix | `tests/api-v1/runtime-acceptance.test.ts` | ALLEEN CONTEXT / API-RUN OPEN |
| APIAI-E-002 | Beschermde dashboardroute | Deze run niet uitgevoerd; eerdere anonieme redirectchecks zijn contextueel herbruikbaar | APIAI-runtime moet vanaf een vastgelegde kandidaat worden gestart | Geen codefix | `tests/api-v1/runtime-acceptance.test.ts` | ALLEEN CONTEXT / API-RUN OPEN |
| APIAI-E-003 | Workforce Summary | Route nog niet gemount | AuthContext, limiter, audit en privacycontract worden eerst geïntegreerd | Geen route-aanpassing in deze testscope | Zelfde testbestand | OPEN |
| APIAI-E-004 | Team Skills | Route nog niet gemount | AuthContext, limiter, audit en privacycontract worden eerst geïntegreerd | Geen route-aanpassing in deze testscope | Zelfde testbestand | OPEN |
| APIAI-E-005 | Development Plans | Route nog niet gemount | AuthContext, limiter, audit en privacycontract worden eerst geïntegreerd | Geen route-aanpassing in deze testscope | Zelfde testbestand | OPEN |

De proef wordt alleen geactiveerd met `LIQUIDHR_API_V1_ACCEPTANCE=true` en een lokale `LIQUIDHR_ACCEPTANCE_BASE_URL` op loopback met poort >= 3000. Zonder die expliciete opt-in worden de runtimecases overgeslagen en tellen ze niet als acceptatiebewijs.

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
| APIAI-E-010 | Toegestane/geweigerde/rate-limited READ-audit met request-/correlation-id en zonder ruwe HR-payload/entityfabricatie | Huidig `audit_logs`-schema heeft geen READ-actie, geen `hr_group_id` en verplicht `entity_id`; uitbreidingsbesluit is niet goedgekeurd | OPEN — auditschemagebonden |
| APIAI-E-011 | APIAI-resourcevelden, no-store, foutomhulling, scope mapping en privacy-/re-identificatie-negatives | Alleen het niet-gepubliceerde YAML-draft en contracttests bestaan; geen actieve endpoint-/bearerresponse om te bewijzen | OPEN — contract-/runtimegebonden |

De gerichte APIAI-tests zijn uitgevoerd met `npm.cmd run test --workspace=@liquid-hr/hr-suite -- lib/api-v1 tests/api-v1`: **9 bestanden geslaagd, 1 runtimebestand overgeslagen; 91 tests geslaagd, 5 runtimechecks overgeslagen**. De vijf overgeslagen runtimechecks vereisen de expliciete lokale opt-in en zijn geen acceptatiebewijs.

De afzonderlijke `openapi-contract.test.ts`-suite bevat **5/5 geslaagde tests**. Deze controleert uitsluitend het YAML-draft: `servers: []`, `NOT-PUBLISHED`, de huidige draftpaden, lege parameterlijsten, allowlistvelden, foutreferenties, `no-store` en traceheaders. Zij valideert niet de volledige OpenAPI-semantiek en bewijst niet dat een route bestaat of bereikbaar is.

## 2C. Afbakening ten opzichte van andere ontwikkelsporen

Openstaande controles uit CONVERGENCE01, CONTROL01, INS01 en AI01-A blijven in hun eigen acceptatieruns staan. Voorbeelden zijn Control invitation/reuse/forged-context, INS01 export-/filterscope en AI01-A live persona-/toggle-/scope-revocationchecks. Deze administratieve of domeinspecifieke open punten zijn geen directe voorwaarde voor het APIAI-01-fundament en blokkeren dat fundament niet.

APIAI-01 heeft wel zijn eigen, hierboven genoemde security- en integratiegates. Een bestaand productbewijs uit een ander spoor mag geen ontbrekend APIAI-01-bearer-, provider-, limiter- of auditbewijs vervangen.

## 3. Personamatrix

| Persona | Normale login | Bestaande rolwissel | APIAI-01-resourcecontroles |
|---|---|---|---|
| HR Admin | Bestaand Test Auth-/browserbewijs; alleen contextueel | Bestaand lokaal rolwisselbewijs; alleen contextueel | OPEN — geen APIAI-bearer/AuthContext/RLS-keten |
| Manager | Bestaande Insights-persona-/scopechecks; alleen contextueel | Bestaand lokaal rolwisselbewijs; alleen contextueel | OPEN — geen APIAI-bearer/AuthContext/RLS-keten |
| Employee | Bestaande deny/lege Insights-personachecks; alleen contextueel | Bestaand lokaal rolwisselbewijs; alleen contextueel | OPEN — geen APIAI-bearer/AuthContext/RLS-keten |

De test leest geen inloggegevens en maakt geen identity of rol aan. De normale login- en bestaande rolwisselcontrole moet lokaal met de reeds geconfigureerde TEST-persona's via de officiële browserprocedure worden uitgevoerd. Mock-authenticatie wordt niet als E2E-bewijs gebruikt.

## 4. Functionele resultaten

De HTTP-runtimeproef moet vanaf de APIAI-01-buildworktree worden uitgevoerd nadat een kandidaatcommit is vastgelegd:

```powershell
$env:LIQUIDHR_API_V1_ACCEPTANCE = 'true'
$env:LIQUIDHR_ACCEPTANCE_BASE_URL = 'http://127.0.0.1:3013'
npm.cmd run test --workspace=@liquid-hr/hr-suite -- tests/api-v1/runtime-acceptance.test.ts
```

Deze run gebruikt uitsluitend echte HTTP-verzoeken. De logincontrole controleert een normaal e-mail-/wachtwoordformulier en de Google-loginoptie. De dashboardcontrole controleert een server-side redirect voor een anoniem verzoek. De API-controles accepteren alleen `404` zolang de route gesloten is of `401` nadat de route gemount is.

## 5. Negatieve en securityresultaten

- Geen bearer-token of testwachtwoord is in de testcode opgenomen.
- Geen externe URL wordt door de test geaccepteerd; de basis-URL moet loopback zijn.
- Een gemounte API-route zonder bearer moet `401` teruggeven met `Cache-Control: no-store` en een UUID `X-Request-Id`.
- Een nog niet gemounte route mag tijdelijk `404` blijven; dat is gesloten oppervlak, geen bewijs van API-bouwgereedheid.
- Scope-, tenant-, HR-groep-, administratie-, privacy-, rate-limit- en READ-auditcontroles blijven OPEN totdat de complete routeketen aanwezig is.
- Geen enkele bestaande rolwissel- of persona-browsercheck wordt als bearer-, APIAI-scope- of RLS-proof hergebruikt.

## 6. Mobiele en responsive resultaten

OPEN. De runtimeproef gebruikt alleen HTTP. Desktop- en 390px-browsercontrole moet na vastlegging van de kandidaatcode apart worden uitgevoerd.

## 7. Data-/database-readback

Niet van toepassing op deze alleen-lezen-proef. Er zijn geen schrijfacties op afstand, migraties, fixturemutaties of database-uitlezingen uitgevoerd.

## 8. Kwaliteitsgates

- APIAI-gerichte suite: **91 PASS, 5 SKIP** (runtime opt-in ontbreekt in deze unit-run).
- OpenAPI-draftcontract: **5/5 PASS**, structurele contractcontrole.
- HR Suite TypeScript-check: **PASS** (`npm.cmd run type-check --workspace=@liquid-hr/hr-suite -- --incremental false`).
- HR Suite lint: **0 errors, 7 warnings** in bestaande Payroll-testbestanden buiten APIAI-01.
- Volledige HR Suite: **521 testbestanden geslaagd, 4 overgeslagen; 2.201 tests geslaagd, 8 overgeslagen** met `--no-file-parallelism --maxWorkers=1`. Een eerdere parallelle run had twee resourcegevoelige time-outs; de Payroll-boundary- en PDF-bestanden slaagden geïsoleerd en in de sequentiële volledige run.
- Officiële lokale Development-runtime, echte login/rolwissel en Production-build/preflight zijn nog uit te voeren op een vastgelegde kandidaat.
- Vercel Preview en hosted acceptatie zijn niet uitgevoerd.

## 9. Tijdens deze run opgelost

Geen.

## 10. Omgevingsgebonden (ENVIRONMENT-GATED)

- Lokale TEST-runtime vereist de centrale configuratie en de launcher `scripts/start-test-worktree.ps1`.
- Development-runtime en Production-build/preflight moeten op een schone, vastgelegde kandidaat worden uitgevoerd; het definitieve commit-SHA moet hier na die run worden ingevuld.
- Vercel Preview en de remote omgeving zijn niet gebruikt.

## 11. Productbesluiten

De test implementeert geen productbesluit. De routegrens volgt de bouwopdracht: publieke APIAI-01-routes blijven dicht totdat providerverificatie, actuele LiquidHR-AuthContext, resource-scope, rate limiting, privacy en READ-audit samen bewezen zijn.

## 12. Nog niet opgelost

- Geen nieuwe normale login-/rolwisselresultaten totdat de vastgelegde lokale runtime beschikbaar is; bestaand bewijs blijft contextueel.
- Geen positieve/negatieve API-resource-matrix.
- Geen externe OAuth/provider-, limiter-, privacy- of auditacceptatie.
- Geen bearergebonden `AuthContext`/RLS-bewijs voor HR Admin, Manager of Employee.
- Geen bewijs van directe access-tokenrevocatie, scope-intrekking of clientbinding voor APIAI-01.

## 13. Lessen en patronen

- Een mock-provider of unit-test bewijst geen normale login, bearer-validatie of hosted OAuth.
- Een `404` op een nog niet gemounte route bewijst alleen dat het oppervlak gesloten is.
- Elke API-leesacceptatie moet echte HTTP-status, `Cache-Control`, request-/correlation-id en responsevelden vastleggen; geen secrets of ruwe interne DTO's in het rapport.

## 14. Commits en remote HEAD

- Buildbranch: `work/apiai-01-build-20261003`.
- Baseline bij aanmaak: `6349d02538351cd01fc51f298c6e6fa0ba88006c`.
- Kandidaatcommit: nog OPEN totdat integratie is vastgelegd.
- Geen push, merge, deployment of remote migratie uitgevoerd door deze testscope.

## 15. Eindbeoordeling

**PARTIAL / ENVIRONMENT-GATED.** Deze notitie levert een herhaalbare, secret-vrije lokale HTTP-proef en maakt de huidige gesloten routegrens expliciet. Zij is geen bewijs voor APIAI-01 externe API-bouwgereedheid. De openstaande controles moeten op de uiteindelijke kandidaatcommit opnieuw worden uitgevoerd.
