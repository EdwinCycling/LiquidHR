# ADR-0009 — HR-groepen als zichtbaarheids- en inrichtingsgrens

Status: **GEACCEPTEERD**  
Datum: **2026-08-05**

## Besluit

LiquidHR modelleert binnen één holding/tenant één of meerdere HR-groepen. Een HR-groep is de primaire gebruikerscontext, de zichtbaarheidgrens en de grens voor de operationele HR-inrichting.

Een HR-groep bevat één of meer administraties. Een bestaande administratie kan niet naar een andere HR-groep worden verplaatst. Nieuwe administraties mogen later worden toegevoegd aan een bestaande of nieuwe HR-groep. HR-groepen worden door Edwin via de Control Plane aangemaakt; een HR-admin kan vanuit een geselecteerde HR-groep administraties aanmaken.

Administraties worden niet verwijderd; een latere lifecyclefase mag ze alleen deactiveren. Een HR-groep wordt niet verwijderd zolang er administraties of historische gegevens aan gekoppeld zijn. Samenvoegen of splitsen is geen normale beheeractie en vereist altijd een afzonderlijke migratieprocedure.

De eerdere tenantbrede `SEPARATE`/`COMBINED`-keuze is niet het doelmodel. De HR-admin switcht expliciet tussen HR-groepen. Binnen de geselecteerde groep kan de HR-admin, waar nodig, een administratie kiezen.

## Scopebesluiten

- Bedrijf, locaties, afdelingen, functies, rollen, leidinggevende-toewijzingen, verlofregels en verzuiminstellingen zijn HR-groepgebonden.
- Een persoon bestaat één keer binnen een HR-groep en kan nul of meerdere dienstverbanden hebben.
- Een dienstverband hoort bij precies één administratie, afdeling, functie en vaste CAO.
- Salaris, payroll en administratiegegevens blijven administratiegebonden.
- Verlofsaldo, verlofboekingen en verlofgrootboek blijven dienstverbandgebonden; de regels worden groepsbreed ingericht.
- Een verzuimcasus en ziekteperiode zijn dienstverbandgebonden.
- Verzuim mag gelijktijdig bestaan op verschillende dienstverbanden, ook in verschillende HR-groepen. Alleen overlap binnen hetzelfde dienstverband wordt geblokkeerd.
- Een login kan eventueel toegang tot meerdere HR-groepen hebben. Groepsspecifieke persoonsgegevens en zakelijke e-mailadressen blijven gescheiden.

## Reden

Een klant kan meerdere juridische of organisatorisch afgescheiden entiteiten binnen dezelfde holding hebben. De HR-admin moet daarom per HR-groep kunnen werken zonder gegevens van andere groepen te zien. Tegelijkertijd voorkomen groepsbrede verlof- en organisatie-instellingen onnodig dubbel beheer over meerdere administraties.

De dienstverbandgrens blijft noodzakelijk voor salaris, CAO, verlofsaldo en verzuimregistratie. Vooral verzuim mag niet persoonsbreed worden gemodelleerd: iemand kan bijvoorbeeld voor het dienstverband als portier hersteld zijn gemeld en voor het dienstverband als badmeester gelijktijdig ziek zijn.

## Gevolgen

- Het contextmodel krijgt een HR-groepniveau naast een optionele administratiecontext.
- RLS en foreign keys moeten groepgrenzen afdwingen.
- Het bestaande administratiegebonden bedrijf-/locatiemodel moet worden gemigreerd naar HR-groep-scope.
- Verlofconfiguratie en verzuiminstellingen moeten naar HR-groep-scope.
- Employment-specifieke saldo-, casus- en transactiedata blijft gescheiden.
- De roltoewijzing en afdelingsdropdown moeten groepsgebonden worden.
- De deactiveringsfase en HR-groep-merge/split blijven afzonderlijke vervolgfases.

## Afgewogen alternatief

Een tenantbrede `COMBINED`-modus met collega-deling is verworpen als doelmodel. Die modus maakt de zichtbaarheidgrens afhankelijk van één tenantinstelling en kan niet duidelijk uitdrukken dat twee bedrijven binnen dezelfde holding afzonderlijke HR-entiteiten zijn.
