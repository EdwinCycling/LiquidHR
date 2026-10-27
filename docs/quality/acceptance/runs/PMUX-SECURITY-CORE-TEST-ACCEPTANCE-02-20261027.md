# PMUX-SECURITY-CORE-TEST-ACCEPTANCE-02 — Core TEST

**Datum:** 27 oktober 2026

**Status:** **PARTIAL** — migratie en gerichte negatieve autorisatiecontroles PASS; volledige rol-/WVP-acceptatie OPEN.

**Project:** LiquidHR Core TEST `wnpfloqpjvaacobppbpk`

**Branch / codebasis:** `work/pmux-security-authorization-hardening-01-20261026` / `c0c5c44c337e6f5c3874866ed00c941f735b1f13`

## Migratie en autorisatie

- Voor toepassing is opnieuw gecontroleerd dat `apps/hr-suite/supabase/migrations/20261026190604_pmux_security_authorization_hardening.sql` exact SHA-256 `fae20ac4b8f9d690ced6fb979a4abc3830feefe577fbc682dc9c298db11c0b63` had, overeenkwam met de beoordeelde inhoud en nog niet in Core TEST was geregistreerd.
- De migratie is eenmaal transactioneel toegepast na expliciete toestemming. De historie ging van 585 naar 586 records. Supabase registreerde de naam `20261026190604_pmux_security_authorization_hardening` onder gegenereerde versie `20261027170458`; er staat precies één record voor deze naam.
- De migratie definieert 22 functies in `internal_security`, waaronder de actuele actor-, subject-, team-, administratie-, kandidaat-, claim-, actie-, lees-, Leave/P9/P10- en WVP-checks. Er zijn geen tabellen, policies, triggers of bestaande grants gewijzigd; er is geen fixture, backfill of businessdata-mutatie uitgevoerd.
- Readback bevestigde de functiecontracten, private helper-ACL's, bestaande wrappergrants, RLS op de betrokken tabellen, 11 bestaande policies en 41 bestaande triggers. Security-advisors gaven 11 `rls_enabled_no_policy`-INFO's, 4 `anon_security_definer_function_executable`-WARNs, 136 `authenticated_security_definer_function_executable`-WARNs en 1 `auth_leaked_password_protection`-WARN. Geen van de 22 door de migratie gedefinieerde functies kwam voor in de advisor-findings.
- Herstelstrategie: rollback bij fouten vóór COMMIT; na COMMIT alleen forward-only herstel. De transactie is succesvol gecommit; rollback is niet gebruikt. Er is geen aparte backup/PITR gebruikt, overeenkomstig het akkoord.

## Proceshistorie en neveneffecten

Voor en na de migratie en negatieve HTTP-proeven bleven de aantallen gelijk: 14 procesinstanties, 26 werkitems, 26 kandidaatrijen en 79 procesevents. De zes generieke negatieve claim-/actieproeven en drie adapterproeven veranderden status, versie of toewijzing van geen enkel doelwerkitem. De HR Admin-werkbak bleef 26 items tonen.

## Native lokale TEST-acceptatie

De officiële `start-test-worktree.ps1`-launcher startte de centrale TEST-configuratie op loopbackpoort 3011. Poort 3010 was bezet; geen proces is gestopt. De centrale configuratie en bestaande synthetische persona's zijn gebruikt; waarden van secrets zijn niet getoond. De bestaande lokale persona-/role-switchflow is gebruikt.

| Rol | Positieve read / UI | Negatieve scopeproef | Resultaat |
| --- | --- | --- | --- |
| HR Admin | Context Planeten / Jupiter BV; `/work` HTTP 200; werk-API HTTP 200 met 26 items. Van de vijf open items hadden vijf `canAct=true` en één `canClaim=true`; geen actie uitgevoerd. | Een niet-geregistreerde administratie-ID gaf HTTP 200 met 0 items. Een bestaand buiten-tenant personeelsrecord gaf HTTP 404 op de employee-detailroute. | **PASS** voor geteste toegang en scopefiltering. |
| Manager (Lisa) | In dezelfde HR-groep/administratie; `/work` HTTP 200; teamendpoint HTTP 200 met 3 medewerkers. De Manager-werkbak had 0 items; er bestond geen procesinstantie voor haar directe team. | Een proces buiten de teamscope gaf HTTP 403. Claim en generieke actie op open Leave-, interne-overgang- en documentkennisnametaken gaven elk HTTP 403. De specifieke Leave-workflow-, interne-transfer-commit- en document-acknowledgementroutes gaven elk HTTP 403. | **PASS** voor negatieve scope- en adapterproeven; positieve Manager-procesread OPEN wegens ontbrekende fixture. |
| Employee (Jaap) | Eigen `/work`-route en API gaven HTTP 200 met 0 taken. Er bestond geen eigen procesinstantie in de bestaande fixtures. | Detailread van een vreemd proces en vreemd werkitem gaven beide HTTP 403; filter op een andere medewerker gaf 0 items. | **PASS** voor geteste vreemde-scopeweigering; positieve eigen procesread OPEN wegens ontbrekende fixture. |

De Manager- en Employee-proeven gebruikten bestaande TEST-authidentiteiten. De uitvoering gebruikte alleen normale app-routes en sessies; er is geen service-role- of directe SQL-write-bypass gebruikt.

## Kandidaatrijen en WVP

- Read-only inspectie vond geen kandidaatrij voor Manager Lisa. Over alle 26 bestaande kandidaatrijen gaf de actuele permission-helper voor de bijbehorende kandidaatactoren toestemming; er was geen oude `is_eligible=true`-rij waarvan de actor nu buiten de scope viel. De gevraagde stale-candidate-negatieve proef heeft daardoor geen passend bestaand fixture.
- De eerder goedgekeurde actieve synthetische afwezigheidscasus bestaat nog. Voor die casus zijn 0 guidance-links, 0 guidance-events en 0 WVP-taken aanwezig. Er is geen WVP-proces gestart.
- De normale afwezigheidsleesroute is niet aangeroepen: `listEmployeeAbsence` voert eerst lifecycle-normalisatie uit en kan bij `absence:write` WVP-taken genereren. Dat zou buiten de toegestane read-only/negatieve scope vallen. Daardoor zijn WVP-specifieke task-RPC's en positieve WVP-toegang niet native geaccepteerd.

## Tests, grenzen en resterende gates

- De eerder op deze codebasis geslaagde lokale securitycontracttests (`39/39 PASS`) zijn niet herhaald. Er is geen algemene suite opnieuw uitgevoerd.
- De nieuwe gerichte native HTTP-controles bevestigen server-side weigering van scope-overschrijdende reads, claims en acties voor de aanwezige Leave-, interne-transfer- en document-acknowledgementfixtures, zonder procesneveneffecten.
- Open blijven: een bestaande oude kandidaatrij met actuele scopeweigering, een positief Manager-proces binnen directe teamscope, een positief eigen Employee-proces, WVP-guidance-/mijlpaaldata en de WVP-specifieke autorisatie-/actieproeven. Er zijn geen positieve procesmutaties uitgevoerd.
- Er is geen nieuwe migratie, procesdefinitie, grant, datafix, WVP-start, GitHub-push of Vercel-deployment uitgevoerd. De historische [lokale securityrun](PMUX-SECURITY-AUTHORIZATION-HARDENING-01-LOCAL-20261026.md) is ongewijzigd bewaard.
