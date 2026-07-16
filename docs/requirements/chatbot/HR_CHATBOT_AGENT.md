> **Status: VERVANGEN.** Dit historische concept is opgevolgd door [`HERA_AI_AGENT.md`](HERA_AI_AGENT.md). Gebruik het nieuwe document voor implementatie; dit bestand blijft alleen als ontwerpgeschiedenis bewaard.

Dit is de ultieme integratie die al onze eerdere modules (Core HR, Contracten, Hiërarchie, Vrije Velden, Liquid Display en Autorisatie) samenbrengt. Een AI-chatbot die niet alleen kan praten, maar ook **acties kan uitvoeren** (een AI Agent), is de meest innovatieve feature die je kunt bouwen.

Om dit veilig, meertalig en met verschillende "levels van praten" op te zetten, moeten we wegblijven van het gevaarlijke idee dat de AI rechtstreeks in de database schrijft of zoekt. We bouwen dit op via **Secure Tool-Use (Function Calling)** en een **Human-in-the-Loop** bevestigingssysteem.

---

### 🧠 De 4 Pilaren van de HR Chatbot Agent

#### 1. Veiligheid Eerst (Enforce Module 6)
De chatbot mag *nooit* direct SQL-queries uitvoeren of omwegen zoeken. De chatbot praat uitsluitend met de database via **vooraf gedefinieerde, beveiligde functies (Tools)** op de backend. 
Elke keer dat de AI een tool aanroept (bijv. `getCurrentSalary()`), checkt de backend eerst via de autorisatie-middleware (Module 6) of de ingelogde gebruiker (`actorId`) dit recht daadwerkelijk heeft. Zo niet, dan weigert de backend de actie en meldt de AI netjes: *"Ik heb hier geen rechten voor."*

#### 2. Human-in-the-Loop (Voor opdrachten / schrijf-acties)
Als de gebruiker een opdracht geeft (bijv. *"Verander mijn adres naar Stationsstraat 22"*), voert de AI dit **niet direct** uit in de database.
*   **De flow:** De AI roept de tool `draftAddressUpdate` aan. Deze tool genereert een **bevestigings-widget** in de chat (gemaakt via de Liquid Display Engine). 
*   **De actie:** De chatbot typt: *"Ik heb de adreswijziging voor je klaargezet. Klopt dit?"* en toont een knop **[Bevestigen]**. Pas als de gebruiker op de knop klikt, wordt de schrijf-actie daadwerkelijk veilig op de backend uitgevoerd.

#### 3. Conversatiehistorie & Memory (Sessie-geheugen)
We slaan de chatberichten op in de database (`ChatMessage`). Bij elke nieuwe vraag sturen we de laatste X berichten mee naar de LLM. Hierdoor onthoudt de bot de context:
*   *Gebruiker:* *"Wie is de manager van Danielle Rademaker?"* -> *AI:* *"Clemens Zorgvliet."*
*   *Gebruiker:* *"En wat is zijn e-mailadres?"* -> *AI snapt dat "zijn" slaat op Clemens.*

#### 4. Verschillende Levels van Praten (System Prompts)
De chatbot past zijn toon en de hoeveelheid informatie die hij deelt (het "level of conversation") dynamisch aan op basis van de **rol** van de ingelogde gebruiker:
*   **Employee Level (Empathisch & Begeleidend):** Richt zich op self-service, is informeel en behulpzaam. *"Hoi Jan, ik zie dat je nog 5 vakantiedagen hebt. Zal ik een verlofaanvraag voor je klaarzetten?"*
*   **Manager Level (Actiegericht & Efficiënt):** Richt zich op to-do's, goedkeuringen en teamstatistieken. *"Hoi Clemens, er staan nog 3 verlofaanvragen open voor jouw team. Wil je ze hier direct accorderen?"*
*   **HR Admin Level (Formeel & Datagericht):** Richt zich op mutaties, rapportages en compliance. *"De loonstijging voor afdeling Operations is verwerkt in de payroll-run van deze maand."*

---

### 📝 Het complete Markdown document: `HR_Chatbot_Agent.md`

Sla dit document op als **`HR_Chatbot_Agent.md`**. Het geeft je AI-assistent de perfecte blauwdruk om deze hypermoderne conversational AI-laag bovenop je HR-systeem te bouwen.

