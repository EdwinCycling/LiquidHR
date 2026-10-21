# PMUX-03C — Productbrede UX-afwerking van P-mutaties

## Doel en grens

Maak de bestaande Process Automation-schermen één begrijpelijke gebruikerservaring voor HR Admin, medewerker, manager en HR. Gebruik de Processtudio, Formulierenstudio, `/work`, Focus en dashboardprojecties die al bestaan. Voeg geen nieuw portaal, procesengine, routefamilie, databasecontract of parallelle status toe.

## Functionele eisen

- HR Admin kan bestaande processtappen toevoegen, bewerken, selecteren, ordenen en na bevestiging verwijderen. Verwijderen haalt de inkomende en uitgaande routes weg, corrigeert de startstap als die is verwijderd en laat de bestaande compiler resterende ongeldige routes aanwijzen.
- Rol, formulier, route en technische sleutel behouden hun bestaande typed contract. De normale stapbediening gebruikt gewone taal; technische gegevens staan onder Geavanceerd.
- Focus **Mijn aanvragen** toont de link naar de catalogus in `/work?view=REQUESTS` alleen wanneer de bestaande servergefilterde catalogus een startbaar proces teruggeeft en Focus niet read-only is; er ontstaat geen tweede catalogus. De startservice controleert bevoegdheid opnieuw. Procesdetails die vanuit Focus worden geopend, keren terug naar dezelfde Focus-context. Alleen vooraf vastgelegde Focus-contexten zijn geldig; een queryparameter kan geen willekeurige redirect bepalen.
- Focus toont afzonderlijke, begrijpelijke statussen voor aanvullen gevraagd, afgewezen, geannuleerd, geblokkeerd, verlopen, afgerond en wachten. Datumweergave volgt NL/EN.
- Managerwerk in Focus houdt zijn bestaande scope en gebruikt dezelfde generieke details. De nieuwe-aanvraagknop staat alleen in Mijn aanvragen.
- De dashboardprojectie blijft de bestaande geautoriseerde `ProcessWorkWindow` met open taken, verval-/blokkadesignalen en links naar de bestaande taakdetails.
- Op mobiel blijven de stappenlijst, bevestiging en acties met toetsenbord en schermlezer bedienbaar; Focus-kaarten en aanvraagcatalogus passen in het bestaande responsive Foundation-patroon.

## Bewuste capabilitygrenzen

- Formuliervelden en roltoegang gebruiken de bestaande definitie. Veldrechten zijn per deelnemer, niet per combinatie van stap en deelnemer. PMUX-03C introduceert geen fijnmaziger autorisatie.
- Dynamische voorwaarden voor zichtbaarheid/verplicht invullen en vrij instelbare assignment selectors, deadlines en herinneringen zijn geen complete HR Admin-configuratie in deze slice. Als daarvoor een nieuw backend-, schema- of securitycontract nodig is, blijft die mogelijkheid uitgeschakeld tot een afzonderlijke goedgekeurde requirement en gate.
- De Opleidingsaanvraag is een studio-voorbeeld. PMUX-03C publiceert of seedt geen procesdefinitie en maakt geen aanvraag aan.
- PMUX-03A-catalogus- en PMUX-03B-historieprojecties blijven LOCAL ONLY totdat voor PMUX-04 afzonderlijke databaseautorisatie is gegeven.

## Verificatiecontract

Voer voor iedere aangepaste route de zes gebruikersvragen uit: locatie/volgende actie, visuele rust, logica van bediening en status, zelfstandige afronding, desktop/390px en correcte rechten. Component-/contracttests bewijzen codepaden; alleen een geauthenticeerde browserrun met rol- en scopetests bewijst echte UI-/autorisatieacceptatie. Zie [PMUX-03C lokale acceptatie en PMUX-04-plan](../../quality/acceptance/runs/PMUX-03C-20261021-LOCAL.md).
