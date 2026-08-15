# LiquidHR — Salaris Insights
## UX Reference — Fase 3 — v1

**Primaire bestaande referentie:** `Inzichten → Medewerkers → Personeel per leeftijd`

> Dit document beschrijft hoe Salary Insights visueel en interactief moet aansluiten op de bestaande LiquidHR Insights-ervaring. De huidige implementatie van `Personeel per leeftijd` is de primaire component- en interaction-reference. Hergebruik bestaande componenten waar mogelijk.

---

# 1. Referentieprincipes

Gebruik uit `Personeel per leeftijd`:

- accordion/report shell;
- icon + title + subtitle;
- chevron open/close;
- filter card;
- label boven elk filter;
- searchable multi-select;
- `Selecteer alles`;
- single-select met actieve checkmark;
- `Geautoriseerde data`;
- KPI cards;
- visualization card;
- detail table;
- right-side `Actieve selectie`;
- export action;
- bestaande spacing/tokens/radius/borders;
- responsive behavior.

Niet overnemen:

- leeftijdslogica;
- maand/periode-range;
- `Volledig jaar tonen`;
- 3/5-year controls;
- trendanalytics;
- leeftijdsbuckets/kolommen.

---

# 2. Report shell

Iedere Salary report card gebruikt dezelfde hiërarchie:

1. icon badge;
2. title;
3. subtitle;
4. collapse/expand chevron;
5. filter card;
6. results area.

Gebruik de bestaande Insights shell/component als die beschikbaar is.

---

# 3. Filter card

Desktop:
- filters in één of meer nette horizontale rows;
- vergelijkbare control height als reference;
- labels boven controls volgens bestaand patroon.

Mobile:
- controls stapelen;
- full-width waar nodig;
- geen clipped popovers.

Toon niet alle beschikbare salarisfilters permanent in één rij.

Per rapport:
- circa 5–6 primaire filters zichtbaar;
- secundaire filters via bestaand `Meer filters`-patroon of dichtstbijzijnde bestaande Insights-pattern.

---

# 4. Searchable multi-select

Primaire referentie: bestaande `Team` filter in `Personeel per leeftijd`.

Gedrag:

- default closed state: `Alle teams`, `Alle administraties`, enz.;
- één selectie: gekozen naam;
- meerdere selecties: compacte samenvatting, bijvoorbeeld `3 teams geselecteerd`;
- open popover bevat search input;
- daaronder `Selecteer alles`;
- checkbox rows;
- scrollbare lijst;
- select/deselect zonder popover na elke click te sluiten;
- Escape/outside click sluit;
- keyboard bereikbaar;
- selected state duidelijk.

Gebruik voor:

- Administratie
- Afdeling
- Team
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/bedrijfseigen regeling
- Salarisstructuur
- Salarisband
- Schaal
- Trede
- Employment type

---

# 5. Single-select

Primaire referentie: bestaande `Groeperen per`.

Gedrag:

- clean popover list;
- exact één actieve keuze;
- checkmark op actieve optie;
- arrow state;
- keyboardbediening.

Gebruik voor:
- Groeperen per
- Sorteren op
- eventuele report-specific single-selects.

---

# 6. Peildatum

Gebruik NIET de bestaande period semantics.

Gebruik WEL de periodepopover als visuele/interactie-referentie.

Gesloten:

`Peildatum`
`14 aug. 2026`

Open:

- single-date calendar;
- month navigation;
- year navigation;
- shortcut `Vandaag`;
- optioneel:
  - `Einde vorige maand`
  - `Einde vorig jaar`

Niet tonen:
- month range;
- volledig jaar;
- 3 jaar;
- 5 jaar;
- trendperiode.

Salary Insights V1 heeft geen Trend.

---

# 7. Results header

Gebruik het bestaande patroon.

Links:
`Geautoriseerde data`

Rechts:
- alleen relevante view/report controls;
- `Exporteren`.

Wanneer slechts één visualisatiemodus bestaat:
- geen `Verdeling / Trend` toggle tonen.

---

# 8. `Actieve selectie`

Gebruik het bestaande rechterzijpaneel.

Desktop:
- rechts naast primary result content indien passend.

Toon:
- Peildatum
- Groeperen per
- alleen non-default filters
- Sorteren op indien afwijkend

Voorbeeld:

`ACTIEVE SELECTIE`

`Peildatum              14 aug. 2026`
`Administratie          Mercurius BV`
`Team                   3 geselecteerd`
`Salarisstructuur       Functiebands 2026`
`Groeperen per          Salarisband`

Mobile:
- collapsible/stacked onder of boven het resultaatgebied.

---

# 9. KPI cards

Gebruik dezelfde KPI-cardfamilie als het leeftijdsrapport.

Per kaart:
- label;
- hoofdwaarde;
- optionele contextregel.

