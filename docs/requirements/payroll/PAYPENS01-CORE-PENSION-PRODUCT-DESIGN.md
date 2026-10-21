# PAYPENS01 — Core Pension Product Design

**Status:** LEIDEND productrequirementsdocument<br>
**Scope:** normale pensioeninrichting en toepasselijke werknemerskoppeling in Core HR en Payroll<br>
**Productregel:** [`PRODUCT_ENVIRONMENT_PARITY`](../../architecture/PRODUCT_ENVIRONMENT_PARITY.md)

## Productbesluit

Een werkgever beheert pensioenregelingen als gewone administratiegegevens. In Core TEST is een expliciet gekozen fictieve werkgever, waaronder Mars BV, een normale administratie. HR Admins met de reguliere rechten kunnen regelingen inrichten en beheren; Payroll gebruikt de opgeslagen, versiegebonden regeling via de normale productservices.

TEST verandert deze productfunctionaliteit niet. Een regeling wordt niet apart aangemaakt als TEST-feature en werknemers krijgen geen speciale synthetische status. De gegevens kunnen fictief zijn en de interne audittrail registreert die herkomst.

## Reguliere klantworkflow

1. Een bevoegde HR Admin of Payroll Admin opent Pensioenregelingen vanuit de normale beheerervaring.
2. De werkgever legt de regeling, uitvoerder/referentie, effectieve periode, pensioenbasis, franchise, maxima, percentages, verdeling, deelnamevoorwaarden en toepasselijke loon-/urenbehandeling vast voor zover nodig voor die regeling.
3. De applicatie valideert volledigheid, typen, effectieve datums, versieoverlap en onderlinge consistentie. Ze maakt geen wettelijke of contractuele waarden op basis van een voorbeeld, naam of testpersona.
4. Op basis van de opgeslagen regeling en expliciet beheerde toepasselijkheidscriteria koppelt het systeem de relevante dienstverbanden/werknemers. De uitkomst is inzichtelijk en auditeerbaar; ambigue of onvolledige gevallen worden als controle- of reviewpunt aangeboden.
5. Een bevoegde gebruiker kan een koppeling corrigeren of beëindigen via de reguliere wijzigingsflow met ingangsdatum, reden, actor en audit-event. Historische runs en afgesloten versies blijven immutable.
6. Payroll leest de effectieve regeling en toewijzing in de normale bronprojectie en berekeningsflow. Een ontbrekende, niet-ondersteunde of onbewezen juridische regel resulteert in een zichtbare controle/warning of blokkade volgens de lifecycle; er wordt geen fictief bedrag of automatische nul ingevuld.

Er is geen aparte TEST-knop, fixturepagina, synthetic-only route, environment claim of `PENSION_TEST_FIXTURES_ENABLED`-vereiste voor deze normale productworkflow.

## Regelingsgegevens en toepasselijkheid

Regelingsconfiguratie is werkgeveropgegeven data, tenzij een specifieke parameter aantoonbaar uit een onafhankelijke bron is gevalideerd. Het model bewaart minimaal:

- tenant-, HR-groep- en administratiegrens;
- regelingidentiteit, naam, uitvoerder-/regelingreferentie en versie;
- ingangsdatum en optionele einddatum;
- toepasselijkheidscriteria die de werkgever of bevoegde beheerder expliciet heeft vastgelegd;
- financiële parameters met eenheden, basis, afrondings- en verdelingsmethode;
- bron/verantwoording en eventuele verificatiestatus;
- actor, audit-timestamps, supersession en immutable historie.

Toepasselijkheid gebruikt de aanwezige gescopeerde dienstverband-, IKV-, loon-, uren- en arbeidsvoorwaardengegevens en de expliciet beheerde criteria. Een regeling wordt niet alleen aan een administratie toegewezen zonder toepasbaarheidscontrole. Conflicterende regelingen en ontbrekende brongegevens leiden tot een controlepunt, geen stille selectie.

Door de werkgever opgegeven parameters bewijzen niet dat een pensioenregeling juridisch volledig is, op een specifieke werknemer van toepassing is, of fiscaal juist is verwerkt. Die conclusies vereisen passende juridische bronvalidatie en afzonderlijke acceptatie.

