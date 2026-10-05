# APIAI-05 — WebMCP progressive enhancement

Datum: 2026-10-05
Status: **LOCAL ADAPTER BUILT / AUTHENTICATED APP ACCEPTANCE OPEN**

## Doel

APIAI-05 registreert bestaande read-only Workforce-tools via de experimentele
WebMCP imperative API wanneer de browser die aanbiedt. Browsers zonder
`document.modelContext` blijven gewone LiquidHR-browsers: er wordt geen
polyfill of tweede bediening geïnstalleerd.

De registratie is alleen een AI-discoverylaag. De server-side
`/api/internal/workforce-tools`-route en gedeelde Workforce-dispatcher blijven
voor iedere toolcall de bron voor authenticatie, toestemming, context, tenant,
module en RLS.

## Registratie en context

De Dashboard Server Component bouwt descriptors uit de bestaande
Workforce-catalogus. De lijst wordt beperkt op dezelfde role-audience-precedentie
als de dispatcher, geldige Employee/Manager/HR-scopevoorwaarden, actieve
permissions en ingeschakelde tenantmodule. Alleen ID, beschrijving, READ-
operatie en input-schema gaan naar de client; identifiers en autorisatiecontext
worden niet opgenomen in toolinput.

De clientcomponent registreert tools alleen onder het ingelogde dashboard en
gebruikt de actuele browserroute en een opaque server-render-lifecyclekey als
effectdependencies. Cleanup abort de lifecycle, waarna Chrome de tools
unregistert en lopende fetches worden afgebroken. Ondersteunde paden zijn
read-only; output wordt als onbetrouwbare inhoud gemarkeerd.

Toolnamen krijgen de stabiele prefix `liquidhr_`. Elke aanroep gebruikt een
relatieve same-origin `POST /api/internal/workforce-tools`, met
`credentials: 'same-origin'` en `cache: 'no-store'`. De body bevat uitsluitend
`toolId` en `input`. Vóór verzending valideert de adapter de input tegen het
gepubliceerde JSON Schema (vereiste velden, typen, grenzen, enums, patterns en
gesloten objecten). Een schema met niet-ondersteunde validatie-keywords wordt
fail-closed niet geregistreerd; alleen object-root-schema's worden als tools
geadverteerd. De BFF en Workforce-dispatcher blijven de server-authoritatieve
schema- en autorisatiegrens. De adapter weigert daarnaast
geneste of top-level callercontext zoals tenant-, employee-, user-, rol-,
administratie-, HR-groep-, afdeling-, team- of manager-ID's. De clientfilter
blijft uitsluitend discovery/UX.

## Foutafhandeling

- Een browser zonder WebMCP geeft een lege no-op registratie terug.
- Absolute en protocol-relative endpoint-URL's worden geweigerd.
- Rechten-, sessie-, module- en resourcefouten worden naar een stabiele
  allowlist aan foutcodes gemapt.
- Serverbody's, databasefouten en andere interne response-details worden niet
  naar het model doorgegeven.
- Lifecycle-cleanup annuleert registratie en actieve requests.

## Verificatie en grenzen

De gerichte unit-tests controleren progressive fallback, read-only selectie,
annotations, same-origin credentials, requestbody, contextinjectie, bounded
errors, JSON Schema-invoervalidatie en abort/cleanup. Een cataloguscontracttest
controleert dat alle acht huidige Workforce-schema's worden geregistreerd.

Een geïsoleerd Chrome `154.0.8037.93`-profiel met de officiële
`chrome://flags/#enable-webmcp-testing`-flag bevestigde dat de native browser
de tool registreert, uitvoert en na cleanup verwijdert. De proef gebruikte een
lokale mockresponse. De TEST-app kon niet worden gestart omdat de centrale
`%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` ontbreekt; de geïntegreerde
authenticated BFF-/persona-browsertest blijft **ENVIRONMENT-GATED**.

WebMCP is een experimentele Chrome API, geen releasevoorwaarde of vervanging
voor MCP. Externe ChatGPT, provider, OAuth/bearer, openbare hosting en
route-activatie blijven buiten scope.

## Bronnen

- [Chrome for Developers — WebMCP](https://developer.chrome.com/docs/ai/webmcp/)
- [Chrome for Developers — WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome for Developers — WebMCP secure tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [APIAI-02 Workforce-tools](APIAI-02_WORKFORCE_TOOLS.md)
- [APIAI-04 ChatGPT MCP-profiel](APIAI-04_CHATGPT_MCP_PLUGIN.md)
