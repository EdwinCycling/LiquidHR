# PMUX security fixture acceptance 05 — vervolg

**Datum:** 27 oktober 2026
**Status:** **PARTIAL** — bestaande rolproeven en de Manager-runtime zijn aantoonbaar; de stale-kandidaatfixture ontbreekt en WVP is door de gepubliceerde permissieconfiguratie geblokkeerd.
**Core TEST:** `wnpfloqpjvaacobppbpk`
**Lokale branch:** `work/pmux-security-authorization-hardening-01-20261026`, vóór dit evidencecommit `84997c2278d6dd39ae8371340d6b114072d37ac6`
**PR:** [#52](https://github.com/EdwinCycling/LiquidHR/pull/52), opnieuw read-only gecontroleerd: open, Draft, niet gemerged; remote head `25a5042986bb758f292dad6e74ef8a12ddb2fca7`.

## Uitgevoerde controles

De officiële lokale TEST-launcher gebruikte de bestaande configuratie en synthetische identiteit; de runtime was beschikbaar op `http://127.0.0.1:3012`. Een bestaande browser was ingelogd als Manager Yara (`71e35860-95c9-4ba3-ac9a-6b366096d8ec`, medewerker `9048f02b-4fdc-3c4c-e1aa-fd339660029c`). Geen credentials zijn gelezen of getoond.

De geauthenticeerde `GET /api/process-work?view=WORK` gaf drie werkitems terug, alle voor directe teammedewerker Noah (`c6b1c7a9-c250-3d19-b1a0-87e317e80b13`, dienstverband `eb1eea55-62c4-4b85-a3e9-20dca923e7d4`):

| Werkitem | Proces | Waargenomen status |
| --- | --- | --- |
| `137155e4-fba5-4eac-8550-a8e95cc0ba31` | R5-TEST interne overplaatsing | OPEN; de detailpagina liet geen uitvoerbare actie zien en de Opslaan-knop was uitgeschakeld. |
| `52520a62-aac9-47fc-8d6d-dc4c648f7dfc` | Document lezen en bevestigen | OPEN, toegewezen aan de Employee-stap. |
| `d89e77ca-6eb7-4389-a0ab-a6e62bfed2db` | R5-TEST interne overplaatsing | OPEN. |

Dit toont een actuele Manager-read binnen teamscope. Er is geen actie op deze items uitgevoerd. De bestaande eerdere acceptatie blijft aanvullend bewijs: Yara claimde via de normale route Leave-taak `5204a656-3eb6-4004-9095-2b8c363fe2d7` (`OPEN` v1 → `CLAIMED` v2, één audit-event); Employee Noah las zijn eigen proces en kreeg `403` voor een vreemd proces; Manager Lisa kreeg `403` buiten Noahs teamscope. Die historie staat onveranderd in [de oorspronkelijke acceptance](PMUX-SECURITY-FIXTURE-ACCEPTANCE-05-20261027.md).

## Fixtures en beveiligingsproeven

Geen persona, medewerker, dienstverband, administratie, procesinstantie, kandidaat of procesdefinitie is aangemaakt of gewijzigd. Er is geen remote write uitgevoerd. Read-only Core TEST-teruglezing bevestigde dezelfde aantallen als de eerdere acceptatie: 14 procesinstanties, 26 werkitems, 26 kandidaatrijen, 80 events en **0** kandidaten met `is_eligible=false`.

Alle bestaande processubjecten met instantie- of werkitemrijen vallen binnen Yara's actuele directe team; er is geen passend bestaand proces voor een Manager-buiten-teamprobe in deze sessie. Eerdere cross-team-negatives met Lisa en cross-employee-negatives met Noah blijven geldig bewijs. Een stale-kandidaatproef is nog niet uitgevoerd: er is geen oude onbevoegde kandidaatrij. Die rij kan niet veilig uit bestaande gegevens worden gemaakt zonder een onderliggende team-/dienstverbandsscope te wijzigen; er was bovendien geen HR Admin-sessie beschikbaar om een geïsoleerde synthetische fixture via de reguliere beheerflow te maken. Geen scope is gewijzigd en geen recht is verruimd.

De eerdere Leave-, P9- en P10-negatieve proeven hadden geen neveneffect. P10-acknowledgement gaf `400` in plaats van de verwachte `403`; status, versie en toewijzing bleven ongewijzigd. Deze statusmapping blijft open.

## WVP01

Read-only Core TEST-controle bevestigde migraties `20261026055349_wvp01_absence_guidance` (geregistreerd `20261026131216`), `20261026172808_wvp01_guidance_audit_case_id` (geregistreerd `20261026175140`) en `20261026190604_pmux_security_authorization_hardening` (geregistreerd `20261027170458`). Geen migratie is uitgevoerd.

De gepubliceerde definitie `02bfc76b-e55c-4802-b74d-da04f2168e24`, versie 1 `568f9ca3-cd6a-498c-8b36-42d14d998b8b`, staat op `PUBLISHED` en behoudt queue `wvp01` en administratie Jupiter (`8483abc9-f275-c80b-5a23-fedc54ce9f0a`). De `case-owner.permission` én `selector.permission` zijn echter nog steeds `process-definition:publish`. Dat is geen veilige taakuitvoeringspermissie. Voor bestaande casus `356e0c99-5d67-4e7a-a0da-3b7219ef617f` bestaat geen rij in `public.absence_guidance` en dus geen WVP-koppeling. **WVP-processtart is BLOCKED**; er is geen proces gestart en geen mijlpaal, werkitem of event aangemaakt.

## Eindmatrix en advies

| Scenario | Resultaat | Bewijsstatus |
| --- | --- | --- |
| HR Admin binnen Jupiter-administratie | PASS | Bestaande HTTP/API-proef in het oorspronkelijke rapport. |
| Manager eigen teamscope: read en toegestane actie | PASS | Bestaande Yara-claim; deze run bevestigde live team-read en taakdetail. |
| Manager buiten teamscope | PASS | Bestaande Lisa-proef gaf `403`; geen aanvullende Yara-fixture gevonden. |
| Employee eigen proces versus andere medewerker | PASS | Bestaande Noah-proeven: eigen read toegestaan, vreemd proces geweigerd. |
| Verouderde kandidaat: claim en uitvoering geweigerd | OPEN | 0 historische ineligible kandidaten; geen veilige stale fixture beschikbaar. |
| Leave/P9/P10 ongeautoriseerde mutaties zonder neveneffect | PARTIAL | Negatieve proeven zonder statuswijziging; P10-acknowledgement retourneerde `400` in plaats van `403`. |
| WVP-processtart en taakautorisatie | BLOCKED | Gepubliceerde permissies zijn ongeschikt; casus heeft geen guidance-link. |

**Advies merge PR #52: HOLD. TEST-release: HOLD.** PR #52 blijft Draft en ongewijzigd. Geen push, merge, migratie, deployment, processtart, notificatie of businessdatamutatie is uitgevoerd. De securityfix heeft bestaande negatieve autorisatie-evidence, maar deze run sluit stale-candidate-, P10-statusmapping- of WVP-gaten niet.

**Blokkade voor vervolg:** gebruik de normale lokale persona-ownerflow om een bestaande Test HR Admin-sessie te openen; deel geen wachtwoorden of secrets. Daarna kunnen uitsluitend ontbrekende synthetische fixtures via bestaande beheer-/procesroutes worden gemaakt. Een oude kandidaatproef moet geïsoleerd blijven en mag bestaande teamscope niet wijzigen. WVP blijft dicht totdat de definitie via een afzonderlijk geautoriseerde normale publicatie een taakpermissie gebruikt die door de server-side PMUX-autorisatie wordt afgedwongen.
