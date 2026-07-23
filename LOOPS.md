# Project loops

## HRMyDay releasegate

- Uitleg: Controleert iedere afgeronde HRMyDay-verticale slice vóór merge of deployment op codekwaliteit, databaseveiligheid en echte browserwerking.
- Prompt: Wanneer een HRMyDay-verticale slice klaar is, lees de actuele staat en voer de releasegate uit: tests, lint, strict typecheck, i18n-check, build, lokale controle op poort 3000 en publieke preview. Bij schema-, RLS-, grant- of migratiewijzigingen: voer ook positieve en negatieve SQL-isolatietests, Supabase advisors en typegeneratie uit. Herstel alleen in-scope fouten en controleer opnieuw. Stop bij groen, blokkade, geen voortgang of goedkeuring vóór merge/deploy.
- Opgeslagen: 2026-07-21
