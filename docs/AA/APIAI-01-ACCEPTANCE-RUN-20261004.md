# APIAI-01 — acceptatierun en beveiligingsgates

**Datum:** 2026-10-04 (Europe/Amsterdam)  
**Status:** **PARTIAL / NOT SECURITY-ACCEPTED / ROUTES UNMOUNTED**  
**Worktree:** `C:\Users\Edwin\.codex\worktrees\apiai01-build-20261003\LiquidHR`  
**Branch:** `work/apiai-01-build-20261003`  
**Baseline:** `6349d02538351cd01fc51f298c6e6fa0ba88006c`  
**Codecommit:** `2bdea940fe7652794a97d6cb42117b443baed4c7`  
**Gebouwde en lokaal gestarte commit:** `af05f575a0bc3d0be84d31d19e463de85ded06f4` (codecommit plus uitsluitend het Keycloak/RLS-proefdocument)

Dit rapport is kandidaatbewijs voor de ongemounte APIAI-01-foundation. Het is geen securitygoedkeuring, productbesluit, providerkeuze, route-activatie of live-readbewijs. De gedeelde delivery-statusbestanden zijn niet gewijzigd omdat PR #2 diezelfde bestanden wijzigt.

## 1. Wat is veranderd

- P-05 API `READ`-audit gebruikt een server-only, smalle RPC-writer. De writer bewaart alleen de RPC-functie van de bestaande service-role-client; hij heeft geen `.from()`-pad en leest geen HR-data.
- De resource-read en limiter blijven afhankelijk van dezelfde bearergebonden RLS-client. De actor komt uit `AuthContext`; de auditcorrelatie wordt server-side gegenereerd en neemt de client `X-Correlation-Id` niet over.
- De databasekandidaat beperkt de audit-RPC tot `service_role` en controleert actor, groep, administratie en relatie tot de aangevraagde scope. De bestaande authenticated audit-events blijven beperkt tot hun goedgekeurde `REVEAL`/`EXPORT`-policies.
- De eerste Development Plans-handler is self-only: vereist `self:talent-goal:read`, kiest de employee uitsluitend uit `AuthContext`, leest via de bearer-RLS-client en projecteert alleen periode, voortgang, status en voltooiingsdatum. Manager/HR Admin grants verbreden deze self-read niet.
- De kandidaat heeft geen `/api/v1`-routebestanden; externe routes zijn niet gemount.

De service-role RPC blijft een trust boundary: PostgreSQL kan via deze sink niet zelfstandig bewijzen dat een concrete bearer de voorafgaande read uitvoerde. Alleen de vertrouwde serverroute mag de actor, geverifieerde OAuth-client, status en correlatie aanbieden. De route-logica legt de volgorde vast; echte bearer-, audit-write- en readback-proeven ontbreken nog.

## 2. Uitgevoerde lokale controles

