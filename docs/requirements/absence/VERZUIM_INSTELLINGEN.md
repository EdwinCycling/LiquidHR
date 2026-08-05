# Verzuiminstellingen

> **Actuele scope vanaf 2026-08-05:** deze instellingen worden op HR-groepniveau beheerd. De verzuimcasus zelf blijft aan één dienstverband gekoppeld. Parallel verzuim op verschillende dienstverbanden of HR-groepen is toegestaan; alleen overlap binnen hetzelfde dienstverband wordt geblokkeerd. Zie [HR-groepen: scope, inrichting en domeingrenzen](../multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md).

Status: **LEIDEND — slice A in uitvoering**.

## 1. Context

Alle instellingen zijn gekoppeld aan de actieve `hr_group_id`. Een HR-groepwissel en een eventuele administratiecontext worden uitsluitend uit de sessie afgeleid.

## 2. Slice A

HR Admin beheert:

- drempel frequent verzuim, standaard `3`, bereik `1..20`;
- standaardcasemanager als actieve LiquidHR-medewerker met passende casustoegang.

Een casemanager buiten het bestaande user-/accessmodel kan nog niet worden gekozen.

## 3. Slice B

HR Admin beheert actieve/inactieve contacttypen en niet-medische verzuimdocumentcategorieën. Systeemcodes blijven immutable; historische verwijzingen worden niet verbroken door verwijderen.

Er is geen encryptieschakelaar. Opslag is private en downloads lopen via korte signed URLs na autorisatie.

## 4. Slice C

HR Admin kan eigen WvP-taken toevoegen en de wettelijke set alleen inzien. De wettelijke set heeft een versie, bron en geldigheidsperiode. De exacte bewaartermijn, vernietiging en anonimisering worden niet als vrij getal ingesteld; daarvoor komt eerst een juridische bewaarmatrix.
