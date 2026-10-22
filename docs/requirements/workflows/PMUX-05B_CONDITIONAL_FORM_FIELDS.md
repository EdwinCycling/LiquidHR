# PMUX-05B — Conditionele formuliervelden

Status: lokale UX-kandidaat; serveracceptatie **OPEN**

Datum: 2026-10-22

## Doel

HR Admin configureert in de bestaande Formulierenstudio, per veld, wanneer het zichtbaar is en wanneer het verplicht is. De instelling blijft onderdeel van de bestaande versieerbare formulierdefinitie.

## Bestaande contracten en capabilitymatrix

| Onderdeel | Vóór PMUX-05B | Na PMUX-05B |
| --- | --- | --- |
| Conditiecontract | **BESTAAND:** `FieldDefinition.visibilityCondition` en `requiredCondition` gebruiken `ConditionNode`. | Ongewijzigd gebruikt; geen nieuw schema. |
| Evaluator en compiler | **BESTAAND:** getypeerde evaluatie, veldverwijzing, typecontrole en cyclusdetectie. Ontbrak: expliciete afwijzing van conditioneel verborgen bronvelden en conditionele invulplicht met `WRITE_REQUIRED`. | Compiler geeft daarvoor concrete issues; onbekende/verwijderde velden, onverenigbare typen, verborgen bronnen en cycli blijven fouten. |
| Serverprojectie en validatie | **BESTAAND:** SQL projecteert zichtbare velden en `required`; response-save controleert toegang, zichtbaarheid, type en verplichte waarden met de bestaande condition-functies. | Ongewijzigde serverruntime hergebruikt; de contractgaten hieronder verhinderen volledige live acceptatie. |
| FormRuntimeRenderer | **BESTAAND:** rendert de serverprojectie, autosavet en ververst na een succesvolle save de projectie; de API/RPC valideert opnieuw server-side. | Ongewijzigd gebruikt; geen client-side autorisatie of tweede runtime-evaluator. |
| Formulierenstudio | **UX-GAT:** bestaande veldtoegang en statische preview, zonder bruikbare editor voor zichtbaarheid/conditionele invulplicht. | Veldniveau-keuzes voor altijd zichtbaar/zichtbaar bij regel en niet verplicht/altijd verplicht/voorwaardelijk verplicht; menselijke regeltekst, directe foutfeedback en synthetische interactieve preview. |
| PMUX-05A-regelbouwer | **BESTAAND:** visuele regelbouwer voor procesroutes, nog lokaal in de route-editor. | Gedeelde `ConditionRuleBuilder` voor route- en veldcondities; geen tweede builder/evaluator. |
| Echt contractgat | Conditionele form/save-semantiek had geen betrouwbare wijzigings- en opslagvolgorde voor de bestaande autosave. | Blijft **OPEN**: server valideert verplichting tijdens elke save vóór de nieuwe zichtbare projectie en bewaart verborgen oude waarden in de samengevoegde `new_values`. |

## Regelbouwer en rechten

- Kies een veld dat voor alle deelnemers die het doelveld kunnen zien, zelf zichtbaar en beschikbaar is. Een conditioneel verborgen bronveld, ontbrekende deelnemerstoegang of afhankelijkheid die een cyclus maakt, wordt niet aangeboden; de compiler blijft de definitieve controle.
- De gedeelde builder toont vergelijkingen per veldtype. Tekst, getal, geld, datum/tijd, boolean en enkele keuze ondersteunen hun bestaande scalaire operators. Multi-select en verwijzingsvelden bieden alleen leeg/niet-leeg, conform de serverevaluator.
- Conditionele invulplicht bewaart het bestaande schrijfrecht maar slaat `WRITE_REQUIRED` op als `WRITE_OPTIONAL` met `requiredCondition`; dit volgt de bestaande SQL-helper. Manager/HR met `READ` of `HIDDEN` krijgen daardoor geen schrijfrecht of invulplicht.
- Preview gebruikt de bestaande TypeScript `evaluateCondition`, uitsluitend lokale voorbeeldwaarden, en wist voorbeeldwaarden zodra hun veld verborgen raakt. Preview-aanpassingen worden niet verzonden.
- Autosave, draft revisions, compilerfeedback en immutable publicatie blijven bestaande studio-/runtimeverantwoordelijkheden.

## Servercontractgaten en afsluiting

De huidige `save_process_form_response_with_bindings`-route wordt bij wijzigingen door de bestaande autosave gebruikt. De functie controleert de verplichte zichtbare velden op de samengevoegde antwoordwaarden en geeft pas daarna de nieuwe projectie terug. Als een bronwaarde een voorheen verborgen veld conditioneel verplicht maakt, ziet de deelnemer dat veld dus nog niet en kan de save van de bronwaarde worden geweigerd als `REQUIRED_FORM_FIELD`. De huidige renderer kan dat veld niet eerder tonen, omdat de conditie- en versieprojectie server-side wordt aangeleverd.

Bij verbergen slaat de RPC `existing_new || incoming_new` op. De projectie laat verborgen velden weg, maar de opgeslagen oude waarde wordt niet verwijderd; als de veldconditie later weer waar wordt, kan die waarde opnieuw zichtbaar worden. Dit voldoet niet aan de eis om verborgen waarden bij indienen niet te bewaren.

Sluit dit alleen met een afzonderlijk toegestane forward-only SQL-contractwijziging en PGlite/SQL-proeven voor autosave, finale validatie, verborgen-waarde-purge en dezelfde participantrechten. PMUX-05B bevat geen migratie of live DB-write. Tot dat bewijs is de status **PARTIAL** en blijft live acceptatie **OPEN**.

Lokale code- en gate-evidence: [PMUX-05B local acceptance](../../quality/acceptance/runs/PMUX-05B-20261022-LOCAL.md).
