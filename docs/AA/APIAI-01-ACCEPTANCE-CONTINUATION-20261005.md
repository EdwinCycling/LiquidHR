# APIAI-01 — acceptatievoortzetting 2026-10-05

- Status: **PARTIAL / DATABASE ENVIRONMENT-GATED / NOT SECURITY-ACCEPTED / ROUTES UNMOUNTED**
- Worktree-identiteit: apiai01-build-20261003
- Branch: work/apiai-01-build-20261003
- Lokale applicatiecommit: 7c28cddd3a5fb08c6fea610e3266dc8578d32df4
- Remote PR #3-head: 2408b2646421619ac1d9ce57a1aa0e82bcb4e731; open en Draft
- Productbesluiten: P-01 t/m P-05 zijn door Edwin goedgekeurd voor implementatie. Security-, Privacy-, Data- en Operations-acceptatie voor externe activering blijft open.

Deze voortzetting actualiseert de oudere [acceptatierun](APIAI-01-ACCEPTANCE-RUN-20261005.md). De nieuwe lokale commit is niet naar GitHub gepusht en staat niet op PR #3. Geen publieke route is gemount; er is niet gemerged of gedeployed.

## Productrichting

De exacte buildrichting staat in [APIAI-01-PRODUCT-DIRECTION-20261005.md](APIAI-01-PRODUCT-DIRECTION-20261005.md). Keycloak blijft alleen de voorkeurskandidaat voor een technische proef. De eerste resource is self-only Development Plans met uitsluitend periodStart, periodEnd, progressPercent, status en completedAt. De productgoedkeuring laat de afzonderlijke security-, privacy- en databasedrempels intact.

## Lokale implementatie en verificatie

De lokale commit voegt providerneutrale OAuth/PKCE-contracten en endpointbeveiliging, een fail-closed identity-bridge seam, een self-only Development Plans-handler en compositie-/regressietests toe. Er is geen concrete Keycloak-verifier, callback/stateopslag of persistente identity-linkopslag toegevoegd. De compositietest gebruikt mocks en is geen bewijs van een echte provider, Supabase, AuthContext of PostgreSQL.

| Controle | Resultaat | Bewijsgrens |
| --- | --- | --- |
| Volledige hr-suite Vitest, serieel | **533 bestanden geslaagd, 4 overgeslagen; 2.289 tests geslaagd, 8 overgeslagen** | Lokale unit-, component- en contracttests |
| Strict TypeScript | **Geslaagd** met incremental false | Geen live databasebewijs |
| ESLint | **0 errors; 7 bestaande Payroll-testwaarschuwingen** | Geen nieuwe APIAI-waarschuwingen |
| i18n | **41 NL/EN-namespaces met gelijke sleutels** | Geen API-routebewijs |
| APIAI-migratiecontracttest | **1 bestand / 3 tests geslaagd** | Statische SQL-contracten; geen PostgreSQL |
| Officiële LiquidHR Production-build op commit 7c28cdd | **Geslaagd; 308 pagina's; Payroll client-boundary scan 152 browserassets geslaagd** | Lokale build met centrale TEST-config; geen Vercel-deployment |
| Lokale Production-runtime op poort 3011 | **404** voor workforce/summary, team-skills en development-plans; server daarna gestopt | Bevestigt alleen dat deze publieke routes ongemount blijven |
| Normale login en rolwisseling | Niet opnieuw uitgevoerd | Niet relevant voor deze ongemounte API-modulewijziging; oudere SHA-evidence is geen bewijs voor deze commit |

De parallelle eerste full-suite-run had één timeout in een bestaande Payroll-grensscan. Diezelfde test slaagde afzonderlijk 5/5; de daaropvolgende volledige seriële run slaagde volledig zoals hierboven. Alle tests zijn lokaal uitgevoerd.

## Supabase-testdatabase en remote status

Edwin gaf toestemming voor één tijdelijke APIAI-testbranch, minimale synthetische fixtures en uitsluitend daar de kandidaat-migratie. De bestaande Supabase-tooling weigerde branchcreatie met PaymentRequiredException: branching vereist het Pro-plan of hoger. De read-only branchinventaris toont alleen de default branch main van project wnpfloqpjvaacobppbpk. Er is geen testbranch-ID.

