# INS-03B — Meldingsfrequentie en Bradford: semantiek, tijdvensters en vergelijkbaarheid

**Status:** Productpakket goedgekeurd voor scoped implementatie via Draft PR #68 en issue #66 (29-10-2026). **Afhankelijkheid:** INS-03A [PR #65](https://github.com/EdwinCycling/LiquidHR/pull/65) is gemerged in development `main` via `fa3edc5bbe746479b7227c2b9bdcdbf90bb10ade`; geen Vercel TEST-acceptatie.

## 1. Probleem en productdoel

Bestaande Insights-rapporten `absence-frequent` en `absence-bradford` gebruiken niet vanzelf dezelfde gebeurtenisdefinitie. De discovery [INS-03](INS-03_ABSENCE_WVP_DISCOVERY.md) constateerde: frequent verzuim telt `absence_case`-records met `first_absence_on` in het gekozen venster, terwijl Bradford `absenceOccurrences` uit `absence_spell`-IDs gebruikt. Bradford combineert deze met verzuimdagen. Dat is niet per definitie één uniforme meldingsfrequentie. INS-03A heeft scope, bronkwaliteit en read-only rapportage verbeterd, **niet** de semantische harmonisatie voltooid.

Doel: de betekenis, periodegrenzen, bronkwaliteit en gebruikerslabels van beide rapporten aantoonbaar consistent maken. **Geen tweede Insights-framework** en geen wijziging aan het operationele verzuimdossier om rapportcijfers passend te maken.

## 2. Expliciete ontwerpbesluiten vóór implementatie

| ID | Besluit | Minimale toets |
|---|---|---|
| B01 | Onderscheid `case` (dossier/melding) en `spell` (ziekteperiode); leg vast wat de teller `S` en 'meldingsfrequentie' betekent | Eén case met twee spells levert voorspelbare, afzonderlijk benoemde waarden |
| B02 | Periode-inclusie: case-start, spell-start of overlap met periode; kies per metric bewust | Start vóór venster, herstel binnen venster, nieuwe spell binnen hetzelfde dossier |
| B03 | Bradford `B = S² × D`: betekenis van `S`, `D` (kalender-/rooster-/gewogen ziektedagen), deduplicatie, bandgrenzen en afronding | Handberekende fixtures met meerdere spells, overlap en partiële arbeidsgeschiktheid |
| B04 | Frequentie: rolling 12 months versus kalenderjaar, configureerbare drempel, denominator en nulpopulatie | Geen onterechte vergelijking van verschillende vensters |
| B05 | Meerdere dienstverbanden, afdelingshistoriek en medewerkerdeduplicatie | Geen dubbele telling door dezelfde gebeurtenis in meerdere contracten |
| B06 | Onvolledige rooster/capacity/plaatsingsdata, truncatie, privacy | Onbekend blijft onbekend, fail closed bij afdelingsfilter en bronlimiet |

**Besluit:** de goedgekeurde besluitreactie bij PR #68 en issue #66 autoriseert het pakket in §6. Er staat geen aanvullend productbesluit voor de beschreven scope open.

## 3. Technische grenzen

