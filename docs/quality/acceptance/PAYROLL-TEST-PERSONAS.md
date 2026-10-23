# Permanente Payroll TEST-persona's

Dit is de leesbare ingang voor de canonieke [machinecatalogus](PAYROLL-TEST-PERSONAS.json). Gebruik de catalogus en `scripts/check-test-personas.ps1` voor lokale Payroll-, ESS-, MSS- of PDF-acceptatie. Lisa/Jaap/Frits blijven **PARTIAL / BLOCKED** waar hun afzonderlijke Auth- of bronlinks ontbreken. De Test HR Admin-context en de afgebakende DEMO-002-loonstrookflow zijn lokaal gecontroleerd in [PAYDOC-D0](runs/PAYDOC-D0-20261021-LOCAL.md).

## TEST-omgeving en vaste loginroute

- Core TEST-project: `wnpfloqpjvaacobppbpk`; Payroll Lab TEST-project: `jhgeriucbkfarxiudzfy`.
- Doelcontext voor Lisa/Jaap/Frits: De Sterren holding → Planeten → Jupiter BV. De vaste persona-keys zijn `payroll-lisa`, `payroll-jaap` en `payroll-frits`; wissel rechtstreeks vanuit de lokale Test HR Admin-sessie. Gebruik geen tussenstap via Edwin.
- Test HR Admin heeft één actieve `TENANT`-toekenning met rol `TENANT_ADMIN` binnen De Sterren holding. Deze bestaande grant is rechtstreeks in Core TEST gewijzigd, niet via een Git-migratie. De bestaande tenantgebonden permissiematrix blijft gelden; er zijn geen platformrechten. Read-only Core TEST-readback toonde drie actieve HR-groepen, vijf administraties, nul actieve grants naar andere tenants en twee inactieve oude Mars-/Jupiter-administratiegrants. De browserkiezer en serverreadback bevestigden de drie HR-groepen en vijf administraties. Het vroegere Mars-only-testcontract is achterhaald; historische acceptance-rapporten blijven ongewijzigd. D0 deed geen grant- of schemamutaties.
- Persona-credentials staan in `%LOCALAPPDATA%\LiquidHR\TestRuntime\payroll-test-personas.env`; ACL is beperkt tot de huidige Windows-gebruiker. De repo en deze docs bevatten geen waarden. Lisa's bestaande accountwachtwoord is in deze run lokaal ververst; Jaap en Frits hebben nog geen Auth-identiteit of employee-link, dus hun voorbereide credentialregels zijn nog niet bruikbaar.
- Start alleen via `scripts/start-test-worktree.ps1` op loopback. Test Auth en role-switch zijn gesloten op Vercel Preview/Production. Voor PR #31 is geen Preview-deployment gevonden; de Production-login toonde de normale uitnodigingslogin zonder Test Auth of role-switch.
- Terugkeer naar Test HR Admin gebruikt de bestaande lokale Test Auth-flow. Een ontbrekende Auth-user wordt door de role-switch geweigerd; de route maakt die niet aan.

## Persona's

| Persona | TEST-login | Bestaande medewerker / dienstverband | Scope | Run en lifecycle | Status |
|---|---|---|---|---|---|
| Lisa | `lisa.test@liquidhr.test` | `64ad3a23-f59a-4ed0-af41-26dda20ff067` / `b7391845-77d4-407c-bfe6-555a8a3d463b` | De Sterren holding / Planeten / Jupiter BV | `57ac6c10-7a02-49c4-a588-2ca244e621d9` — 2026-10 FINALIZED | Bestaande Auth-link en Core-employment zijn bevestigd. Directe Test HR Admin-handoff en zichtbare FINALIZED-weergave niet herbevestigd; eigen salary-API gaf HTTP 200. Cross-employee salarisprobe gaf HTTP 200 met niet-lege of onbekende data; pre-bestaande DIRECT_MANAGER-toegang in Planeten/andere groepen maakt de denialcontrole OPEN. Geen PDF-control zichtbaar. |
| Jaap | `jaap.test@liquidhr.test` | `dd9bde02-76bb-4f7c-8add-db544a148f3f` / `29058c73-5cfa-409d-b9d4-80dd30f36962` | De Sterren holding / Planeten / Jupiter BV | `e20e0345-90ac-489b-9fee-7610b2d8f6a3` — 2026-10 SUCCEEDED / CONCEPT | Core-medewerker, actieve ESS-markering en Jupiter-employment bestaan. Auth-link ontbreekt en de vaste role-switch geeft HTTP 503. Concept mag niet als definitieve loonstrook verschijnen of worden gefinaliseerd. |
| Frits | `frits.test@liquidhr.test` | `79091d14-ef66-41fe-a2d5-92df108727e5` / `d19bace9-bb97-4822-a462-eed22821ed05` | De Sterren holding / Planeten / Jupiter BV | `338ef391-fbf6-435a-a4d7-e28a8024ebc2` — 2026-10 FINALIZED; andere runs in JSON | Core-medewerker, actieve ESS-markering en Jupiter-employment bestaan. Auth-link ontbreekt en de vaste role-switch geeft HTTP 503. Drie historische traces sluiten qua bron-employee/employment-ID en source/input/result-hashes aan op Frits; elk trace-label is `Jan` en blijft OPEN. PFZW blijft SOURCE_GAP; netto blijft niet-definitief. |

