Als we de chatbot willen positioneren als de **ultieme invoertool** – waarbij de traditionele grafische interface (de GUI) naar de achtergrond verdwijnt en optioneel wordt – moeten we de chatbot uitrusten met een complete set transactionele vaardigheden (Tools). 

De chatbot wordt hiermee een **Conversational Agent**. Voor complexe acties (zoals het invoeren van een nieuwe medewerker) gebruikt de bot een **multi-step dialog (Conversational Wizard)** of toont hij een tijdelijk, dynamisch invoerformulier direct in de chat via de Liquid Display Engine.

Hier is het overzicht van de functies die we moeten ondersteunen om dit te realiseren, ingedeeld in vier logische domeinen.

---

## 🛠️ De Ultieme Invoer- en Actielijst (AI Tools)

### Domein 1: Instroom, Doorstroom & Uitstroom (Employee Lifecycle)
Dit domein vervangt de grote, intimiderende invoerschermen. De AI begeleidt de gebruiker stapsgewijs door de processen.

| AI Tool & API Functie | Input Parameters | Wat gebeurt er op de achtergrond? |
| :--- | :--- | :--- |
| `initializeOnboarding` | `firstName`, `lastName`, `email` | Start een interactieve wizard. AI vraagt stapsgewijs om BSN, adres, geboortedatum en zet een concept-medewerker klaar. |
| `terminateEmployment` | `employeeId`, `endDate`, `reason` | Sluit het actieve contract (`EmploymentContract.endDate`), sluit de lopende tijdlijnen en registreert de reden van uitdiensttreding. |
| `updateEmployeeField` | `employeeId`, `fieldName`, `value` | Past een specifiek veld op de medewerker aan. **Ondersteunt ook onze dynamic JSONB `customFields`!** (Bijv: *"Sla schoenmaat 43 op bij Jan"* ➡️ `fieldName: "schoenmaat"`, `value: 43`). |

---

### Domein 2: Contract, Rooster & Salaris Mutaties (Payroll Wijzigingen)
Dit domein vervangt de complexe formulieren voor mutaties. De AI berekent de nodige tijdlijnen en sluit voorgaande periodes netjes af.

| AI Tool & API Functie | Input Parameters | Wat gebeurt er op de achtergrond? |
| :--- | :--- | :--- |
| `mutateSalary` | `employeeId`, `startDate`, `paymentType`, `amount`, `salaryBasis`, `scaleId/stepId` | Sluit de huidige actieve `EmployeeSalary` af op `startDate - 1` en maakt een nieuwe salaris-slice aan. Lost schalen/treden op indien van toepassing. |
| `mutateSchedule` | `employeeId`, `startDate`, `scheduleType`, `avgHoursPerWeek`, `daysHoursMap` | Sluit het huidige actieve rooster af en opent een nieuwe `EmployeeSchedule` slice. Past de deeltijdfactor (FTE) automatisch aan. |
| `mutateOrganization` | `employeeId`, `startDate`, `jobTitle`, `departmentId`, `directManagerId` | Verhuist een medewerker organisatorisch. Maakt een nieuwe `EmployeeOrganization` slice aan. |

---

### Domein 3: Self-Service & Workflow Transacties
Dit zijn de dagelijkse, snelle interacties van medewerkers en managers.

| AI Tool & API Functie | Input Parameters | Wat gebeurt er op de achtergrond? |
| :--- | :--- | :--- |
| `requestLeave` | `employeeId`, `startDate`, `endDate`, `hours`, `leaveType` | Maakt een concept-verlofaanvraag aan en start de goedkeurings-workflow richting de manager (die we vinden via onze escalatie-hiërarchie). |
| `reportSick` | `employeeId`, `startDate` | Registreert een ziekmelding. Past de status van de medewerker aan en stuurt een notificatie naar de manager. |
| `reportRecovered` | `employeeId`, `endDate` | Meldt de medewerker weer beter (beter-melding). |
| `processWorkflowTask` | `taskId`, `action` (`APPROVE`/`REJECT`), `comment` | Manager keurt direct vanuit de chat een verlofaanvraag of declaratie van een ondergeschikte goed. |

---

### Domein 4: Organogram, Stamgegevens & Systeembeheer
Hiermee kan de HR-admin het systeem configureren door simpelweg met de bot te praten.

| AI Tool & API Functie | Input Parameters | Wat gebeurt er op de achtergrond? |
| :--- | :--- | :--- |
| `createDepartment` | `name`, `parentId` | Maakt een nieuwe afdeling aan in de boomstructuur (`Department`). |
| `assignDepartmentRole` | `departmentId`, `roleCode`, `employeeId` | Wijst een manager of plaatsvervanger toe aan een specifieke afdeling (`DepartmentManagement`). |
| `createCustomField` | `name`, `entityType`, `fieldType`, `selectOptions` | **Meta-programming via Chat:** Maakt live een nieuw extra veld aan in de `CustomFieldDefinition` tabel (bijv: *"Voeg een extra tekstveld 'Allergieën' toe aan medewerkers"*). |

