# Addendum: bonusverlof op basis van leeftijd en anciënniteit

Dit addendum is onderdeel van de Verlof Opbouw Machine. Leeftijd en anciënniteit zijn een afzonderlijk type verlofopbouw naast contracturen en gewerkte uren. Een regel kan één trigger hebben: `AGE` of `SENIORITY`. Als een administratie beide regelingen gebruikt, worden twee aparte verlofopbouwtegels aangemaakt.

## Architectuur

Een `LeaveBonusRule` hoort bij één verlofprofiel en één verloftype. De regel bevat de naam, de trigger, het toekenningsmoment en de instelling voor pro-rata in het eerste jaar. Een regel heeft één of meer `LeaveBonusTier`-traptreden.

Alle `bonusAmount`-waarden worden opgeslagen voor 100% FTE. Bij toekenning wordt de waarde vermenigvuldigd met de actieve `partTimeFactor` uit de medewerkerplanning op de triggerdatum.

## Datamodel

De database gebruikt de enums `leave_bonus_trigger_type` (`AGE`, `SENIORITY`) en `leave_bonus_award_timing` (`START_OF_YEAR`, `ON_TRIGGER_DATE`).

`leave_bonus_rules` bevat:

- `leave_profile_id` en `leave_type_id` als verplichte relaties;
- `name` als verplichte weergavenaam;
- `trigger_type` voor leeftijd of anciënniteit;
- `award_timing` voor 1 januari of de exacte verjaardag/jubileumdatum;
- `pro_rate_first_year` en `is_active`.

`leave_bonus_tiers` bevat per regel een unieke `threshold_years` en een niet-negatieve `bonus_amount` in uren per jaar bij 100% FTE.

## Tiers-motor

Voor ieder actief profiel:

1. Bij `AGE` wordt de geboortedatum gebruikt; bij `SENIORITY` de datum in dienst.
2. Bereken het aantal volledige jaren op de laatste dag van het kalenderjaar.
3. Kies de hoogste trede waarvoor `thresholdYears <= achievedYears`.
4. Als geen trede is bereikt, wordt niets toegekend.
5. Bepaal de jaarlijkse triggerdatum. Een 29 februari vereist expliciet beleid wanneer het doeljaar geen schrikkeljaar is.
6. Vermenigvuldig de bonus met de actieve FTE-factor.

Bij `START_OF_YEAR` wordt de volledige jaarwaarde vanaf 1 januari toegekend wanneer de drempel in dat jaar wordt bereikt. Bij `ON_TRIGGER_DATE` wordt, als `proRateFirstYear` actief is, vanaf de triggerdatum naar rato van de resterende dagen toegekend. In volgende jaren vervalt die pro-rata-beperking en wordt de volledige waarde op 1 januari toegekend. De hoogste bereikte trede blijft gelden totdat een hogere trede wordt bereikt.

De engine schrijft voor een daadwerkelijke boeking een `LeaveAccrualTransaction` met type `ACCRUAL` en een herkenbare reden, bijvoorbeeld `Leeftijdsbonus (57 jaar)` of `Anciënniteitsbonus (7 jaar)`.

## Beheer-UI

Op ieder verloftype staan de bonusregels als afzonderlijke tegels. De tegel toont profiel, trigger, timing en alle traptreden. Toevoegen ondersteunt meerdere treden en toont onderaan een samenvatting. De bestaande gewone opbouweditor ondersteunt uitsluitend `CONTRACT_HOURS` en `WORKED_HOURS`; leeftijd en anciënniteit worden niet als één gecombineerde basis aangeboden.
