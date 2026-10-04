# APIAI-01 — security-integratiebesluiten ter goedkeuring

- **Datum:** 2026-10-04
- **Status:** voorstellen voor review — **NIET GOEDGEKEURD**
- **Relatie:** aanvulling op [APIAI-01-DECISIONS-DRAFT-20261003.md](APIAI-01-DECISIONS-DRAFT-20261003.md) en [APIAI-01-SECURITY-STORAGE-PROPOSAL-20261003.md](proposals/APIAI-01-SECURITY-STORAGE-PROPOSAL-20261003.md).
- **Grens:** dit document keurt geen provider, tokencontract, veldset, quota, databasewijziging, publieke route of externe activering goed.

De voorstellen zijn aangescherpt na implementatie van een lokale bearer/RLS-keten en een onafhankelijke review van de D0-documentatie. Tests met mocks valideren codepaden; zij vervangen geen echte provider-, bearer-, RLS- of databaseproef.

## P-01 — OAuth-provider en gedelegeerde levenscyclus

**Voorgestelde keuze.** Behoud Authorization Code + PKCE met uitsluitend `S256`; bind iedere aanvraag aan een vooraf geregistreerde client met een exacte redirect-URI. Koppel een externe actor alleen met een unieke `(issuer, subject)`-link naar één bestaande LiquidHR-gebruiker. Valideer access-tokenhandtekening, issuer, audience, client-id, tijdclaims, actieve clientregistratie en revocatiestatus bij ieder verzoek. Gebruik nooit e-mailmatching, ID-tokens, browsercookies of service-role als partneridentiteit.