```markdown
# Architectuur & Datamodel: HR Chatbot Agent (Module 7)

## 1. Inleiding
De **HR Chatbot Agent** is een conversatie-gestuurde interface waarmee gebruikers in natuurlijke taal gegevens kunnen opvragen (Queries) en opdrachten kunnen geven (Commands). 

De agent maakt gebruik van **Secure Tool-Use (Function Calling)**. Dit garandeert dat de AI nooit rechtstreeks database-queries uitvoert, maar uitsluitend beveiligde API-endpoints aanroept die worden gecontroleerd door de Autorisatie Middleware (Module 6).

---

## 2. Aanwijzingen voor de AI (Vibe Coding Instructions)

- **Taal:** Schrijf alle backend-code, tabelnamen, API-endpoints en systeem-prompts in het **Engels**.
- **Taaldetectie:** De chatbot moet automatisch reageren in de taal waarin de gebruiker typt (bijv. Nederlands of Engels), of terugvallen op de `preferredLanguage` van de medewerker.
- **Human-in-the-Loop Rule:** Schrijfacties (zoals adreswijzigingen of verlofaanvragen) mogen **nooit** direct door de AI in de database worden weggeschreven. De AI moet een JSON-payload teruggeven die in de frontend rendert als een **interactieve bevestigingskaart** met een `[Confirm]` en `[Cancel]` knop. Pas na een klik op `Confirm` voert de API de wijziging uit.
- **Security Check:** Elke backend-functie (tool) die door de AI wordt aangeroepen, moet als eerste parameter de `actorId` (van de ingelogde gebruiker) meekrijgen om via Module 6 te verifiëren of de actie is toegestaan.

---

## 3. Datamodel: Chat & Memory

Om de chatbot context en geheugen te geven over meerdere sessies heen, slaan we de conversatiehistorie op in de database.

### 3.1 ChatSession (De Chat-conversatie)
**Relatie:** `Employee` (1) -> `ChatSession` (0..*)

| Field Name | Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Foreign Key | Verwijst naar de ingelogde `Employee.id`. |
| `title` | String | Required | Automatisch gegenereerde samenvatting van de chat (bijv. "Adreswijziging Jan"). |
| `createdAt` | DateTime | Required, Def: NOW| Tijdstip van aanmaken. |

### 3.2 ChatMessage (De Chatberichten)
Slaat elk individueel bericht op, inclusief eventuele metadata over de door de AI aangeroepen tools.
**Relatie:** `ChatSession` (1) -> `ChatMessage` (0..*)

| Field Name | Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `sessionId` | UUID | Foreign Key | Verwijst naar `ChatSession.id`. |
| `sender` | Enum | Required | `USER` (de medewerker) of `AI` (de chatbot). |
| `content` | Text | Required | De daadwerkelijke tekst van het bericht. |
| `toolCalls` | JSONB | Optional | Indien de AI een tool heeft aangeroepen, slaat dit de naam en parameters van de tool op (handig voor debugging). |
| `createdAt` | DateTime | Required, Def: NOW| |

---

## 4. Chatbot Persona's & "Levels of Conversation"

De AI moet zijn gedrag en system prompt dynamisch aanpassen op basis van de actieve rol van de ingelogde gebruiker.

### 4.1 Employee Level (Self-Service)
- **Doel:** Helpen met verlof, declaraties, loonstroken en persoonsgegevens.
- **Toon:** Vriendelijk, empathisch, informeel (jij/jou) en uiterst behulpzaam.
- **Systeem Instructie Fragment:**
  > "You are an empathetic HR Assistant. Speak in a warm, helpful tone. Help the employee with self-service tasks like requesting leave, checking their own balance, or drafting address changes. Always use 'Human-in-the-loop' confirmation widgets for any write action."

### 4.2 Manager Level (Team Beheer)
- **Doel:** Helpen bij goedkeuringen, verlofkalenders, team-roosters en prestaties.
- **Toon:** Professioneel, actiegericht, to-the-point en efficiënt.
- **Systeem Instructie Fragment:**
  > "You are a concise Manager Assistant. Focus on efficiency. Present approvals clearly. Help the manager optimize their team schedule and resolve hierarchy queries. Do not waste time on overly polite chit-chat."

### 4.3 HR Admin Level (Bedrijfsbeheer & Compliance)
- **Doel:** Helpen bij mutaties, payroll-checks, CAO-regels en organisatiebeheer.
- **Toon:** Formeel, uiterst accuraat, datagericht en discreet.
- **Systeem Instructie Fragment:**
  > "You are a highly precise, formal HR Compliance Agent. Accuracy and security are paramount. Verify data paths. Help the admin with bulk changes, payroll auditing, and organizational hierarchy. Always maintain strict confidentiality."

---

## 5. Secure Function Calling (De AI Tools)

De AI heeft toegang tot de volgende beveiligde backend functies (Tools). Elk van deze functies checkt op de backend de autorisatie van de `actorId`.

### 5.1 Query Tools (Gegevens opvragen)
- `getEmployeeProfile(actorId, targetEmployeeId)`: Haalt persoonsgegevens op (NAW, relaties).
- `getEmployeeSalary(actorId, targetEmployeeId)`: Haalt actieve salarisgegevens op.
- `getEmployeeSchedule(actorId, targetEmployeeId)`: Haalt actieve roostergegevens op.
- `getManagerOfEmployee(actorId, targetEmployeeId, roleCode)`: Start de `getManagerForEmployee` recursieve boom-zoekopdracht.
- `getTeamAbsences(actorId, departmentId, date)`: Haalt afwezigheden op binnen de scope van de manager.

### 5.2 Command Tools (Opdrachten & Wijzigingen)
- `draftAddressUpdate(actorId, targetEmployeeId, street, houseNumber, addition, zipCode, city)`: Genereert een adreswijziging-ontwerp en stuurt een Bevestigings-Widget terug naar de frontend.
- `draftLeaveRequest(actorId, targetEmployeeId, startDate, endDate, hours)`: Genereert een concept-verlofaanvraag en stuurt een Bevestigings-Widget terug naar de frontend.
- `approveWorkflowTask(actorId, taskId)`: Keurt een openstaande taak (bijv. verlof van een ondergeschikte) goed.

---

## 6. Voorbeeld Flow: Adreswijziging (Human-in-the-loop)

```
Gebruiker: "Ik ben verhuisd naar Stationsstraat 22, 8171 TR in Vaassen."
   │
   ▼ (AI detecteert verhuis-intentie en roept tool aan)
