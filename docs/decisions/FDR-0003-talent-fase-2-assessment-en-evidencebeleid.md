# FDR-0003: Talent fase 2 — assessment- en evidencebeleid

**Status:** VASTGESTELD VOOR M2.3/M2.4 — veilige defaults gekozen  
**Datum:** 2026-08-02  
**Bron:** fase-2-plan §4, §5 en §9  
**Gerelateerd:** ADR-0007 en ADR-0006

## Doel

Dit functionele besluit legt de voorgestelde status-, herkomst-, zichtbaarheid- en archiveringssemantiek vast voor persoonlijke Talentdata. Het maakt duidelijk wat al een beschermende default is en welke keuzes nog door de product owner moeten worden bevestigd.

## Voorgestelde semantiek

### Assessmentcyclus

Een cyclus gebruikt uitsluitend:

`DRAFT → OPEN → CLOSED → ARCHIVED`

`OPEN` bepaalt wanneer antwoorden mogen worden gewijzigd of ingediend. `CLOSED` blokkeert nieuwe submits. `ARCHIVED` is een historische toestand en opent niets opnieuw. Er is geen status `PUBLISHED` zolang publicatie niet als afzonderlijk productbesluit nodig is.

### Assessmentantwoord

Een self- of managerantwoord gebruikt:

`DRAFT → SUBMITTED → LOCKED → FINALIZED`

`REOPENED` is een auditbare opdracht, geen stille overschrijving. Na een geautoriseerde reopen gaat het antwoord terug naar `DRAFT` met een nieuw versie-/concurrencytoken. Een `FINALIZED` antwoord kan niet normaal worden aangepast of verwijderd.

### Persoonlijke capabilityregistratie

Een registratie gebruikt:

`DRAFT`, `RELEASED`, `EXPIRED`, `ARCHIVED`

`DRAFT` is niet zichtbaar buiten de actor en HR-beleid. `RELEASED` is operationeel leesbaar binnen de rolmatrix. `EXPIRED` blijft historisch zichtbaar als de rol dat mag. `ARCHIVED` is niet beschikbaar voor nieuwe operationele afleidingen.

### Herkomst

De herkomst is een vaste waarde en geen vrij tekstveld:

- `SELF_ENTERED`
- `HR_ENTERED`
- `MANAGER_ENTERED`
- `IMPORTED`

Een systeem mag geen persoonlijke score of capability claim als `SYSTEM_DERIVED` publiceren. Afgeleide inzichten worden later als aparte, herleidbare projectie behandeld.

### Datumsemantiek

- Geldigheid gebruikt ISO-datums met halfopen interval `[valid_from, valid_until)`.
- `valid_until` is exclusief en mag niet vóór `valid_from` liggen.
- Gebeurtenissen zoals submit, lock, reopen, finalize en export gebruiken UTC `timestamptz`.
- `EXPIRED` wordt door geldigheid vastgesteld; een gebruiker kan dit niet als vrije status kiezen.

### Evidence

Evidence is een afzonderlijke referentie naar een geautoriseerde bestaande document-/opslagprojectie. Het bronbestand of de volledige inhoud komt niet in een antwoord-, capability- of auditrecord terecht.

De beschermende default vóór definitieve beleidskeuze is:

- HR Admin ziet evidence alleen met de daarvoor vastgestelde permission;
- een medewerker ziet eigen evidence alleen wanneer de recordpolicy dit expliciet toestaat;
- een manager ziet standaard geen evidence-inhoud en minimaal alleen de informatie die voor de workflow noodzakelijk is;
- private managernotities zijn nooit medewerkerdata in een standaardresponse;
- een `evidence_id` zonder succesvolle scopecheck levert geen metadata of signed URL op.

## Beslispunten voor review

| ID | Vraag | Veilige default tot besluit | Status |
|---|---|---|---|
| M20-01 | Mag een medewerker eigen capabilityrecords direct `RELEASED` maken? | Nee. Eigen records blijven concept; HR bepaalt vrijgave. | BESLOTEN |
| M20-02 | Welke evidence is privé voor HR/manager en welke is zichtbaar voor de medewerker? | Geen evidence-inhoud of signed URL in deze projecties; alleen gecontroleerde status/reference-metadata. | BESLOTEN |
| M20-03 | Wanneer ziet een medewerker de manageruitkomst? | Alleen bij `FINALIZED`; eerder blijft de manageruitkomst verborgen. | BESLOTEN |
| M20-04 | Is een capabilityrecord tenant-owned zonder administratiecontext? | Ja. Talentrecords, assessments en matrixdata zijn tenant-owned; administratie is alleen bestaande scope/provenance. | BESLOTEN |
| M20-05 | Welke bewaartermijn en archiveringsregels gelden? | Historische Talentdata wordt gearchiveerd en niet hard verwijderd; automatische retentie/verwijdering is uitgeschakeld totdat een afzonderlijk bewaarbeleid is vastgesteld. | BESLOTEN |
| M20-06 | Welke minimumgroepsgrootte geldt voor Team Talent en vergelijking? | Deze slice toont alleen individuele rijen; aggregaten zijn uitgeschakeld. Een toekomstige groepsuitkomst vereist minimaal 5 medewerkers. | BESLOTEN |
| M20-07 | Welke notificatieservice wordt gebruikt? | Geen automatische fase-2-notificaties in M2.3/M2.4; bestaande reminders worden niet stilzwijgend hergebruikt. | BESLOTEN |

## Functionele consequenties

- Een score is altijd gekoppeld aan cyclus, onderdeel, beoordelaar, schaal, status, herkomst en tijd.
- Self-score, manager-score, evidence en private notitie zijn nooit één veld of één ongefilterde JSON-response.
- Een manager kan alleen beoordelen binnen de actuele managementscope en binnen een `OPEN` cyclus.
- Een medewerker ziet uitsluitend eigen resultaten en manageruitkomsten die volgens de cycluspolicy zijn vrijgegeven; manageruitkomsten worden pas na `FINALIZED` zichtbaar.
- Reopen, lock en finalize zijn expliciete commands met auditbewijs; dubbel submitten en gesloten cycli geven een stabiele domeinfout.
- Geen percentage, matchscore of ranking wordt toegevoegd als de bron, weging en zichtbaarheid niet in een geaccepteerd besluit staan.

## Reviewuitkomst

De veilige defaults voor M2.3/M2.4 zijn hiermee vastgesteld. M2.1 blijft concept-only voor eigen invoer; M2.3 gebruikt de expliciete statusmachine en gescheiden private notes; M2.4 toont uitsluitend individuele scope-rijen zonder aggregate score. Een toekomstig bewaarbeleid, notificaties en groepsaggregaten kunnen alleen via een nieuw besluit de huidige grenzen uitbreiden.
