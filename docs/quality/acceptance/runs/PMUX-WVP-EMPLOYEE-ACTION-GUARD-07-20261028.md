# PMUX-WVP-EMPLOYEE-ACTION-GUARD-07 — lokale securitycorrectie

Datum: 2026-10-28
Core TEST-project: `wnpfloqpjvaacobppbpk`
Bestaande WVP-instantie: `0bcbc7b1-6ff1-406e-8a7a-00832833213a`
Casus: `356e0c99-5d67-4e7a-a0da-3b7219ef617f`
WVP-definitieversie: `6c4b523e-51c8-415c-af06-1bb7cb77c630`

## Verdict

**LOCAL SECURITY CORRECTION: PASS. Core TEST acceptance: OPEN until the migration is separately authorized and applied.** De code en geïsoleerde contracttest bewijzen de oorspronkelijke server-side bypass en de gecorrigeerde weigering. Er is geen muterende call op de bestaande Core TEST-instantie uitgevoerd.

## Root cause

**A — Niet alleen een projectiefout.** `get_process_work_item_detail` en de twee gedeelde werkbakprojecties behandelden `process-task:act` als voldoende voor `canAct`. De detailprojectie gaf dan de stapacties terug, ook als de actor het werkitem niet had geclaimd en geen actuele kandidaat was. Dat veroorzaakte de inconsistente combinatie met `canClaim=false`.

**B — De oude authenticated RPC had dezelfde tekortkoming.** `perform_process_work_item_action` controleerde de procespermission en blokkeerde alleen wanneer een item al door een andere actor was geclaimd. Een Employee kon daarom een ongeclaimde Manager-taak met bekende work-item-ID rechtstreeks `CANCEL`-en; `SUBMIT` volgde dezelfde ontbrekende claim/candidate-guard. De geïsoleerde PGlite-test reproduceerde de `CANCEL`: de taak werd COMPLETED en de stap CANCELLED. De test rolde de transactie terug en bevestigde daarna status OPEN en nul events.

**C — Generiek gedeeld PMUX-probleem, niet WVP-configuratie.** De centrale executor en projecties zijn procesgeneriek. Leave-, P9-, P10- en WVP-adapters die deze executor gebruiken vallen onder dezelfde guard; hun afzonderlijke routes zijn in deze run niet allemaal live/end-to-end uitgevoerd. Historische en nieuwe instanties gebruiken dezelfde centrale action-functie; er is geen procesdefinitie gewijzigd.

## Core TEST read-only momentopname

Read-only SQL bevestigde dat de bestaande instantie RUNNING is op definitieversie `6c4b523e-51c8-415c-af06-1bb7cb77c630`. De huidige stap is `wvp-week-6` (FORM), work item `624c923d-25d2-4c71-b074-23bdfabf617a`, participant `case-owner`, status OPEN, expected version 1. De stap staat `CANCEL` en `SUBMIT` toe. Er is één kandidaatrij, die de laatste resolutierij is en `is_eligible=true` heeft (`queue:wvp01`). Deze read toont de taakrouting; de actoridentiteit achter die kandidaat is hier niet opnieuw aan de naam Yara gekoppeld.

Er is niet via HR Admin-, Manager- of Employee-sessie ingelogd en de bestaande taak is niet geclaimd, uitgevoerd of geannuleerd. Er zijn geen instantie-, work-item-, candidate- of eventrecords aangepast.

## Minimale correctie

Nieuwe lokale migratie `20261028125342_pmux_work_item_claim_guard` (SHA-256 `AD4119C05369D454A2CB1670EFB644DDC16CFAD970A81CE06335AE2C3C580528`) introduceert alleen:

1. `internal_security.process_work_item_actor_can_act(uuid, uuid, uuid)` — private security-definer helper, waarvan execute expliciet is ingetrokken van `public`, `anon` en `authenticated`.
2. Vervanging van `internal_security.perform_process_work_item_action(...)`.
3. Vervanging van `internal_security.get_process_work_item_detail(uuid)`.
4. Vervanging van `internal_security.get_process_work_projection(...)`.
5. Vervanging van `internal_security.get_unified_process_work_projection(...)`.

