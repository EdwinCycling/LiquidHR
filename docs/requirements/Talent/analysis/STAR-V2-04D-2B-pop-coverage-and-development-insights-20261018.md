# STAR-V2-04D-2B — POP-dekking en ontwikkelvoortgang

**Status:** lokaal geaccepteerd op 2026-10-18
**Productgrens:** read-only aggregatie in de bestaande categorie Talent & Ontwikkeling.

## Contract

De rapportage gebruikt uitsluitend de bestaande bronnen en autorisatiepaden:

- `talent_development_goals` levert planstatus, vastgelegde voortgang, periode en voltooiingsdatum;
- bestaande Continuous Appraisal `ACTION`-items leveren status, deadline en optionele volgende afspraak;
- `getStarPerformersInsights` levert één server-afgeleide medewerkerpopulatie voor HR Admin en de directe actieve Manager-teamscope;
- Employee krijgt geen managementrapportage; de bestaande eigen POP-/developmentroutes blijven eigenaar van self-service.

De medewerkerdekking is `unique employees with at least one ACTIVE plan / unique relevant employees`. Statussen en voortgang worden niet afgeleid. `due_on` bepaalt achterstallige acties; alleen een aanwezige `next_meeting_on` bepaalt komende of verlopen opvolging. Ontbrekende brondata blijft `no-data` of `unavailable` en wordt niet als nulmeting of risico geïnterpreteerd.

## Rapport- en exportpariteit

KPI's, statusbadges, afdelings-/teamaggregatie, medewerker-/bronlinks, filters en CSV gebruiken dezelfde geautoriseerde selectie. De CSV gebruikt vaste allowlisted kolommen en bevat afzonderlijke rijen voor plannen en acties. Historische trends worden niet getoond zolang geen vergelijkbare historische ontwikkeldata beschikbaar is.

## Niet in scope

Geen nieuwe POP-workflow, opvolger-readiness, score, kunstmatige voortgang, databaseobject, migration, permission, RLS-policy, fixturevulling of tweede rapportberekening. Deze slice levert geen 04D-2C of 04D-2D-functionaliteit.

Zie de [lokale acceptance-evidence](../../quality/acceptance/runs/STAR-V2-04D-2B-LOCAL-20261018.md) voor de rolmatrix, live aantallen, CSV-pariteit en resterende algemene TS/lint-meldingen.
