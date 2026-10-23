# PMUX-05A — Bruikbare conditionele procesroutes

Status: lokaal geïmplementeerd; browser-/persistente readback blijft open

Datum: 2026-10-22

## Doel

Een HR Admin kan in de bestaande Processtudio een eenvoudige voorwaarde maken voor een bestaande procesactie. De voorwaarde heeft een duidelijke ja-bestemming en een anders-bestemming. De procesdefinitie blijft het bestaande versieerbare contract gebruiken.

## Contract en gebruikersgedrag

- Gebruik `ProcessTransition.condition` en het bestaande `ConditionNode`-schema. Maak geen tweede evaluator, routing-engine, schema of migratie.
- Kies een bestaand scalair formulierveld, een vergelijking die bij het veldtype past, een geldige waarde en beide bestaande vervolgstappen.
- De eenvoudige editor ondersteunt tekst, integer, decimal, geld, datum, tijd, datum/tijd, boolean en enkele keuze. Meerdere keuzes en verwijzingsvelden zijn niet als vrije-tekstregel te configureren.
- Bewaar een ja/nee-regel als twee bestaande overgangen met dezelfde actie: `C` en `not(C)`. Daardoor blijft de overgangsselector exclusief: geen match en meerdere matches blijven fouten.
- Een lege vergelijkingwaarde is ongeldig. Een leeg procesveld bij `greaterThan` is onwaar; de complementaire route is dan waar, overeenkomstig de bestaande evaluator.
- Toon namen van velden en stappen. Laat compilerfeedback bestaande veld- en stapverwijzingen valideren.
- De write-free Procesproef gebruikt synthetische veldwaarden en het bestaande TypeScript-condition-evaluatorcontract. De daadwerkelijke werkitemactie blijft bij de bestaande server-/SQL-runtime.
- Autosave bewaart het bestaande draftcontract; publiceren blijft een expliciete HR Admin-handeling. Gepubliceerde versies blijven immutable.

## Acceptatie

1. Stel voor een Opleidingsaanvraag in dat `Wat zijn de verwachte kosten?` hoger zijn dan EUR 1.000.
2. Kies de HR-beoordelingsstap als ja-bestemming en de bestaande normale stap als anders-bestemming.
3. Controleer de Procesproef met EUR 750, EUR 1.000, EUR 1.250 en een lege waarde.
4. De compiler weigert een verwijderd veld of een ontbrekende bestemming. Een waarde van het verkeerde type wordt als blokkade gemeld.
5. Save/reopen behoudt de conditionele overgangen in dezelfde versieerbare draft; de gecompileerde inhoud blijft immutable.
6. De bestaande server-runtime selecteert de enige passende overgang op basis van actie en voorwaarde en weigert nul of meerdere matches.
7. Er wordt geen echte aanvraag gestart, geen proces gepubliceerd en geen Supabase-write uitgevoerd.

Lokale implementatie- en gate-evidence: [PMUX-05A local acceptance](../../quality/acceptance/runs/PMUX-05A-20261022-LOCAL.md).