Tool Call: draftAddressUpdate(actorId: "100110", street: "Stationsstraat", houseNumber: "22", zipCode: "8171 TR", city: "Vaassen")
   │
   ▼ (Backend verifieert Module 6: Mag actor "100110" zijn eigen adres wijzigen? -> JA)
Backend Response: { status: "DRAFT_CREATED", data: { street: "Stationsstraat", houseNumber: "22", ... } }
   │
   ▼ (AI genereert tekst + Liquid Display Bevestigings-Widget)
Chatbot: "Ik heb je nieuwe adres voor je klaargezet. Controleer de gegevens hieronder:"

┌────────────────────────────────────────────────────────┐
│  Adreswijziging Concept                                │
│  - Adres: Stationsstraat 22, 8171 TR Vaassen           │
│                                                        │
│  [ Annuleren ]                      [ Adres Bevestigen ]  <-- Klik actie door gebruiker
└────────────────────────────────────────────────────────┘
```
```

***

### Samenvatting van de complete architectuur:
We hebben nu een volledig dekkend, modern en uiterst geavanceerd HR-systeem ontworpen via deze opeenvolgende modules:

1.  **`Medewerker_Record.md`**: Alle basisgegevens en tijdsgebonden adressen.
2.  **`Contract_Dienstverband.md`**: De tijdsgebonden financiële en rooster-tijdlijnen.
3.  **`Organisatie_Rollen_Hierarchie.md`**: De afdelingenboom, rollen en automatische escalaties.
4.  **`Vrije_Velden.md`**: Volledige flexibiliteit via dynamische vrije velden (JSONB).
5.  **`Autorisatie_Rechten_Matrix.md`**: Een waterdicht, door de admin te beheren rollen- en rechtensysteem met automatische scope-bepaling.
6.  **`Liquid_Display_Engine.md`**: Het on-the-fly genereren van de UI op basis van queries.
7.  **`HR_Chatbot_Agent.md`**: De conversational AI-laag die bovenop al deze systemen communiceert en acties uitzet.

Dit is een ongeëvenaard fundament om mee te gaan vibe coden. Je hebt hiermee alle documenten in handen om een revolutionair product te bouwen. Is er nog een laatste ding dat we moeten bespreken, of ben je klaar om te gaan bouwen?
