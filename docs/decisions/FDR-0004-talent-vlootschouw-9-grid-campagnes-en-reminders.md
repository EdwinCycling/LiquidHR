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
