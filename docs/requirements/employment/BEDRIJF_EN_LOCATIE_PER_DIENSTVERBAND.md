# Bedrijf en locaties binnen de HR-groep

> **Actuele scope vanaf 2026-08-05:** bedrijf en locaties zijn HR-groepbreed. Administraties binnen dezelfde HR-groep gebruiken hetzelfde bedrijfsprofiel en dezelfde locatiecatalogus. Alleen de concrete locatieplaatsing van een dienstverband blijft employmentgebonden. De oudere administratiegebonden implementatiebeschrijving hieronder is historische context en wordt vervangen volgens [HR-groepen: scope, inrichting en domeingrenzen](../multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md).

## Status

LEIDEND voor de bedrijf-en-locatiepagina binnen de geselecteerde HR-groep. Bedrijfsgegevens en de locatiecatalogus zijn groepsgebonden; een dienstverband verwijst vanuit zijn organisatieplaatsing naar een locatie binnen dezelfde HR-groep.

## Functionele afspraak

- Een medewerker kan meerdere parallelle dienstverbanden hebben; iedere dienstverbandrelatie kan een eigen effectieve locatieplaatsing hebben.
- De geselecteerde HR-groep levert het bedrijfsprofiel en de locaties. De administratiekeuze bepaalt niet welke locaties bestaan.
- HR kiest per dienstverband een actieve locatie uit een doorzoekbare keuzelijst met uitsluitend locaties uit dezelfde HR-groep.
- Een locatiekeuze heeft alleen een ingangsdatum. Bij een nieuwe ingangsdatum wordt de vorige periode automatisch gesloten op de dag ervoor; gebruikers voeren geen einddatum in.
- Bestaande perioden kunnen worden bekeken en de locatie kan worden gewijzigd. Een nieuwe periode kan alleen aansluiten op een bestaande periode binnen de looptijd van het dienstverband.
- De pagina heet **Bedrijf en locatie** en blijft een zelfstandige tab binnen het dienstverband, zodat later aanvullende bedrijfsinformatie op dezelfde kaart kan worden toegevoegd.

## Technische grenzen

- De doelmodellen voor bedrijf en locaties zijn HR-groepgebonden; de bestaande `administration_company_data` en `administration_locations` worden in de testmigratie naar deze scope gemigreerd.
- De bestaande `employee_organizations.location_id` draagt de locatie mee per effectieve organisatieperiode; de nieuwe RPC beheert de locatie-mutatie atomair en valideert dezelfde HR-groep.
- Lezen en wijzigen vallen onder `organization-placement:read` en `organization-placement:write`; RLS dwingt tenant-, HR-groep- en waar nodig employment-scope af.
- De migratie `20260802210500_manage_employment_company_location.sql` is naar Supabase uitgerold; de mutatieroute moet nog met een geauthenticeerde browsercontrole worden bevestigd.