## Rechten, audit en gegevenspresentatie

- Beheer verloopt via de bestaande HR Admin-/Payroll Admin-permissions, server-side services en de geldende tenant-, HR-groep- en administratiescope.
- Toewijzingen, correcties, versies en berekeningskeuzes zijn controleerbaar en voorzien van actor, datum, reden, bron, versie en hashes waar het domein dit vereist.
- Managers en werknemers zien alleen de pensioeninformatie die hun normale scope en permissions toestaan.
- Klantgerichte schermen gebruiken gewone termen zoals pensioenregeling en deelname. Ze tonen geen `TEST`, `fixture`, `synthetic` of technische acceptatieclaims op basis van de omgeving.
- Interne audit- en acceptatiedocumentatie benoemt wel TEST/Production, fictieve/echte data, opgegeven/geverifieerde parameters en de grenzen van de compliance-evidence.

## TEST-safety en interne tooling

TEST gebruikt fictieve gegevens en behoudt dezelfde beheerschermen, businessregels en autorisaties. De omgeving blokkeert echte aangiften, SEPA-betalingen, externe distributie en Production-integraties. Een succesvolle lokale of TEST-berekening is geen bewijs dat de regeling juridisch is gevalideerd.

Beveiligde fixture-provisioning, testclaims en flags mogen alleen interne ontwikkel- of acceptatietooling beveiligen. Ze worden niet als productvereiste, autorisatie voor een klantgebruiker, of noodzakelijke stap in de normale pensioenbeheerworkflow gebruikt. Een fixture kan TEST-data klaarzetten; acceptatie van de feature voert daarna normale beheer- en werknemerskoppelingshandelingen uit.

De bestaande CAO-BENCH02/PAYLAB Phase 1-beperking tot drie synthetische Payroll Lab-fixtures blijft een historische interne benchmarkscope. Zij beperkt de Core-pensioenfunctie voor klanten niet. Zie de verduidelijking in [`ADR-PAYLAB-002`](../../decisions/ADR-PAYLAB-002-ARRANGEMENT-FOUNDATION.md).

De benodigde flag en claims in de historische [PAY-RULE-002 acceptatie](../../payroll/acceptance/PAY-RULE-002-PFZW-2026-20261009.md) en [final-closeout](../../payroll/acceptance/PAY-RULE-002-FINAL-CLOSURE-20261010.md) beveiligen die specifieke interne fixture-executie. Ze zijn geen Core-pensioenontwerp en geen precondition voor normale klantinrichting.

## Acceptatiecriteria

Een pensioenfeature voldoet wanneer de relevante criteria zijn getest:

1. Een normale bevoegde beheerder kan een regeling via de gewone productinstellingen aanmaken, versiebeheer uitvoeren en corrigeren.
2. Geldige toepasselijke werknemers/dienstverbanden worden volgens expliciete criteria gekoppeld; niet-toepasselijke en ambigue gevallen worden veilig geweigerd of ter review aangeboden.
3. Geen speciale TEST-flag, fixtureclaim of alternatieve route is nodig voor instellingen, koppelingen of payrollinvoer.
4. Positieve en negatieve normale autorisaties, scopegrenzen en audit-events zijn aangetoond.
5. Effective dating, versie, bron, parameters, herberekening en immutable historische resultaten zijn herleidbaar.
6. Werkgeveropgegeven parameters zijn onderscheiden van juridisch gevalideerde regeling en berekeningssucces van compliance.
7. TEST weigert externe betalingen, aangiften, distributie en Production-integraties.
8. Normale UI en documenten bevatten geen omgeving- of fixturelabels; functionele statussen zoals Concept blijven behouden.

## Gerelateerde standaarden

- [`AA-PAYROLL`](../../AA/AA-PAYROLL.md)
- [`PRODUCT_ENVIRONMENT_PARITY`](../../architecture/PRODUCT_ENVIRONMENT_PARITY.md)
- [`ADR-PAYLAB-002`](../../decisions/ADR-PAYLAB-002-ARRANGEMENT-FOUNDATION.md)
- [`PAYDOC01`](PAYDOC01-PAYSLIP-ANNUAL-STATEMENT-AND-DESIGNER.md)
