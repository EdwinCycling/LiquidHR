# PAY-W02B-R2-NET-ORACLE-01 — R2 bruto-netto acceptance

- **Datum:** 24-10-2026
- **Branch:** `work/pay-postmerge-r2-factor-01-20261024`
- **Werkboom-HEAD bij start:** `aba671217a348525145f187932450db670d0b496`
- **W02a codecommit:** `0dd06ea04ca06909ba35246af06b9bd246c6501f`
**Verdict:** **PASS voor de volledige synthetische R2-rekenketen; GO voor code-integratie.** Reële bronbevestiging, juridische toepasselijkheid en echte salarisverwerking blijven **OPEN/HOLD**.

## Scope en veiligheid

Werk uitgevoerd op de bestaande W02a-branch en -worktree. De W02a-factorlogica is behouden. De normale Employee Payroll-calculatieservice verwerkt een volledige, uitsluitend in-memory synthetische R2-bronset; een onafhankelijke BigInt-cent-oracle vergelijkt de volledige componentuitvoer. De standaard R2-fixture met onvolledige fiscale, pensioen-, werkgevers- en cumulatieve gegevens blijft `SOURCE_GAP` en levert geen run, bruto of netto.

De testservice gebruikt een geïsoleerde tijdelijke teststore. Er zijn geen echte medewerkers, remote database-/schemawrites, gedeelde TEST-mutaties, review, finalisatie, opgeslagen PDF, push, merge of deployment uitgevoerd. De R2-service-uitkomst is `CONCEPT` in de lokale teststore; er is geen gehoste of echte salarisverwerking bewezen. De kandidaat staat niet op `main`.

## Bronnenmatrix

| Afhankelijkheid | Status in oracle | Expliciete input / beperking |
| --- | --- | --- |
| Dienstverband, periode en uren | AVAILABLE | Synthetisch dienstverband start 2026-07-01; periode 2026-07; 24 van 38 contracturen. Exacte verhouding is `24/38`; `0.6316` is de gevalideerde factor op vier decimalen. |
| Fulltime/parttime loon | AVAILABLE | Synthetische fulltime maandbasis €2.542,50; berekende parttime basis €1.605,79. CAO-uurbasis €15,44. |
| CAO-/premieregels | AVAILABLE | Retail Non-Food versie `2026.7`, geldig vanaf 2026-07-01. De overlapset bevat 1 nachtuur, 1 zondaguur en 2 overuren waarvan beide overuren overlappen; de bestaande best-of-regel kent €15,44 precies eenmaal toe. Een echte werkgeversscope/CAO-indeling blijft MISSING. |
| Fiscale regels en parameters | AVAILABLE | Synthetische witte maandtabel, Nederland standaard, 2026; `NL-2026-01`. De werknemer is in de fixture fictief onder de AOW-leeftijd. Dit bewijst geen echte fiscale classificatie. |
| Loonheffingskorting en werknemersverklaringen | AVAILABLE (synthetic) | Fictieve tax profile v1, effectief 2026-07-01; één IKV, Nederlandse woonplaats, onder AOW en loonheffingskorting op die IKV. De echte werknemersverklaring, leeftijd, woonplaats en IKV-readback zijn MISSING. |
| Pensioenregeling, franchise en percentages | AVAILABLE (synthetic) | `BPF-DETAILHANDEL-2026-v1`; 24,75% totaal, maximaal 6,1875% werknemer en resterend 18,5625% werkgever, franchise €18.680 per jaar, loonmaximum €79.409; fixture-mapping effectief 2026-01-01 t/m 2026-12-31. Synthetisch deelnamebesluit; echte verplichtstelling, sector-/cao-verdeling en werknemersdeelname blijven MISSING. |
| Werkgeverspremies en reserves | AVAILABLE (synthetic) | `SYNTHETIC-R2-EMPLOYER-2026-v1`, configuration v1 effectief 2026-01-01: AWF 2,74%, AOF 6,27%, WKO 0,50%, WHK 1,93%, Zvw 6,10%, vakantiereserve 8%, eindejaarsreserve 0%. WHK en werkgeversclassificaties zijn fictieve scenario-inputs; werkelijke werkgeversbeschikking en toepasselijkheid zijn MISSING. |
| Openingscumulatieven | AVAILABLE (synthetic first period) | Alle fixture-openingen staan expliciet op €0,00; dienstverband en eerste volledige periode beginnen 2026-07-01. Echte R2-cumulatieven/historie zijn MISSING. Niet-nul of ontbrekende openingsbronnen blokkeren de service. |
| Nettovergoedingen en overige inhoudingen | AVAILABLE (synthetic zero) | Geen nettovergoeding of aanvullende inhouding; de fixture legt expliciet nul vast. Een echte bron voor eventuele R2-vergoedingen/inhoudingen is niet aangeleverd. |
| Bijzondere beloning / nabetaling | NOT_APPLICABLE | Dit is één regulier eerste maandloon; er is geen bonus, bijzondere beloning of TWK-input in deze synthetische case. |
| Echte employer-/pension-applicability | MISSING | Geen synthetische fixturewaarde wordt als werkgevers- of werknemersbesluit gebruikt. |

