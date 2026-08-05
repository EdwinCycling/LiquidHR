# FDR-0006 — Parallel verzuim per dienstverband

Status: **GOEDGEKEURD**  
Datum: **2026-08-05**

## Besluit

Verzuim wordt altijd geregistreerd op één dienstverband. De applicatie blokkeert alleen overlappende verzuimperiodes binnen hetzelfde dienstverband.

Gelijktijdig verzuim op verschillende dienstverbanden van dezelfde persoon is toegestaan. Dat geldt ook wanneer die dienstverbanden bij verschillende administraties of HR-groepen horen.

Voorbeeld:

```text
Dienstverband 1: portier, 50% — hersteld gemeld
Dienstverband 2: badmeester, 50% — ziek
```

Deze situatie is geldig. Een herstelmelding op dienstverband 1 mag de casus op dienstverband 2 niet sluiten, wijzigen of samenvoegen.

## Context- en keuzeproces

- De gebruiker kiest eerst de HR-groep wanneer meerdere groepen beschikbaar zijn.
- Bij één actief passend dienstverband kiest de server dat dienstverband automatisch.
- Bij meerdere passende dienstverbanden toont de applicatie eerst een dienstverbandkeuze.
- Een leidinggevendeactie vanuit een afdeling mag automatisch kiezen wanneer exact één dienstverband van de medewerker aan de gekozen afdeling/functie gekoppeld is.
- Bij meer dan één match blijft een expliciete keuze verplicht.

Dezelfde keuzeprocedure geldt voor verlofweergave en verlofacties. Het verlofsaldo blijft per dienstverband gescheiden.

## Casus- en periode-integriteit

- `absence_case` heeft exact één `employment_id`.
- `absence_spell` heeft exact één casus en daarmee één dienstverband.
- De vierwekenketen, herstelstatus, casusklok en WvP-relatie worden per dienstverband berekend.
- Een databaseconstraint of RPC mag geen overlap blokkeren op alleen `employee_id`.
- Overlapcontrole moet minimaal de combinatie `employment_id` en de relevante effectieve periode gebruiken.
- Een cross-group persoonskoppeling mag nooit worden gebruikt om verzuim tussen verschillende dienstverbanden te blokkeren.

## Privacy en autorisatie

De toestemming om een verzuimcasus te lezen of te wijzigen blijft beperkt tot de geselecteerde HR-groep, het dienstverband en de bestaande permission-/managementscope. Een foutmelding over een bestaand verzuim in een andere groep mag geen gegevens uit die groep onthullen.

## Testacceptatie

1. Overlap op hetzelfde dienstverband wordt geweigerd.
2. Overlap op twee actieve dienstverbanden van dezelfde persoon wordt geaccepteerd.
3. Parallel verzuim in twee HR-groepen wordt geaccepteerd.
4. Herstel op dienstverband 1 verandert dienstverband 2 niet.
5. Een leidinggevende met één afdeling-match krijgt automatische selectie.
6. Bij meerdere afdeling-matches verschijnt een keuze.
