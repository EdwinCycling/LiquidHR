# PAYLAB03 — officiële NL-2026 reguliere maandberekening

Bronanalyse uitgevoerd op 2026-09-30, voorafgaand aan fiscale implementatie.
Dit document beschrijft uitsluitend WHITE / NL / STD / jonger dan AOW /
volledige MONTH / regulier loon / één werknemer, employment en IKV.

## Gepinde bronnen en actualiteitscontrole

De officiële [publicatiepagina](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/rekenvoorschriften-voor-de-geautomatiseerde-loonadministratie)
vermeldt op de controledatum januari 2026, **versie 2**, als nieuwste 2026-uitgave.
Gerichte controle op een nieuwere 2026-correctie leverde geen nieuwere
rekenvoorschriften op. De officiële downloads zijn opnieuw opgehaald en hun
SHA-256 is identiek aan de drie lokale bestanden onder `../Docs/` ten opzichte
van de repositoryroot. Geen blog of externe calculator is normatieve bron.

| Bron | Titel / versie / uitgave | SHA-256 | Relevante gedrukte pagina's |
| --- | --- | --- | --- |
| [Rekenvoorschriften](https://download.belastingdienst.nl/belastingdienst/docs/rekenvoorschriften_voor_geautomatiseerde_loonadministratie_lh991z62fd.pdf) | Rekenvoorschriften voor de geautomatiseerde loonadministratie 2026, januari 2026, versie 2 | `283c1857d923e8cc9ed7d0a33ae6f6c0c8f35db6c886d67ee2289324cfe58a03` | 3 versiecorrectie; 4 bindende tabellen; 6–9 annualisatie/schijven; 10 AHK; 12–13 ARK; 13–16 inhouding/afronding; 32–33 symbolen |
| [Parameterbijlage](https://download.belastingdienst.nl/belastingdienst/docs/bijlage_rekenvoorschr_voor_geauto_loonadm_pdf_lh991b61fd.pdf) | Bijlage parameterwaarden, substitutiewaarden en herleidingsfactoren 2026, januari 2026 | `fb64f97320f4e7241a2d8c8cf13540579282e5f34156be986f540eb8dbd5ab48` | 4: inwoner Nederland, jonger AOW, wit, Std |
| [Handboek](https://download.belastingdienst.nl/belastingdienst/docs/handboek-loonheffingen-lh0221t61fd.pdf) | Handboek Loonheffingen 2026, maart 2026 | `7576eeaab3c4365e768892b343d89bc1ab8018e8f50659c067e4e5fe33c78120` | 177–182 §9.3.1–9.3.4: tabelkeuze/leeftijd/arbeidskorting; 426 e.v. hoofdstuk 24: loonheffingskorting |

De [Handboek-publicatiepagina](https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/themaoverstijgend/brochures_en_publicaties/handboek-loonheffingen)
vermeldt maart 2026 als nieuwste Handboek-uitgave op de controledatum.
Versie 2 corrigeert in §2.2.2 het tweede-schijfpercentage van **35,76 naar
37,56**; de parameterbijlage geeft eveneens 37,56%. Deze correctie is materieel.
PDF-paginanummer = gedrukte pagina voor deze bestanden. Tabellen en formules
zijn uit de lokale PDF gelezen; parameterpagina 4 en formulepagina 12 zijn
tevens visueel gecontroleerd met de officiële PDF.

## Inputs en classificatie

Typed inputs: fiscale periode/datum in 2026, volledig maandtijdvak, woonland NL,
belasting- én volledige volksverzekeringsplicht (STD), tabel WHITE,
leeftijdscategorie UNDER_AOW **voor de genietingsmaand**, regulier loon uit
tegenwoordige dienstbetrekking, één IKV, loonheffingskorting boolean en
`taxableWage` (EUR, twee decimalen). Geen jonggehandicaptenkorting of andere
bijzondere situatie. AOW geldt al vanaf de eerste dag van de maand waarin
de werknemer de AOW-leeftijd bereikt; alleen feitelijk onder-AOW vóór de
genietingsdatum is onvoldoende classificatie (Handboek p.178).

`taxableWage` is het loon voor loonbelasting/volksverzekeringen, kolom 14
loonstaat: niet algemeen gelijkstellen aan bruto. Voor CC-NL-2026-001 is er
uitsluitend €4.000,00 regulier geldloon, geen pensioeninhouding, aftrek,
bijtelling, netto vergoeding of bijzondere beloning. De expliciete
NL_REGULAR_WAGE → NL_TAXABLE_WAGE-keten draagt daarom dezelfde €4.000,00.
GC-NL-001 met synthetische inhouding €700 blijft een afzonderlijke enginecase.

## Versioned parameters (wit / NL / Std / onder AOW)

Bedragen hieronder zijn euro's. Percentages `b` zijn officieel percentages;
de overige factoren zijn decimale vermenigvuldigingsfactoren.

| Officieel symbool → interne sleutel | Waarde | Eenheid | Bron |
| --- | --- | --- | --- |
| F2 → monthFactor | 12.000 | factor | §2.2.1 tabel 1b, p.8 |
| Lv → annualTableStep | 54 | EUR | §2.2.1 tabel 1a, p.7 |
| Lmax → maximumAnnualTableWage | 133110 | EUR | idem; parameterbijlage p.4 |
| a1.1 / a2.1 / a3.1 → bracketOffsets | 0 / 38883 / 78426 | EUR | §2.2.2 tabel 2, p.9; parameterbijlage p.4 |
| b1.1 / b2.1 / b3.1 → bracketRates | 35.75 / 37.56 / 49.50 | percent | idem |
| c1.1 / c2.1 / c3.1 → bracketCumulativeTax | 0 / 13900 / 28752 | EUR | idem; gebruik gepinde cumulatieve waarden |
| ahkm1.1 → generalCreditMaximum | 3115 | EUR | §2.2.3.1 tabel 3, p.10; parameterbijlage p.4 |
| ahkg1 / ahkg2 → generalCreditTaperBounds | 29736 / 78426 | EUR | idem |
| ahka1.1 → generalCreditTaperRate | 0.06398 | factor | idem |
| arko1.1 / arko2.1 / arko3.1 → labourCreditBuildRates | 0.08324 / 0.31009 / 0.01950 | factor | §2.2.3.4 tabel 6, p.13; parameterbijlage p.4 |
| arkm1.1 / arkm2.1 / arkm3.1 → labourCreditBuildCaps | 996 / 5300 / 5685 | EUR | idem |
| arkg1 / arkg2 / arkg3 / arkg4 → labourCreditBounds | 11965 / 25845 / 45592 / 132920 | EUR | idem |
| arka1.1 → labourCreditTaperRate | 0.06510 | factor | idem |

OUK en AOK zijn niet van toepassing onder AOW. Jonggehandicaptenkorting is
expliciet uitgesloten: niet stil behandelen als nul wanneer die is aangevraagd.
Parameters horen met effectiveFrom 2026-01-01 / effectiveTo 2026-12-31,
bronversie/hash en symbolische mapping in het SYSTEM-regelpakket.

## Exacte berekeningsvolgorde

Gebruik fixed decimal/Decimal, `floorN`, `ceilN`, `roundN` (rekenkundig, halve
eenheid omhoog voor niet-negatieve waarden). Geen binary floating point.

1. **Annualisatie** (§2.1, §2.2.1 p.6–8): `rawL = tvl * F2`.
   Bij rawL ≤ 0: L=0. Bij rawL ≤ Lmax:
   `L = floor0(rawL / Lv) * Lv`. Dus maandstappen €4,50. Bij rawL > Lmax:
   `L = round5(rawL)` en ga naar de boven-Lmax-rekenregel hieronder.
2. **Schijfkeuze** (§2.2.2 p.8–9): L ≤38883: schijf1;
   38883 < L ≤78426: schijf2; L >78426: schijf3. Voor L ≤Lmax:
   `X1 = max(0, floor0((L-a)*b/100+c))` (§2.2.4 p.14).
3. **AHK** (§2.2.3.1 p.10): L ≤29736:3115;
   29736 < L <78426: `max(0,ceil0(3115-(L-29736)*0.06398))`;
   L ≥78426:0. De voetnoot verlangt volledig afgebouwd **op** de eindgrens.
4. **ARK** (§2.2.3.4 p.12–13):
   `t1=round5(.08324*L)`;
   `t2=round5(.31009*max(L-11965,0))`;
   `t3=round5(.01950*max(L-25845,0))`;
   `taper=round5(.06510*max(L-45592,0))`.
   `s1=min(t1,996)`; `s2=min(s1+t2,5300)`;
   `s3=min(s2+t3,5685)`;
   `ARK=max(0,ceil0(s3-taper))`, maar L ≥132920 geeft0
   (volledige afbouw op eindgrens volgens voetnoot).
   De caps gelden **opeenvolgend**; niet ongecapte term1 in som2 hergebruiken.
5. **Korting toepassen / aftoppen** (§2.2.4 p.13): korting UIT: AHK=ARK=0.
   Korting AAN en theoretische AHK+ARK >X1: verminder eerst ARK en daarna AHK
   (algemene officiële volgorde AOK,ARK,OUK,AHK; OUK/AOK hier afwezig), totdat
   toegepaste AHK+ARK=X1. Anders behoud beide. Bewaar zowel theoretische als
   toegepaste credits in trace. `X=max(0,floor0(X1-appliedAHK-appliedARK))`
   voor L ≤Lmax. Hiermee ontstaat nooit negatieve inhouding.
6. **Maandbedragen** (§2.2.5 tabel8 p.15):
   `x=round2(X/F2)`, `ahk=round2(appliedAHK/F2)`,
   `ark=round2(appliedARK/F2)`. Arbeidskorting per tijdvak moet afzonderlijk
   worden vastgelegd (Handboek p.182); bij lage lonen is dit de afgetopte credit.
   `tablePeriodWage=ceil2(L/F2)` is een tracewaarde, niet de werkelijk
   betaalde bruto-/fiscale grondslag. Netto in deze simpele case=`4000-x`.

### Regulier loon boven Lmax

Reguliere maandlonen boven €11.092,50 zijn geen bijzondere beloning.
§2.2.4 p.15 staat de rekenregel (systematiek2) toe. Implementeer deze of
markeer de limiet expliciet als UNSUPPORTED; nooit de normale tabelvloer
doortrekken boven Lmax. Beide credits zijn op Lmax reeds nul.

`taxAtLmaxAnnual=floor0((Lmax-a3)*b3/100+c3)`;
`Y=round5(round2(taxAtLmaxAnnual/F2)*F2)`;
`excessPeriod=round5((L-Lmax)/F2)`;
`Xboven=round5(floor2(excessPeriod*b3/100)*F2)`;
`X1=Y+Xboven`; `X=round5(X1)`; `x=round2(X/F2)`.
Gebruik dit pad pas bij tvl >ceil2(Lmax/F2). §2.2.5 p.16 beschrijft de
maximale-tabelloonafrondingsmarge; voor maand/F2 is Lmax/F2 exact €11092,50.

## Eerste controlecase (analist, rechtstreeks uit bronstappen)

CC-NL-2026-001, september2026, fiscale grondslag €4000, korting AAN:
rawL48000 → L47952; X1=17306; AHK=1950; ARK=5532;
X=9824; loonheffing **€818,67**; netto **€3181,33**;
toegepaste maandarbeidskorting €461,00. Dit is een analistenberekening;
de onafhankelijke oracle moet eigen afleiding en officiële maandtabelcheck
leveren voordat fiscale acceptatie GREEN wordt.

## Unsupported en begrenzing

Iedere andere fiscale jaar-/tabel-/woonland-/herleiding-/leeftijd-/tijdvaksituatie,
onvolledige maand, meerdere IKV's, bijzondere beloning, jonggehandicaptenkorting,
anoniementarief, student/artiest, 30%-regeling, auto, WKR, DGA, pensioen/uitkering,
TWK/nabetaling of andere fiscale uitzondering retourneert een concrete
machine-readable UNSUPPORTED reason. Ontbrekende/ongeldige typed input mag
niet tot een aannametarief leiden. Pensioenbasisinteractie en werkgeverspremies
blijven buiten deze case. Korting UIT vereist uitsluitend overslaan van de
credits en is zonder nieuwe fiscale branch afzonderlijk te verifiëren.

Boundarytests: maandstap €4,50; drie schijven; AHK start/einde; vier ARK-grenzen;
lage-loon-creditcap; Lmax; ROUND2 halve-cent en het boven-Lmax FLOOR2-moment.
Test grenzen met onder/exact/boven én besef dat ruwe annualisatiegrenzen vaak
niet op een tabelloonstap liggen: fiscale formules zien de naar beneden
afgeronde L. Verwachte waarden komen niet uit de productiecalculator.
