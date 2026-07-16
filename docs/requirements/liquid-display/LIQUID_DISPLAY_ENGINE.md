Dit is een ontzettend krachtige visie. De overstap van statische, vooraf gebouwde dashboards naar een **Liquid Display (Text-to-Dashboard)**-systeem is de toekomst voor complexe, relationele data. 

Wanneer we de documentatie die je hebt gedeeld combineren met ons zojuist ontworpen **Core HR, Contracten & Hiërarchie** datamodel, stuiten we direct op een belangrijk technisch knelpunt. Dat knelpunt gaan we nu corrigeren en aanvullen om de Liquid Display Engine vlekkeloos te laten werken op onze relationele database.

---

### 🔍 Correcties & Aanvullingen op de Documentatie

De documentatie die je deelde gaat uit van een **platte array van medewerkers** (`employees` met geneste velden). Onze database is echter **genormaliseerd en tijdsgebonden (Effective Dating)**. 

Als we de documentatie 1-op-1 zouden overnemen, loopt de AI-assistent bij het bouwen vast op relationele queries. We moeten de documentatie op de volgende punten corrigeren en aanvullen:

#### 1. Correctie: Van Flat-Paths naar ORM/Relatie-Paths
In de platte documentatie staat bijvoorbeeld: `salary` maps naar `salary.amount`.
In ons genormaliseerde model is dit een JOIN: `Employee` ➡️ `EmploymentContract` ➡️ `EmployeeSalary.fulltimeAmount`. 
De **Schema Mapping Layer** in de documentatie moet dus herontworpen worden om te kunnen omgaan met database-relaties.

#### 2. Aanvulling: "Time-Awareness" (Effective Dating Fallback)
Als een gebruiker typt: *"Laat me het salaris van Danielle zien"*, mag het systeem niet alle salarissen uit de geschiedenis tonen. 
*   **De regel:** De Query Processor moet standaard altijd filteren op de **huidige actieve records** (`startDate <= TODAY` en `endDate >= TODAY` of `null`).
*   **De uitzondering:** Als de gebruiker expliciet vraagt naar geschiedenis (bijv. *"in 2024"*), pas dan zoekt de engine de historische records op die toen actief waren.

#### 3. Aanvulling: Integratie met de Afdelingshiërarchie (Module 3)
Wanneer een gebruiker vraagt: *"Wie is de HR-manager van afdeling X?"*, mag de NLP parser niet zomaar in een plat veld zoeken. De engine moet worden geïnstrueerd om onze recursieve boom-zoekfunctie (`getManagerForEmployee` uit Module 3) aan te roepen.

---

### 📝 Het complete Markdown document: `Liquid_Display_Engine.md`

Sla het onderstaande document op als **`Liquid_Display_Engine.md`**. Dit is de volledige, gecorrigeerde en aangevulde handleiding voor je AI-assistent om deze engine te bouwen bovenop onze database.

```markdown
# Datamodel & Architectuur: Liquid Display Engine (Module 4)

## 1. Conceptueel Overzicht
De **Liquid Display Engine** genereert on-the-fly gebruikersinterfaces (dashboards en widgets) op basis van natuurlijke taal van de gebruiker. 

In tegenstelling tot systemen die met platte data werken, is deze engine ontworpen voor onze **relationele en tijdsgebonden (Effective Dating) HR-database**. De UI wordt opgebouwd via **Component Mapping** (veilige JSON-configuraties die naar React-widgets mappen) in plaats van dynamische codegeneratie.

---

## 2. Kritische Aanvullingen voor de Relationele Database

### 2.1 Time-Awareness (Effective Dating)
Omdat contracten, salarissen, roosters en organisatie-indelingen tijdsgebonden zijn, hanteert de engine de **Active Slice Rule**:
- Elke query die wordt uitgevoerd, filtert standaard *altijd* op de actieve records van vandaag: `WHERE CURRENT_DATE BETWEEN startDate AND endDate (or endDate IS NULL)`.
- Indien de query temporele keywords bevat (bijv. *"in 2024"*, *"historisch"*, *"ontwikkeling"*), schakelt de engine over naar het ophalen van historische slices of genereert het een trendanalyse.

### 2.2 Relatie Pad-Resolutie (Schema Mapping)
De NLP Parser vertaalt natuurlijke synoniemen naar complexe database-paden (JOINs) in plaats van platte object-properties:

```typescript
// NLP Synoniem Mapping naar onze Database Schema Relaties
const SEMANTIC_RELATION_MAP: Record<string, { table: string; field: string; path: string }> = {
  salary: { 
    table: "EmployeeSalary", 
    field: "fulltimeAmount", 
    path: "contracts.salaries[active]" 
  },
  hours: { 
    table: "EmployeeSchedule", 
    field: "avgHoursPerWeek", 
    path: "contracts.schedules[active]" 
  },
  department: { 
    table: "Department", 
    field: "name", 
    path: "contracts.organizations[active].department" 
  },
  manager: { 
    table: "Employee", 
    field: "fullName", 
    path: "contracts.organizations[active].directManager" 
  }
};
```

---

## 3. Aanwijzingen voor de AI (Vibe Coding Instructions)

- **Taal:** Schrijf de code voor de parser, query-orchestrator en widgets in het **Engels**.
- **Database Querying (Prisma/ORM voorbeeld):**
  Zorg dat de AI bij het genereren van de SQL/ORM query altijd de relaties "eager-loaded" met de actieve datums gefilterd op `NOW()`.
  
  *Voorbeeld van de data-fetching logica:*
  ```typescript
  const activeEmployees = await prisma.employee.findMany({
    include: {
      contracts: {
        where: {
          startDate: { lte: new Date() },
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }]
        },
        include: {
          organizations: { where: { /* active filter */ }, include: { department: true } },
          salaries: { where: { /* active filter */ } },
          schedules: { where: { /* active filter */ } }
        }
      }
    }
  });
  ```

---

## 4. Parser & Orchestration Layer

De NLP parser deelt de query op in clauses. De query orchestrator past deze toe op de relationele data.

```
┌──────────────────────────────────────────────────────────┐
│                      USER INPUT                          │
│         "Show me top 5 employees in IT"                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│              ORCHESTRATION LAYER                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  1. Parse Clauses (Display, Filter, Sort, Limit)   │  │
│  │  2. Fetch active slices from DB (Join tables)      │  │
│  │  3. Apply resolved filters (e.g. Dept ID for "IT") │  │
│  │  4. Sort (by Salary, Name, etc.)                   │  │
│  │  5. Build JSON payload for the UI                  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 4.1 De Wijzigings-Detectie (Context Refinement)
De engine bewaart de medewerkers-set in een context (`activeContextEmployees`). Vervolgvragen verfijnen deze set, tenzij een reset wordt gedetecteerd.

