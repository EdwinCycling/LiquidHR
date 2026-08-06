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

- De doelmodellen voor bedrijf en locaties zijn HR-groepgebonden. Migration `20260805180000_hr_group_company_administration_locations.sql` heeft `administration_company_data` en `administration_locations` naar deze scope gemigreerd; beide tabellen hebben `hr_group_id` en geen legacy `administration_id`-eigenaarskolom.
- De bestaande `employee_organizations.location_id` draagt de locatie mee per effectieve organisatieperiode; de composite foreign key en de RPC `manage_employment_company_location` valideren tenant en HR-groep samen. Een cross-group locatie wordt geweigerd.
- Lezen en wijzigen vallen onder `organization-placement:read` en `organization-placement:write`; RLS dwingt tenant-, HR-groep- en waar nodig employment-scope af.
- Groepsbrede bedrijf- en locatiegegevens worden beheerd vanuit `/settings/company-data` zonder administratiekeuze. Administratienaam en -nummer worden afzonderlijk beheerd via `/settings/hr-groups`; het interne administratie-ID blijft stabiel en wijzigingen worden geaudit.
- De migrations `20260805180000_hr_group_company_administration_locations.sql`, `20260805182000_hr_group_company_location_privileges.sql`, `20260805183000_hr_group_scope_column_privileges.sql` en de FK-indexhardening zijn lokaal versioneerbaar en remote op het testproject toegepast. De geauthenticeerde browsercontrole bevestigde de groepsswitch, de groepsspecifieke locatiecatalogus en de administratie-wijzigflow.