Voorbeeld:

`GEM. COMPA-RATIO`
`94,3%`
`42 medewerkers met geldige salarisband`

Ontbrekende salary data nooit als nul visualiseren.

---

# 10. Visualization card

Zelfde hiërarchie als reference:

- kaart;
- klein sectielabel/titel;
- korte uitleg;
- visualisatie.

Iedere chart:
- heeft concrete HR-analysevraag;
- heeft toegankelijke samenvatting;
- is ook via tabeldata interpreteerbaar.

Geen decoratieve chart.

---

# 11. Detail table

Gebruik de bestaande Insights table family.

- duidelijke kolomkoppen;
- employee name clickable;
- sorteerbaar waar logisch;
- geen inline salary edit.

Klik medewerker:
`Medewerker → Salaris`

---

# 12. Report-specific UX

## 12.1 Salarisoverzicht

**Header**
`Salarisoverzicht`
`Algemeen overzicht van salarissen, salarisroutes en salarisverdeling op peildatum.`

**Primary filters**
- Groeperen per
- Peildatum
- Administratie
- Team
- Afdeling
- Salarisroute

**Secondary filters**
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/regeling
- Employment type

**Groeperen per**
- Salarisroute
- Administratie
- Afdeling
- Functiegroep

**KPI cards**
- Medewerkers
- Totale salarissom
- Gem. FTE-salaris
- Mediaan FTE-salaris
- Gem. FTE
- Gem. compa-ratio
- Onder band
- Boven band
- Uitzonderingen
- Peildatum

**Primary chart**
- FTE-salary distribution.

**Optional secondary chart**
- verdeling over salary routes.

**Table**
`Medewerker | Administratie | Team/Afdeling | Functie | Salarisroute | FTE | FTE-salaris | Structuurpositie | Status`

Structuurpositie bijvoorbeeld:
- `Band E3`
- `Schaal 8 · Trede 5`
- `Minimumloon`
- `Vrij salaris`

---

## 12.2 Salarisbandpositie

**Header**
`Salarisbandpositie`
`Analyse van salarispositie binnen salarisbanden op basis van fulltime-equivalent salaris.`

**Primary filters**
- Groeperen per
- Peildatum
- Salarisstructuur
- Salarisband
- Team
- Administratie

**Secondary filters**
- Afdeling
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/regeling
- FTE

**Groeperen per**
- Salarisband
- Salarisstructuur
- Administratie
- Afdeling
- Team
- Functiegroep
- Status

**KPI cards**
- Medewerkers
- Gem. compa-ratio
- Gem. range penetration
- Onder band
- Binnen band
- Boven band
- Geen geldige band
- Peildatum

**Primary chart**
Horizontal compa distribution:
- `<80%`
- `80–<90%`
- `90–<100%`
- `100–<110%`
- `≥110%`

**Secondary contextual visual**
Wanneer één band geselecteerd is, mag een min–midpoint–max position visual worden getoond.

**Table**
`Medewerker | Administratie | Functie | Structuur | Band | FTE-salaris | Min | 100%-punt | Max | Compa-ratio | Range penetration | Status`

---

## 12.3 Onder en boven salarisband

**Header**
`Onder en boven salarisband`
`Signaleer medewerkers die onder, binnen of boven hun salarisband vallen.`

**Primary filters**
- Groeperen per
- Peildatum
- Status
- Salarisstructuur
- Salarisband
- Team

**Secondary filters**
- Administratie
- Afdeling
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/regeling

**Groeperen per**
- Status
- Salarisband
- Administratie
- Team

**KPI cards**
- Onder bandminimum
- Binnen salarisband
- Boven bandmaximum
- Geen geldige salarisband
- Medewerkers
- Peildatum

**Chart**
- verdeling over de vier bandstatussen.

**Table**
`Medewerker | Administratie | Functie | Structuur | Band | FTE-salaris | Min | 100%-punt | Max | % 100%-punt | Afwijking | Status`

Afwijking bijvoorbeeld:
- `€240 onder minimum`
- `€180 boven maximum`

Onder/boven band is geen automatische fout of mutatie.

---

## 12.4 Schaal & trede

**Header**
`Schaal & trede`
`Overzicht van medewerkers in schaal- en tredestructuren op peildatum.`

**Primary filters**
- Groeperen per
- Peildatum
- Salarisstructuur
- Schaal
- Trede
- Team

**Secondary filters**
- Administratie
- Afdeling
- Manager
- Functie
- Functiegroep
- Locatie
- CAO/regeling
- Employment type

**Groeperen per**
- Salarisstructuur
- Schaal
- Trede
- Administratie
- Team
- Functiegroep
- Geldigheidsstatus

**KPI cards**
- Medewerkers
- Structuren
- Schalen
- Tredes
- Ongeldige schaal/trede
- Peildatum

