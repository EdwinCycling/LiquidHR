# PMUX-SECURITY-FIXTURE-ACCEPTANCE-05 — native closeout

**Datum:** 27 oktober 2026
**Core TEST:** `wnpfloqpjvaacobppbpk`
**Uitkomst:** **PARTIAL**
**Lokale branch / HEAD vóór dit rapport:** `work/pmux-security-authorization-hardening-01-20261026` / `077c3b392affda4989cdf5e4c35bdb85edb1dbd7`
**PR:** [#52](https://github.com/EdwinCycling/LiquidHR/pull/52), open, Draft, niet gemerged; remote head `25a5042986bb758f292dad6e74ef8a12ddb2fca7`.

Deze run bouwt voort op de [oorspronkelijke acceptatie](PMUX-SECURITY-FIXTURE-ACCEPTANCE-05-20261027.md) en het [vervolgbewijs](PMUX-SECURITY-FIXTURE-ACCEPTANCE-05-FOLLOWUP-20261027.md). De bestaande 39/39 securitycontracttests en eerder uitgevoerde rolproeven zijn niet herhaald.

## Reikwijdte en fixtures

De officiële lokale TEST-runtime is gestart op `http://127.0.0.1:3013` en daarna gestopt. Een geïsoleerde Playwright-sessie gebruikte het bestaande HR Admin-account Maya in Planeten / Jupiter BV (`8483abc9-f275-c80b-5a23-fedc54ce9f0a`). Eerdere native sessies en de bestaande API-evidence voor Manager Yara en Employee Noah zijn hergebruikt. Er zijn geen accounts, secrets, rollen, grants, migraties of nieuwe procesdefinities gemaakt.

| Actor | Subject / scope | Bestaande fixture | Resultaat |
| --- | --- | --- | --- |
| HR Admin Maya (`TENANT_ADMIN`) | Planeten / Jupiter; geldig administratiebereik | Werkbak en synthetisch profiel | Bestaande read: HTTP 200, 9 werkitems. Niet-bestaande administratiefilter: HTTP 200, 0 items. In de verse browser werd de bestaande synthetische medewerkerkaart geopend. |
| Manager Yara — user `71e35860-95c9-4ba3-ac9a-6b366096d8ec`, employee `9048f02b-4fdc-3c4c-e1aa-fd339660029c` | Direct teamlid Noah, Jupiter | Leave-instance `e651d6bd-f696-4b84-8add-505efe3fabfc`; taak `5204a656-3eb6-4004-9095-2b8c363fe2d7` | Proces- en taakread HTTP 200; toegestane claim HTTP 200, `OPEN` v1 → `CLAIMED` v2. Geen verlofbesluit uitgevoerd. |
| Manager Lisa — user `685971ca-b68d-4fea-9da8-d9c2806aa7d4`, employee `64ad3a23-f59a-4ed0-af41-26dda20ff067` | Buiten Noahs directe teamscope, Jupiter | Bestaande Leave-, P9- en P10-instanties | Read, Leave-claim/-actie, P9-claim/-transfercommit en P10-claim kregen HTTP 403. P10-documentkennisname en generieke ACK kregen HTTP 400; beide zonder neveneffect. |
| Employee Noah — user `f38fe229-494e-4294-822d-90c19188232f`, employee `c6b1c7a9-c250-3d19-b1a0-87e317e80b13` | Eigen proces versus proces van Yara | Eigen Leave-/P10-werk; proces `c20e10fd-14ca-44bb-bb4f-09d6a999b320` van een ander | Eigen procesread HTTP 200. Cross-employee proces-, werkitem- en claimproeven HTTP 403. Een extra cross-role action op Yara's geclaimde Leave-taak werd geweigerd met HTTP 400. |

## Read-only status en neveneffecten

- Core TEST bevat 14 procesinstanties, 26 werkitems, 26 kandidaatrijen en 80 procesevents; geen kandidaat heeft `is_eligible=false`. Lisa heeft geen kandidaatrij op de gebruikte workflows. Een oude kandidaat die na scopeverlies opnieuw wordt beoordeeld, is dus niet aanwezig.
- De extra Employee-action gebruikte idempotency key `pmux-sec-a05-employee-cross-role-approve-20261027`. De server gaf HTTP 400 met `PROCESS_WORK_ITEM_OPERATION_FAILED` in plaats van 403. Read-only teruglezing: taak `5204a656-3eb6-4004-9095-2b8c363fe2d7` is nog `CLAIMED`, versie 2, geclaimd door Yara; er staat één bestaand event op die taak en nul events met de proef-idempotencykey. Er is geen onbevoegde mutatie of extra audit-event ontstaan.
- Het eerder gemarkeerde synthetische profiel `94632716-7ec2-4e12-ad0d-aa043a1fc231` is actief, heeft geen dienstverband, geen werkitem en geen proces. De enige administratieplaatsing voor dit profiel is Jupiter vanaf 1 november 2026. De verse HR Admin-sessie heeft de normale dienstverbandwizard alleen geopend en niet ingediend.
- De eerdere reguliere complete-employment-aanmaak voor dit profiel faalde met `EMPLOYMENT_SCHEDULE_LABOR_CONDITION_REQUIRED` (SQLSTATE `P0001`). De databasefunctie `publish_complete_employment` maakt in de aangetroffen Core-contractversie een contract aan zonder `fulltime_hours_per_week`, waarna de schedule-normalisatie dit veld vereist. De normale wizard kan daardoor geen geldige teamfixture opleveren. De bestaande toekomststartplaatsing kan niet via een gevonden normale endpoint naar vandaag worden verplaatst. Er is daarom geen tweede profiel aangemaakt, geen direct SQL geschreven en geen bestaande team- of dienstverbandsscope aangepast.
- Geen notificatie, taakbesluit, P9-transfer, WVP-start of andere procesmutatie is uitgevoerd in deze closeout. De eerdere Yara-claim blijft de enige positieve procesmutatie.

## WVP01 preflight

Read-only migratiehistorie bevestigt dat de WVP-basismigratie (`20261026055349`, registratie `20261026131216`), WVP-auditcorrectie (`20261026172808`, registratie `20261026175140`) en PMUX-securitymigratie (`20261026190604`, registratie `20261027170458`) elk aanwezig zijn. Geen migratie is uitgevoerd.

Casus `356e0c99-5d67-4e7a-a0da-3b7219ef617f` is `ACTIVE`, voor medewerker `c6b1c7a9-c250-3d19-b1a0-87e317e80b13`, Jupiter, eerste verzuimdag `2026-10-26`. Er zijn nul `absence_guidance`-koppelingen en nul WVP-procesinstanties.

De gepubliceerde definitie `02bfc76b-e55c-4802-b74d-da04f2168e24`, versie 1 `568f9ca3-cd6a-498c-8b36-42d14d998b8b`, behoudt Jupiter en queue `wvp01`, maar `case-owner.permission` én `selector.permission` zijn `process-definition:publish`. Deze configuratie bewijst geen veilige taakuitvoeringsscope. WVP-start en WVP-proeven blijven daarom **BLOCKED**; er is niets gestart.

## Verdicts en advies

| Proef | Verdict | Bewijs / resterende grens |
| --- | --- | --- |
| HR Admin binnen administratie | PASS | Jupiter-scope, 9 werkitems; foutieve administratiefilter geeft 0 resultaten. |
| Manager binnen eigen team | PASS | Yara leest proces/taak en claimt de bestaande Leave-taak via de normale API. |
| Manager buiten team | PASS met adapterafwijking | Lisa's read/claim-/transferproeven geven 403; P10-documentactie geeft 400 zonder neveneffect. |
| Employee eigen versus andermans proces | PASS met statusmappingafwijking | Eigen read 200, vreemd proces/read/claim 403; cross-role action wordt geweigerd maar geeft 400. |
| Verouderde kandidaat na scopeverlies | OPEN | Geen historische ineligible kandidaat. Geïsoleerde fixture geblokkeerd door falende complete-employment-flow en ontbrekende normale update-route voor de future-only administratieplaatsing. |
| Leave/P9/P10 ongeautoriseerde mutaties | PARTIAL | Geen neveneffecten; P10 en de extra cross-role action rapporteren 400 in plaats van 403. |
| WVP-proces en roltoegang | BLOCKED | Gepubliceerde selector-/participant-permissie onveilig voor bewijs; casus heeft geen guidance-koppeling. |

**Algemene acceptatie: PARTIAL. Mergeadvies PR #52: HOLD. Core TEST-releaseadvies: HOLD.** PR #52 is read-only gecontroleerd als open Draft met ongewijzigde remote head. Geen push, merge of deployment. De beschermde `apps/hr-suite/next-env.d.ts` bleef ongewijzigd; SHA-256 `B8B3A344484B959AF5E4E3FC1A1609DAC3CB9ECE0CDEB6C145BE29BC4C491000`. De lokale werkboom had alleen dit bestaande beschermde bestand dirty vóór het toevoegen van dit rapport.

Bronnen: [oorspronkelijke acceptatie](PMUX-SECURITY-FIXTURE-ACCEPTANCE-05-20261027.md), [follow-up](PMUX-SECURITY-FIXTURE-ACCEPTANCE-05-FOLLOWUP-20261027.md) en PR [#52](https://github.com/EdwinCycling/LiquidHR/pull/52).

## Aanvullende read-only verificatie — 27 oktober 2026

- Een verse Core TEST-readback bevestigde opnieuw 14 procesinstanties, 26 werkitems, 26 kandidaatrijen en 0 kandidaatrijen met `is_eligible=false`. De 11 Yara-kandidaatrijen zijn voor Noah; bij alle 11 was Yara zowel op `resolution_date` als op 27 oktober de directe manager. Een controle op directe-manager-kandidaten die niet meer overeenkomen met de huidige directe manager gaf 0 rijen. Er is dus nog steeds geen veilige bestaande stale-kandidaatfixture.
- De Core TEST-migraties zijn read-only opnieuw bevestigd: WVP-basis `20261026055349` (registratie `20261026131216`), WVP-auditcorrectie `20261026172808` (`20261026175140`) en PMUX-security `20261026190604` (`20261027170458`). Op `absence_guidance` en `absence_guidance_events` staan de triggers `audit_absence_guidance` en `audit_absence_guidance_events` ingeschakeld (`O`) en gekoppeld aan `internal_security.audit_wvp_guidance_change`; `wvp_events_immutable` is eveneens ingeschakeld.
- WVP-casus `356e0c99-5d67-4e7a-a0da-3b7219ef617f` blijft `ACTIVE`, met eerste verzuimdag `2026-10-26`; de guidance-tabellen bevatten 0 rijen en voor de gepubliceerde definitie zijn 0 procesinstanties. Definitieversie 1 is `PUBLISHED`, behoudt Jupiter en queue `wvp01`, maar voor `case-owner` blijven zowel `permission` als `selector.permission` `process-definition:publish`. Volgens de opdracht blijft WVP daarom **BLOCKED**; er is niets gestart.
- De eerder waargenomen fout bij de normale dienstverbandwizard blijft exact `EMPLOYMENT_SCHEDULE_LABOR_CONDITION_REQUIRED` (SQLSTATE `P0001`). Nadere broninspectie toont dat `internal_security.normalize_employment_contract()` bij INSERT `fulltime_hours_per_week` uit de arbeidsvoorwaardenset hoort te vullen. De eerdere uitleg dat het ontbreken van dit veld in de expliciete INSERT op zichzelf de fout veroorzaakt, is dus niet bewezen en geldt niet als vastgestelde root cause. Er is geen nieuwe poging of mutatie gedaan; de synthetische profiel-/teamfixture blijft onvolledig.
- Deze verificatie was read-only: geen account, fixture, proces, migratie, rol of scope is gewijzigd; geen taakactie, notificatie, push, merge of deployment is uitgevoerd. De eerdere native positieve en negatieve API-proeven hierboven zijn hergebruikt.