- Behoud bestaande rapportcatalogus, API-route `app/api/insights/absence/route.ts`, typed queryfilters, NL/EN, responsive UI en bestaande Excel-formaten waar contractueel mogelijk.
- Hergebruik `getAbsenceInsightScope` en de geautoriseerde dataset uit INS-03A: tenant → HR-groep → **actieve toegestane administratie**; Manager directe teamleden vóór persoonsqueries; Employee geen collega-inzage.
- `getAbsenceInsightReport`, `getFrequentAbsenceReport`, `getBradfordInsightReport` en de exportfuncties moeten overeenkomen in hun expliciete tellerdefinities. Als de metrics verschillen, moeten labels, formule-uitleg en export dit duidelijk onderscheiden.
- Geen diagnose, vrije medische tekst of onnodige persoonsgegevens in UI, logs en Excel. Geen muterende RPC vanuit Insights-GET.
- WVP blijft `available=false`; INS-03C, PMUX/WVP en lifecycle-owner/cadence [#67](https://github.com/EdwinCycling/LiquidHR/issues/67) zijn afzonderlijke trajecten.

## 4. Acceptatievoorbeelden (synthetische data)

1. Twee administraties en twee directe teams: buiten-scope events mogen geen KPI/detail/export verhogen.
2. Eén case met twee spells: de case-teller blijft één; spell-teller twee, of een bewust en gedocumenteerd ander resultaat.
3. Twee overlappende spells: ziektedagen en Bradford-D worden volgens gekozen beleid niet onbedoeld dubbel geteld.
4. Case gestart in vorige periode, spell gestart/hersteld in huidige periode: ieder venster volgt B02.
5. Meerdere dienstverbanden bij één medewerker: definities en medewerkerdeduplicatie aantoonbaar.
6. Onbekend rooster of capacity: geen gefabriceerd percentage, aantal ziektedagen of Bradford-score.
7. Zoek-/afdelings-/frequent-only-filter: KPI's, rijen en Excel gebruiken dezelfde bedoelde populatie.
8. Drempelbanden, afronding, lege data en NL/EN-teksten gecontroleerd.

## 5. Uitvoering en gates

**Eerst:** read-only semantische review + expliciet besluit B01–B06. **Dan:** kleine gerichte codewijziging met regressietests en Draft PR op een eigen branch. Gerichte Vitest, TypeScript, ESLint, i18n-pariteit (43 namespaces) en diff-check; geen volledige suite/build op deze tussenstap tenzij een wijziging dit noodzakelijk maakt. Bescherm lokale `next-env.d.ts`, Focus en `output/wvp01/`; bestaande gegenereerde `.next`-fouten niet ongericht repareren.

**Geen** DB-write, migratie, grant, merge, Vercel-deployment of activatie van WVP zonder afzonderlijke toestemming. Volledige HR Admin/Manager/Employee, RLS, browser en Vercel TEST-acceptatie wordt later gezamenlijk uitgevoerd. Development-merge is geen release-go.

## 6. Goedgekeurd productbesluit en implementatiebasis (29-10-2026)

**Goedgekeurd in de besluitreactie bij PR #68 en bevestigd bij issue #66.** De analyse hieronder legt de implementatiebasis en de vastgestelde invulling vast.

### Wat bestaande requirements al vastleggen

- [`VERZUIM_EN_HERSTEL.md`](../absence/VERZUIM_EN_HERSTEL.md) §2 definieert een `absence_case` als één ziekteketen voor één dienstverband en een `absence_spell` als één ononderbroken ziekteperiode. §5 bepaalt dat hervatting binnen 28 dagen in dezelfde case blijft en exact 28 dagen een nieuwe case start. §7 zegt expliciet dat frequent verzuim casuswortels telt, niet spells in dezelfde keten.
- [`VERZUIM_INSTELLINGEN.md`](../absence/VERZUIM_INSTELLINGEN.md) legt voor de HR-groep een instelbare drempel vast met standaard 3 en bereik 1–20.
- [`RAPPORTAGES_EN_INZICHTEN.md`](RAPPORTAGES_EN_INZICHTEN.md) §Autorisatie, data en export definieert Bradford `S` als afzonderlijke ziekteperioden, `D` als roostergewogen verzuimdagen en de banden `<51`, `51–400` en `>400`. Bradford is een gesprekssignaal, geen automatische personeelsbeslissing.

Daarmee zijn de semantiek van case versus spell, de teller voor frequent verzuim, Bradford-S, Bradford-D op hoofdlijn, de instellingen-drempel en de banden geen nieuwe keuzes voor INS-03B.

### Huidige code-uitkomst

- `frequent-absence-query.ts` maakt het rollende venster inclusief beide grensdagen: vandaag minus 364 dagen tot en met vandaag (**365 datums**). `frequent-absence-report.ts` telt cases waarvan `first_absence_on` in dat venster valt. Eén case met meerdere spells telt dus één keer. De aanvullende ziektedagen-KPI is de unie van kalenderdatums uit de spells, afgeknipt op het venster en per medewerker gededupliceerd.
- `bradford-query.ts` gebruikt vandaag minus 363 dagen tot en met vandaag (**364 datums / 52 weken**). `absence-report.ts` neemt spells mee die het rapportvenster overlappen; Bradford `S` telt de unieke spell-ID's. `D` komt uit roostergewogen gemiste dagen per dienstverband, ook afgeknipt op het venster. De twee rollende vensters verschillen één datum.
- Bij overlappende spells binnen hetzelfde dienstverband telt Bradford nu elke spell-ID voor `S`, terwijl de dagberekening de hoogste actieve capaciteitswaarde gebruikt en de dag niet optelt. De domeinrequirement zegt dat overlap binnen hetzelfde dienstverband door de mutatieservice wordt geblokkeerd, maar de rapportage valideert dit niet opnieuw.
- De verzuimaggregatie voegt `D` over employments van dezelfde medewerker samen. Omdat parallelle employments in het domein zijn toegestaan, kan dezelfde kalenderdatum in meerdere dienstverbanden als meerdere roostergewogen dagen meetellen. Frequent verzuim dedupliceert zijn aanvullende kalenderdagen-KPI juist over de medewerker.
- `calculateBradfordScore` rondt `S² × D` af op een geheel getal nadat de bronwaarde van `D` op twee decimalen is afgerond. De getoonde `D` is één decimaal. De bestaande requirement specificeert geen afrondingsmoment.
- Beide rapporten bieden ook `this-year` en `previous-year`; die gebruiken kalenderjaargrenzen. Frequent verzuim heeft geen percentage: `frequentCount` vergelijkt het aantal cases met de ingestelde drempel. `totalEmployees` is het aantal gefilterde medewerkers met cases, geen populatienoemer.

### Vastgestelde beperkte harmonisatie

| Keuze | Goedgekeurde invulling | Afbakening |
|---|---|---|
| Rollend venster | Gebruik voor beide rapporten dezelfde inclusieve 365 datums (vandaag minus 364 dagen t/m vandaag); behoud kalenderjaar-presets. Label beide als **Laatste 365 dagen**. | Geen extra periodepreset of wijziging aan de kalenderjaargrenzen. |
| Gebeurtenis en periode-inclusie | Frequent verzuim telt unieke cases op hun `first_absence_on`. Bradford `S` telt unieke spells die de gekozen periode overlappen; `D` telt alleen roostergewogen dagen binnen diezelfde periode. Een al lopende spell blijft in Bradford zichtbaar, zonder als nieuwe frequentiecase te tellen. | De twee expliciete tellers blijven onderscheiden in UI en Excel. |
| Overlap en meerdere dienstverbanden | Een overlap binnen hetzelfde dienstverband is volgens het domeinmodel ongeldig: fail-closed voor de Bradford-score. Parallelle employments blijven afzonderlijke werkverplichtingen: unieke cases/spells tellen per geregistreerde ID en roostergewogen `D` wordt per employment opgeteld. | Dedupliceer `D` niet op medewerker en kalenderdatum; verwerk een spell-ID niet dubbel. |
| Afronding | Behoud een geheel Bradford-cijfer: bereken met `D` op interne bronprecisie en rond `S² × D` één keer af naar het dichtstbijzijnde gehele getal; toon `D` op één decimaal en pas daarna de bestaande banden toe. | Bepaal de band op basis van de definitieve afgeronde score. |
| Drempel en noemer | Behoud de HR-groepinstelling (standaard 3, bereik 1–20), case-teller en binaire drempel. Toon geen frequentiepercentage of ongedefinieerde personeelsnoemer; lege populatie geeft alleen nul-tellingen. | Geen nieuwe noemer of percentage. |

### Voorbeelden van de goedgekeurde uitkomst

1. Venster 1–31 januari. Case C begon 20 december; spell A loopt 20 december–5 januari en spell B 20–25 januari als herstel binnen dezelfde vierwekenketen. Volgens het besluit telt frequent verzuim **0 cases** (de casuswortel ligt vóór het venster), Bradford telt **2 spells** (beide overlappen januari), en `D` omvat alleen roostergewogen dagen van 1–31 januari. UI en Excel benoemen die verschillende tellers.
2. Eén case met twee spells die beide in het venster vallen: frequent verzuim telt **1 case**; Bradford `S` telt **2 spells**.
3. Twee overlappende spell-intervallen binnen hetzelfde employment: Bradford is onbekend/fail-closed wegens een ongeldige broncombinatie. Twee gelijktijdige verzuimregistraties op twee toegestane employments blijven twee werkverplichtingen; hun roostergewogen `D` wordt opgeteld.

### Acceptatiegrens

De implementatie behoudt de INS-03A-autorisatie en bronkwaliteitsgrenzen. De gerichte lokale gates bewijzen de code en regressies op de Draft PR-branch; gezamenlijke Vercel TEST-release, persona/browseracceptatie en releasebesluit blijven afzonderlijke open acceptatiepunten.
