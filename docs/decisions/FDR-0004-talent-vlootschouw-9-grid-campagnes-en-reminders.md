# FDR-0004: Talent Vlootschouw — campagne-, scope- en reminderbeleid

**Status:** VASTGESTELD VOOR DE 9-GRID-SLICE
**Datum:** 2026-08-03
**Bron:** `docs/requirements/Talent/09-LiquidHR-Vlootschouw-9-grid-Requirements.md` en `C:\Users\Edwin\Downloads\vlootschouw.md`
**Vervangt:** geen; activeert de 9-grid-uitzondering op de fase-1-scope

## Besluiten

1. De 9-grid is een Workforce-proces voor precies twee applicatierollen: HR Admin en Manager. Medewerker- en directieroutes worden niet toegevoegd.
2. De campagne is tenant-owned. Bij starten wordt de actuele effectieve `employee_organizations.direct_manager_id` gebruikt; assignment en teamlidmaatschap worden daarna een historische snapshot.
3. Prestatie en potentieel gebruiken vaste waarden `LOW`, `NORMAL` en `HIGH`. De gridcel wordt niet als vrije invoer opgeslagen; de server bepaalt de afgeleide cel.
4. Scores worden per campagne opgeslagen en zijn na sluiten read-only. Alleen HR kan expliciet heropenen. De bestaande `audit_logs` blijft de auditbron.
5. Reminders hergebruiken de bestaande Tijdhub/reminderinfrastructuur. De automatische planning is zeven dagen vóór de einddatum, of op de einddatum wanneer de campagne korter dan zeven dagen is. Een ingediende assignment krijgt geen reminder.
6. De startactie maakt de assignments en automatische reminders in één databaseoperatie. Zo kan een campagne niet actief worden zonder dezelfde historische teamgrens en reminderplanning.
7. De MVP toont geen vitaliteits-, salaris-, verzuim- of andere gevoelige afleidingen. Die velden mogen niet als vervangende score of fictieve KPI in de grid verschijnen.
8. Een medewerker zonder 9-grid-permissies kan geen route, campagne of scorefunctionaliteit starten. Een gebruiker die ook Manager is, mag zijn eigen medewerkerrecord nooit als reviewsubject zien, scoren of historisch terugzien; dit geldt ook wanneer `direct_manager_id` naar zichzelf wijst. HR-beheer blijft tenantbreed volgens de expliciete HR-permission.

## Rationale

Een live managerrelatie is onvoldoende voor historische rapportage: een medewerker kan na de campagne van manager wisselen. Daarom wordt de managerverantwoordelijkheid op startmoment vastgelegd. De bestaande reminderinfrastructuur behoudt Tijdhub-gedrag, completion/snooze en tenantisolatie; een nieuwe reminderbron zou dubbele notificatielogica introduceren. De deadline-uitzondering voorkomt een overbodige reminder vóór de start bij korte campagnes.

## Gevolgen

- De bestaande Talent Foundation blijft configuratie- en read-only profielbeheer; deze FDR voegt alleen de expliciete 9-gridworkflow toe.
- De campagne- en scoretabellen krijgen eigen RLS/policies naast de bestaande assessmenttabellen; assessmentantwoorden worden niet hergebruikt voor 9-grid-scores.
- De manager ziet historische scores alleen wanneer de manager ook in de betreffende campagneassignment zit. HR heeft tenantbrede read-only historie.
- Een handmatige reminder is een nieuwe remindergebeurtenis voor dezelfde assignment en wordt als campagneactie geaudit; de campagne zelf is de bron van waarheid voor de taakstatus.
- De self-scope wordt in de database afgedwongen met constraints, campaign-start-filter, RLS en de serverservice. De UI-filter is alleen een extra defense-in-depth-laag.

## Addendum TALENT-9GRID-UX-V2 — 2026-10-14

Dit addendum supersedeert uitsluitend de delen hierboven over tenant-brede HR-scope, exclusieve managerinvoer en afsluit-/heropenregels. De overige campagne-, snapshot-, privacy-, reminder- en scorebesluiten blijven gelden.

1. Een campagne hoort bij precies één `administration_id`. Services filteren op de actieve administratie; RLS en RPC's controleren de permission voor de administratie van de campagne. Een vorige campagne mag alleen uit dezelfde administratie komen.
2. Iedere campagne legt `MANAGER_ONLY`, `HR_ONLY` of `HYBRID` vast. Managers zien en bewerken alleen eigen assignments wanneer de modus managerinvoer toestaat. HR Admin ziet resultaten alleen binnen de actieve administratie; invoeren en namens een manager indienen is uitsluitend toegestaan in `HR_ONLY` en `HYBRID`.
3. Een inzending bewaart de manager als assignment-eigenaar en de werkelijke `auth.uid()` van de indiener als `submitted_by_user_id`. Auditlogs registreren de werkelijke actor. Na indienen zijn assignment en scores read-only totdat HR de assignment met een verplichte reden expliciet terugstuurt.
4. Terugsturen zet uitsluitend de gekozen assignment terug naar bewerkbaar en verplaatst de campagne naar de open HR-reviewstatus. Heropenen van een afgesloten campagne vereist ook een reden en zet de betrokken assignments terug naar correctie.
5. Een campagne kan alleen sluiten wanneer er ten minste één assignment bestaat, alle assignments zijn ingediend en elke toegewezen medewerker beide scores heeft. De database-RPC voert deze volledigheidscontrole atomair uit.
6. De HR-workspace heeft afzonderlijke tabs Campagnes, Beoordelen en Resultaten. De beoordelings- en resultatenweergaven gebruiken een grote 3×3-grid met tokengebaseerde kleurvlakken, toegankelijke selectie, klikplaatsing, drag-and-drop en Foto's/Namen-weergave. Historie wordt alleen voor een bewust geselecteerde medewerker getoond.

TALENT-CONVERGENCE-01 autoriseert deze afgebakende migratie naar synthetische TEST. De officiële migratieconnector weigerde de uitvoering op 2026-10-15 met Invalid or expired requestState; daarom blijft acceptatie HOLD totdat de sessie via de ondersteunde Supabase-verbinding is vernieuwd en alle post-migratiegates slagen. Zie [de actuele acceptatierun](../quality/acceptance/runs/TALENT-9GRID-UX-V2-20261015.md).
