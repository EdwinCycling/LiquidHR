# APIAI-01 — productrichting voor de buildfase

- Datum: 2026-10-05
- Status: **Edwin/Product direction APPROVED FOR IMPLEMENTATION**
- Grens: dit is goedkeuring om de beschreven keuzes lokaal te bouwen en te testen. Het is geen Security-, Privacy-, Data- of Operations-acceptatie en activeert geen externe route.

## P-01 — OAuth

Behoud een providerneutrale architectuur. Keycloak is de voorkeurskandidaat voor de geïntegreerde technische proef, niet de definitieve productieprovider. Vereist blijven Authorization Code, PKCE S256, exacte issuer-, audience- en clientvalidatie, een unieke koppeling op issuer en subject, actuele grant- en token-liveness en bewijs dat dezelfde nog geldige bearer na revoke wordt geweigerd.

## P-02 — scopes en LiquidHR-autorisatie

Een externe scope is de maximale clientcapability, nooit de autoriteitsbron. Iedere request moet daarnaast actuele AuthContext, canonieke permission, moduletoegang, tenant, HR-groep, administratie, subjectscope en RLS doorstaan. Een client kan die context niet zelf verbreden.

## P-03 — eerste resource

De eerste externe resource is self-only Development Plans. De toegestane velden zijn periodStart, periodEnd, progressPercent, status en completedAt. Retourneer geen identifiers, titel of vrije tekst en accepteer geen employee-selector. Workforce Summary en Team Skills zijn geen blokkade voor deze slice; zij blijven op hun eigen roadmap.

## P-04 — dataminimalisatie

Bouw een vaste veldallowlist, runtimevalidatie en Cache-Control: no-store. Sluit salaris, BSN, contactgegevens, medische of verzuimgegevens, documenten, evidence en vrije tekst uit. Aggregaten vallen buiten deze eerste resource. De definitieve externe privacyacceptatie blijft een aparte gate.

## P-05 — limiter en audit

Bouw een database-backed atomische limiter met fail-closed gedrag, een server-only auditwriter en de bestaande canonieke auditbron. HR-data wordt uitsluitend via de bearergebonden RLS-client gelezen. Service-role is alleen toegestaan voor de smalle audit-RPC, nooit voor HR-datareads. Gebruik voor databaseacceptatie uitsluitend duidelijk als TEST ONLY gemarkeerde quota; productiequota worden later vastgesteld. Test directe ongeautoriseerde RPC-aanroepen als expliciete trust-boundary-negatieven.

## Activeringsgrens

Alle routes onder /api/v1 blijven ongemount. Productrichting vervangt geen formele Security-, Privacy- of Data-goedkeuring, geen provider-/tokenbewijs en geen PostgreSQL/RLS/grants-, limiterconcurrency- of audit-readbackbewijs. Zie ook de [acceptatievoortzetting](APIAI-01-ACCEPTANCE-CONTINUATION-20261005.md).