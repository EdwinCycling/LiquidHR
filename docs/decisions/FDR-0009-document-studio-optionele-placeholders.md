# FDR-0009 — Optionele placeholders in Document Studio

Status: GOEDGEKEURD

Datum: 2026-09-27

## Context

DOC02 vereist dat optionele waarden zonder kapotte rendering kunnen ontbreken. Het canonieke documentmodel kende geen optionaliteitsvlag, waardoor alle bekende, temporele en vrije placeholders als verplicht werden gevalideerd.

## Besluit

- Een placeholder mag `optional: true` bevatten; afwezig of `false` blijft verplicht gedrag.
- Een ontbrekende of lege optionele waarde wordt als lege tekst gerenderd. Een ontbrekende verplichte waarde blijft de generatie blokkeren.
- Een placeholder-key die meerdere keren voorkomt is optioneel als elke occurrence optioneel is. Eén verplichte occurrence maakt de key als geheel verplicht.
- Optioneel wordt per ingevoegde placeholder ingesteld en maakt deel uit van de canonieke documentversie en snapshot.
- Een actieve DOCUMENT-template moet naast een body-regio ook inhoud hebben die daadwerkelijk kan renderen; een lege paragraaf, alleen witruimte of alleen een pagina-einde telt niet als inhoud.

## Gevolgen

- De editor, canonieke validator, placeholdermanifest, resolver, generation UI en databasecanon-validator delen hetzelfde optionele contract.
- Bestaande templates zonder de vlag behouden hun verplichte gedrag.
- Dit besluit wijzigt geen permissions, doelgroep, RLS of documenteigenaarschap.

## Vervangen besluiten

Geen.
