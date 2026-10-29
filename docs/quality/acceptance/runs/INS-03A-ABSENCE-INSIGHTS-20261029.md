# INS-03A — Verzuim Insights autorisatie en betrouwbaarheid

- **Datum:** 2026-10-29
- **Issue:** [#62](https://github.com/EdwinCycling/LiquidHR/issues/62)
- **Branch:** `work/ins03a-absence-insights-20261029`
- **Codecommit:** `aac56a4a` (`feat(insights): harden absence report scope and quality`)
- **Baseline:** actuele GitHub `main` `b9b1793123259ee49caa5d1c69359af0d850228a`
- **Status:** lokale gerichte codegates PASS; live/RLS/browseracceptatie en Vercel-release niet uitgevoerd.

## Functionele wijzigingen

- Verzuim- en frequent-verzuimrapporten gebruiken dezelfde INS-01/INS-02-populatiescope: HR Admin binnen de actieve geautoriseerde administratie; Manager uitsluitend directe teamleden binnen die administratie. Cases en plaatsingen worden vooraf op die medewerkers beperkt; spells volgen uitsluitend de gefilterde case-ID's en capaciteit uitsluitend de gefilterde spell-ID's.
- De geautoriseerde berekening voedt KPI's, trends, details en Excel. Bradford gebruikt dezelfde verzuimrijen en markeert onvolledige noemers als onbekend.
- Ontbrekende of conflicterende roosters, capaciteitswaarden en historische plaatsingen worden als datakwaliteit getoond. Onbekende noemers leveren geen 8-uursfallback of 0%-verzuim op. Limietbereik en Manager-scope-truncatie falen gesloten.
- De rapporten blijven beschikbaar, WVP blijft disabled. Frequent verzuim telt cases als meldingen en dedupliceert kalenderdagen uit ziekteperioden; Bradford gebruikt ziekteperioden (`spells`) voor `S` en de verzuimdagen voor `D`. De Excel-werkbladen benoemen beide definities.
- Exports bevatten geen diagnose of vrije medische tekst.

## Lifecyclekeuze

INS-03-F01 is opgelost door de muterende `normalize_expired_absence_cases`-RPC uit de Insights-rapportage-GET te verwijderen. De rapport-GET is daarmee read-only. De SQL-functie, statusovergangen en bestaande lifecycle-aanroepen vanuit het verzuimdomein en Focus zijn niet aangepast.

Gevolg: het openen van een Insights-rapport sluit een verlopen `RECOVERY_WINDOW` niet meer als neveneffect. De expiratie wordt alleen uitgevoerd wanneer een bestaand lifecycle-aanroeppad loopt. Voor een voorspelbare cadence is een apart, geautoriseerd lifecycle-job of expliciet mutatiecontract nodig; dat is niet in deze slice toegevoegd. De overgangsregel zelf blijft ongewijzigd.

## Gerichte verificatie

- Vitest: 12 INS-03A-/aangrenzende Insights-testbestanden, **32/32 PASS**. Inclusief twee administraties en meerdere teams; de regressietest controleert scopes vóór uitvoering van de cases-, spells-, capacity- en roosterqueries.
- Gerichte TypeScript: `npx tsc --noEmit -p tsconfig.ins03a.json` — **PASS**. De tijdelijke scopeconfig is na de controle verwijderd.
- ESLint op geraakte Insights TypeScript/TSX-bestanden — **PASS**.
- i18n: `npm run check:i18n` — **PASS**, 43 namespaces met gelijke NL/EN-sleutels.
- `git diff --cached --check` op de 22 geselecteerde implementatiebestanden — **PASS**.

## Bewijsgrens

De regressietests gebruiken mocks en bewijzen querybeperkingen in de applicatiecode; zij bewijzen geen live Supabase-RLS of daadwerkelijke persona-toegang. Geen hosted browseracceptatie, brede `.next`-typecheck, databasewrite, migratie, grant, deployment of merge uitgevoerd. De bekende gegenereerde `.next`-routefouten zijn niet opnieuw onderzocht.

## Resterende acceptatiepunten

- Gezamenlijke geauthenticeerde HR Admin-/Manager-/Employee- en RLS-acceptatie op de bestaande TEST-runtime.
- Een apart besluit over eigenaar en cadence van lifecycle-normalisatie, zodat verlopen cases buiten Insights op voorspelbare wijze worden genormaliseerd.
- Gezamenlijke hosted/browser- en Vercel TEST-releaseacceptatie; WVP blijft disabled tot de afzonderlijke juridische, privacy- en bronacceptatie.
