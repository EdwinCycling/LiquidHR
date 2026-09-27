# FDR-0010 — Verzuim-KPI-eenheden en periodebetekenis

Status: vastgesteld voor ABS02 op 2026-09-27
Scope: verzuimrapportage, Bradford, frequente afwezigheid en de WvP-foundation

## Besluit

LiquidHR gebruikt drie verschillende eenheden bewust naast elkaar. Een rapport mag ze niet als synoniemen presenteren of verwisselen:

| Eenheid | Canonieke bron | Betekenis | Gebruik |
| --- | --- | --- | --- |
| Casus | `absence_cases` | De juridische/operationele verzuimketen met één eerste ziektedag, status en effectieve WvP-klok per dienstverband | `caseCount`, actieve casussen, frequentie en dossiercontext |
| Ziekteperiode | `absence_spells` | Eén afzonderlijke aaneengesloten of opnieuw geopende periode binnen een casus | `absenceOccurrences` en Bradford-factor `S` |
| Herstelvenster | `absence_cases.status = RECOVERY_WINDOW` plus `recovery_window_ends_on` | Een tijdelijke lifecycle-status na herstel; het is geen extra ziekteperiode | zichtbaarheid en automatische sluiting van de casus |

Een casus kan dus meerdere ziekteperioden bevatten. `caseCount` telt casussen; `absenceOccurrences` telt ziekteperioden. Een Bradford-score gebruikt uitsluitend ziekteperioden als `S` en roostergewogen verzuimdagen als `D`, volgens `S² × D`. Het rapport toont de gebruikte naam en eenheid in scherm en export.

## Aggregatie over meerdere dienstverbanden

Wanneer dezelfde medewerker meerdere in-scope dienstverbanden heeft, worden eerst alle employment-fragmenten op medewerker samengevoegd en pas daarna de medewerker-KPI berekend:

- `availableHours`, `availableDays`, `sickHours` en `sickDays` worden opgeteld;
- `absenceRate = sickHours / availableHours × 100` gebruikt die gecombineerde noemer;
- casus- en ziekteperiode-identifiers worden gededupliceerd voor de telling;
- de laatste eerste ziektedatum bepaalt de getoonde actuele status bij één medewerkerregel;
- een afdelingsfilter beperkt eerst de employmentscope; de uitkomst mag daarna niet terugvallen op de laatste employment.

Een medewerker met 24 zieke uren en 16 beschikbare uren uit een tweede dienstverband heeft daarom een percentage van `24 / (24 + 16) = 60%`, niet 100%.

## Periode- en klokregels

- Verzuimpercentage en uren zijn measurement-KPI’s binnen de gekozen rapportperiode en gebruiken alleen bevestigde, niet-gearchiveerde casussen.
- De eerste ziektedag en de ziekteperioden worden niet automatisch gelijkgesteld aan het aantal kalenderdagen in de rapportperiode.
- De WvP-foundation gebruikt `effective_clock_start_on`; herstelgaten verschuiven de klok volgens het bestaande verzuimengine-contract.
- Een herstelvenster sluit deterministisch wanneer `recovery_window_ends_on <= current_date`; daarbij wordt `closed_at` gevuld als die nog ontbreekt. De normalisatie gebeurt via een canonical server-side RPC vóór relevante reads/writes.

## WvP-foundation

WvP-mijlpalen zijn versioned, neutrale `STATUTORY_CANDIDATE`- of `REVIEW`-taken in `absence_tasks`. De foundation maakt geen juridische conclusie en bevat geen medische oorzaak. Iedere taak heeft `human_confirmation_required = true`; de operationele voltooiing gebeurt via de server-side completion-RPC. Generatie is idempotent per casus/mijlpaal en mag geen directe clientinsert of -update gebruiken.

## Gevolgen

- Rapportservices, Bradford, frequente afwezigheid, UI en Excel-export behouden hun eigen contractuele veldnamen en gebruiken de juiste eenheid.
- Nieuwe rapportage moet expliciet aangeven of een getal een casus, ziekteperiode, dag, uur of percentage is.
- Een wijziging van deze definities vereist een nieuw FDR of een expliciete herziening van dit besluit; een lokale UI-labelwijziging mag de eenheid niet stilzwijgend veranderen.