Supabase Auth OAuth Server blijft een conditionele kandidaat, geen gekozen provider. De gedeelde TEST-provider gaf tijdens de providerproef `feature_disabled`; de lokale Supabase-configuratie heeft de OAuth Server uitgeschakeld. Er is geen echte code-, PKCE-, `aud`-, `client_id`-, link- of revocatieproef uitgevoerd. De officiële documentatie beschrijft Authorization Code + PKCE, maar staat zowel `S256` als `plain` toe en documenteert geen projectinstelling om `plain` uit te schakelen; `S256` is aanbevolen, dus een harde S256-only-eis is hiermee niet provider-GREEN ([OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)). De standaard access-token-audience is `authenticated`; een Custom Access Token Hook kan claims, waaronder `aud`, aanpassen. Access tokens bevatten `client_id`, dat in RLS kan worden gebruikt ([OAuth getting started](https://supabase.com/docs/guides/auth/oauth-server/getting-started), [token security](https://supabase.com/docs/guides/auth/oauth-server/token-security), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)). Native scopes zijn OIDC-profielscopes; custom LiquidHR-resource-scopes zijn niet beschikbaar ([OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)). `revokeGrant` trekt grant-/refresh-tokenstatus en sessies in, maar een reeds uitgegeven stateless JWT kan tot `exp` cryptografisch geldig blijven; gevoelige routes moeten daarom ook de sessie/grant-liveness controleren ([user sessions](https://supabase.com/docs/guides/auth/sessions), [user management](https://supabase.com/docs/guides/auth/managing-user-data)). Supabase Identity Linking of e-mailmatching is niet gelijk aan een goedgekeurde unieke `(issuer, subject)`-koppeling ([Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)).

**Alternatieven.** (a) Een andere OAuth/OIDC-provider die de volledige negatieve matrix doorstaat. (b) Supabase na een geïsoleerde lokale providerproef, eigen consent-UI, asymmetrische sleutels, expliciete app-level scopes en bewezen weigering van een bestaand token na revoke. Een TTL-only compromis is alleen bespreekbaar na een expliciete risicoacceptatie en bewaakte maximale blootstellingsduur.

**Impact.** Er wordt nog geen provideradapter, consent-/callbackroute, clientregistratie, OAuth-configuratie of route geactiveerd. De huidige providerneutrale interfaces vormen uitsluitend een testbare grens.

**Goedkeuring nodig.** Product kiest provider, clienttypen, consent, redirects, accountlink/unlink en menselijke versus machine-identiteiten. Security keurt claims, algoritmes/sleutels, clientbinding, replay, intrekking en incidentgedrag goed. Privacy/platform keurt providergegevensverwerking, bewaartermijnen, secrets en eventuele beta-aanvaarding goed.

## P-02 — externe scopes naar LiquidHR-autorisatie

**Voorgestelde keuze.** Behandel externe resource-scopes als een afzonderlijke, beperkte applicatielaag-capability. Zij geven nooit zelfstandig toegang en worden per resource gecombineerd met actuele canonieke LiquidHR-permissions, moduletoegang, bestaande services en RLS. Supabase standaard OIDC-scopes worden niet als LiquidHR-resourcescopes geïnterpreteerd. Geen aanvraagparameter mag tenant, HR-groep, administratie, medewerker, team of mode selecteren.

Voorstel voor de eerste mapping: `workforce.summary.read` → `employee:read` plus goedgekeurde module-/datasetgrens; `development-plans.self.read` → `self:talent-goal:read` plus actieve TALENT-module en de self-serviceguard; `team.skills.read` blijft uitgesteld. Accounts met meerdere mogelijke tenant-/HR-groep-/administratiecontexten falen voorlopig met `409` totdat Product en Security een niet-cookie contextselectiecontract goedkeuren.

**Alternatieven.** Eén brede `workforce.read`-scope is minder least-privilege; scopes per veld/filter voegen onnodige complexiteit toe. Als providerclaims geen resource-scopes ondersteunen, blijft een geregistreerde, server-side consent/capabilitymapping mogelijk, maar alleen na goedkeuring en echte clientbindingtests.

**Impact.** De lokale integratie bindt bearer, accountlink, contextloader en beschermde read-adapter aan één requestgebonden RLS-client. De bestaande permissionhelper voert self-/ESS-/preboardingregels uit. Dit codebewijs is unit-/integratie-testbewijs en nog geen provider- of databasebewijs.

**Goedkeuring nodig.** Product keurt scope-namen en consentbetekenis goed. Security keurt elke scope-to-permission/modulecombinatie, contextselectie en actuele-rechtensemantiek goed. De domeineigenaar bevestigt per resource de zichtbare populatie.

## P-03 — eerste read-only resources en veldcontract

**Voorgestelde keuze.** Houd routes ongemount totdat contract en securityketen zijn goedgekeurd. Behandel alleen de self Development Plans-projectie als lokaal geïntegreerde kandidaat: `periodStart`, `periodEnd`, `progressPercent`, `status`, `completedAt`. De projector geeft geen titel/vrije tekst, database-ID, capability-ID of employee-ID terug en laat de bestaande Talent-service dezelfde bearercontext en client gebruiken.

Een Workforce Summary met alleen `asOfDate` is niet betekenisvol afgerond. Een mogelijke latere, betekenisvolle kandidaat is uitsluitend `activeEmployeeCount`, berekend over de server-afgeleide zichtbare populatie en alleen met goedgekeurde minimumgroottes en suppressieregels; totdat P-04 dit goedkeurt bestaat dit veld niet als API-belofte. Team Skills blijft `DEFERRED` wegens linkability en het ontbreken van een goedgekeurde niet-herleidbare populatie-/filtercontract.

**Alternatieven.** Alleen self Development Plans als eerste resource; Workforce Summary later toevoegen na privacybesluit. Team Skills niet aanbieden in v1. Geen raw service-DTO of vrije tekst serialiseren.

**Impact.** Runtime-schema en tests valideren de self-projectie. Workforce Summary en Team Skills worden niet als volledig of bruikbaar gepresenteerd; geen van de drie publieke routes is gemount.

**Goedkeuring nodig.** Product/domein bevestigt de betekenis en enum-/datumsemantiek van Development Plans en of een headcount werkelijk nodig is. Privacy en Security keuren de aggregaatpopulatie, herleidbaarheid, minimumgroepgrootte, suppressie en querydifferencingbescherming goed. Een eventuele titel of andere vrije tekst vereist afzonderlijke classificatie en goedkeuring; de huidige kandidaat laat die weg.

## P-04 — dataminimalisatie, aggregatie en privacy

**Voorgestelde keuze.** Gebruik per resource vaste allowlists, runtime-schema's en `Cache-Control: no-store`. Sluit namen, werknemersnummers, interne IDs, salaris, contactgegevens, medische/verzuimdetails, documenten, evidence en vrije tekst uit. Accepteer geen clientfilters, peildatum, sortering of uitsplitsingen die de populatie verkleinen. Houd aggregaten uitgeschakeld totdat een afzonderlijk privacybesluit bestaat.

Een eventuele headcount vereist ten minste een goedgekeurde minimumcohort, kleine-cel-suppressie, begrensde herhaalde queries tegen differencing, een server-afgeleide populatie en audit/retentiebeleid. De eerder genoemde groep-5-grens is een mogelijk minimumuitgangspunt en geen automatische goedkeuring of voldoende bescherming op zichzelf.

**Alternatieven.** Alleen individuele self-data aanbieden; aggregaten uitstellen; Team Skills helemaal niet publiceren wanneer veilige projectie of groepsgrootte niet kan worden bewezen.

**Impact.** De Development Plans-projector beperkt output tot niet-vrije-tekst period-/statusvelden en voert runtimevalidatie uit. Geen workforcecount of skillsdata is geïmplementeerd of openbaar.

**Goedkeuring nodig.** Privacy/Product keurt doel, categorieën, populatie, cohortgrens, suppressie, differencinglimieten, bewaartermijn en eventueel client-side opslag goed. Security controleert de volledige response-/fout-/log-/auditpaden. De domeineigenaar bevestigt status- en peildatumdefinities.

## P-05 — limiter, READ-audit en fouten

**Voorgestelde keuze.** Gebruik uitsluitend een gedeelde atomische database-limiter in een niet via Data API blootgestelde `internal_security`-opslag. De bucket-sleutel bindt tenant, HR-groep, `auth.uid()`-actor, geregistreerde OAuth-client en vaste resource; de functie gebruikt de databaseklok, een row lock of conflict-safe atomic upsert, een allowlist, en retourneert alleen `allowed`, `remaining` en begrensde `retryAfterSeconds`. Actor en actieve tenant-/HR-groepmembership worden in de database afgeleid/gecontroleerd; ontbrekende policy, membership, clientbinding, opslag of databasefout faalt gesloten. Overschrijding wordt `429`; limiter- of auditopslagfout wordt `503`. Gebruik `audit_logs` als canonieke auditbron, zonder fictieve `entity_id`, payload, employee-id, result count, raw IP of token. Schrijf een toegestane response pas uit nadat de verplichte READ-audit veilig is opgeslagen.

De kandidaat-RPC-wrappers en hun allowlistpayloads bestaan lokaal, maar de benodigde SQL-functies, policies/grants en opslag zijn niet aanwezig of getest. De JavaScript-`Map`-limiter is alleen een test-double; zij bewijst geen database-atomiciteit of concurrency. Het bestaande schema mist `READ` en `hr_group_id`, vereist `entity_id` en toont geen live atomiciteit. Voor API-read events is het voorstel de minimale nullable velden `hr_group_id`, `api_resource_key`, `api_client_id`, `api_outcome`, `api_status_code` en `correlation_id` toe te voegen, met een constraint die `entity_id IS NULL` uitsluitend toestaat bij `entity_name = 'api_resource'` en `action = 'READ'`; bestaande events houden `entity_id` verplicht. Inserts binden actor aan `auth.uid()`, beperken metadata tot de typed allowlist en verbieden UPDATE/DELETE. Auditlezers moeten naast `audit:read` ook toegang tot de gevulde HR-groep hebben. `correlationId` is de huidige wrapperinput; het voorstel is alleen correlation-ID op te slaan en request-ID operationeel te houden. Product/Security moeten caller-supplied trace-ID's, opslag, retentie en onderscheid tussen beide headers goedkeuren.

**Alternatieven.** Een aparte `internal_security.api_read_audit`-tabel vermijdt wijziging van `audit_logs`, maar wijkt af van de canonieke auditbron en vraagt een expliciet Data/Product-besluit over bron, retentie en uitleesrechten. Een gateway- of in-memory limiter kan aanvullend misbruik afremmen, maar vervangt de atomische actor/client/resource-limiter niet. Een fictieve `entity_id` (tenant-ID of willekeurige UUID) is afgewezen omdat die auditsemantiek vervalst.

**Impact.** Er is geen echte limiter- of audit-RPC, geen migratie en geen remote wijziging. Unit-tests bewijzen payloadvalidatie en fail-closed wrappers, niet concurrency, RLS, grants of databaseatomiciteit. Er zijn geen productquota vastgelegd.

**Goedkeuring nodig.** Product/Operations keurt quota, burst, kostenbeleid, alerting en uitzonderingen goed. Security/Data keuren actor-/clientbinding, atomiciteit, `audit_logs`-uitbreiding, nullable-entityconstraint, HR-groepsselectiepolicy, retention en correlation/request-ID-contract goed. Pas daarna volgt een lokale migratie met advisor/typegen en afzonderlijk goedgekeurde remote toepassing.

## Besluitstatus en activeringsgrens

Alle bovenstaande keuzes blijven **PROPOSAL / NOT APPROVED**. Opname in D0/PR #2 of PR #3, tests of dit addendum vormen geen goedkeuring. Een externe route blijft ongemount tot de benodigde Product-, Security-, Privacy- en Data-goedkeuringen formeel in ADR/FDR/contract zijn vastgelegd en provider-, RLS-, database- en runtimebewijs alle relevante negatieve cases dekt.
