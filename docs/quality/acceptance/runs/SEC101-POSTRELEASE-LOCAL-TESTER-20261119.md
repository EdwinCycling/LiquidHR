# SEC-101 post-release lokale regressietestvoorziening — 19-11-2026

## Doel en scope

De lokale runner gebruikt de officiële Supabase SDK via `@supabase/ssr` voor normale `signInWithPassword`-authenticatie op HR/Core TEST (`wnpfloqpjvaacobppbpk`). De SDK beheert de sessiecookies in een in-memory cookie-opslag die ook voor de Vercel-routes wordt gebruikt. De runner maakt geen testaccounts, records of schemawijzigingen aan.

De verborgen PowerShell-prompts sturen de wachtwoorden via standaardinvoer naar het Node-proces. Ze komen niet in commandline-argumenten, environmentvariables, bestanden of output terecht. Supabase-sessies worden niet persistent opgeslagen en worden in een `finally`-blok afgemeld. De runner toont alleen persona-labels, statuscodes, rijtellingen, scenario-statussen en testnamen; geen e-mailadressen, record-ID's, fiscale inhoud, bedragen, JWT's, hashes of sleutels.

## Uitvoeren

Start vanuit de repository-root in een interactieve PowerShell:

```powershell
pwsh -NoProfile -File .\scripts\run-sec101-postrelease-acceptance.ps1
```

Gebruik de bestaande Jaap-TEST-identiteit voor Employee-only, `manager.fixture@liquidhr.test` voor Manager en `hradmin.fixture@liquidhr.test` voor Tenant Admin, of voer de bestaande gelijkwaardige TEST-identiteiten in. De wachtwoorden worden afzonderlijk verborgen gevraagd. De runner controleert de effectieve rolcodes vóór de API-proeven en stopt als de persona niet ondubbelzinnig bij het opgegeven roltype past.

De runner laadt de bestaande app-runtimeconfiguratie in procesgeheugen en weigert elke Supabase-URL behalve de goedgekeurde HR/Core TEST-projectref. Hij gebruikt alleen de publiceerbare API-sleutel; geen service-role, sleutelbeheer-API of browser-tokenextractie.

## Uitgevoerde lokale controles

| Controle | Status | Resultaat |
|---|---|---|
| Persona-afbakening Employee-only / Manager / Tenant Admin | PASS | Afgedekt in 5/5 Vitest-tests |
| Denial-classificatie kolom- en out-of-scope HTTP-fouten | PASS | Alleen SQLSTATE `42501` telt als kolomweigering; alleen HTTP 403/404 telt als out-of-scope routeweigering |
| Node.js-syntaxis runner | PASS | `node --check` |
| PowerShell-launcher parse | PASS | PowerShell AST-parser |
| Live Supabase Data API matrix | NOT RUN | Wachtwoorden zijn niet in de lokale prompts ingevoerd |
| HR Admin Payroll 3/3 na CONTRACT | NOT RUN | Wordt door dezelfde runner uitgevoerd na invoer |

De live matrix controleert bestaande fiscale profielen en auditrijen met expliciete `employee_id`-filters: Employee-self en Employee-other; Manager-self, directe teamleden, peers en een andere administratie; Tenant Admin binnen de actieve tenant en in een andere administratie binnen dezelfde tenant. Voor elke rol worden ook de beschermde profielkolommen `source_reference`, `idempotency_key`, `confirmed_by_user_id` en auditkolommen `actor_user_id`, `request_key` rechtstreeks via de Data API op weigering getest. De runner markeert een categorie NOT TESTED als de Tenant Admin geen bestaande profiel- of auditrustargets kan bevestigen.

Een passende andere-tenantfixture is niet beschikbaar gesteld; die proef blijft expliciet NOT TESTED. De drie HR Admin-scenario's (+2 betaalde uren, +5%, 32 contracturen) lopen via de bestaande Vercel-route en tellen alleen als PASS bij HTTP-succes, `CALCULATED` en `READY`. Bedragen en provenance-hashes worden niet weergegeven.

## Rollbackcontrole

De rollbackprocedure is read-only beoordeeld aan de hand van de uitgevoerde CONTRACT-migratie en de bestaande cutoveracceptatie; er is geen rollback uitgevoerd. De bestaande READY-deployment blijft actief en beschikbaar als referentie. Na CONTRACT is terugzetten naar code die brede kolomprojecties verwacht niet veilig; een database-downgrade die brede SELECT-grants herstelt zou de technische metadata opnieuw blootstellen. Herstel daarom alleen naar een deployment die expliciet CONTRACT-compatibel is; anders is de veilige herstelroute een fix-forward. Geen migratie, deployment of domeinwijziging is onderdeel van deze lokale voorziening.

## Status

De voorziening is lokaal gereed, maar de live beveiligingsacceptatie is nog niet uitgevoerd. Security #101 blijft OPEN totdat de verborgen lokale loginprompts zijn gebruikt en de gerapporteerde statuscodes en rijtellingen zijn beoordeeld. Manager-MSS en BONUS blijven PARKED.
