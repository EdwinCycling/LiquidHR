# Actual Work V1

## Status

Development candidate op `work/actual-work-v1`, gebaseerd op
`origin/main` SHA `3c7a3c73e9d1aba928f44c3350f5d84d2ea65923`.

De schema-, service-, route- en UI-slice is lokaal gebouwd. Migration
`20260914192320_actual_work_v1` is uitsluitend toegepast op het LiquidHR
DEV/test Supabase-project `wnpfloqpjvaacobppbpk`; Production is buiten scope.
Remote readback, generated types, Supabase advisors, de gerichte tests,
strict TypeScript en i18n zijn groen. Geauthenticeerde browseracceptatie,
feature-push, main-integratie en deployment blijven afzonderlijke gates.

## Productcontract

Actual Work V1 legt directe gewerkte uren vast als canonieke feiten per
dienstverband en werkdag of periode. De HR Admin kiest expliciet de soort:

- `WORK`: reguliere gewerkte uren; deze bron is ook beschikbaar voor Leave
  `WORKED_HOURS`-opbouw.
- `ADDITIONAL`: expliciet ingevoerde aanvullende uren voor parttimers, met de
  effectieve fulltime-norm en FTE als server-side eligibility- en limietbasis.
- `OVERTIME`: expliciet ingevoerd overwerk; bestaande Leave-overurensemantiek
  gebruikt dezelfde canonieke bron.
- `TRANSPARENT`: uitsluitend informatief. Deze uren tellen niet mee voor
  gewerkte uren, payroll, Leave of opbouw, maar kunnen als team- of
  kalenderinformatie worden getoond.

De applicatie classificeert niet automatisch: meer uren dan het rooster of
een fulltime-norm maakt een invoer niet vanzelf aanvullend of overwerk. Save
en Publish blijven de expliciete persistence boundary. Employee self-service
mag dezelfde canonieke save- en correctieflow gebruiken voor de eigen
records; dit is geen managergoedkeuring en breidt managerrechten niet uit.

Canonicale hoeveelheden gebruiken `numeric(12,4)` en exacte decimale parsing.
Eén tienduizendste uur is 0,36 seconde. Er wordt niet tussentijds naar
zwevende JavaScript- of Postgreswaarden afgerond. Typegeldigheid,
granulariteit, toekomstige invoer, dienstverbandperiode, parttime-
eligibility, dag/week/maandlimieten en gesloten perioden worden server-side
en via RLS afgedwongen.

## Tijd, correcties en perioden

Elke invoer resolveert de effectieve employment-, rooster-, FTE- en
typeconfiguratie op de betreffende datum. Een periode is maandelijks en kan
worden geopend of gesloten; een gesloten periode accepteert geen normale
CRUD. Correcties zijn append-only historie met oorspronkelijke waarde,
huidige waarde, delta, actor, tijdstip en verplichte reden. Heropenen is geen
V1-flow.

Actual Work gebruikt de bestaande `work_hour_types` en
`employment_work_hour_entries` als canonieke urenledger. Er is geen tweede
urenbron toegevoegd. De bestaande Leave- en kalenderprojecties lezen deze
zelfde bron; transparante typen blijven buiten Leave-saldi en
accrualberekeningen.

## Autorisatie en zichtbaarheid

De server controleert actor, tenant, HR-groep, permission, employee en
employment-scope voordat een read of write wordt uitgevoerd. De database
behoudt RLS op alle nieuwe tabellen en gebruikt invoker-bound RPC's voor
entry-save en period-close. UI-verberging is geen security boundary.

De UI-surfaces zijn HR Admin (medewerkeruren, Actual Work-instellingen,
teamoverzicht en Insights) en Employee Focus → Uren. Employee heeft via de
canonieke `self:actual-work:write`-permission uitsluitend schrijf- en
correctierecht op de eigen Actual Work-records; de bestaande service, RPC en
RLS blijven de enige persistence boundary. Managerrechten worden niet
impliciet uitgebreid. Cross-employee, cross-group, cross-tenant en
manager-zonder bestaand HR-recht moeten negatief blijven.

## DEV-fixtures

De idempotente seed gebruikt uitsluitend de synthetische Planeten/Jupiter-
scope in DEV: Lisa en Jan bevatten fulltime/parttime en de roosterwissel van
Jan op 2026-10-01. De seed bevat alle vier families, limieten, een gesloten
augustusperiode, open september/oktober/novemberperioden, correctiehistorie
en een `WORKED_HOURS` Leave-bron. De lege TEST-BOUNDARY-groep wordt niet
gerefereerd en blijft leeg.

## Routes

- `/employees/[employeeId]/hours`
- `/settings/actual-work`
- `/actual-work/team`
- `/actual-work/insights`
- `/insights?report=actual-work&month=YYYY-MM`

De API-grens staat onder `/api/actual-work/*` voor types, entries, periods,
team en insights. Dezelfde save-service wordt door individuele invoer en
bulk/period workflows gebruikt zodra die UI wordt uitgebreid.

## Acceptatiegates

1. DEV migration/readback, typegen en advisors.
2. Gerichte Actual Work-tests, strict TypeScript, i18n, lint en diff-check.
3. Authenticated Employee browserflow op Focus → Uren met precies één eigen
   create en één correctie, persistence readback, privacynegatieven, plus
   HR/Manager-projecties, gesloten periode, Leave/kalender/Insights.
4. Negatieve persona- en scopechecks zonder service-role browserbypass.
5. Feature branch commit/push, fast-forward integratie op `main`, exact
   GitHub-SHA-readback.
6. Deployment van exact die SHA naar de bestaande LiquidHR testlijn en
   hosted acceptance.
