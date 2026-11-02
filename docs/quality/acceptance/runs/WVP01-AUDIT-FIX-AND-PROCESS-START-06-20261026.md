# WVP01 audit-fix and process-start acceptance 06

- Datum: 2026-10-26
- Core TEST-project: `wnpfloqpjvaacobppbpk` (LiquidHR, `ACTIVE_HEALTHY`)
- Branch: `work/wvp01-safe-integr-02-20261026`
- Basiscode: `d72e236f8f420eea5f6c1157d1dccde47a75be43`
- Correctiecommit: `2abde76373d5bbe6ea9c1be1765ce322d36f97c0`
- Status: **BLOCKED** — lokale correctie groen; Core TEST-migratie en processtart niet uitgevoerd.

## Lokale auditcorrectie

Nieuwe migratie: `20261026172808_wvp01_guidance_audit_case_id`.

- SHA-256: `115d9b483e7764a20fd7b025c550127a650330681eeb94ec92d3e164d8b3c99d`
- Objecten: `internal_security.audit_wvp_guidance_change()` en vervanging van triggers `audit_absence_guidance` en `audit_absence_guidance_events`.
- De `absence_guidance`-audit gebruikt `case_id` als entiteitsidentiteit; audit voor gebeurtenisrijen behoudt de gebeurtenis-`id` en haalt tenant/administratie via de gekoppelde casus op. Actor, administratie, actie en voor/na-historie worden naar `audit_logs` geschreven.
- De helper beperkt auditpayloads tot expliciete WVP-kolommen en bevat geen medische velden. De generieke `internal_security.audit_hr_change()`, bestaande tabellen, RLS/policies en grants worden niet gewijzigd. Directe uitvoering van de nieuwe helper wordt ingetrokken.
- Herstelontwerp: transactierollback vóór commit; na commit uitsluitend forward-only correctie. Deze remote herstelstrategie is niet gebruikt, omdat de migratie niet is toegepast.

## Gerichte verificatie

De PGlite-contracttest laadt de bestaande WVP-migratie en een contractdummy van de gedeelde audithelper die het foutieve `NEW.id`-contract reproduceert. Binnen een rollback-transactie is SQLSTATE `42703` bevestigd. Daarna zijn de correctiemigratie, `INSERT`/`UPDATE`-audit, case- en eventidentiteit, actor, administratie, privacy-allowlist en directe helperrechten gecontroleerd.

- WVP-databasecontract en drie WVP-domain/service/process-definitiontests: **39/39 PASS**.
- `git diff --check`: **PASS**.
- Een eerste Vitest-run faalde vóór testcollectie door Windows `EPERM` op de sandbox-tempmap. De gerichte herhaling met checkout-lokale `TEMP`/`TMP` slaagde.
- De bredere algemene suite is niet herhaald.

## Core TEST-readback en writeblokkade

De gecombineerde migratie- en processtarttoestemming is expliciet ontvangen. Direct vóór de write bevestigde read-only preflight:

- `20261026055349_wvp01_absence_guidance` is eenmaal geregistreerd; nieuwe migratie `20261026172808` ontbreekt.
- Casus `356e0c99-5d67-4e7a-a0da-3b7219ef617f` is `ACTIVE` voor de bevestigde medewerker, tewerkstelling en Jupiter BV; eerste verzuimdag `2026-10-26`, één open periode.
- Er is precies één equivalente actieve casus, nul `absence_guidance`-rijen, nul WVP-procesinstanties en nul WVP-mijlpalen.
- De bestaande procesdefinitie `02bfc76b-e55c-4802-b74d-da04f2168e24` is `PUBLISHED` en is niet gewijzigd.
- De huidige Core TEST-triggerdefinities wijzen nog naar `internal_security.audit_hr_change()`; WVP-tabellen hebben RLS aan en geven authenticated geen directe INSERT/UPDATE/DELETE.

De Supabase `apply_migration`-tool is tweemaal aangeroepen met de goedgekeurde migratie en gaf beide keren `McpServerError: Invalid or expired requestState`. Read-only teruglezing na iedere poging bevestigde: migratieversie niet geregistreerd, nieuwe helper niet aanwezig, beide oude triggerbindings ongewijzigd, casus nog zonder WVP-link of procesinstantie. De officiële Supabase CLI-help bevestigde dat `migration up` alleen lokaal of op een gelinkt project draait; `migration list --linked` stopte met `ProjectRefNotLinkedError`. Er is geen projectlink gemaakt, geen directe SQL-DDL uitgevoerd en geen brede `db push` geprobeerd.

## Acceptatiestatus

- Lokale correctie en gericht regressiebewijs: **PASS**.
- Core TEST-correctiemigratie: **BLOCKED** door de verlopen/ongeldige Supabase request-state.
- Processtart: **niet geprobeerd** omdat de noodzakelijke correctiemigratie niet was bevestigd. De casus heeft geen WVP-proces-ID; er zijn geen nieuwe WVP-mijlpalen, taken of auditgebeurtenissen aangemaakt.
- Deadline-, reminder-, herhalings/idempotentie-, postcorrectie-rol- en responsive acceptatie: **OPEN**.
- Er zijn geen mijlpalen afgerond, werkafspraken of kennisnames vastgelegd, herstelmelding of afsluiting uitgevoerd, of notificaties verzonden.
- Geen nieuwe casus, migratieherhaling, GitHub-push, Vercel-deployment of wijziging aan de beschermde hoofdwerkboom.