### Geversioneerde bronpins

De testfixture bindt versie, geldigheidsperiode, URL en SHA-256 van iedere externe regelbron. De 2026-detailhandelpremie, franchise, loonmaximum en mogelijke sectorafwijkingen zijn terug te vinden bij [Pensioenfonds Detailhandel](https://pensioenfondsdetailhandel.nl/werkgever-en-administratiekantoor/pensioenzaken/pensioenpremie-en-opbouw). De loonbelastingtabellen staan bij de [Belastingdienst](https://www.belastingdienst.nl/wps/wcm/connect/nl/personeel-en-loon/content/hulpmiddel-loonbelastingtabellen); de officiële 2026-cijferbijlage noemt onder meer het eerste schijftarief van 35,75% ([Cijferbijlage loonheffingen 2026](https://odb.belastingdienst.nl/wp-content/uploads/2025/12/Cijferbijlage-2026-bij-Nieuwsbrief-LH-LH-209-1B61FD_TG.pdf)). Deze bronnen bevestigen parameters, niet de toepasselijkheid op een echte R2-werkgever of werknemer.

| Bron | Versie en geldigheid | SHA-256 |
| --- | --- | --- |
| [CAO Retail Non-Food](https://www.inretail.nl/wp-content/uploads/2026/05/260527-Cao-Retail-Non-Food-juli-2026-def.pdf) | definitieve juli 2026; 2026-07-01 t/m 2027-06-30 | `ec6fd7a8ee7c3b1f18f58ac6cc5081d6a72e053405480e346eb8a4c7d1e1d2cc` |
| [Belastingdienst rekenvoorschriften](https://download.belastingdienst.nl/belastingdienst/docs/rekenvoorschriften_voor_geautomatiseerde_loonadministratie_lh991z62fd.pdf) | januari 2026, versie 2; 2026-01-01 t/m 2026-12-31 | `283c1857d923e8cc9ed7d0a33ae6f6c0c8f35db6c886d67ee2289324cfe58a03` |
| [Belastingdienst parameterbijlage](https://download.belastingdienst.nl/belastingdienst/docs/bijlage_rekenvoorschr_voor_geauto_loonadm_pdf_lh991b61fd.pdf) | januari 2026; 2026-01-01 t/m 2026-12-31 | `fb64f97320f4e7241a2d8c8cf13540579282e5f34156be986f540eb8dbd5ab48` |
| [Witte maandtabel, Nederland standaard](https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf) | v01 januari 2026; 2026-01-01 t/m 2026-12-31 | `c959d65273e18a1a2fdf33562fd34e31d45d3bca0f260ea232815d28e69284dc` |
| [Pensioenfonds Detailhandel premieoverzicht](https://pensioenfondsdetailhandel.nl/content/Publicaties/Rekenvoorbeelden/Premieoverzicht-2026.pdf) | 2026; 2026-01-01 t/m 2026-12-31 | `494bc0fb3c3136d0048c053339a5e40cfb79d4620d37be791d7f738e95508f3d` |
| [Pensioenfonds Detailhandel VCR-rekenvoorbeelden](https://pensioenfondsdetailhandel.nl/content/Publicaties/Rekenvoorbeelden/Rekenvoorbeelden-2026.pdf) | 2026, maandmethode; 2026-01-01 t/m 2026-12-31 | `5a2cb3d329a1aef6c4e521448c70540501dc290e73648f36f6df87143a4cb16f` |
| [Pensioenfonds Detailhandel verplichtstelling](https://pensioenfondsdetailhandel.nl/werkgever-en-administratiekantoor/situaties-en-wijzigingen/verplichtstelling) | werkgeversinformatie; 2026-01-01 t/m 2026-12-31 | `76a5a8e8b26aeefddf362262ff72bc576f57a8c38c69fd38df2bb7fcf5de70a9` |

De werkgeversparameters zelf zijn afzonderlijk gemarkeerd als synthetische bronversie; in het bijzonder is de WHK 1,93% een fictieve fixturekeuze. Er wordt geen juridische conformiteitsclaim gedaan.

## R2 onafhankelijke bruto-netto-uitkomst

De oracle gebruikt BigInt-centen en haalt geen productiecalculator binnen. Iedere component is onafhankelijk gereconstrueerd uit de bovenstaande input en bronversies; bedragen worden afgerond op de expliciete stap voordat volgende componenten ervan afhangen.

| Component | Oracle | Berekeningsbasis |
| --- | ---: | --- |
| Parttime basisloon | €1.605,79 | €2.542,50 × exacte urenverhouding 24/38, op de CAO-loonstap afgerond |
| Overlapveilige premie | €15,44 | Eén toepassing van de geselecteerde premie op €15,44/u |
| **Bruto** | **€1.621,23** | Basisloon + premie, eenmaal |
| Maandfranchise | €1.556,67 | €18.680 / 12, op centen afgerond |
| Naar deeltijd verlaagde franchise | €983,19 | Maandfranchise × 0,6316, op centen afgerond |
| Pensioengrondslag | €638,04 | Bruto − deeltijdfranchise |
| Totale pensioenpremie | €157,91 | 24,75% van grondslag |
| **Werknemerspensioen** | **€39,48** | 6,1875% van grondslag |
| Werkgeverspensioen | €118,43 | Totale premie − werknemersdeel |
| **Fiscaal loon** | **€1.581,75** | Bruto − werknemerspensioen |
| Werknemersverzekeringsloon | €1.581,75 | Afzonderlijke componentbasis uit de synthetische rule package |
| Zvw-loon | €1.581,75 | Afzonderlijke componentbasis uit de synthetische rule package |
| Jaarloon voor tabelstap | €18.981,00 | Fiscaal maandloon × 12 |
| Jaar-tabelloon | €18.954,00 | Naar beneden op veelvoud van €54 volgens gepinde regelversie |
| Jaarheffing vóór kortingen | €6.776,00 | 35,75%, jaarlijkse floor volgens de gepinde regel |
| Algemene heffingskorting | €3.115,00 | Jaarparameter, begrensd door beschikbare heffing |
| Arbeidskorting | €3.164,00 | Jaarlijkse stappen, caps en afronding volgens gepinde 2026-regel |
| Jaarheffing na kortingen | €497,00 | Kortingen begrensd door beschikbare heffing |
| **Loonheffing voor de maand** | **€41,42** | €497 / 12, op centen afgerond |
| **Netto** | **€1.540,33** | Bruto − werknemerspensioen − loonheffing; geen andere nettoposten |
| AWF / AOF / WKO / WHK / Zvw | €43,34 / €99,18 / €7,91 / €30,53 / €96,49 | Synthetische tarieven op €1.581,75, afzonderlijk op centen afgerond |
| Werkgeverspremies samen | €277,45 | Som werkgeversverzekeringen en Zvw |
| Vakantiereserve | €129,70 | Synthetische 8% van bruto |
| **Totale werkgeverskosten** | **€2.146,81** | Bruto + werkgeverspensioen + werkgeverspremies + vakantiereserve |

De test vergelijkt alle relevante componentrijen van de normale productservice met de onafhankelijke oracle op centniveau. Identieke bron-, input- en regelversies reproduceren dezelfde source-, input- en result-hashes. De bestaande R2-brutoformule blijft `€1.605,79 + €15,44 = €1.621,23`.

## Regressies en fail-closed bewijs

- R1 volledige regressie blijft: bruto €4.767,20; werknemerpensioen €198,65; loonheffing €1.107,17; netto €3.461,38; werkgeverskosten €6.545,86.
- De standaard onvolledige R2-fixture blijft `SOURCE_GAP`, zonder opgeslagen run of bruto-/nettobedrag.
- Ontbrekende fiscale, pensioen-, werkgevers- en cumulatieve bronnen, tegenstrijdige cumulatieven, onmogelijke fiscale ingangsdatum, ongeldige bronversie, inconsistente deeltijdbasis en foreign-tenant/foreign-employee scope worden geweigerd.
- Als de CAO-premiebron ontbreekt terwijl de uren/overtime-bronnen bestaan, wordt geen tweede variabele loonroute geaccepteerd; readiness blijft niet-berekenbaar en de testrun-teller verandert niet.
- Geen formule, fiscale parameter, globale layout, dependency of Next-config is gewijzigd.

## Kwaliteitsgates

| Gate | Resultaat |
| --- | --- |
| Payroll regressies | PASS — 10 testbestanden, 147/147 tests |
| NL-2026 fiscale oracle | PASS — 1 testbestand, 27/27 tests |
| TypeScript | PASS — root `npm run type-check` onder Node 24.22.1 |
| ESLint gewijzigde Payroll-bestanden | PASS — 0 errors; één bestaande ongebruikte-import-waarschuwing op `liquid-hr-source-provider.ts` (ongewijzigde regel) |
| Root productiebuild | PASS — `npm run build`, Node 24.22.1, npm 10.9.2; hr-suite en Control, inclusief prerendering en Payroll post-buildscans |
| Dependencies | Next 16.4.2, React 19.2.9, React DOM 19.2.9; lockfile/manifests ongewijzigd |
| `git diff --check` | PASS |

De eerste sandbox-build kon geen Next.js-junction maken en eindigde met Windows `Access is denied`/`EPERM`. Dezelfde volledige rootbuild is vervolgens buiten die sandboxbeperking geslaagd. De gegenereerde Focus-widgetbron is exact teruggezet naar de schone HEAD-versie; `next-env.d.ts` is ongewijzigd.

## Verdict en resterende gates

**W02b synthetische technische gate: PASS. Integratieadvies: GO voor de lokale codekandidaat, met een afzonderlijke HOLD voor echte salarisverwerking.** Dit is geen bewijs dat de synthetische R2-input overeenkomt met een echte werknemer/werkgever, geen gehoste acceptatie en geen wettelijke conformiteitsverklaring. Main/remote blijft ongewijzigd.

Voor W04/echte payroll ontbreken minimaal:

1. Door bevoegde bronhouder bevestigde werknemer-/dienstverband-/IKV-data, salaris/CAO-schaal en effectieve werkuren.
2. Reële CAO Retail Non-Food-toepasselijkheid, bedrijfsactiviteit en eventuele uitzonderingsbeoordeling.
3. Echte fiscale werknemersverklaringen, leeftijd/woonplaats, loonheffingskorting en andere IKV-claims.
4. Gevalideerde pensioenverplichtstelling, werknemersdeelname en eventuele sector-/cao-afwijkende verdeling.
5. Werkgeversbesluiten voor AWF/AOF/WKO/Zvw/WHK, inclusief echte WHK-beschikking en vakantie-/eindejaarsregelingen.
6. Read-back van historische cumulatieven voor loon, heffing, werknemersverzekeringen, Zvw, pensioen/VCR en reserves; verdere meerdere-perioden- en jaargrensreconciliatie.
7. Reële nettovergoedingen/inhoudingen, indien die bij deze werknemer van toepassing zijn.
8. Afzonderlijke geautoriseerde gehoste/browser-, review-, FINALIZED- en PDF-acceptatie op de juiste persona en scope; geen van deze acties is in W02b uitgevoerd.

Deze gates blijven buiten deze begrensde wave. Er wordt geen W02b-code automatisch geïntegreerd, gedeployed of verwerkt in een echte salarisrun.