Lisa heeft een bestaande `DIRECT_MANAGER`-toewijzing voor Planeten en andere groepen. Deze taak heeft die rechten niet gegeven of gewijzigd. De generieke Test Manager blijft de aparte MSS-persona.

## PAYDOC-D0 — bestaande Mars-loonstrook

- Afzonderlijke bestaande lokale role-switch-key: `payroll-demo-002`; deze case wordt niet toegevoegd aan de vaste Lisa/Jaap/Frits-set die de canonieke preflight afdwingt.
- In De Sterren holding → Mars BV is de bestaande run van `2026-10` `FINALIZED` met een reeds opgeslagen immutable `PAYSLIP_PDF` van 513.406 bytes. HR Admin-view/download en Employee-self-view/download leverden dezelfde PDF-bytes en SHA-256 `51b8c513b4c6f9b0c5a9e74e36086099d493ec08b9228b997779ae6cee56d977`.
- Desktopbrowser: HR Admin en Employee PASS. HR Admin-viewer op 390 px PASS; de Employee-viewer op 390 px bleef onbewezen omdat de browserautomatisering timeoutte. De opgeslagen artifact is alleen gelezen; run, bedragen, lifecycle en PDF zijn niet gewijzigd.
- Gerichte regressies bewijzen 401/403 voordat HR Admin-artifactbytes worden gelezen, Manager-/Employee-rolafwijzing voor Payroll Admin-toegang, forged-tenant-scopeafwijzing en self-scopeweigering vóór cross-employee artifactread. Geen Manager-live-switch of live foreign-tenant impersonatie uitgevoerd.
- Volledig D0-bewijs en resterende gates: [PAYDOC-D0 lokaal](runs/PAYDOC-D0-20261021-LOCAL.md).

## Gebruik en toegangsgrenzen

1. Voer `scripts/check-test-personas.ps1` uit. Deze preflight controleert projectrefs, credential-ACL, aanwezigheid van de zes waarden zonder ze te tonen, vaste keys, runtime en browsergedrag. `-SkipBrowser` controleert alleen de statische/runtime-preflight en kan geen persona `READY` verklaren.
2. Start met de beveiligde lokale TEST-launcher. Log in als Test HR Admin en wissel rechtstreeks via `payroll-lisa`, `payroll-jaap` of `payroll-frits`; gebruik geen Edwin-tussenpersona.
3. Bevestig na iedere handoff tenant, HR-groep, administratie, eigen ESS-route, lifecycle, documenten en negatieve cross-employee-scope. Gebruik uitsluitend de rechten van de ingelogde identiteit.
4. Keer via de bestaande Test Auth-flow terug naar Test HR Admin.

De browsercheck gebruikt een aparte sessie per directe persona-login en rapporteert alleen status, HTTP-status en foutreden. Response-bodies, wachtwoorden, cookies en tokens worden niet gelogd of vastgelegd. Een HTTP 200 met onbekende of niet-lege cross-employee-data faalt gesloten.

## Huidige afsluitvoorwaarden

- Jaap/Frits hebben nog geen bruikbare bestaande Auth-link; de eerdere 403-linkobservatie kwam uit het Mars-only-contract en bewijst de huidige tenantbrede context niet. D0 heeft die linkroute niet opnieuw getest. Er is geen employee-link RPC of bestaande ondersteunde link uitgevoerd en er is geen tijdelijke allowlist-uitbreiding naar Edwin toegepast. Hervat alleen met een bestaand geautoriseerd auditbaar pad; maak geen Auth-user of rol/grant.
- Hervat koppeling pas via een expliciet geautoriseerd bestaand Auth Admin + auditbaar Core-pad met de juiste Jupiter-beheerscope. Maak geen orphan Auth-users en geef geen Mars-Admin of Lisa extra rechten.
- Onderzoek Lisa's verwachte persona-/managergrens en herhaal de negatieve salary-/dossierprobe zonder response-body vast te leggen. Bewijs daarna Lisa's directe handoff, 2026-10 FINALIZED UI en beschikbare PDF-flow.
- Behoud Frits' historische runs ongewijzigd; los de trace-label-mismatch op via provenance/productbesluit voordat een definitieve payrollclaim wordt gedaan.
