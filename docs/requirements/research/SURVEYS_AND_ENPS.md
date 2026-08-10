# Surveys en eNPS

Status: leidend voor de eerste verticale slice.

## Doel

LiquidHR ondersteunt twee afzonderlijk activeerbare modules binnen de actieve HR-groep:

- **Surveys** voor flexibele medewerkersvragen met tekst-, keuze-, getal-, datum- en matrixvragen.
- **eNPS** voor anonieme pulse-metingen met de verplichte aanbevelingsvraag en een vaste vragenbank van 150 vragen in 15 categorieën.

## Rollen en rechten

| Rolcontext | Pagina's | Widgets | Rechten |
| --- | --- | --- | --- |
| Medewerker met medewerkerscontext | Onderzoekshub en eigen uitnodigingen | Openstaande onderzoeken | `self:research:respond` |
| HR-admin | Onderzoekshub, instellingen, campagnebouwers, monitor en resultaten | Onderzoeksmonitor | `research:read`, `research:write`, `research-result:read` |
| Leidinggevende zonder expliciete onderzoeksrechten | Geen beheer of resultaten | Geen onderzoekswidget | Geen |

Autorisatie wordt zowel server-side als via RLS afgedwongen. Modulecodes `SURVEYS` en `ENPS` bepalen welke campagnevormen beschikbaar zijn.

## Campagneverloop

1. HR maakt een concept aan voor één HR-groep en kiest periode en doelgroep.
2. Bij activeren wordt de doelgroep server-side opgelost en krijgt iedere medewerker één uitnodiging.
3. De medewerker ziet alleen eigen uitnodigingen en kan één keer indienen tijdens de actieve periode.
4. HR volgt deelname, verstuurt een herinneringssignaal en sluit de campagne.
5. HR met resultaatrecht bekijkt aggregaties; surveyresultaten zijn exporteerbaar als CSV.

## Privacy

- Een anonieme survey schrijft geen medewerker-ID naar de respons.
- Een eNPS-respons bevat nooit een gebruiker-, medewerker-, e-mail-, IP- of apparaatveld.
- Bij eNPS wordt uitsluitend deelname op de uitnodiging vastgelegd; het tijdstip van indienen wordt daar niet opgeslagen.
- eNPS-resultaten, drivers en opmerkingen zijn pas zichtbaar vanaf vijf responsen.
- De monitor toont deelname per uitgenodigde medewerker, maar koppelt een anonieme respons nooit aan een persoon.

## Validatie

- Einddatum ligt na de startdatum.
- Een gerichte doelgroep heeft minimaal één selectie en geen duplicaten.
- Een survey bevat minimaal één valide vraag; keuzevragen hebben minimaal twee opties en matrices minimaal één rij.
- Een eNPS-campagne bevat precies één verplichte vraag op positie 1, met type `SCALE_10`.
- Een uitnodiging kan maximaal één keer worden ingediend.

## Open voor de volledige productgate

- E-mailbezorging en geplande achtergrondtaken voor automatische eNPS-herinneringen; de huidige handmatige herinnering is een zichtbaar in-app signaal.
- Concepten wijzigen nadat ze zijn geactiveerd.
- Resultaten segmenteren op kleine groepen; dit vereist een afzonderlijk privacybesluit.
- Authenticated drie-rollen-browserbewijs op de samengevoegde `main`-versie.