---

## 💬 Hoe de AI de "Ultieme Invoertool" wordt: De Conversational Wizard

Voor complexe invoer (zoals onboarding of een salariswijziging) willen we niet dat de gebruiker een gigantische lap tekst met 20 parameters in één keer moet typen. De AI start in dat geval een **interactieve dialoog (State Machine)**.

### Voorbeeld Onboarding Dialoog via Chat:

1. **Gebruiker:** *"Ik wil een nieuwe medewerker aanmelden: Mark de Vries."*
2. **AI (Tool Call):** `initializeOnboarding(firstName: "Mark", lastName: "de Vries")`
3. **AI:** *"Wat leuk! Laten we Mark de Vries aanmelden. Om te beginnen: wat is zijn zakelijke e-mailadres en zijn geboortedatum?"*
4. **Gebruiker:** *"mark.devries@bedrijf.nl, en hij is geboren op 4 april 1992."*
5. **AI (Slaat gegevens op in tijdelijke sessie):** *"Genoteerd. Welk bruto maandsalaris hebben jullie afgesproken en hoeveel uur gaat hij werken?"*
6. **Gebruiker:** *"3600 euro op basis van een 40-urige werkweek."*
7. **AI (Berekent FTE en loonstrook-frequentie):** *"Top, dat is een fulltime contract (1.0 FTE). Ik heb een concept-medewerker klaargezet. Controleer de gegevens en klik op bevestigen om hem definitief in dienst te melden."*

   *(De AI toont nu een prachtige, interactieve Liquid Display kaart in de chat)*:
   
   ```
   ┌────────────────────────────────────────────────────────┐
   │ 🆕 Nieuwe Medewerker Concept: Mark de Vries            │
   │                                                        │
   │  - E-mail: mark.devries@bedrijf.nl                     │
   │  - Geboortedatum: 04-04-1992                           │
   │  - Contract: Fulltime (40 uur / 1.0 FTE)               │
   │  - Salaris: € 3.600,00 bruto per maand                 │
   │                                                        │
   │  [ Annuleren ]                      [ Dienst melden ]  <-- Knop stuurt veilige API-call
   └────────────────────────────────────────────────────────┘
   ```

---

## 📝 Toevoeging aan het Master-Architectuur Document

Sla de onderstaande code-block op en voeg deze toe aan het einde van je **`HR_Chatbot_Agent.md`** (of je masterbestand) onder de sectie **"Secure Function Calling"**. Hiermee heeft je AI-assistent de complete bibliotheek van noodzakelijke transactionele API-koppelingen.

