# Verzuiminstellingen

Status: **LEIDEND — slice A in uitvoering**.

## 1. Context

Alle instellingen zijn gekoppeld aan de actieve `administration_id`. Een tenantwissel of administratiecontext wordt uitsluitend uit de sessie afgeleid.

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
