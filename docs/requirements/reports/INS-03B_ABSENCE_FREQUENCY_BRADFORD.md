# INS-03B — Meldingsfrequentie en Bradford: semantiek, tijdvensters en vergelijkbaarheid

**Status:** READY FOR SCOPED IMPLEMENTATION / OPEN DECISIONS (29-10-2026). **Issue:** [#66](https://github.com/EdwinCycling/LiquidHR/issues/66). **Afhankelijkheid:** INS-03A [PR #65](https://github.com/EdwinCycling/LiquidHR/pull/65) is gemerged in development `main` via `fa3edc5bbe746479b7227c2b9bdcdbf90bb10ade`; geen Vercel TEST-acceptatie.

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

**Open:** deze keuzes zijn niet automatisch door de bestaande code of dit document juridisch/bedrijfskundig goedgekeurd. Laat Codex de huidige implementatie en bestaande requirements read-only naast elkaar leggen en één voorstel met voorbeelden formuleren; bij betekenisvolle productkeuze eerst expliciet besluit vastleggen.

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
