# PAYRUN01 — Jan Kinderopvang TEST-scenario — 2026-10-05

**Status: PAYRUN01 TEST PERSONA ASSIGNMENT — accepted synthetic input definition.** “Jan” is only the bounded test persona label. This assignment does not state that a real employee named Jan performs this function, belongs in this scale or salary step, or has these contract hours. The function, salary step, hours, and effective date are explicit synthetic choices; none is inferred from a name or existing salary. It defines test inputs only and does not establish a statutory payroll result.

## Testscenario

| Gegeven | Waarde | Herkomst |
| --- | --- | --- |
| Persona-label | Jan | Synthetische testkeuze |
| Functie | Pedagogisch professional | Synthetische functiekeuze; de officiële functiematrix koppelt deze functie aan schaal 6 |
| CAO-schaal | 6 | Officiële mapping, onder voorbehoud van de functie-indeling |
| Salarisnummer | 20 | Synthetische keuze; geen automatisch aanvangsnummer |
| Contracturen | 32 uur per week | Synthetische keuze: 32/36 = 8/9 = 88,89% van voltijd |
| Ingang testvoorwaarden | 1 september 2026 | Synthetische datum; valt samen met de ingangsdatum van de officiële salaristabel |
| Testmaanden | september en oktober 2026 | Synthetische periode; één volledige maand per salarisbedrag verondersteld |

## Salaris en rekenbasis

De CAO definieert voltijd als gemiddeld 36 uur per week. De officiële tabel per **1 september 2026** geeft voor schaal 6, salarisnummer 20, **€ 3.425 bruto per maand bij 36 uur**. De test legt de voltijdgrondslag en uren vast: `€ 3.425`, 32 contracturen en 36 voltijduren.

De synthetische contractuele maandgrondslag is `€ 3.425 × 32 / 36 = € 27.400 / 9 = € 3.044,444…`; de centweergave is `€ 3.044,44`. De volledige verhouding blijft input voor de PAYRUN01-berekening, zodat de engine geen afgerond weergavebedrag teruggebruikt als tussenstap. De onafhankelijke payroll-oracle moet de toepasselijke centafronding nog vergelijken voordat dit als berekend loonbedrag geldt. De salarisnummerkeuze is niet door de CAO als startpunt voorgeschreven: bij indiensttreding bepaalt de werkgever het salarisnummer. Alleen als de medewerker direct vóór indiensttreding of maximaal één maand eerder dezelfde functie had bij een werkgever die ook onder deze CAO valt, geldt de beschreven ondergrens van het vorige salarisnummer. Daarvoor zijn hier geen persoonsgegevens of historie aangenomen.

## Vakantietoeslag en eindejaarsuitkering

- **Vakantietoeslag:** 8% over de daarvoor geldende grondslag van **1 juni tot en met 31 mei**, uitbetaling in mei. Het voltijd-minimum is € 216,82 per maand vanaf 1 september 2026. De naar rato geldende minimumtoets, de maandelijkse opbouw en het cumulatieve bedrag volgen uit de engineberekening; dit document stelt daarvoor geen deeltijdbedrag vast. De CAO noemt ook doorbetaling, uitkeringen en aanvullingen bij ziekte/arbeidsongeschiktheid in de grondslag.
- **Eindejaarsuitkering:** **8% vanaf 1 januari 2026**, betaald in december en berekend over de twaalf maandsalarissen van januari tot en met december. De opbouw voor september en oktober is 8% van de door de engine vastgestelde salarisgrondslag voor die perioden. Dit document stelt geen bedrag vast en voorspelt geen januari–augustus- of november–decemberbedragen.

In deze synthetische testregeling is voor goedgekeurde uren met familie `ADDITIONAL` expliciet `TIME_OFF` vastgelegd, met een geconfigureerde cashaanvulling van `€ 0,00`. De projectie bewaart die keuze en telt deze uren niet als extra cashloon. De keuze wordt niet afgeleid van de persona-naam of de urenfamilie; een ontbrekende keuze blokkeert de berekening. Gewone `WORK`-uren worden niet boven op het contractuele maandsalaris betaald.

De algemene CAO-regel is dat uurafhankelijke arbeidsvoorwaarden naar verhouding van de contracturen gelden. De concrete kalender-/roosterdagen zijn geen onderdeel van dit scenario.

## Officiële CAO-feiten en bronnen

Alle onderstaande bronnen zijn van **Kinderopvang werkt!** en betreffen de CAO Kinderopvang 2025–2026:

1. [Integrale CAO Kinderopvang 2025–2026 (PDF)](https://www.kinderopvang-werkt.nl/sites/fcb_kinderopvang/files/2025-06/Cao-Kinderopvang-2025-2026-integraal.pdf): §4.2 (voltijd, deeltijd en naar rato), §5.1–5.3 (functie bepaalt schaal, indiensttreding en periodieke verhoging), §5.7 (eindejaarsuitkering), §6.1 (vakantietoeslag), bijlage 1 (functiematrix, gedrukte pp. 55–56) en bijlage 2 (salaristabellen, gedrukte pp. 64–66).
2. [Salaris bepalen](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-salaris-bepalen): schaal volgt de functie in bijlage 1; tabelverhogingen van 2,5% per 1 juli 2025 en 1,5% per 1 september 2026.
3. [Salaris bij indiensttreding](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/het-bepalen-van-het-salaris-bij-indiensttreding-van-de-medewerker): werkgever bepaalt het salarisnummer; de voorwaarden voor behoud van een eerder salarisnummer zijn beperkt.
4. [Vakantietoeslag](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/vakantietoeslag).
5. [Eindejaarsuitkering](https://www.kinderopvang-werkt.nl/cao-kinderopvang-2025-2026/eindejaarsuitkering).

## Uitgesloten

Dit scenario bepaalt geen echte functiewaardering, individueel schaal-/salarisrecht, bestaand salaris, contract, rooster, werkgeverbeleid of historische beloning. Het berekent geen loonheffing/netto, IKV- of fiscale gegevens, pensioen, werkgeverslasten, ORT, verzuim-/verlofcorrecties, volledige jaargrondslagen of een definitieve decemberbetaling. Het maakt geen Payroll-bronmomentopname, berekening, run, payslip of databasewijziging en vormt geen claim van volledige CAO-, fiscale of payroll-compliance.