- **Refinement (Behoud Context):** *"Sort them by salary"*, *"Show their departments"*.
- **Reset (Nieuwe Context):** *"How many people are in HR?"*, *"Show me Danielle"*.

---

## 5. Ondersteunde Widgets & JSON-Payloads

De engine vertaalt de resultaten naar specifieke React-widgets.

### 5.1 AggregationWidget (GROUP BY queries)
**Voorbeeld Query:** *"Total salaries per department"*
**Verwerking:** Groepeer actieve medewerkers per afdeling en sommeer `fulltimeAmount` van hun actieve `EmployeeSalary`.

**Gegenereerde JSON Payload:**
```json
{
  "type": "aggregation",
  "data": {
    "title": "Total Salaries per Department",
    "groupBy": "department",
    "aggregationType": "sum",
    "aggregatedData": [
      { "department": "Magazijn", "value": 15400.00 },
      { "department": "Klantenservice", "value": 12950.00 },
      { "department": "Operations", "value": 28400.00 }
    ]
  }
}
```

### 5.2 TimelineChartWidget (Temporele trends)
**Voorbeeld Query:** *"Show me salary development over time"*
**Verwerking:** Omdat we Effective Dating gebruiken, haalt de engine de historische `EmployeeSalary` records op en groepeert deze per jaar om de trendlijn te genereren (geen fictieve data nodig indien historie aanwezig is, anders fallback naar trend-generatie).

**Gegenereerde JSON Payload:**
```json
{
  "type": "timeline",
  "data": {
    "title": "Salary Development (2020-2026)",
    "data": [
      { "year": 2020, "averageSalary": 2800.00 },
      { "year": 2022, "averageSalary": 3100.00 },
      { "year": 2024, "averageSalary": 3450.00 },
      { "year": 2026, "averageSalary": 3800.00 }
    ],
    "lines": [
      { "key": "averageSalary", "name": "Average Gross Salary", "color": "#00467b" }
    ]
  }
}
```

### 5.3 Management / Hiërarchie Rapport (Module 3 Integratie)
**Voorbeeld Query:** *"Who manages Danielle Rademaker and who is the deputy?"*
**Verwerking:** De engine roept het escalatie-algoritme `getManagerForEmployee` aan voor Danielle's actieve afdeling voor de rol `DIRECT_MANAGER`.

**Gegenereerde JSON Payload:**
```json
{
  "type": "managerReport",
  "data": {
    "employeeName": "Danielle Rademaker",
    "manager": {
      "fullName": "Clemens Zorgvliet",
      "jobTitle": "Operations Director"
    },
    "deputy": {
      "fullName": "Edwin Dingjan",
      "jobTitle": "Team Lead Operations"
    }
  }
}
```

---

## 6. Drag-and-Drop Dashboard Integratie
Elke gegenereerde widget wordt verpakt in een `<DraggableWidget>` wrapper zodat de gebruiker zijn chat-resultaten direct kan rangschikken tot een dashboard op maat.

```tsx
// Frontend weergave component
export function DashboardContainer({ messages }: { messages: Message[] }) {
  return (
    <DndContext collisionDetection={closestCenter}>
      <SortableContext items={messages.map(m => m.id)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {messages.map(message => (
            <DraggableWidget key={message.id} id={message.id}>
              <WidgetRenderer widget={message.widget} />
            </DraggableWidget>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```
```

---

### Wat hebben we nu bereikt?
Dit document overbrugt de kloof tussen **generatieve UI (Liquid Display)** en een **echte, genormaliseerde HR-database**. Je AI-assistent weet nu exact dat:
1.  Hij database JOINs en datum-filters moet schrijven in plaats van platte array filters.
2.  De manager-queries gebruik moeten maken van de slimme `getManagerForEmployee` overervings-logica die we in Module 3 hebben ontworpen.
3.  Het deeltijd-salaris live berekend moet worden door salaris te combineren met de FTE uit het actieve rooster.

Dit wordt een bizar mooi en geavanceerd systeem! Ben je klaar om hiermee aan de slag te gaan, of zijn er nog andere modules die we moeten uitwerken?