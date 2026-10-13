# Permanente Payroll TEST-persona's

Dit is de leesbare ingang voor de canonieke [machinecatalogus](PAYROLL-TEST-PERSONAS.json). Gebruik de catalogus en `scripts/check-test-personas.ps1` voor iedere lokale Payroll-, ESS-, MSS- of PDF-acceptatie. Vraag niet opnieuw welke vaste accounts, role-switchdoelen of credentiallocatie beschikbaar zijn.

## TEST-omgeving en login

- Core TEST-project: `wnpfloqpjvaacobppbpk`.
- Payroll Lab TEST-project: `jhgeriucbkfarxiudzfy`.
- Geverifieerde broncontext: De Sterren holding → Planeten → Jupiter BV. HR Admin blijft binnen zijn eigen bestaande administratiebinding; de lokale role-switch kent geen rollen of administratie toe. De laatste herhaalrun kon De Sterren niet kiezen in de bestaande Admin→Edwin-handoff; Jupiter-acceptatie blijft daardoor geblokkeerd tot een reeds toegestane contextflow beschikbaar is.
- Lokale credentials staan, wanneer geprovisioneerd, in `%LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env`. De repository bevat geen wachtwoorden.
- Start alleen via `scripts/start-test-worktree.ps1` op loopback. Vercel Preview en de bestaande Production-deployment blijven gesloten voor Test Auth en role-switch.
- Terugkeer naar Test HR Admin gebruikt de bestaande lokale Test Auth-login. Role-switchtargets moeten al bestaan; de route weigert een ontbrekende Payroll-Auth-account en maakt die niet aan.

## Persona's

| Persona | TEST-login | Bestaande medewerker / dienstverband | Scope | Run en lifecycle | Status |
|---|---|---|---|---|---|
| Lisa | `lisa.test@liquidhr.test` | `64ad3a23-f59a-4ed0-af41-26dda20ff067` / `b7391845-77d4-407c-bfe6-555a8a3d463b` | De Sterren holding / Planeten / Jupiter BV | `57ac6c10-7a02-49c4-a588-2ca244e621d9` — 2026-10 FINALIZED | Bestaande Auth-link, ESS en Jupiter-context bevestigd. PDF/downloadcontrol niet gevonden op `/my-salary`; Manager/MSS-rol niet bevestigd. |
| Jaap | `jaap.test@liquidhr.test` | `dd9bde02-76bb-4f7c-8add-db544a148f3f` / `29058c73-5cfa-409d-b9d4-80dd30f36962` | De Sterren holding / Planeten / Jupiter BV | `e20e0345-90ac-489b-9fee-7610b2d8f6a3` — 2026-10 SUCCEEDED / CONCEPT | Auth-link en ESS ontbreken. Concept mag nooit als definitieve loonstrook verschijnen of voor acceptatie worden gefinaliseerd. |
| Frits | `frits.test@liquidhr.test` | `79091d14-ef66-41fe-a2d5-92df108727e5` / `d19bace9-bb97-4822-a462-eed22821ed05` | De Sterren holding / Planeten / Jupiter BV | `338ef391-fbf6-435a-a4d7-e28a8024ebc2` — 2026-10 FINALIZED; oudere september-/oktoberreferenties in JSON | Auth-link en ESS ontbreken. PFZW blijft SOURCE_GAP; netto is niet definitief. De huidige run toont `Jan` in de berekeningstrace terwijl de runheader Frits toont. Bronidentiteit is OPEN. |

De catalogus bevat de exacte tenant-, HR-groep-, administratie-, employee-, employment-, role-switch- en run-ID's. Lisa is alleen als medewerker-selfservice bevestigd. Ken haar geen Manager-rechten toe zonder afzonderlijk bewijs. De generieke Test Manager blijft de MSS-persona.

## Gebruik en toegangsgrenzen

1. Voer `scripts/check-test-personas.ps1` uit. Deze preflight controleert de canonieke projecten, ACL en waarden van de lokale credentialbron, vaste role-switchkeys, directe login, scope, ESS, dossier-self-only, desktop/mobiel en terugkeer. Gebruik `-SkipBrowser` alleen voor de statische/runtime-preflight; die kan geen persona `READY` verklaren.
2. Start de browser via de beveiligde lokale TEST-launcher; log in als Test HR Admin en wissel via de vaste keys `payroll-lisa`, `payroll-jaap` en `payroll-frits`.
3. Bevestig na iedere handoff tenant, HR-groep, administratie, eigen ESS-route en runlifecycle. Gebruik alleen de rechten van de ingelogde identiteit.
4. Keer via de bestaande Test Auth-flow terug naar Test HR Admin.

De browsercheck gebruikt een aparte sessie per directe persona-login en geeft alleen statuscodes, persona-keys en foutredenen weer. Wachtwoorden, response-body's en accountcookies worden niet gelogd of vastgelegd. De role-switch gebruikt de bestaande beveiligde Auth-handoff zonder een persona-wachtwoord in te voeren.

De Admin-sessie die uitsluitend Mars BV mag gebruiken, krijgt geen Jupiter-toegang. Gebruik voor Jupiter de bestaande geautoriseerde context of rapporteer het ontbrekende beheerbewijs. Geen account-, rol-, ESS-, administratie- of Payroll-write om acceptatie te fabriceren. Historische runreferenties en gaps blijven ongewijzigd.
