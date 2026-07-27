# ADR-0005 — Verzuimcasus per dienstverband met ziekteperioden

Datum: 26 juli 2026  
Status: Goedgekeurd voor implementatie

## Context

De aangeleverde Verzuim-documenten modelleerden persoonsbrede cases met `parentCaseId` en verwezen naar `EmploymentContract`. LiquidHR gebruikt echter `Employee → Employment`, staat parallelle employments toe en heeft effectieve dienstverbandgebonden bronnen. UWV telt ziekteperioden binnen vier weken samen.

## Besluit

LiquidHR modelleert één `absence_case` per `employment_id`. Een casus bevat één of meer `absence_spells`; een nieuwe spell binnen vier weken wordt automatisch aan dezelfde casus toegevoegd. Vanaf vier weken ontstaat een nieuwe casus. De casusstatus, recovery window, sluiting en archivering zijn afzonderlijke lifecycle-aspecten.

## Gevolgen

- Geen `parentCaseId`-boom.
- Geen medische oorzaakvraag of oorzaakveld.
- Verzuimmutaties zijn altijd per employment.
- De WvP-klok wordt afgeleid uit spells en herstelgaten.
- De engine is de enige schrijfweg voor cases, spells en capaciteitswijzigingen.