| Controle | Resultaat | Grens |
| --- | --- | --- |
| Volledige Vitest-suite, na de laatste testwijzigingen, `--maxWorkers=2` | **529 bestanden PASS / 4 SKIP; 2.247 tests PASS / 8 SKIP** | Lokale unit-, component- en contracttests |
| Strict TypeScript `npm.cmd run type-check` | **PASS** | Geen database-runtimebewijs |
| Volledige ESLint `npm.cmd run lint` | **0 errors / 7 warnings** | Alle zeven waarschuwingen staan in bestaande Payroll-testbestanden, buiten deze wijziging |
| `git diff --check` | **PASS** | Geen whitespacefouten in kandidaatdiff |
| Officiële build `scripts/start-test-worktree.ps1 -Mode Production -Build -Port 3015` | **PASS** op exacte buildcommit `af05f575…`; centrale TEST-config geladen zonder waarden te tonen | Geen deployment; 308 statische pagina's gegenereerd; TypeScript/build en Payroll client-boundary scan (152 browserassets) geslaagd |
| Officiële Production-runtime via dezelfde launcher | **PASS**, loopback `127.0.0.1:3015`, matching buildprovenance | Lokale TEST-runtime; geen hosted of Vercel-bewijs |
| Lokale HTTP-acceptatiesuite | **5/5 PASS**: loginpagina 200, anonieme dashboardredirect naar login, en 404 voor `/api/v1/workforce/summary`, `/api/v1/team-skills` en `/api/v1/development-plans` | 404 bewijst uitsluitend dat deze routes gesloten/ongemount zijn |
| Lokale browser | Loginformulier op `127.0.0.1:3015/login` zichtbaar; browserconsole leverde geen warn/error | Geen verse gebruikerslogin of Test Role Switcher-run in deze turn: er was geen aangemelde lokale sessie en er is geen wachtwoord aan de browser verstrekt |
| Development Plans handler/projectie | In volledige testsuite opgenomen; medewerker krijgt alleen vijf toegestane velden; Manager en HR Admin zonder self-permission krijgen 403 vóór service-read | Mock-/handlerbewijs, geen echte Auth-, PostgreSQL- of RLS-read |
| SQL migration contracttests | Opgenomen in volledige testsuite en geslaagd | pgTAP `plan(40)` is broncode en is **niet uitgevoerd** |
| Docker, Keycloak en lokale Supabase/PostgreSQL | Docker daemon niet beschikbaar; Java, Keycloak CLI/runtime en Supabase CLI ontbreken; geen lokale listeners | Geïntegreerde provider→AuthContext→`auth.uid()`→RLS-test niet uitvoerbaar; geen remote database aangeraakt |

De lokale loginpagina en anonieme redirect zijn opnieuw gezien op deze kandidaat. Eerdere normale login- en rolwisselresultaten staan als historische evidence op oudere SHA's in [`APIAI-01-ACCEPTANCE-RUN-20261003.md`](./APIAI-01-ACCEPTANCE-RUN-20261003.md), sectie 17; die worden hier niet als verse persona-evidence geclaimd.

## 3. Bestaand providerbewijs en actuele grens

De geïsoleerde Keycloak 26.8-proef is eerder uitgevoerd en is alleen providerbewijs: DCR `201`; PKCE `S256`/consent slaagde en verkeerde verifier gaf `400`; discovery/JWKS slaagde; geldige/tampered UserInfo bearer gaf `200/401`; dezelfde access bearer na refresh-token logout gaf UserInfo `401`; een expliciete audience mapper was vereist. Deze proef is niet opnieuw uitgevoerd in deze run. Zie [`APIAI-01-KEYCLOAK-RLS-TRIAL-20261004.md`](./APIAI-01-KEYCLOAK-RLS-TRIAL-20261004.md).

Dit bewijst niet dat een Keycloak-token door LiquidHR kan worden gekoppeld aan precies één `auth.users.id`, door Supabase Auth wordt geaccepteerd, `auth.uid()` als die gebruiker oplevert of Development Plans onder echte RLS leest. Er is geen actuele provideradapter/identity bridge of echte bearer beschikbaar voor deze lokale run. Geen cookie-, e-mail- of service-role-fallback is gebruikt.

## 4. Onafhankelijke securityreview

De onafhankelijke read-only LUNA MAX-review vond geen P0/P1 in de beoordeelde kandidaatcode. Besluit: overdraagbaar als gated, ongemounte foundation; **NO-GO voor route-activatie**. Reviewercontrole bevestigde statisch:

- auditwriter service-role-only RPC, zonder service-role HR-read;
- actor uit `AuthContext`, servergegenereerde correlatie en veilige fout bij mislukte audit;
- geen authenticated audit-`READ`-insert-bypass aangetroffen;
- Development Plans self-only-permission, contextgebonden employee en beperkte veldprojectie.

Voor volgende activatie moeten daarnaast expliciet worden afgedekt:

1. Productieroute-wiring en contracttest die de goedgekeurde auditwriter en bearer-RLS-limiter afdwingt; de dependency-injected handler bewijst deze wiring zelf nog niet.
2. Live bewijs van provider- en bearerbinding, correcte actor/client-context, weigering van directe authenticated RPC-calls, auditwrite/readback en echte positieve/negatieve RLS-reads.
3. De audit-RPC controleert geen JWT-claims omdat alleen de vertrouwde service-role-route haar kan aanroepen. Dit is een expliciete interne trust boundary en vereist Product/Security/Data-goedkeuring.
4. De reviewer signaleerde als aanvullende DB-vraag dat de auditfunctie de tenant-lifecycle niet zelfstandig controleert. Bevestig dit vóór mount in live SQL-contextproeven of voeg de passende databasecheck toe.

## 5. Besluiten en resterende gates

De besluiten P-01 t/m P-05 in [`APIAI-01-SECURITY-INTEGRATION-DECISIONS-20261004.md`](./APIAI-01-SECURITY-INTEGRATION-DECISIONS-20261004.md) blijven **PROPOSAL / NOT APPROVED**. De codekandidaat verandert deze status niet.

Voor route-mounting blijven minimaal open: goedgekeurde externe OAuth-/identity-bridgekeuze; exacte scope-mapping; goedgekeurde privacy-/veldcontracten; limit-, audit- en foutbeleid; echte provider- en revocationproeven; lokale of goedgekeurde TEST-PostgreSQL/migratie/pgTAP/advisor/typegen; bearergebonden positieve en negatieve RLS-proeven voor self, subject, tenant, HR-groep, administratie en permission; limiterconcurrency; audit-write/readback; en route-wiringcontract.

De product-/security-/datagoedkeuringen voor provider, scopes, privacy/minimalisatie en trust-boundary blijven expliciet nodig. Geen migration is toegepast, geen route is gemount, geen Vercel Preview/deployment is gestart en er is niet gemerged.

## 6. GitHub/Vercel-momentopname vóór push

Op 2026-10-04, na de lokale kandidaatbuild en vóór push:

- GitHub PR #3 (`https://github.com/EdwinCycling/LiquidHR/pull/3`) staat open en Draft volgens de actuele PR-samenvatting, base `main`. PR #2 blijft afzonderlijk open en Draft; het nieuwe acceptatiedocument wijzigt geen door PR #2 gewijzigde bestanden. GitHub branch search vindt `work/apiai-01-build-20261003`; compare meldt remote branch **12 commits ahead / 0 behind** op `main` SHA `6349d025…`, wat overeenkomt met PR #3-head `3a02911f…` vóór deze twee lokale commits. Statuschecks op die bestaande head: geen.
- Vercel project `liquidhr` meldt `live: false`. De nieuwste Production-deployment is `READY` op `main` SHA `6349d025…` (`dpl_63efkfC6BXosA9m1dQy7GjZ4Gho5`). De branch-filtered deploymentquery voor `work/apiai-01-build-20261003` vindt **0 deployments**.
- De repositoryconfiguratie zet `git.deploymentEnabled: false`; er is geen Preview/deployment gestart vanuit deze worktree. Een branchpush is uitsluitend bedoeld om Draft PR #3 bij te werken; er is geen merge, promote of route-activatie geautoriseerd.
- Lokale `git ls-remote`/`gh auth status` kan de actuele ref niet ophalen door ontbrekende/ongeldige lokale GitHub CLI-referenties (`SEC_E_NO_CREDENTIALS`). De verbonden GitHub- en Vercel-read-only-controles hierboven zijn gebruikt voor de externe momentopname. Dit zegt niets over een deployment die na een toekomstige push zou ontstaan; daarom wordt Vercel na een eventuele push opnieuw gecontroleerd.
## 7. Eindbesluit

**PARTIAL / NOT SECURITY-ACCEPTED / NOT EXTERNALLY ACTIVATABLE.** De auditprovenance-code, self-only handler, testdekking, typecheck, lint, exacte lokale TEST-build en gesloten-route HTTP-probes zijn gereed en overdraagbaar. De drie APIAI-01-routes blijven ongemount totdat de formele besluiten en live provider-, database-, RLS-, audit-, limiter- en route-wiringgates zijn aangetoond en goedgekeurd.
