# Bedrijf en locatie per dienstverband

## Status

LEIDEND voor de bedrijf-en-locatiepagina binnen een dienstverband. De bestaande bedrijfsgegevens- en locatiemodellen blijven de bron voor administratiegebonden bedrijfsdata.

## Functionele afspraak

- Een medewerker kan meerdere parallelle dienstverbanden hebben; iedere dienstverbandrelatie krijgt een eigen bedrijf-en-locatiehistorie.
- Wanneer de administratie geen afzonderlijke locaties heeft ingericht, werkt de medewerker op het bedrijfsadres. De dienstverbandpagina toont de bedrijfsnaam en het bedrijfsadres als alleen-lezen kaart.
- Wanneer de administratie wel locaties heeft ingericht, kiest HR per dienstverband een actieve locatie uit een doorzoekbare keuzelijst.
- Een locatiekeuze heeft alleen een ingangsdatum. Bij een nieuwe ingangsdatum wordt de vorige periode automatisch gesloten op de dag ervoor; gebruikers voeren geen einddatum in.
- Bestaande perioden kunnen worden bekeken en de locatie kan worden gewijzigd. Een nieuwe periode kan alleen aansluiten op een bestaande periode binnen de looptijd van het dienstverband.
- De pagina heet **Bedrijf en locatie** en blijft een zelfstandige tab binnen het dienstverband, zodat later aanvullende bedrijfsinformatie op dezelfde kaart kan worden toegevoegd.

## Technische grenzen

- De bestaande administratiegebonden `administration_company_data` en `administration_locations` blijven leidend.
- De bestaande `employee_organizations.location_id` draagt de locatie mee per effectieve organisatieperiode; de nieuwe RPC beheert de locatie-mutatie atomair en bewaart locatie bij een organisatie-opvolger.
- Lezen en wijzigen vallen onder `organization-placement:read` en `organization-placement:write`; RLS blijft de administratie- en tenantscope afdwingen.
- De lokale migratie `20260802210500_manage_employment_company_location.sql` moet nog expliciet naar Supabase worden uitgerold voordat de mutatieroute live kan worden gebruikt.