Daarom zijn niet uitgevoerd: fixtures, migration apply, de 40 pgTAP-asserties, PostgreSQL RLS/grants- of directe RPC-negatieven, audit-write/readback, tenant-lifecycle, limiter first-use/burst/refill/fail-closed, concurrency met twee sessies, catalog-readback, Supabase advisors of typegeneratie. De geslaagde contracttest is hiervoor geen vervanging. De gedeelde Core TEST-database is niet als proef- of resetomgeving gebruikt; Docker, WSL en containers zijn niet gebruikt.

Vóór een branchapply moet de branch-eigen migrationhistory en catalogus opnieuw read-only worden gecontroleerd. In de kandidaat-migratie heeft DROP FUNCTION op regel 542 een 8-argument-signatuur, terwijl de aangemaakte en verleende RPC een 9-argument-signatuur heeft. Controleer op de geïsoleerde branch alle bestaande overloads voordat deze DDL wordt toegepast; los een aangetroffen afwijking uitsluitend forward-only op en voeg een regressietest toe.

### Uitvoerbaar vervolg voor PostgreSQL-bewijs

1. Maak de geautoriseerde branch apiai01-dbtest-20261005 opnieuw aan nadat branching op het bestaande project beschikbaar is, of wijs een reeds geïsoleerde Supabase/PostgreSQL-testdatabase aan. Een abonnement upgraden of een nieuw project aanmaken is niet in deze opdracht uitgevoerd.
2. Lees branch-eigen migrationhistory, relevante schema's en alle record_api_read_audit-overloads; bevestig dat de kandidaatversie voorwaarts toepasbaar is.
3. Maak alleen de minimaal noodzakelijke synthetische HR Admin-, Manager-, Employee-, tenant-, HR-groep-, administratie- en relatiefixtures aan.
4. Pas alleen de APIAI-kandidaat en direct noodzakelijke forward-correcties toe. Draai de 40 pgTAP-asserties, RLS/grants en directe RPC-negatieven, actor/tenant/HR-groep/administratie-isolatie, audit-write/readback, tenant-lifecycle, limiter first-use/burst/refill/fail-closed en twee onafhankelijke concurrency-sessies.
5. Lees schema, overloads, grants, policies, auditrecords en limiterstatus terug; voer security- en performance-advisors uit en verifieer gegenereerde types. Bewaar bewijs met projectref en branch-ID. Merge of reset deze branch niet.

## Onafhankelijke securityreview en resterende gates

De onafhankelijke LUNA MAX-review vond geen P0, maar adviseert **NO-GO voor route-activatie**. De volgende P1-gates blijven open:

- Geen echte Keycloak/provideradapter met cryptografische JWKS/algoritmevalidatie en actuele grant-liveness; de contracten gebruiken testverifiers.
- Geen server-side, eenmalige OAuth-state/verifieropslag en replaypreventie of callbackroute.
- Geen persistente unieke issuer/subject → auth.users.id-opslag en bewezen lifecycle.
- Geen volledige bearer → identity bridge → actuele AuthContext → hetzelfde Supabase bearer → auth.uid() → RLS-proef; auth.getClaims en querylaag in de compositietest zijn mocks.
- Geen bewijs dat dezelfde geldige bearer direct na revoke wordt geweigerd.
- Geen PostgreSQL-bewijs voor RLS, grants, direct RPC-afwijzingen, limiteratomiciteit/concurrency, audit-integriteit/readback of tenant lifecycle.
- Geen externe route-wiring. Alle APIAI-01-routes blijven 404 en ongemount.

Andere ontwikkelsporen zijn geen APIAI-01-blokkade zolang deze slice hun code of schema niet wijzigt.

## GitHub en Vercel

PR #3 staat open en Draft op remote SHA 2408b2646421619ac1d9ce57a1aa0e82bcb4e731. De nieuwe lokale applicatiecommit 7c28cddd is niet gepusht. De branchdeploy-query van Vercel retourneerde nul deployments voor work/apiai-01-build-20261003. Er is geen deployment of merge uitgevoerd.

## Wat Edwin nog nodig is

- Maak branching op het bestaande Supabase-project beschikbaar via een plan waarop database branching werkt, of wijs een reeds bestaande geïsoleerde APIAI-testdatabase aan. Dit ontgrendelt de remote acceptatie; het is geen verzoek om de gedeelde Core TEST-database te wijzigen.
- Security/Privacy/Data/Operations moeten hun afzonderlijke voorwaarden voor externe activering formeel accepteren nadat de concrete provider- en databasebewijzen beschikbaar zijn.

Tot deze gates zijn bewezen blijven database- en securitystatussen OPEN; de geslaagde lokale tests en build worden niet als PostgreSQL- of externe acceptatie gepresenteerd.