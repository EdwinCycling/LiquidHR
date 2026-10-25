# PMUX-P9-RUNTIME-FIX-06 — 25 oktober 2026

**Oordeel: BLOCKED voor volledige P9-acceptatie; de geautoriseerde normalisatiemigratie is PASS.**

## Toegepaste wijziging

- Core TEST: `wnpfloqpjvaacobppbpk`.
- Migratiebron: `20261025090000_pmux_p9_deadline_definition_normalization.sql`.
- Supabase-migratieregistratie: `20261025061834`, naam `20261025090000_pmux_p9_deadline_definition_normalization`.
- Uitsluitend `internal_security.materialize_process_step_deadline()` gewijzigd.
- Exacte vervanging: `select version.definition_json into definition_content` wordt `select internal_security.process_definition_content(version.definition_json) into definition_content`.
- Geen DML, backfill, nieuwe functies, triggerwijzigingen, grants, rolrechten of RLS-wijzigingen. Bestaande deadlines worden niet herberekend.
- Impactcontrole: 99 bestaande versies hebben de content-wrapper; legacy top-level stappen blijven via dezelfde bestaande normalisatiefunctie ondersteund.

## Tests en readback

Gerichte PGlite/Vitest-regressies: **2 bestanden, 11 tests PASS**, inclusief de bestaande PMUX-06A-contracttests.

De nieuwe tests reproduceren eerst STEP_NOT_FOUND bij een wrapper, bewijzen daarna correcte normalisatie, legacy compatibiliteit, minuten/uren, kalenderdagen over DST, geen SLA, inactieve stappen, scopeweigering en de ongewijzigde werkdagkalenderweigering. Herhaalde toepassing is getest.

Live readback is exact gelijk aan de oorspronkelijke functiedefinitie met alleen de bedoelde vervanging. Function OID 50099, owner postgres, ACL `{postgres=X/postgres}`, SECURITY DEFINER en lege search_path zijn gelijk gebleven.

- Voor-hash functie: `d12e8c4fa992d9efd45bd5b2182a08d4`.
- Verwachte en actuele na-hash: `948d056767f667f0e489cd725be6312c`.
- Alle overige public/internal_security-functies: hash gelijk `66e906806b8eb54b6290de51cc5b7a8e`.
- Alle niet-interne triggers: hash gelijk `24c855c186eb4e2377bcff5925c73045`.
- Geen database-typesignatuur gewijzigd; de interne triggerfunctie is niet onderdeel van packages/db/types.ts.
- Security-advisorcategorieën en aantallen zijn voor/na identiek. Bestaande meldingen zijn opgenomen met remediation-links in het readbackbestand.
- Runner syntaxcheck en git diff-check PASS.

## Echte browseracceptatie

De bestaande Windows-hostrunner en server `http://127.0.0.1:3010` zijn gebruikt. Eerder bewezen Manager- en groepsacceptatie zijn overgeslagen.

De reguliere HR Admin-login gaf 303 en de werkelijke sessie werd als hr_admin herkend. De startguard vereiste De Sterren holding / Planeten / Jupiter BV, exact DEMO-028 (`9048f02b-4fdc-3c4c-e1aa-fd339660029c`) en ingangsdatum `2026-10-24`. De UI-selectie en doorgestuurde payload voldeden daaraan.

Een eerste read-call timeout stopte vóór een submission. Een volgende start-response timeout is read-only verzoend: geen case, geen keyed procesevent en geen actieve startquery. De laatste gerichte poging gebruikte dezelfde vaste product-API-idempotentiesleutel:

`PMUX-P9:9048f02b-4fdc-3c4c-e1aa-fd339660029c:2026-10-24`.

Dit voorkomt een tweede case bij herhaalde uitvoering. Voor de start is eveneens gecontroleerd op bestaande cases voor deze medewerker/datum, met definitiekey `internal-transfer%` zodat ook de actuele v2-definitie wordt meegenomen.

Het definitieve antwoord van POST /api/processes/start is **HTTP 409, SLA_WORKDAY_CALENDAR_REQUIRED**. De bestaande actuele P9-definitie internal-transfer-v2 versie 41 heeft startstap request met een SLA van twee werkdagen. De normalisatiefout is verholpen; de ongewijzigde kalenderregel weigert nu terecht het ontbreken van een proceskalender.

| Controle | Resultaat |
| --- | --- |
| HR Admin normale login en P9-startrequest | PASS voor authenticatie/payload; start BLOCKED met 409 |
| Opgeslagen P9-case / case-ID | 0 cases; geen case-ID |
| Bijbehorende proces-auditgebeurtenissen | 0 events voor de vaste idempotentiesleutel |
| HR Admin directe procesinstance-GET | NOT TESTED: geen aangemaakte instance |
| Niet-gerelateerde Employee directe procesinstance-GET | NOT TESTED: geen aangemaakte instance |
| Werkelijke Employee-case-relatie | Niet vaststelbaar zonder case; geen negatieve scope-PASS geclaimd |

Na het definitieve antwoord bevestigt database-readback: keyed_instances=0, matching_instances=0, keyed_events=0, active_start_queries=0. De mislukte start heeft geen persistente case- of proceseventwrite opgeleverd.

De werkdagkalenderblokkade vereist een aanvullende wijziging buiten deze opdracht. Er is gestopt zonder de SLA of andere functies aan te passen.

## Bestanden en behoud

- Git HEAD: `630df89c84bc2be4774072d387ecb5dc7df10f91`.
- Migratiebron, regressietest en runnerwijzigingen staan lokaal. Geen commit: bestaande .git/index.lock is behouden; geen Git-cleanup uitgevoerd.
- Focus-widget SHA256 onveranderd: `A8134B54351065DB6EFF5CBED717511A979AB85118810DA2941195DF8BAEEAEA`.
- Bestaande andere patches en secrets zijn behouden. Geen nieuwe accounts of deployment.
- Browserbewijzen: .browser.json (read-timeout), .browser-retry.json (response-timeout), .browser-final.json (definitieve 409). Lees .readback.json voor de databasevergelijking.
