# FDR-0007: Teamkompas privacy en interpretatie

**Status:** VASTGESTELD VOOR DE EERSTE SLICE
**Datum:** 2026-08-10
**Gerelateerd:** `docs/requirements/team-compass/TEAM_COMPASS.md`, ADR-0007 en FDR-0003

## Besluit

1. Teamkompas gebruikt de productnaam **Teamkompas** en vier samenwerkingsdimensies. De applicatie claimt niet dat de vragenlijst een gevalideerde Jung-, DISC-, MBTI- of klinische test is.
2. De volledige individuele uitkomst is van de medewerker. HR Admin en manager hebben zonder toestemming geen individuele score- of antwoordinzage.
3. Delen is opt-in en gesplitst: Outer mag afzonderlijk worden gedeeld; Inner vereist daarnaast expliciete Inner-toestemming.
4. Teamaggregaten en named teamborden verschijnen pas vanaf minimaal vijf voltooide deelnames binnen de concrete projectiescope. De campagne mag een hogere, nooit lagere drempel kiezen.
5. Ruwe antwoorden worden niet geëxporteerd, niet in audit gekopieerd en niet gebruikt voor ranking of automatische HR-besluiten.
6. Een hoge shift is uitsluitend een uitnodiging tot reflectie. De UI gebruikt geen diagnose, risico- of geschiktheidslabel.
7. Inzichten zijn volledig deterministisch en herleidbaar naar de vastgelegde vragenlijst- en scoreversie. Er wordt geen AI gebruikt.

## Gevolgen

- De database scheidt antwoorddata, profielresultaat, deelnamevoortgang en deeltoestemming.
- HR- en managerprojecties lopen via een afgeschermde databasefunctie die de HR-groep, permission, managerscope, toestemming en drempel opnieuw controleert.
- Onder de drempel blijft alleen campagnevoortgang zichtbaar.
- Een toekomstige uitbreiding naar normering, exports, teamvergelijking, automatische adviezen of inzet in formele besluitvorming vereist een nieuw functioneel besluit.