Uitvoeren vereist nu gelijktijdig: actieve CLAIMED-status, claim-eigenaarschap door dezelfde `auth.uid()`, actuele `process-task:act`-scope en actuele eligible kandidaatstatus op de laatste kandidaat-resolutie. De RPC hercontroleert dit vóór de statusovergang. `canClaim` blijft OPEN + scope + actuele kandidaat; `canAct` is CLAIMED + eigenaar + scope + actuele kandidaat; `allowedActions` is leeg zonder `canAct`. Leespermissies en kandidaatberekening zijn niet verruimd of vervangen.

De migratie maakt geen tabellen, policies, triggers, rollen of nieuwe grants aan, wijzigt geen bestaand datarecord en past de gedeelde basis-permissionfunctie niet aan. Alleen de nieuwe helper krijgt een expliciete REVOKE. Het bestand is lokaal en is niet op Core TEST uitgevoerd. Vóór COMMIT is een migratiefout transactioneel terug te draaien; na COMMIT is alleen forward-only herstel passend.

## Contracttest en resultaten

De gerichte PGlite-test gebruikt uitsluitend synthetische rijen, de PostgreSQL-rol `authenticated` en rollbacktransacties.

| Actor/situatie | Lezen | Claim vóór actie | `canAct` / acties vóór claim | Uitvoering |
| --- | --- | --- | --- | --- |
| Employee Noah, eigen subject | toegestaan | geweigerd | `false` / `[]` | claim, `SUBMIT` en `CANCEL` geweigerd (`42501`), geen status/eventmutatie |
| Employee, ander subject | geweigerd | geweigerd | niet zichtbaar | geweigerd |
| Manager Yara, actuele kandidaat in teamscope | toegestaan | toegestaan | `false` / `[]` vóór claim | claim PASS; na claim `canAct=true`, `SUBMIT` en `CANCEL` beschikbaar; `SUBMIT` PASS binnen rollbacktest |
| Manager buiten teamscope | geweigerd | geweigerd | niet zichtbaar | claim, `SUBMIT` en `CANCEL` geweigerd |
| HR Admin binnen administratie maar geen kandidaat | toegestaan | geweigerd | `false` / `[]` | directe `CANCEL` geweigerd |
| HR Admin zonder geldige administratiescope | geweigerd | geweigerd | niet zichtbaar | geweigerd |
| Manager na verouderde/ineligible kandidaatresolutie | toegestaan zolang bestaand leesrecht geldt | geweigerd | `false` | directe `SUBMIT` geweigerd |

Voor de correctie bewees dezelfde test de verkeerde Employee-projectie (`canClaim=false`, `canAct=true`, acties `SUBMIT/CANCEL`) en de directe authenticated `CANCEL`-bypass. Na rollback bleven de taak OPEN en events op nul. Na de guard waren Employee-`canAct=false`, lege acties en alle claim-/actieproeven geweigerd. De Manager kon na een actuele claim nog handelen; de testtransactie rolde terug en liet opnieuw OPEN/nul events achter.

- Gerichte contractbestand: **3/3 tests PASS**.
- ESLint op het gewijzigde contractbestand: **PASS**.
- CRLF-aware `git diff --check`: **PASS**.
- Algemene testsuite, browserlogin en geauthenticeerde remote RPC: niet uitgevoerd.

## Bestanden, status en resterend risico

- Migratie: `apps/hr-suite/supabase/migrations/20261028125342_pmux_work_item_claim_guard.sql`.
- Regressiecontract: `apps/hr-suite/supabase/migrations/20261026190604_pmux_security_authorization_hardening.contract.test.ts`.
- Actuele status: `docs/AA/AA-CURRENT.md` en `docs/AA/AA-OPEN.md`.
- Core TEST-migratie: **niet toegepast**. Tot afzonderlijke toestemming blijft de oude centrale RPC actief en blijft de server-side bypass bestaan.
- Geen migratie-, configuratie-, proces-, notificatie-, GitHub-, merge- of deploymentwrite uitgevoerd.
- Geen wijziging aangebracht aan de vooraf dirty `apps/hr-suite/next-env.d.ts`; die file is niet onderdeel van dit bewijs of de fixcommit.

Na afzonderlijke toestemming voor exact deze migratie is gerichte authenticated Core TEST-acceptatie nodig: Noah eigen read plus claim/submit/cancel weigeren, Yara geldig claimen en uitvoeren, Manager buiten scope weigeren, HR Admin met/zonder administratie-scope, directe RPC met de bekende work-item-ID en controle op geen neveneffecten. WVP-, Leave-, P9- en P10-adaptergedrag verdient gerichte bestaande-fixture regressie; geen nieuwe processtart is hiervoor nodig.
