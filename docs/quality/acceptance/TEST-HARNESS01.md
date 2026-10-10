# TEST-HARNESS01 — lokale browser- en API-acceptatie

## Standaarduitvoering

Gebruik één werkboom, één relevante functionele route en uitsluitend bestaande lokale TEST-identiteiten. Voer eerst de preflight uit:

    .\scripts\test-local-acceptance.ps1 -WorktreePath (Get-Location).Path -PreflightOnly

Voer daarna de volledige persona- en viewportmatrix uit met de bestaande centrale TEST-context:

    .\scripts\test-local-acceptance.ps1 -WorktreePath (Get-Location).Path -Route '/<beveiligde-route>' -EmployeeRoute '/<toegankelijke-medewerkerroute>' -Personas @('hr-admin', 'manager', 'employee') -TenantId '<bestaande-TEST-tenant-UUID>' -HrGroupId '<bestaande-HR-groep-UUID>' -AdministrationId '<bestaande-administratie-UUID>' -Viewports @('desktop', 'mobile') -AllowProbe @('hr-admin=GET:/api/<toegestane-HR-read>@200', 'manager=GET:/api/<toegestane-manager-read>@200', 'employee=GET:/api/<toegestane-eigen-gegevens-read>@200') -DenyProbe @('hr-admin=POST:/api/auth/test-login@403', 'manager=GET:/api/<verboden-HR-admin-route>@403,404', 'employee=GET:/api/<verboden-managementroute>@403,404')

Vervang routes, context en probes door bestaande TEST-fixtures en autorisatiecontracten van het gewijzigde domein. Neem per persona ten minste één toegestane en één geweigerde directe API-probe op. Probes gebruiken browsercookies van die persona; response bodies worden niet opgeslagen of getoond. Gebruik waar mogelijk GET. Richt een schrijfmethode alleen op een bestaande synthetische fixture en de bedoelde autorisatiegrens.

## Persona-, route- en contextregels

- HR Admin en Manager gebruiken standaard de opgegeven route; de startpagina is /dashboard/start.
- Medewerker gebruikt standaard /personal-settings. Kies een bestaande toegankelijke route. Een weigering op een route waarvoor de medewerker geen recht heeft is autorisatiebewijs; voeg geen permission toe om de harness groen te krijgen.
- Iedere persona en viewport draait in een nieuwe Playwright-browsercontext. Manager en Medewerker worden via de bestaande server-geautoriseerde rolwisselaar getest en keren daarna terug naar HR Admin. Browseropslag wordt niet tussen cellen gedeeld.
- Tenant en HR-groep worden voor iedere persona met de servercontext vergeleken. HR Admin en Manager controleren ook exact de opgegeven administratie. De medewerkeradministratie blijft server-afgeleid: een actieve administratie moet in de door de server teruggegeven toegankelijke set staan; `null` is alleen geldig als die set leeg is. Forceer geen administratiekeuze.
- Een Test Auth- of rolwissel wist de tenant-, HR-groep- en administratiecookies van de vorige identiteit. Na een servermelding dat context ontbreekt, mag de runner alleen de bestaande goedgekeurde tenant en HR-groep kiezen; de actieve administratie blijft server-afgeleid. Controleer bij terugkeer naar HR Admin de administratie en rol opnieuw.
- Desktop is 1440 × 900; mobiel exact 393 × 852 (iPhone 16-profiel).

## Runtime en privacy

- scripts/start-test-worktree.ps1 -TestRunner voert preflight uit, laadt alleen de centrale lokale TEST-runtimeconfiguratie via Node process.loadEnvFile en bindt Next aan loopback. Node 20.12 of hoger is vereist. Een niet-lege NODE_OPTIONS in de centrale TEST-config wordt geweigerd.
- De eerste vrije poort vanaf 3000 wordt gekozen. Een server wordt alleen hergebruikt als worktree, HEAD, config-identiteit, PID/starttijd en /login-readiness overeenkomen. Bij onzeker eigenaarschap start geen tweede server en stopt de launcher geen bestaand proces.
- De wrapper sluit uitsluitend de runtime die hij zelf startte. Een hergebruikte server krijgt cleanupstatus NOT_OWNED en blijft draaien. De expliciete stopactie vereist PID/poort uit de eigen runtime-envelope.
- De runner schrijft geen screenshots of Playwright storage state. Resultaten beperken zich tot persona, route, context, methode/pad/status en bekende foutcodes. Toon of leg geen wachtwoorden, configwaarden, e-mailadressen, volledige headers, formulieren, response bodies, magic links, sessietokens of cookies vast.
- Test Auth werkt alleen met NODE_ENV development, de expliciete lokale flag, het canonieke synthetische TEST-Supabase-project en zonder Vercel-context. Production, Preview en lokale Vercel-runtime blijven fail-closed; alleen de flag schakelt Test Auth daar niet in.
- Control blijft een aparte applicatie met normale OAuth en OWNER/OPERATOR/AUDITOR-autorisatie. Deze HR Suite-runner voegt geen Control-testlogin, platformrol of OAuth-bypass toe.

## Resultaat en vervolg

Een persona is GREEN als browserroute, server-afgeleide persona, context, toegestane/geweigerde probes en eventuele toegestane terugschakeling slagen. De volledige run is GREEN als alle persona-/viewportcellen en afgesproken quality gates bewezen zijn. Ontbrekende context wordt BLOCKED BY CONTEXT; ontbrekende externe/runtimevoorwaarde ENVIRONMENT-GATED; ontbrekende bewijsdekking PARTIAL.

## Definitieve instructie voor toekomstige Codex-runs

> Voer Payroll- en API/AI-acceptatie lokaal uit vanuit de eigen werkboom met deze harness, bestaande centrale TEST-identiteiten, een domeinrelevante route, desktop en iPhone 16 393 × 852, plus per persona een toegestane en geweigerde serverprobe. Gebruik uitsluitend de bestaande Test Auth- en rolwisselflow; verzin geen accounts, contexten, permissies of bypasses en toon geen geheimen. CONTROL02 blijft op zijn eigen normale OAuth- en OWNER/OPERATOR/AUDITOR-acceptatiepad; gebruik deze HR Suite-harness daar alleen voor gedeelde lokale runtime-/browserbewijzen en voeg geen Control-testlogin of platformrol toe. Rapporteer ontbrekend bewijs als PARTIAL, BLOCKED BY CONTEXT of ENVIRONMENT-GATED volgens docs/quality/acceptance/REPORTING-STANDARD.md.

## Huidige runstatus

De originfout is hersteld en de lokale browsermatrix is 6/6 groen. Bewijs, quality gates en hervatinstructies staan in het [TEST-HARNESS01-runrapport](runs/TEST-HARNESS01-20261004.md). Geen push, merge, deployment of remote databasewijziging hoort bij deze acceptatie.