```markdown
### 5.3 Complete Transactionele Tool Library (API Endpoints voor AI Agent)

Om de chatbot te laten fungeren als de primaire invoer-interface, moet de AI-assistent de volgende tool-definities (JSON-schemas) implementeren op de backend. Elke tool voert op de achtergrond een autorisatie-check uit via de `actorId` (Module 6).

#### 1. createEmployee (Onboarding start)
```json
{
  "name": "createEmployee",
  "description": "Start het onboarding-proces voor een nieuwe medewerker met basisgegevens. AI vraagt de rest van de gegevens stapsgewijs in een dialoog.",
  "parameters": {
    "type": "object",
    "properties": {
      "firstName": { "type": "string" },
      "lastName": { "type": "string" },
      "email": { "type": "string" }
    },
    "required": ["firstName", "lastName", "email"]
  }
}
```

#### 2. terminateEmployment (Offboarding)
```json
{
  "name": "terminateEmployment",
  "description": "Beëindigt het dienstverband van een medewerker. Sluit het contract en alle actieve tijdlijnen af per de opgegeven datum.",
  "parameters": {
    "type": "object",
    "properties": {
      "employeeId": { "type": "string" },
      "endDate": { "type": "string", "description": "ISO datum (YYYY-MM-DD) waarop het contract eindigt." },
      "reason": { "type": "string", "description": "Reden van uitdiensttreding." }
    },
    "required": ["employeeId", "endDate", "reason"]
  }
}
```

#### 3. mutateSalary (Salariswijziging / Promotie)
```json
{
  "name": "mutateSalary",
  "description": "Voert een salariswijziging door. Sluit de huidige salaris-slice af en opent een nieuwe salaris-slice per ingangsdatum.",
  "parameters": {
    "type": "object",
    "properties": {
      "employeeId": { "type": "string" },
      "startDate": { "type": "string", "description": "Ingangsdatum van het nieuwe salaris (YYYY-MM-DD)." },
      "paymentType": { "type": "string", "enum": ["PERIODIC_FIXED", "HOURLY_VARIABLE"] },
      "amount": { "type": "number", "description": "Het bruto voltijdbedrag of uurloon." },
      "salaryBasis": { "type": "string", "enum": ["MANUAL", "MINIMUM_WAGE", "CUSTOM_SCALE", "CAO_SCALE"] },
      "customScaleStepId": { "type": "string", "description": "Optioneel ID van de loonschaal-trede." }
    },
    "required": ["employeeId", "startDate", "paymentType", "amount", "salaryBasis"]
  }
}
```

#### 4. mutateSchedule (Roosterwijziging)
```json
{
  "name": "mutateSchedule",
  "description": "Wijzigt het werkrooster en de FTE van een medewerker via een nieuwe tijdlijn-slice.",
  "parameters": {
    "type": "object",
    "properties": {
      "employeeId": { "type": "string" },
      "startDate": { "type": "string", "description": "Ingangsdatum van het nieuwe rooster (YYYY-MM-DD)." },
      "scheduleType": { "type": "string", "enum": ["HOURS_PER_DAY", "HOURS_AND_AVG_DAYS", "HOURS_AND_SPECIFIC_DAYS"] },
      "avgHoursPerWeek": { "type": "number" },
      "avgDaysPerWeek": { "type": "number" }
    },
    "required": ["employeeId", "startDate", "scheduleType", "avgHoursPerWeek", "avgDaysPerWeek"]
  }
}
```

#### 5. requestLeave (Verlof aanvragen)
```json
{
  "name": "requestLeave",
  "description": "Dient een verlofaanvraag in voor een medewerker. Start automatisch de goedkeuringsworkflow naar de leidinggevende.",
  "parameters": {
    "type": "object",
    "properties": {
      "employeeId": { "type": "string" },
      "startDate": { "type": "string", "description": "Eerste verlofdag (YYYY-MM-DD)." },
      "endDate": { "type": "string", "description": "Laatste verlofdag (YYYY-MM-DD)." },
      "hours": { "type": "number", "description": "Totaal aantal verlofuren." }
    },
    "required": ["employeeId", "startDate", "endDate", "hours"]
  }
}
```

#### 6. createDepartment (Afdeling aanmaken)
```json
{
  "name": "createDepartment",
  "description": "Maakt een nieuwe afdeling aan binnen de organisatie-boomstructuur.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Naam van de nieuwe afdeling." },
      "parentId": { "type": "string", "description": "Optioneel ID van de bovenliggende afdeling." }
    },
    "required": ["name"]
  }
}
```

#### 7. createCustomField (Dynamisch invoerveld toevoegen)
```json
{
  "name": "createCustomField",
  "description": "Maakt live een nieuw extra invoerveld aan voor een specifieke entiteit (bijv. Medewerker of Contract) in de database-metadata.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Naam van het veld, bijv. Schoenmaat." },
      "entityType": { "type": "string", "enum": ["EMPLOYEE", "CONTRACT", "ASSET", "DECLARATION"] },
      "fieldType": { "type": "string", "enum": ["TEXT", "TEXT_AREA", "SELECT", "DATE", "INTEGER", "DECIMAL", "CURRENCY", "EMAIL", "HYPERLINK"] },
      "selectOptions": { "type": "array", "items": { "type": "string" }, "description": "Optioneel bij type SELECT." }
    },
    "required": ["name", "entityType", "fieldType"]
  }
}
```
```

---

### Conclusie: De "No-UI" Revolutie

Door deze set aan tools te implementeren, bereik je een aantal baanbrekende voordelen:
1. **De interface schuift naar achteren:** Gebruikers hoeven niet meer te navigeren door diepe menu's ("Ga naar Medewerkers -> Klik op Danielle -> Klik op Dienstverband -> Klik op Salaris -> Klik op Bewerken"). Ze typen simpelweg: *"Geef Danielle 200 euro bruto opslag vanaf 1 augustus"* en de AI handelt de rest veilig af.
2. **Mobielvriendelijk:** Je HR-systeem werkt hierdoor direct fantastisch op mobiele apparaten (bijvoorbeeld via een WhatsApp- of Slack-koppeling) omdat praten/typen veel makkelijker is op een klein scherm dan het invullen van desktop-formulieren.
3. **Behoud van de GUI als vangnet:** De traditionele formulieren en overzichten (de GUI) blijven bestaan, maar fungeren puur nog als "read-only" overzicht of als back-up voor als iemand handmatig iets wil controleren. De primaire invoerstroom loopt via de intelligente chatbot.

Dit is een ongelooflijk gaaf concept om te vibe coden. Je hebt nu de volledige blauwdruk in handen! Heb je nog vragen over hoe we dit kunnen integreren, of ben je helemaal klaar om de AI de code te laten schrijven?