**Chart**
- verdeling per gekozen grouping;
- default: schaal.

**Table**
`Medewerker | Administratie | Functie | Structuur | Schaal | Trede | Revision vanaf | Salaris | Status`

Status minimaal:
- `Geldig`
- `Actie vereist: schaal/trede niet meer geldig`

---

## 12.5 Salarisstructuur-uitzonderingen

**Header**
`Salarisstructuur-uitzonderingen`
`Uitzonderingen en acties rondom geldigheid van salarisstructuren, banden en schalen.`

**Primary filters**
- Groeperen per
- Peildatum
- Ernst
- Uitzonderingstype
- Salarisstructuur
- Administratie

**Secondary filters**
- Afdeling
- Team
- Manager
- Salarisroute
- Band
- Schaal
- Trede

**Groeperen per**
- Ernst
- Uitzonderingstype
- Administratie
- Salarisstructuur

**KPI cards**
- Uitzonderingen totaal
- Aandacht
- Actie vereist
- Geen geldige band
- Ongeldige schaal/trede
- Peildatum

**Chart**
- exception distribution per type of severity.

**Table**
`Medewerker | Administratie | Looncontract | Route | Structuur | Band/Schaal/Trede | Uitzondering | Vanaf | Ernst | Actie`

Actie:
- `Bekijk medewerker`
- of bestaande `Salaris aanpassen` flow.

Geen inline bulk-edit.

---

## 12.6 Interne salarispositie

**HR Admin only**

**Header**
`Interne salarispositie`
`Vergelijk medewerkers met een voldoende grote interne vergelijkingsgroep.`

**Primary filters**
- Groeperen per
- Peildatum
- Functie
- Functiegroep
- Salarisband
- Administratie

**Secondary filters**
- Afdeling
- Team
- Locatie
- CAO/regeling
- Salarisstructuur
- FTE

**Groeperen per**
- Functie
- Functiegroep
- Salarisband
- Administratie

**KPI cards**
- Medewerkers in selectie
- Voldoende vergelijkingsgroep
- Onvoldoende vergelijkingsgroep
- Gem. afwijking t.o.v. mediaan
- Peildatum

**Chart**
- verdeling van medewerkers relatief aan groepsmediaan.

Geen prescriptief salarisadvies.

**Table**
`Medewerker | Functie | Vergelijkingsgroep | Groepsgrootte | Eigen FTE-salaris | Peer mediaan | Peer gemiddelde | Verschil mediaan | Relatieve positie | Status`

Bij group `<5`:
- status `Onvoldoende vergelijkingsgroep`
- peer statistic cells `—`
- geen verborgen peerwaarden in response.

Geen peernamen/memberlijst als peeranalyse-output.

---

# 13. Sorting

**Salarisoverzicht**
- Naam
- Salaris hoog-laag
- Salaris laag-hoog
- FTE
- Status

**Salarisbandpositie**
- Compa hoog-laag
- Compa laag-hoog
- Band
- Naam

**Onder/boven**
- Status
- Grootste afwijking
- Naam

**Schaal & trede**
- Structuur
- Schaal
- Trede
- Naam

**Uitzonderingen**
- Ernst
- Vanaf datum
- Type
- Naam

**Interne salarispositie**
- Verschil mediaan
- Relatieve positie
- Naam

---

# 14. Empty states

Algemeen:
`Geen medewerkers gevonden voor deze selectie.`

Band:
`Geen medewerkers met een geldige salarisband op deze peildatum.`

Uitzonderingen:
`Geen salarisstructuur-uitzonderingen voor deze selectie.`

Peer:
`Onvoldoende vergelijkingsgroep`

Gebruik rustige, niet-alarmistische copy.

---

# 15. Loading/error

Hergebruik bestaande Insights-patterns.

Belangrijk:
- laat nooit tijdelijk totals/data van een bredere scope zien voordat authorization klaar is.

---

# 16. Responsive

## Desktop
- horizontal/row filter layout;
- KPI cards in columns;
- visualization + active-selection side panel;
- table below.

## 390×844
- filters stacked;
- KPI cards 1–2 per row;
- visualization before table;
- active selection collapsible/stacked;
- multi-select usable without clipping;
- export/actions reachable;
- no broken horizontal report layout.

---

# 17. Accessibility

- keyboard for all filters;
- focus visible;
- date picker keyboard usable;
- multi-select checkbox semantics;
- accordion accessible;
- charts have textual/table equivalent;
- status not color-only.

---

# 18. Visual system

Gebruik geen nieuw Salary Insights design system.

Gebruik bestaande:
- LiquidHR/Exact tokens;
- report cards;
- colors/chart palette;
- spacing;
- borders/radius;
- typography;
- controls.

De referentie is `Personeel per leeftijd`, niet een nieuw los dashboardconcept.
