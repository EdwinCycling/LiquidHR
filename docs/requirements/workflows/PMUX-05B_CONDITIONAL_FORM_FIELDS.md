# PMUX-05B — Conditionele formuliervelden

Status: lokale servercontract-kandidaat GREEN; live rol- en releaseacceptatie OPEN

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
| Serverconceptsave en actieve antwoordset | **ECHT CONTRACTGAT vóór deze run:** concept-save valideerde de verplichte projectie voordat gewijzigde bronwaarden die projectie konden activeren; verborgen oude antwoorden bleven actief in new_values. | **LOKAAL OPGELOST:** draft-save staat onvolledige verplichte invoer toe binnen type-/veld-/rechtencontroles; definitieve acties valideren de actuele zichtbare projectie; verborgen antwoorden worden uit actieve waarden verwijderd en blijven alleen in immutable revisiehistorie. |

## Regelbouwer en rechten

- Kies een veld dat voor alle deelnemers die het doelveld kunnen zien, zelf zichtbaar en beschikbaar is. Een conditioneel verborgen bronveld, ontbrekende deelnemerstoegang of afhankelijkheid die een cyclus maakt, wordt niet aangeboden; de compiler blijft de definitieve controle.
- De gedeelde builder toont vergelijkingen per veldtype. Tekst, getal, geld, datum/tijd, boolean en enkele keuze ondersteunen hun bestaande scalaire operators. Multi-select en verwijzingsvelden bieden alleen leeg/niet-leeg, conform de serverevaluator.
- Conditionele invulplicht bewaart het bestaande schrijfrecht maar slaat `WRITE_REQUIRED` op als `WRITE_OPTIONAL` met `requiredCondition`; dit volgt de bestaande SQL-helper. Manager/HR met `READ` of `HIDDEN` krijgen daardoor geen schrijfrecht of invulplicht.
- Preview gebruikt de bestaande TypeScript `evaluateCondition`, uitsluitend lokale voorbeeldwaarden, en wist voorbeeldwaarden zodra hun veld verborgen raakt. Preview-aanpassingen worden niet verzonden.
- Autosave, draft revisions, compilerfeedback en immutable publicatie blijven bestaande studio-/runtimeverantwoordelijkheden.

## Servercontract en resterende acceptatie

De bestaande server-RPC blokkeerde een draft-save wanneer gewijzigde bronwaarden een nog niet geprojecteerd veld verplicht maakten. Forward-only migratie 20261022203000_pmux05_form_condition_draft_save.sql corrigeert de savevolgorde en laat onvolledige draft-invoer toe. Ongeldige niet-lege typen, onbekende velden, verborgen velden, read-only velden en participant-/tenantcontroles blijven actief.

Definitief indienen en goedkeuren gebruiken de bestaande conditie-evaluator en controleren alle op dat moment zichtbare, bewerkbare, verplichte velden. De projectie en runtimevelden gebruiken dezelfde gefilterde antwoordset als validatie.

Als een veld verborgen raakt, verwijdert de RPC de vorige waarde uit de actieve new_values-set. De waarde blijft alleen in append-only response-revisiehistorie als auditprovenance; de bestaande RLS-policy en privileges weigeren directe authenticated SELECT. Er komt geen nieuwe historische leesroute bij. Ze wordt niet opnieuw geprojecteerd of gebruikt voor een latere procesbeslissing; wanneer de voorwaarde later weer waar wordt, moet het veld opnieuw worden ingevuld.

De PGlite-contracttest voert de bestaande runtime-, evaluator-, projection-, response-save- en prepare-actionfuncties plus de nieuwe migratie uit. Dit is lokale SQL-evidence, geen bewijs van remote Supabase-functie-eigenaarschap, live JWT/RLS, echte actorrechten of browseracceptatie. Migratie is lokaal en niet toegepast. Fijnmazige rechten per stap/deelnemer blijven buiten deze slice.

Zie [PMUX-05 servercontract acceptance](../../quality/acceptance/runs/PMUX-05-SERVER-CONTRACT-20261022-LOCAL.md) en de actuele [AA-OPEN](../../AA/AA-OPEN.md).
