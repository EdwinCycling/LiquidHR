# APIAI-04 — ChatGPT Plugin via MCP

Datum: 2026-10-05
Status: **LOCAL PROFILE BUILT / EXTERNAL ACCEPTANCE OPEN**

## Doel en architectuur

APIAI-04 beschrijft de ChatGPT-koppeling als een MCP-client van dezelfde
LiquidHR MCP-server die APIAI-03 oplevert. ChatGPT krijgt geen tweede
businesslogica, geen aparte autorisatie en geen eigen HR-datatoegang. De
server bepaalt per request de actuele authenticatie-, tenant-, administratie-,
rol- en employeecontext.

De metadata-bron staat in
[`chatgpt-metadata.ts`](../../../apps/hr-suite/lib/workforce-tools/mcp/chatgpt-metadata.ts).
De bron levert de MCP-serverinformatie en het `tools/list`-contract vanuit één
immutable definitie. De servernaam, instructions en versie volgen dezelfde
metadata; de versie is de canonieke `APP_VERSION`. De MCP-transportlaag kan de
geëxporteerde `CHATGPT_MCP_SERVER_METADATA` en `CHATGPT_MCP_TOOLS` rechtstreeks
gebruiken.

## Geadverteerde tool

Het ChatGPT-profiel adverteert uitsluitend:

`employee.talent.development-plans.read`

De tool is read-only, self-only en gebruikt een leeg, strict input-object. De
caller mag geen employee-, tenant-, administratie-, rol- of andere
authcontext-parameter meegeven. De server resolveert de actuele employeecontext
en moet dezelfde server-side authorization- en RLS-keten gebruiken als de
onderliggende LiquidHR-resource.

De structured output is beperkt tot:

- `periodStart`;
- `periodEnd`;
- `progressPercent`;
- `status`;
- `completedAt`.

De bron verwijst gecontroleerd naar de bestaande
`employee.talent.development-plans.read`-definitie voor toolnaam, description,
input, permission, audience, scope, module en read-operatie. De MCP-profiel-
metadata publiceert niet blind het interne output-schema. De geëxporteerde
`projectChatGptDevelopmentPlansResult` parseert eerst het interne Workforce-
resultaat en maakt daarna een nieuwe strict projectie met alleen de vijf
goedgekeurde velden. De MCP-handler past deze projectie toe vóór zowel
`structuredContent` als tekstinhoud wordt teruggestuurd.

Interne identifiers, titels, vrije tekst, evidence, documenten, salaris,
medische gegevens en contactgegevens zijn geen onderdeel van dit contract. De
runtime-schema's zijn strict zodat onbekende velden fail closed worden
afgewezen.

De MCP-handler projecteert het bestaande Workforce-resultaat vóór zowel
`structuredContent` als tekstinhoud. De lokale Inspector-route gebruikt voor
deze ene tool dezelfde projectie, ook al bevat die route voor roltesten de
volledige interne APIAI-02-catalogus.

De metadata markeert deze exposure als `LOCAL_TEST_ONLY`. De aparte ChatGPT-
profielhandler adverteert uitsluitend deze tool en is niet aan een route
gekoppeld. Dat is een bewuste product- en securitygrens: APIAI-01 heeft een
lokaal bouwcontract voor de self-only Development Plans-projectie, maar
provider-, bearer-, RLS-, limiter- en auditbewijs voor externe routeactivatie
ontbreekt nog.

## Niet geadverteerd

De bredere APIAI-02-catalogus blijft intern. Manager- en HR Admin-workflows
worden niet via deze ChatGPT metadata gepubliceerd totdat een afzonderlijk
extern scope-, privacy-, populatie- en RLS-contract is goedgekeurd. Er wordt
geen brede employee search toegevoegd voor ChatGPT. De metadata bevat ook geen
OAuth-clientgegevens, secrets, access tokens of service-role-informatie.

Er wordt geen legacy `ai-plugin.json`, custom GPT Action of tweede pluginroute
toegevoegd. De actuele integratierichting is MCP: servernaam, versie,
instructions, toolnamen, beschrijvingen, JSON Schema en read-only annotations.

## MCP Apps UI

Deze slice voegt geen widget toe. De enige toegestane resource is een
gestructureerde read-only Development Plans response; een iframe zou daarvoor
geen aantoonbare waarde toevoegen. Tools blijven daardoor bruikbaar voor
hosts die geen UI renderen. Een latere UI-slice moet eerst de open MCP Apps
bridge gebruiken (`_meta.ui.resourceUri` en `ui/*` JSON-RPC) en mag
ChatGPT-specifieke `window.openai`-extensions alleen gebruiken als de open
standaard de benodigde capability niet biedt.

## Acceptatie en grenzen

De contracttests
[`chatgpt-metadata.test.ts`](../../../apps/hr-suite/lib/workforce-tools/mcp/chatgpt-metadata.test.ts)
controleren stabiele servermetadata, minimale input, de vijf allowlisted
outputvelden, read-only annotations, het ontbreken van Manager/HR-tools en
fail-closed runtimevalidatie. De MCP-transporttest roept daarnaast de aparte
ChatGPT-handler aan en controleert `initialize`, `tools/list` en de
geminimaliseerde response.

Lokale MCP Inspector-proeven horen bij de APIAI-03 transportacceptatie. Een
echte ChatGPT Developer Mode-koppeling is in deze run niet uitgevoerd:
ChatGPT vereist een bereikbare HTTPS MCP-endpoint en eventuele externe
registratie blijft buiten scope. De status blijft daarom **EXTERNAL ACCEPTANCE
OPEN**. Lokale metadata- of Inspectorresultaten mogen niet als ChatGPT-host-
acceptatie worden gerapporteerd.

## Bronnen

- [OpenAI — MCP server bouwen](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI — MCP server en UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)
- [OpenAI — UI toevoegen aan een MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [OpenAI — plugin verbinden en testen](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [APIAI-01 productrichting](../../AA/APIAI-01-PRODUCT-DIRECTION-20261005.md)
- [APIAI-02 Workforce-tools](APIAI-02_WORKFORCE_TOOLS.md)
