# APIAI-03 — lokale Workforce MCP-transportlaag

Datum: 2026-10-05
Status: **LOCAL IMPLEMENTATION BUILT / EXTERNAL ACCEPTANCE OPEN**

## Doel en eigenaarschap

APIAI-03 voegt een MCP-transport toe voor de APIAI-02 Workforce-catalogus. De
transportlaag introduceert geen HR-querypad, identity bridge of
autorisatiemodel. Iedere toolcall gaat door de bestaande
`dispatchWorkforceTool`-dispatcher, die de actuele servercontext, audience,
scope, permission en tenantmodule opnieuw controleert voordat de bestaande
tool wordt uitgevoerd.

De handler gebruikt `@modelcontextprotocol/server` en de officiële
Streamable HTTP-handler. Iedere HTTP-request bouwt een verse stateless
`McpServer`; er wordt geen gebruikers- of tenantcontext tussen requests
opgeslagen. De route blijft een interne lokale ontwikkel-/testinterface.

## Lokale route en fail-closed voorwaarden

Route: `POST`, `GET` en `DELETE /api/internal/mcp`.

De route antwoordt standaard met `404 MCP_UNAVAILABLE`. Alleen wanneer alle
voorwaarden gelden, wordt de MCP-handler aangeroepen:

- `NODE_ENV` is `development` of `test`;
- `LIQUIDHR_INTERNAL_MCP_ENABLED=true` staat expliciet aan;
- `VERCEL` en `VERCEL_ENV` zijn niet gezet;
- request-URL en `Host` zijn HTTP-loopback (`localhost`, `127.0.0.1` of
  `::1`);
- de `Host`-header is uitsluitend een geldige loopback-host met optionele
  numerieke poort; pad-, query-, fragment-, userinfo-, backslash- en
  lijstwaarden worden geweigerd;
- een meegestuurde `Origin` is exact dezelfde origin als de request-URL.

De vastgelegde TEST-launcher bindt de applicatie aan `127.0.0.1`. Responses
zijn `no-store` en gebruiken de bestaande request-/correlation-ID-headers.
De SDK-handler begrenst de body op 16 KiB, gebruikt stateless JSON-responses
voor normale MCP-aanroepen en bouwt de server per request opnieuw op.

## Catalogusprofielen

De lokale Inspector-handler adverteert de acht APIAI-02-readtools: zes
Employee-tools, de directe-team-tool voor Manager en de tenanttool voor HR.
Dit bredere profiel is uitsluitend bruikbaar voor lokale roltesten achter de
loopback-gate. De zichtbare toolcatalogus verleent geen autorisatie; de gedeelde
dispatcher blijft leidend.

De aparte ChatGPT-handler adverteert alleen
`employee.talent.development-plans.read`, met strict lege input en de
APIAI-01-goedgekeurde projectie. Deze handler wordt door geen Next-route
gemonteerd. Het lokale Inspector-profiel gebruikt diezelfde vijf-velden-
projectie voor deze tool, ook in zijn bredere rolcatalogus.

Inputvalidatie, access errors, module-errors en onverwachte failures produceren
begrensde foutcodes. Callerwaarden en interne exceptiondetails komen niet in
MCP-foutteksten. Toolresponses doorlopen de bestaande Workforce-
outputvalidatie; het ChatGPT-profiel valideert daarna de smallere
Development Plans-projectie voordat tekst of `structuredContent` wordt
teruggestuurd.

## Beveiligingsgrenzen

- Geen bearer-tokenauthenticatie of externe identity mapping is toegevoegd.
- Geen browserbearer-, service-role- of directe databasequery is toegevoegd.
- Employee-, tenant-, administratie- en rolcontext komen niet uit toolinput.
- De bestaande cookie-authenticated BFF en de Workforce-dispatcher blijven
  verantwoordelijk voor sessie, actuele scope, permissions en moduletoegang.
- Geen Supabase-migratie, RLS-wijziging, remote write of publieke
  `/api/v1`-route is toegevoegd of geactiveerd.

## Verificatie en open acceptatie

Focused protocol-, route-, metadata-, WebMCP- en dispatcherregressies zijn
uitgevoerd. De officiële MCP Inspector heeft via HTTP tools/list gevalideerd:
acht tools in het lokale testprofiel en één tool in het aparte ChatGPT-profiel;
strict schema-controle slaagde. Dit controleert de MCP-handler en is geen
ChatGPT-hostacceptatie.

De eerdere TEST-launcherblokkade is niet meer actueel; deze is vervangen door de
geïntegreerde acceptatierun van 2026-10-05. Via de officiële TEST-launcher zijn
verse normale persona-logins en echte authenticated BFF/MCP-calls uitgevoerd
voor Employee, Manager en HR Admin; initialize, tools/list en tools/call
zijn met structured output en dispatcherautorisatie bewezen. tools/list toont
de statische catalogus van acht tools voor alle rollen; iedere uitvoering wordt
opnieuw server-side geautoriseerd. Zie het
[geïntegreerde acceptatierapport](../../quality/acceptance/runs/APIAI-03-04-05-INTEGRATION-20261005.md).

Er is geen ChatGPT Developer Mode-registratie, publiek HTTPS-endpoint of tunnel
gemaakt. Provider-, bearer-, RLS-, limiter-, audit- en externe hostacceptatie
blijven OPEN.

## Bronnen

- [MCP TypeScript SDK — Streamable HTTP](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)
- [MCP Specification — tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Specification — transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [OpenAI — MCP server bouwen](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI — plugin verbinden en testen](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [APIAI-01 productrichting](../../AA/APIAI-01-PRODUCT-DIRECTION-20261005.md)
- [APIAI-02 Workforce-tools](APIAI-02_WORKFORCE_TOOLS.md)
