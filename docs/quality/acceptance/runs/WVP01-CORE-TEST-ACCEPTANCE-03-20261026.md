# WVP01 Core TEST acceptance 03

Datum: 2026-10-26 13:17 UTC  
Worktreebasis: `work/wvp01-safe-integr-02-20261026` @ `c45cc75b760fa690fcb4989ca46ab7b12cac4844`  
Status: **PARTIAL** — migratie PASS; native rolgebaseerde browseracceptatie OPEN.

## Gecontroleerde Core TEST-wijziging

Doel: LiquidHR Core TEST, Supabase-project `wnpfloqpjvaacobppbpk` (ACTIVE_HEALTHY, `eu-west-3`, PostgreSQL 17.6).

De gebruiker gaf expliciet akkoord voor precies één transactionele toepassing van:

- Migratie: `20261026055349_wvp01_absence_guidance`
- Bestand: `apps/hr-suite/supabase/migrations/20261026055349_wvp01_absence_guidance.sql`
- SHA-256 (UTF-8/LF): `d4ec81cdab60e398a61d7ee12e8fb76e7d1bbf68829264501eb6efb3cd35659a`
- Git-blob: `59bf3f7ece6b4262f9f14355ab1cd8eddb05c683`

De Supabase-migratietool meldde succes. De live migratiehistorie bevat de versie eenmaal. De SQL zelf is begrensd met `BEGIN`/`COMMIT`; de afgesproken herstelstrategie was rollback vóór COMMIT en na COMMIT uitsluitend forward-only corrigeren. Er is geen afzonderlijk backup/PITR-herstelpunt geverifieerd of gebruikt.

## Schema- en rechtenreadback

Live read-only cataloguscontrole na toepassing:

- Exact twee nieuwe relaties: `absence_guidance` en `absence_guidance_events`; beide hebben RLS aan. Force-RLS staat uit, conform het bestaande schema-patroon.
- Twee policies, uitsluitend `SELECT` voor `authenticated`; de beleidsfilters gebruiken de bestaande case-scopehelper.
- `anon` heeft geen tabelrechten of RPC-execute. `authenticated` heeft uitsluitend tabel-SELECT en execute op de drie WVP-RPC’s.
- Drie publieke RPC’s zijn `SECURITY INVOKER`; 14 interne WVP-helpers zijn aanwezig.
- Alle 11 verwachte WVP-/audittriggers zijn aanwezig en ingeschakeld.
- `service_role` heeft brede tabel- en functie-defaultrechten die al door Core TEST op `public` worden verleend; de migratie laat die defaults bestaan. De gebruiker is vóór toepassing hierover geïnformeerd. Bestaande rechten en policies op de oude verzuim-/procesrelaties zijn niet aangepast.
- Beide nieuwe tabellen tellen nul rijen. De migratie heeft geen fixture, backfill, casus of procesinstantie aangemaakt.

Supabase advisors tonen geen WVP-gerelateerde securityfinding. De performance-advisor toont twee INFO-findings voor niet-geïndexeerde samengestelde foreign keys in `absence_guidance` en unused-index INFO’s op nieuwe WVP-indexen. Er is geen aanvullende indexmigratie toegepast of geautoriseerd. De overige projectbrede advisor-waarschuwingen zijn niet aan WVP-objecten toegeschreven.

De live gegenereerde TypeScript-definitie bevat beide tabellen, relaties en drie RPC’s; de voorbereide lokale `packages/db/types.ts` bevat dezelfde tabellen, FK-relaties en RPC-namen. De generator geeft nullable UUID-RPC-argumenten als `string`; de lokale call-contracten laten `null` toe.

## Fixture- en runtimeacceptatie

Er zijn alleen read-only aggregaties gebruikt voor fixtureselectie:

- De toegepaste gedocumenteerde absence-fixtures bevatten negen cases; alle staan `CLOSED`.
- De canonieke TEST-persona’s hebben geen actieve absence-case (één gesloten case gevonden; voor de overige geen case).
- Twee actieve cases zonder gedocumenteerde synthetische fixturemarkering zijn uitgesloten.
- De WVP-startfunctie vereist een `ACTIVE`-case. Er was dus geen bestaande actieve synthetische casus voor een volledige start/mijlpaal/afspraak/kennisname/herinnering/afsluitketen.
- Er zijn geen casus-, proces-, taak-, reminder- of fixturemutaties uitgevoerd. Een nieuwe synthetische casus of heractivering vereist apart, exact akkoord; gesloten historie wordt niet aangepast.

De lokale launcher is geprobeerd op loopback-poort 3012. Hij startte niet: `%LOCALAPPDATA%\LiquidHR\TestRuntime\.env.local` ontbreekt; ook `payroll-test-personas.env` is afwezig. Er zijn geen waarden gelezen, getoond of aangemaakt. Er was geen lokale server op poort 3010–3012. Daarom is geen geïsoleerde Playwright-login, persona-/scopeproef of responsive browserrun uitgevoerd. Een browser-PASS wordt niet geclaimd.

Eerdere engineeringevidence blijft behouden in [WVP01-20261026-LOCAL.md](WVP01-20261026-LOCAL.md): de lokale SQL-contracttest was daar 19/19 PASS op dezelfde migratiehash; deze test is in deze acceptatieronde niet opnieuw uitgevoerd.

## Eindoordeel

- Core TEST schema-toepassing en catalogusreadback: **PASS**.
- Geen businessdata- of fixturewrite buiten de goedgekeurde schemawijziging: **PASS**.
- Native HR Admin-/Manager-/Employee-browserketen: **OPEN** door ontbrekende bestaande runtimecredentials/config en het ontbreken van een actieve synthetische casus.
- Volledige WVP01 Core TEST-acceptatie: **PARTIAL**.
