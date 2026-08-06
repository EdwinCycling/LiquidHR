# Verzuim en herstel

> **Actuele scope vanaf 2026-08-05:** verzuiminstellingen zijn HR-groepgebonden; een verzuimcasus en ziekteperiode zijn altijd aan één dienstverband gekoppeld. Overlap wordt alleen binnen hetzelfde dienstverband geblokkeerd. Overlap over verschillende dienstverbanden of HR-groepen heen is toegestaan. Zie [HR-groepen: scope, inrichting en domeingrenzen](../multitenancy/HR_GROEP_SCOPE_EN_INRICHTING.md) en [FDR-0006](../../decisions/FDR-0006-parallel-verzuim-per-dienstverband.md).

Status: **LEIDEND**  
Implementatie: **STAP 8 FUNCTIONEEL GEÏMPLEMENTEERD — schema/RLS, API, UI, tests en browsercontrole uitgevoerd; Stap 9 blijft open**
Scope: HR-groepgebonden verzuiminstellingen en employmentgebonden verzuimregistratie.

## 1. Doel

LiquidHR registreert ziekmeldingen, gedeeltelijk herstel en volledig herstel zonder medische diagnoses, oorzaken of behandelingen op te slaan. Een verzuimcasus is altijd gekoppeld aan exact één `employment_id`; de blijvende persoonsidentiteit `employee_id` is nooit de mutatiescope.

## 2. Kernbegrippen

- `absence_case`: één wettelijke/verzuimtechnische keten voor één dienstverband.
- `absence_spell`: een ononderbroken ziekteperiode binnen een casus.
- `absence_capacity_change`: effectieve wijziging van de mate van verzuim.
- `RECOVERY_WINDOW`: volledig hersteld gemeld, maar de vierwekentermijn loopt nog.
- `CLOSED`: de vierwekentermijn is verstreken zonder nieuwe ziekteperiode.

## 3. Registratie

Bij een ziekmelding registreert de gebruiker uitsluitend noodzakelijke operationele gegevens:

- eerste ziektedag;
- meldmoment;
- geldig dienstverband;
- verwachte verzuimduur;
- mate van verzuim;
- lopende werkafspraken;
- vangnet-indicator `ja/nee/onbekend`;
- arbeidsongeval-indicator `ja/nee/onbekend`;
- verkeersongeval met mogelijke derde `ja/nee/onbekend`.

De formulieren bevatten geen diagnose, symptomen, medicatie, behandeling, medische oorzaak of vrij medisch tekstveld. De werkgever mag bij ziekmelding niet vragen naar de aard of oorzaak van de ziekte. Zie [AP, De zieke werknemer](https://autoriteitpersoonsgegevens.nl/uploads/imported/beleidsregels_de_zieke_werknemer.pdf).

## 4. Dienstverbandkeuze

- Zoek bevestigde employments die op de eerste ziektedag geldig zijn.
- Bij exact één geldig dienstverband kiest de server dit automatisch.
- Bij meerdere parallelle dienstverbanden kiest de gebruiker exact één dienstverband, tenzij de afdeling/functiecontext van een leidinggevende exact één geldig dienstverband bepaalt.
- Bij geen geldig dienstverband wordt de mutatie geblokkeerd met een typed fout.
- Verzuimdata worden nooit op meerdere employments tegelijk in één casus geboekt. Afzonderlijke verzuimcasussen op verschillende employments mogen wel gelijktijdig bestaan, ook over HR-groepen heen.
- Herstel op het ene dienstverband wijzigt geen verzuimcasus op een ander dienstverband.

## 5. Vierwekenketen

Een nieuwe ziekteperiode binnen vier volledige kalenderweken na herstel hoort bij dezelfde casus; vanaf vier weken ontstaat een nieuwe casus. De server beslist dit automatisch op basis van datums. De gebruiker krijgt geen vraag over dezelfde of een andere medische oorzaak. Zie [UWV, ziekteperiodes optellen](https://www.uwv.nl/nl/ziek/ziekteperiodes-optellen).

De implementatietest legt de grens vast als:

- 27 dagen tussen herstel en nieuwe eerste ziektedag: dezelfde casus;
- exact 28 dagen: nieuwe casus.

## 6. Gedeeltelijk en volledig herstel

- Een wijziging van het verzuimpercentage is een `absence_capacity_change`.
- Volledig herstel sluit de open `absence_spell`, maar archiveert de casus niet.
- De casus gaat naar `RECOVERY_WINDOW` en toekomstige taken worden gepauzeerd.
- Een hervatting binnen vier weken voegt een nieuwe spell toe aan dezelfde casus en activeert/herberekent taken opnieuw.
- Na de termijn zonder hervatting wordt de casus `CLOSED`.
- Archivering, vernietiging en anonimisering zijn afzonderlijke geaudite processen.

## 7. Frequent verzuim

De drempel staat per HR-groep. De telling blijft per dienstverband/casuscontext herleidbaar en telt casuswortels, niet losse spells in dezelfde keten. De nieuwe casus wordt gemarkeerd wanneer `eerdere_casussen + 1 >= drempel`. De count en drempel worden als snapshot opgeslagen; de resulterende taak is idempotent.

## 8. Toegang

De kernpermissions zijn `absence:read`, `absence:write` en `absence:recover`. Medewerker-selfservice voor de eerste ziekmelding is geïmplementeerd binnen de actieve HR-groep; herstel, capacity-wijzigingen en aanvullende casusvelden blijven server-side en met RLS begrensd. RLS en `requirePermission()` bepalen samen de tenant-, HR-groep-, employment- en casusscope.

## 9. Ingangen

Dezelfde serverflow en gedeelde Zod-schema’s zijn beschikbaar vanuit:

1. het verzuimvenster op het medewerkerdashboard;
2. een geselecteerde medewerkerdag in `/hr-calendar`;
3. het tabblad Verzuim op `/employees/[employeeId]`.

## 10. Buiten scope van de kernslice

Medische dossiers, arbodienstintegraties, ESS, loonbetalingsberekening, oproepkracht-13-wekenmodel, rapportage en bewaarmatrix krijgen afzonderlijke requirements en besluiten.
