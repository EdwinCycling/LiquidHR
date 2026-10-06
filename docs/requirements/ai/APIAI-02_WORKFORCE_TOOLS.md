# APIAI-02 — gedeeld workforce-toolplatform

Datum: 2026-10-04
Status: lokale implementation-candidate; geen externe API-publicatie

## Doel en grens

APIAI-02 levert één provider-neutrale catalogus, runtimecontract en dispatcher voor deterministische, read-only workforce-tools. Een tool mag uitsluitend bestaande LiquidHR-services aanroepen; authenticatie, actuele rol, actieve tenant/context, capability, permission, module en onderliggende service-/RLS-scope blijven server-side bepalend.

De cookie-authenticated BFF staat intern op `POST /api/internal/workforce-tools`. Dit pad is geen partner-API. De publieke `/api/v1`-routes blijven ongemount. De lokale MCP-achtige harness is in-process en opent geen netwerklistener. HeRa/Gemini krijgt function declarations uit dezelfde catalogus en dispatcht via dezelfde runtimevalidatie.

## Catalogus

| Tool | Doelgroep en scope | Invoer |
|---|---|---|
| `employee.talent.development-plans.read` | Employee, uitsluitend eigen ontwikkelplannen | Leeg object |
| `employee.talent.development-progress.read` | Employee, uitsluitend eigen voortgang | Leeg object |
| `employee.talent.skills.read` | Employee, eigen skills | Leeg object |
| `employee.talent.competencies.read` | Employee, eigen competenties | Leeg object |
| `employee.talent.development-gaps.read` | Employee, eigen functieprofielvergelijking | Leeg object |
| `employee.talent.goal-check-ins.read` | Employee, metadata van check-ins bij een eigen ontwikkeldoel | Alleen `goalId`; de service bindt het doel aan de actuele employee |
| `manager.talent.team-capability-matrix.read` | Manager, uitsluitend directe teamleden | Zoek- en capabilityfilters plus begrensde `limit`/`offset` |
| `hr.talent.tenant-capability-matrix.read` | HR, tenantbrede capabilitymatrix | Dezelfde zoek-/capabilityfilters en begrensde `limit`/`offset` |

De Manager/HR-matrix laat alleen `RELEASED` en `EXPIRED`-records zien. HR vereist zowel de bestaande team-read- als tenant-manage-permission. Tenant-, HR-group-, administratie-, employee-, manager-, department- en teamselectors zijn geen caller-invoer. Manager kan `DRAFT` niet opvragen.

## Contract en beveiliging

- Elke tool heeft strikte Zod-input- en output-schema's. Onbekende keys en caller-gestuurde scopes worden vóór de serviceaanroep afgewezen.
- De centrale dispatcher valideert eerst de invoer en herleidt daarna de actuele audience uit de geauthenticeerde actieve rollen. Hij controleert scope, alle gedeclareerde permissions en de actieve module voor iedere aanroep.
- Self-tools vereisen een employee-context en canonieke `self:*:read`-permission. De check-in-service zoekt eerst het doel binnen tenant én actuele employee-ID en bindt de check-in-query opnieuw aan die employee-ID. Een onbekend of niet-eigen doel geeft dezelfde generieke `404`.
- Manager-/HR-scope en database-autorisatie blijven in bestaande services en RLS. Toolinvoer kan die scope niet verbreden.
- Employee-uitvoer bevat geen onnodige database-ID's, beschrijvingen, evidence-document-ID's, private check-in-tekst of follow-up-titel. Ontwikkelplannen geven alleen `goalId` terug als minimale navigatiesleutel voor de eigen check-inmetadata-tool; de overige Employee-uitvoer laat interne ID's weg.
- Manager/HR-uitvoer bevat geen employee-, department-, record-, capability- of evidence-ID's. Per pagina worden maximaal 25 medewerkers en 20 capabilities per medewerker teruggegeven. `hasMore`/`nextOffset` beschrijven pagina's; `sourceTruncated` meldt dat een onderliggende query de serverlimiet van 5.000 plaatsingen of 10.000 capabilityrecords heeft geraakt. Per medewerker meldt `capabilitiesTruncated` de modeluitvoerlimiet.
- De interne HTTP-route begrenst de JSON-body tot 16 KiB, gebruikt `Cache-Control: no-store` en geeft alleen begrensde foutcodes terug.

## Niet inbegrepen

APIAI-02 voegt geen schrijftools, schema of migraties, OAuth-client/PKCE, bearer-tokenflow, publieke API-route, provider-call, Liquid Credits-afschrijving, nieuw auditopslagmodel of externe netwerk-MCP-server toe. APIAI-01 blijft de aparte gesloten foundation voor een toekomstige externe API; deze interne catalogus activeert die route niet.

## Acceptatie

De lokale code- en regressiegates zijn vastgelegd in [`APIAI-02 acceptance`](../../quality/acceptance/runs/APIAI-02-20261004.md). Die status onderscheidt unit-/integratiebewijs van lokale authenticated TEST-browserproeven en van ontbrekend hosted/previewbewijs.
