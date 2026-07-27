# Wet verbetering poortwachter

Status: **LEIDEND — wettelijke milestone-set nog inhoudelijk te valideren**  
Afhankelijkheid: `VERZUIM_EN_HERSTEL.md`.

## 1. Doel

De WvP-engine plant operationele taken rond een verzuimcasus, met de ziekteperioden als bron van waarheid en met een effectieve casusklok die herstelgaten niet als ziektedagen telt.

## 2. Wettelijke basis

De te seeden systeemset wordt vóór productie-inrichting inhoudelijk bevestigd. De eerste ontwerp-kandidaten zijn probleemanalyse rond week 6, plan van aanpak rond week 8, evaluatie iedere zes weken, de 42e-weeksmelding en de eerstejaarsevaluatie. Raadpleeg [UWV, stappenplan zieke werknemer](https://www.uwv.nl/en/employers/sickness/a-step-by-step-guide-to-employee-sickness) en [Rijksoverheid, regels bij ziekte](https://www.rijksoverheid.nl/themas/werk/ziekteverzuim-van-het-werk/regels-en-verplichtingen-bij-ziekte).

## 3. Klok

- De spells vormen de bron van waarheid.
- De engine berekent opgebouwde ziekteduur exclusief herstelgaten.
- `effective_clock_start_on` is een door de engine bewaakte projectie.
- Een te laat afgeronde taak verschuift de volgende wettelijke deadline niet.
- Een hervatting binnen de keten herberekent alleen toekomstige deadlines die door de klok veranderen.

## 4. Taken

`absence_tasks` is de workflowbron. De bestaande `reminders`, `reminder_target_rules` en `reminder_recipients` verzorgen signalering en ontvangers. Een taak heeft een deadline, status, bewijsvereiste, toegewezen medewerker of onbehandelde werkvoorraad en optionele reminderkoppeling.

Bij ontbreken van een casemanager of directe manager wordt niet willekeurig één HR-gebruiker gekozen. De taak blijft zichtbaar in een geautoriseerde werkvoorraad totdat een bevoegde gebruiker toewijst.

## 5. Evidence

Een evidenceplichtige taak kan alleen transactioneel worden voltooid wanneer de vereiste niet-medische re-integratiecategorie aanwezig is. Medische adviezen en medische dossiers horen niet in het werkgeversdossier.

## 6. Eigen bedrijfstaken

HR Admin kan administratiegebonden, niet-wettelijke taken toevoegen. Een systeemcode, bron, versie en wettelijke deadline zijn niet wijzigbaar door een tenant. Eigen taken worden gedeactiveerd, niet hard verwijderd wanneer historische cases ernaar verwijzen.

## 7. Buiten scope

De 13-wekenberekening voor oproepkrachten, UWV-/arbodienstkoppelingen, loonbetaling en automatische notificaties volgen pas na een aparte bronkwaliteits-, payroll- en privacybeslissing.
