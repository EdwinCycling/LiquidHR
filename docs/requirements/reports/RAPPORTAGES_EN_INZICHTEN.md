# Rapportages en Inzichten

Status: **LEIDEND**  
Implementatie: **GEDEELTELIJK**  
Versie: `2026-07-24`

## Doel

`/insights` is de centrale rapportagecatalogus van Liquid HR. De pagina staat in de hoofdnavigatie onder **Kalender** en boven **Instellingen**. De gebruiker opent een rapport in dezelfde pagina als harmonica-item. De catalogus toont nooit fictieve cijfers of filteropties: brondata, resultaten en exports zijn altijd geautoriseerd en administratiegebonden.

## Catalogus, indeling en status

De catalogus groepeert rapporten in vier vaste secties: **Medewerkers**, **Verlof**, **Verzuim** en **Overige rapportages**. Alleen een rapport zonder aangesloten bron draagt de badge **Wordt later gedaan**.

| Rapport | Status |
|---|---|
| Personeel per afdeling | Live medewerkerprojectie, visuele verdeling en detailtabel. |
| Personeel per geslacht | Live medewerkerprojectie; privacydrempel blijft vervolgwerk. |
| Personeel per leeftijd | Live medewerkerprojectie; privacydrempel blijft vervolgwerk. |
| Reden uit dienst | Live termination-projectie. |
| Verlof in beeld | Wordt later gedaan; geaggregeerde bron volgt. |
| Verzuim | Wordt later gedaan; verzuimbron ontbreekt. |
| Balansvoorziening verlof | Wordt later gedaan; waarderingsprojectie ontbreekt. |
| WvP-voortgang | Wordt later gedaan; workflow ontbreekt. |

## Interactie, voorkeuren en URL-state

- De gekozen rapportage is deelbaar via `?report=<code>`.
- Ieder rapport heeft een eigen filterset. Medewerkerrapporten gebruiken afzonderlijke team- en segmentfilters; entiteiten worden niet in een generiek medewerkerfilter samengevoegd.
- De periodekiezer ondersteunt maand, jaar, Vandaag en Volledig jaar tonen. Filters en sortering synchroniseren naar URL-state.
- Bij het openen rolt de pagina vloeiend naar de bovenkant van het harmonica-item. URL-mutaties veroorzaken geen tweede scrollbeweging.
- De actieve-selectiekaart is inklapbaar. Die voorkeur wordt persoonlijk bewaard in `user_preferences.ui_state.insights`.
- De optie **Bewaar filterwijzigingen** bewaart de filters per rapport. Zonder de optie zijn wijzigingen tijdelijk; een volgend bezoek gebruikt de eerder bewaarde selectie of de rapportstandaard.

## Visualisatie en toegankelijkheid

- Beschikbare rapporten combineren gekleurde KPI's, verdeling en compacte tabel; kleur is nooit het enige onderscheid.
- Grafieken hebben een zichtbare legenda/tekstueel alternatief en de detailtabel blijft beschikbaar.
- Toetsenbordbediening, zichtbare focus en mobiele stapeling zijn vereist.
- Geaggregeerde uitsplitsingen voor gevoelige kenmerken krijgen een privacydrempel voordat zij productiegereed zijn.

## Autorisatie, data en export

- Ieder catalogusitem heeft een zelfstandig canoniek functiepunt: `report-employee-department:read`, `report-employee-gender:read`, `report-employee-age:read`, `report-terminations:read`, `report-leave:read`, `report-absence:read`, `report-leave-provision:read` of `report-wvp:read`.
- `TENANT_ADMIN` en `HR_ADMIN` ontvangen alle rapportrechten standaard. De rechtenmatrix kan ieder rapport vervolgens afzonderlijk aan een rol toewijzen; de rapportteller toont alleen het aantal toegestane rapporten.
- De rapportservice vereist zowel het rapportrecht als het onderliggende bronrecht. Iedere query en export blijft RLS-gebonden, met tenant, administratie en managementscope uit de sessie.
- Beschikbare medewerkersrapporten bieden per geopend harmonica-item CSV-export. De download loopt opnieuw via dezelfde geautoriseerde serverroute en neemt exact de actieve URL-filters mee.
- Excel/PDF en immutable exportaudit zijn vervolgwerk.

## Volgende verticale slices

1. Pas de permissionmigratie toe en controleer de rechtenmatrix met een HR-admin en een beperkte rol.
2. Bouw de geaggregeerde verlofprojectie per `employment_id`, inclusief privacydrempel, RLS- en negatieve isolatietests.
3. Voeg Excel/PDF-export en immutable exportaudit toe.
4. Werk verzuim, voorziening en WvP afzonderlijk uit met requirement, schema, API, UI en tests.
