# Medewerkerarchief, foto en kaartnavigatie

## Status

LEIDEND voor de aanvullende medewerkerkaartfunctionaliteit van 2026-07-18.

## Functionele afspraken

- Een medewerker heeft naast de bestaande soft-delete een onafhankelijke, reversible `is_archived`-vlag.
- De medewerkerslijst filtert expliciet op niet-gearchiveerd, gearchiveerd of alle medewerkers. Andere lijstfilters werken binnen die selectie.
- Organogram, kalender en andere operationele medewerkerselecties tonen standaard alleen niet-gearchiveerde medewerkers.
- De HR-beheerder kan archiveren en terugzetten via een bevestigingsdialoog; beide acties worden geaudit.
- Een medewerkerfoto wordt private opgeslagen, is uploadbaar/vervangbaar/verwijderbaar en verschijnt in de medewerkerslijst, medewerkerkaart, kalender en dienstverbanddetailkaart.
- De medewerkerkaart heeft duidelijke hoofdtabbladen voor persoonsgegevens, dossier en dienstverbanden. Dienstverbanden worden als effective-dated tijdlijn weergegeven; contracttypen hebben Nederlandstalige labels.
- Organogramfilters zijn standaard ingeklapt en bewaren de laatste selectie per gebruiker.

## Autorisatie en data

Server-side permissions en RLS blijven leidend. Foto-opslag gebruikt een private Supabase Storage-bucket met tenant- en medewerkerpad; de avatarroute controleert `employee:read` of `employee:write`.
