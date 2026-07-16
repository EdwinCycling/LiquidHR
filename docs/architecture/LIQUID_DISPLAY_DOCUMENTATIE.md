# Liquid Display: Text-to-Dashboard Documentatie

## Inhoudsopgave

1. [Conceptueel Overzicht](#1-conceptueel-overzicht)
2. [Functionele Specificaties](#2-functionele-specificaties)
3. [Technische Architectuur](#3-technische-architectuur)
4. [Implementatie Stappenplan](#4-implementatie-stappenplan)
5. [Voorbeeld JSON-Payload](#5-voorbeeld-json-payload)
6. [Geavanceerde Functionaliteit](#6-geavanceerde-functionaliteit)

---

## 1. Conceptueel Overzicht

### 1.1 Wat is Liquid Display?

**Liquid Display** is een paradigmaverschuiving in de manier waarop dashboards worden gebouwd en geconsumeerd. In plaats van vooraf gedefinieerde, statische dashboards met vaste widgets, genereert een Liquid Display systeem de user interface **on-the-fly** op basis van natuurlijke taal input van de gebruiker.

#### De Kernprincipes:

- **Generatief in plaats van Statisch**: De UI bestaat niet van tevoren, maar wordt gegenereerd op het moment van de vraag.
- **Intentie-gestuurd**: Het systeem interpreteert de bedoeling van de gebruiker en kiest automatisch de beste visualisatie.
- **Data-agnostisch**: Werkt met ELKE database-structuur door middel van schema mapping.
- **Conversationeel**: Ondersteunt drill-down en verfijning door middel van vervolgvragen.

### 1.2 Van Fixed Dashboarding naar Generative UI

#### Traditional Fixed Dashboard:
```
┌─────────────────────────────────────┐
│  KPI 1    │  KPI 2    │  KPI 3     │
├─────────────────────────────────────┤
│         Bar Chart (hardcoded)        │
├─────────────────────────────────────┤
│      Data Table (hardcoded)          │
└─────────────────────────────────────┘
```
- Ontwikkelaar bepaalt vooraf welke data en visualisaties worden getoond
- Gebruiker kan alleen interacteren met voorgedefinieerde filters
- Elke nieuwe vraag vereist code-wijzigingen

#### Liquid Display Dashboard:
```
User: "Show me the top 5 highest paid employees in IT"

┌─────────────────────────────────────┐
│  [AI genereert automatisch]         │
│  - Employee Table Widget            │
│  - Columns: Name, Function, Salary  │
│  - Filtered: Department = IT        │
│  - Sorted: Salary DESC              │
│  - Limited: 5 rows                  │
└─────────────────────────────────────┘

User: "Show their email addresses and managers"

┌─────────────────────────────────────┐
│  [AI verfijnt bestaande resultaat]  │
│  - Same 5 employees (context kept)  │
│  - Columns: Email, Manager          │
└─────────────────────────────────────┘
```
- Gebruiker stelt vragen in natuurlijke taal
- Systeem genereert de juiste visualisatie en data-selectie
- Context wordt behouden voor verfijning
- Geen code-wijzigingen nodig voor nieuwe queries

### 1.3 Voordelen van Liquid Display

1. **Flexibiliteit**: Gebruikers krijgen EXACT de data die ze willen, op ELKE manier die ze willen.
2. **Snelheid**: Geen wachten op ontwikkelaars voor nieuwe dashboards.
3. **Schaalbaarheid**: Eén systeem ondersteunt oneindig veel queries.
4. **Toegankelijkheid**: Niet-technische gebruikers kunnen complexe data-analyses doen.
5. **Contextbehoud**: Natuurlijke conversatie flow met drill-down mogelijkheden.

---

## 2. Functionele Specificaties

### 2.1 Dynamic Data Binding

Het systeem koppelt automatisch natuurlijke taal aan database-velden door middel van **semantische mapping**.

#### Field Mappings (Voorbeeld):
```typescript
const FIELD_MAPPINGS: Record<string, string[]> = {
  name: ["name", "full name", "fullname", "employee name"],
  salary: ["salary", "pay", "wage", "compensation", "income", "earnings"],
  department: ["department", "dept", "division", "team"],
  yearsInService: ["years in service", "tenure", "how long", "years of service"]
}
```

**Hoe het werkt**:
1. Gebruiker vraagt: "Show me salaries and departments"
2. NLP parser detecteert:
   - "salaries" → maps naar field `salary`
   - "departments" → maps naar field `department`
3. Query processor haalt deze velden op uit de database
4. Widget renderer toont deze exact in de volgorde zoals genoemd

### 2.2 Widget Autonomie

Het systeem kiest **automatisch** de beste visualisatievorm op basis van:
- Aantal velden
- Type data (numeriek, categorisch, temporeel)
- Aggregatie-niveau (individueel vs. gegroepeerd)
- Expliciete keywords in de query

#### Beslissingsboom:

```
Query komt binnen
    │
    ├─ Bevat "chart"/"graph"? 
    │   └─ YES → ChartWidget (bar/pie/line)
    │
    ├─ Bevat "word cloud"?
    │   └─ YES → WordCloudWidget
    │
    ├─ Bevat "timeline"/"trend"/"over time"?
    │   └─ YES → TimelineChartWidget
    │
    ├─ Bevat "GROUP BY" intentie (aggregation)?
    │   └─ YES → AggregationWidget
    │
    ├─ Meer dan 2 velden OF sorting?
    │   └─ YES → EmployeeTableWidget (tabular display)
    │
    └─ Default
        └─ EmployeeWidget (card-based display)
```

#### Ondersteunde Widgets:

| Widget Type | Use Case | Voorbeeld Query |
|------------|----------|-----------------|
| **EmployeeWidget** | 1-2 velden, simple display | "Show me Pieter Jansen" |
| **EmployeeTableWidget** | 3+ velden, sorted/filtered data | "Top 10 employees by salary, show name, function, department, salary" |
| **AggregationWidget** | GROUP BY queries met COUNT/SUM/AVG | "Show me all departments and the total of people" |
| **ChartWidget** | Visualisatie van distributies | "Show me a bar chart of employees by location" |
| **WordCloudWidget** | Frequentie-analyse | "Word cloud of all functions" |
| **TimelineChartWidget** | Temporele trends | "Show me income development over time by education" |
| **StatsWidget** | Simpele KPI's | "How many employees do we have?" |

### 2.3 Interactiviteit & Context Management

#### Context Refinement (Drill-Down)

Het systeem houdt de resultaten van de vorige query bij in een **context** variabele. Vervolgvragen kunnen de context verfijnen:

**Voorbeeld Flow**:
```
Query 1: "Show me all employees in IT"
→ Context: 8 employees in IT department

Query 2: "Show their salaries"
→ Context: Same 8 employees (verfijnd met salary data)

Query 3: "Sort by salary highest to lowest"
→ Context: Same 8 employees (gesorteerd)
```

#### Context Reset Detection

Het systeem detecteert automatisch of een query een **nieuwe vraag** is of een **verfijning**:

**Nieuwe Query** (reset context):
- Bevat expliciete aantallen: "Show me 10 employees"
- Start met action verbs: "Find employees in Finance"
- Bevat aggregation keywords: "How many people..."

**Verfijning** (behoud context):
- Gebruikt verwijzende woorden: "Show **their** email addresses"
- Start met continuation words: "Also show..."
- Alleen sorting/limiting: "Sort by age"

### 2.4 Clause-Based Parsing

De query wordt opgebroken in **onafhankelijke clauses**:

```
Query: "Show me top 5 employees in IT sorted by salary, 
        show their name, email, and function"

┌─────────────────────────────────────────────────────┐
│ LIMIT CLAUSE: "top 5" → limit = 5                  │
├─────────────────────────────────────────────────────┤
│ FILTER CLAUSE: "in IT" → filter.department = "IT"  │
├─────────────────────────────────────────────────────┤
│ SORT CLAUSE: "sorted by salary" → sort = "salary"  │
├─────────────────────────────────────────────────────┤
│ DISPLAY CLAUSE: "name, email, and function"        │
│   → fields = ["name", "email", "function"]          │
└─────────────────────────────────────────────────────┘
```

Elk clause wordt onafhankelijk geparse door een dedicated parser functie.

### 2.5 Flexibele Column Selection

**Kritische Feature**: Gebruikers kunnen EXACT specificeren welke kolommen ze willen zien en in welke volgorde.

**Principe**: "Als je het vraagt, krijg je het. Niets meer, niets minder."

```
Query: "Show name, salary, and city"
Result: Columns = [Name, Salary, City]  ← EXACTLY these, in THIS order

Query: "Show salary"
Result: Columns = [Salary]  ← ONLY salary, nothing else
```

Dit wordt bereikt door:
1. Display clause parser vindt velden in de query
2. Behoudt de **positie** van elk veld in de query
3. Sorteert velden op positie (ascending)
4. Widget toont EXACT deze velden in deze volgorde

### 2.6 Aggregation Support

Het systeem ondersteunt **GROUP BY** queries met aggregaties:

```
Query: "Show me all departments and the total of people"

Processing:
1. Detect aggregation intent: "total of people" → COUNT aggregation
2. Detect grouping: "departments" → GROUP BY department
3. Execute:
   - Group employees by department
   - Count employees per group
4. Render: AggregationWidget with counts per department
```

**Ondersteunde Aggregaties**:
- **COUNT**: Aantal items per groep
- **SUM**: Som van een veld per groep (bijv. totale salaris)
- **AVERAGE**: Gemiddelde van een veld per groep (bijv. gemiddeld salaris)

### 2.7 Management Queries

Speciale queries voor management relaties:

```
Query: "How many people does Pieter Jansen manage?"

Output: TWO widgets
┌──────────────────────────────────┐
│ StatsWidget                      │
│ "Pieter Jansen manages 5 people" │
│ Count: 5                         │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ EmployeeTableWidget              │
│ Name          | Function         │
│ Emma Berg     | Developer        │
│ John Smith    | Designer         │
│ ...                              │
└──────────────────────────────────┘
```

### 2.8 Timeline & Trend Analysis

Het systeem genereert **fictional historical data** voor trend-analyses:

```
Query: "Show me income development over time by education"

→ TimelineChartWidget met:
  - X-as: Years (2010-2025)
  - Y-as: Average Salary
  - Lines: High School, Bachelor, Master, PhD
  - Realistic growth curves per education level
```

**Waarom fictional data?**
De meeste databases hebben geen historische data. Het systeem genereert plausibele trends gebaseerd op:
- Huidige state van de data
- Realistische groeipercentages
- Random variatie voor natuurlijk uiterlijk

### 2.9 Drag-and-Drop Dashboard

Alle widgets zijn **draggable** - gebruikers kunnen het dashboard naar wens arrangeren:

```tsx
<DraggableWidget
  id={message.id}
  onRemove={() => handleRemoveMessage(message.id)}
>
  <EmployeeTableWidget {...props} />
</DraggableWidget>
```

De volgorde wordt opgeslagen in de message state en blijft behouden tijdens de sessie.

---

## 3. Technische Architectuur

### 3.1 System Overview

```
┌──────────────────────────────────────────────────────────┐
│                      USER INPUT                          │
│         "Show me top 5 employees in IT"                  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│              ORCHESTRATION LAYER                         │
│              (processNLPQuery)                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  1. Parse Query → ParsedQuery object               │  │
│  │  2. Determine employee set (context vs. all)       │  │
│  │  3. Apply filters                                  │  │
│  │  4. Apply sorting                                  │  │
│  │  5. Apply limit                                    │  │
│  │  6. Build response → Widget configuration          │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│                   NLP PARSER                             │
│                  (parseQuery)                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │  parseEmployeeClause()    → matched employees      │  │
│  │  parseDisplayClause()     → fields to show         │  │
│  │  parseFilterClause()      → filters to apply       │  │
│  │  parseSortClause()        → sorting config         │  │
│  │  parseLimitClause()       → result limit           │  │
│  │  parseAggregationClause() → GROUP BY detection     │  │
│  │  shouldResetContext()     → context management     │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│              SCHEMA MAPPING LAYER                        │
│                                                          │
│  FIELD_MAPPINGS: {                                       │
│    name: ["name", "full name", "employee name"],         │
│    salary: ["salary", "pay", "wage", "income"],          │
│    ...                                                   │
│  }                                                       │
│                                                          │
│  Known Values:                                           │
│  - DEPARTMENTS: ["IT", "HR", "Finance", ...]             │
│  - LOCATIONS: ["Amsterdam", "Rotterdam", ...]            │
│  - CONTRACT_TYPES: ["Permanent", "Temporary"]            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  DATA LAYER                              │
│                                                          │
│  Employee Database (Mock):                               │
│  - 45 employees                                          │
│  - Comprehensive fields (30+ properties)                 │
│  - Nested structure (contact, personal, office, etc.)    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│              RESPONSE BUILDER                            │
│              (buildResponse)                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Determine widget type:                            │  │
│  │  - Chart? → ChartWidget                            │  │
│  │  - Word Cloud? → WordCloudWidget                   │  │
│  │  - Table (3+ fields)? → EmployeeTableWidget        │  │
│  │  - Simple? → EmployeeWidget                        │  │
│  │                                                    │  │
│  │  Build widget configuration JSON                   │  │
│  └────────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│                 RENDER ENGINE                            │
│                (ChatContainer)                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  {widget.type === "employeeTable" && (             │  │
│  │    <EmployeeTableWidget {...widget.data} />        │  │
│  │  )}                                                │  │
│  │                                                    │  │
│  │  {widget.type === "chart" && (                     │  │
│  │    <ChartWidget {...widget.data} />                │  │
│  │  )}                                                │  │
│  │                                                    │  │
│  │  ... etc for all widget types                      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  VISUAL OUTPUT                           │
│         ┌────────────────────────────────┐               │
│         │  EmployeeTableWidget           │               │
│         │  ┌──────────────────────────┐  │               │
│         │  │ Name    │ Salary │ Dept  │  │               │
│         │  ├──────────────────────────┤  │               │
│         │  │ Emma    │ €5,200 │ IT    │  │               │
│         │  │ John    │ €4,800 │ IT    │  │               │
│         │  └──────────────────────────┘  │               │
│         └────────────────────────────────┘               │
└──────────────────────────────────────────────────────────┘
```

### 3.2 The Orchestration Layer

**Locatie**: `/utils/nlpQueryProcessor.ts`

**Functie**: `processNLPQuery(query: string, context?: Employee[]): QueryResponse`

**Verantwoordelijkheden**:

1. **Query Routing**: Detecteert speciale query types (management, timeline, aggregation)
2. **Context Management**: Besluit of context behouden of resetten
3. **Filter Application**: Past filters toe op employee set
4. **Sorting & Limiting**: Sorteert en beperkt resultaten
5. **Response Building**: Roept `buildResponse()` aan om widget configuratie te genereren

**Code Flow**:

```typescript
export function processNLPQuery(query: string, context?: Employee[]): QueryResponse {
  // 1. SPECIAL CASES - Detect and handle special query types
  if (managementQueryPattern.test(query)) {
    return handleManagementQuery(query);
  }
  
  if (timelineKeywords.test(query)) {
    return handleTimelineQuery(query);
  }
  
  // 2. PARSE - Break query into structured components
  const parsed = parseQuery(query);
  
  // 3. CONTEXT - Decide which employees to work with
  let targetEmployees: Employee[];
  if (parsed.isPersonSpecific && parsed.employees.length > 0) {
    targetEmployees = parsed.employees;  // Use matched employees
  } else if (!parsed.shouldResetContext && context) {
    targetEmployees = context;  // Use previous results
  } else {
    targetEmployees = employees;  // Use all employees
  }
  
  // 4. FILTER - Apply filter conditions
  if (Object.keys(parsed.filters).length > 0) {
    targetEmployees = applyFilters(targetEmployees, parsed.filters);
  }
  
  // 5. SORT - Apply sorting
  if (parsed.sortBy && parsed.sortOrder) {
    targetEmployees = sortEmployees(targetEmployees, parsed.sortBy, parsed.sortOrder);
  }
  
  // 6. LIMIT - Apply result limit
  if (parsed.limit) {
    targetEmployees = targetEmployees.slice(0, parsed.limit);
  }
  
  // 7. BUILD RESPONSE - Generate widget configuration
  return buildResponse(targetEmployees, parsed.fields, parsed);
}
```

### 3.3 Schema Mapping: Semantic Search

**Locatie**: `/utils/nlpParser.ts`

**Doel**: Vertaal natuurlijke taal naar database field names.

**Techniek**: Hard-coded mapping dictionary met synonyms.

```typescript
const FIELD_MAPPINGS: Record<string, string[]> = {
  name: ["name", "full name", "fullname", "employee name"],
  salary: ["salary", "pay", "wage", "compensation", "income", "earnings"],
  yearsInService: ["years in service", "tenure", "how long", "worked here"],
  // ... 30+ field mappings
}
```

**Hoe het werkt**:

```typescript
function parseDisplayClause(query: string): string[] {
  const fields: Array<{name: string; position: number}> = [];
  
  // Find display section: "show their X, Y, Z"
  const displayMatch = query.match(/\bshow\s+their\s+(.+?)(?:\.|$)/i);
  const searchText = displayMatch ? displayMatch[1] : query;
  
  // Find all field mentions
  for (const [fieldName, synonyms] of Object.entries(FIELD_MAPPINGS)) {
    for (const synonym of synonyms) {
      const index = searchText.toLowerCase().indexOf(synonym);
      if (index !== -1) {
        fields.push({ name: fieldName, position: index });
        break;
      }
    }
  }
  
  // Sort by position to preserve user order
  fields.sort((a, b) => a.position - b.position);
  
  return fields.map(f => f.name);
}
```

**Voorbeeld**:
```
Query: "Show their salary, name, and email"

Step 1: Extract display text → "salary, name, and email"
Step 2: Find "salary" at position 0 → field "salary"
Step 3: Find "name" at position 9 → field "name"
Step 4: Find "email" at position 19 → field "email"
Step 5: Sort by position → ["salary", "name", "email"]
```

### 3.4 Component Mapping vs. Code Generation

**Deze implementatie gebruikt Component Mapping**, NIET code generation.

#### Component Mapping Approach (Gebruikt):

**Voordelen**:
- ✅ Veilig (geen eval() of dynamic code execution)
- ✅ Snel (geen compile-tijd)
- ✅ Voorspelbaar (alle widgets zijn vooraf gebouwd)
- ✅ Type-safe (TypeScript type checking)

**Hoe het werkt**:

1. **Query Processor** genereert een **JSON configuratie** object:

```typescript
return {
  type: "employeeTable",
  message: "",
  data: {
    employees: targetEmployees,
    columns: [
      { field: "name", label: "Name" },
      { field: "salary", label: "Salary" },
      { field: "department", label: "Department" }
    ],
    title: "Top 5 Employees"
  }
}
```

2. **Render Engine** mapped het type naar een React component:

```tsx
// In ChatContainer.tsx
{message.widget && (
  <>
    {message.widget.type === "employeeTable" && (
      <EmployeeTableWidget {...message.widget.data} />
    )}
    {message.widget.type === "chart" && (
      <ChartWidget {...message.widget.data} />
    )}
    {message.widget.type === "wordCloud" && (
      <WordCloudWidget {...message.widget.data} />
    )}
    {/* ... etc */}
  </>
)}
```

#### Code Generation Approach (NIET gebruikt):

**Nadelen**:
- ❌ Veiligheidrisico (dynamic code execution)
- ❌ Langzaam (compile-tijd nodig)
- ❌ Onvoorspelbaar (AI kan fouten maken)
- ❌ Moeilijk te debuggen

**Hoe het ZOU werken**:
```typescript
// AI genereert React code als string
const generatedCode = `
  <EmployeeTableWidget
    employees={data.employees}
    columns={[
      { field: "name", label: "Name" },
      { field: "salary", label: "Salary" }
    ]}
  />
`;

// Eval (gevaarlijk!)
const Component = eval(generatedCode);
return <Component />;
```

**Conclusie**: Component Mapping is de beste keuze voor production systems.

### 3.5 State Management

**Strategie**: Context-based state in React

```typescript
// In App.tsx
const [messages, setMessages] = useState<Message[]>([]);
const contextRef = useRef<Employee[] | undefined>(undefined);

const handleSubmit = (question: string) => {
  // Process query
  const response = processNLPQuery(question, contextRef.current);
  
  // Update context
  if (response.context) {
    contextRef.current = response.context;
  } else {
    contextRef.current = undefined;
  }
  
  // Add AI response as message (widget configuration)
  const aiMessage: Message = {
    id: `ai-${Date.now()}`,
    type: "ai",
    text: response.message,
    widget: { type: response.type, data: response.data }
  };
  
  setMessages(prev => [...prev, aiMessage]);
};
```

**Waarom deze aanpak?**

1. **Context Persistence**: `contextRef` bewaart employee set tussen queries
2. **Widget Persistence**: Alle widgets blijven zichtbaar als messages in de chat
3. **Immutable Updates**: `setMessages(prev => [...prev, newMessage])` zorgt voor clean re-renders
4. **Session-based**: Context wordt gereset bij page reload (geen backend nodig)

**Message Structure**:

```typescript
interface Message {
  id: string;
  type: "user" | "ai";
  text: string;
  widget?: {
    type: "employeeTable" | "chart" | "wordCloud" | "stats" | "aggregation" | "timeline";
    data: any;  // Widget-specific configuration
  };
}
```

### 3.6 Data Access Pattern

**Mock Data** in deze implementatie:

```typescript
// /data/employees.ts
export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  imageUrl: string;
  contact: {
    address: string;
    city: string;
    country: string;
  };
  office: {
    email: string;
    phone: string;
    location: string;
    manager: string;
  };
  salary: {
    amount: number;
    scale: string;
    fte: number;
  };
  // ... 30+ fields
}

export const employees: Employee[] = [
  { id: 1, firstName: "Emma", lastName: "van der Berg", ... },
  { id: 2, firstName: "Pieter", lastName: "Jansen", ... },
  // ... 45 total employees
];
```

**Transitie naar echte API** (zie sectie 4.6):

```typescript
// Replace this:
import { employees } from "../data/employees";

// With this:
const employees = await fetch("/api/employees").then(r => r.json());
```

Het systeem is volledig **data-agnostisch** - het werkt met elke data source die het `Employee[]` interface implementeert.

---

## 4. Implementatie Stappenplan

### 4.1 Stap 1: Data Abstractie

**Doel**: Maak een JSON schema van je database.

#### 1a. Definieer het Data Model

Creëer TypeScript interfaces voor je data:

```typescript
// data/employees.ts
export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  contact: {
    email: string;
    phone: string;
    city: string;
  };
  office: {
    department: string;
    location: string;
    manager: string;
  };
  salary: {
    amount: number;
    fte: number;
  };
  // Add ALL fields that exist in your database
}
```

**Best Practices**:
- ✅ Gebruik **nested objects** voor logische groepering (contact, office, salary)
- ✅ Gebruik **descriptive names** (dateOfBirth ipv dob)
- ✅ Gebruik **consistent typing** (numbers voor getallen, niet strings)

#### 1b. Creëer Mock Data

Voor development en testing:

```typescript
export const employees: Employee[] = [
  {
    id: 1,
    firstName: "Emma",
    lastName: "van der Berg",
    fullName: "Emma van der Berg",
    contact: {
      email: "emma.vandenberg@company.com",
      phone: "+31 20 1234567",
      city: "Amsterdam"
    },
    office: {
      department: "IT",
      location: "Amsterdam HQ",
      manager: "Pieter Jansen"
    },
    salary: {
      amount: 5200,
      fte: 1.0
    }
  },
  // ... generate 40+ more realistic employees
];
```

**Tips voor goede mock data**:
- Gebruik realistische namen (verschillende nationaliteiten)
- Varieer salaries (€2,500 - €15,000)
- Verdeel over 5-8 departments
- Verdeel over 3-5 office locations
- Zorg voor manager relaties (sommige employees zijn manager van anderen)

#### 1c. Maak een Field Registry

Documenteer ALLE queryable fields:

```typescript
const FIELD_REGISTRY = {
  // Basic Info
  id: { type: "number", category: "identity" },
  name: { type: "string", category: "identity", path: "fullName" },
  firstName: { type: "string", category: "identity" },
  lastName: { type: "string", category: "identity" },
  
  // Contact
  email: { type: "string", category: "contact", path: "contact.email" },
  phone: { type: "string", category: "contact", path: "contact.phone" },
  city: { type: "string", category: "contact", path: "contact.city" },
  
  // Office
  department: { type: "string", category: "office", path: "office.department" },
  location: { type: "string", category: "office", path: "office.location" },
  manager: { type: "string", category: "office", path: "office.manager" },
  
  // Salary
  salary: { type: "number", category: "salary", path: "salary.amount" },
  fte: { type: "number", category: "salary", path: "salary.fte" },
  
  // ... add ALL fields
};
```

Dit wordt later gebruikt voor:
- Field mapping (natuurlijke taal → field name)
- Data access (nested path resolution)
- Type validation

### 4.2 Stap 2: Prompt Engineering

**Doel**: Definieer hoe natuurlijke taal wordt geïnterpreteerd.

#### 2a. Creëer Field Mappings

Map natuurlijke taal synoniemen naar database fields:

```typescript
const FIELD_MAPPINGS: Record<string, string[]> = {
  // Voor ELKE field, definieer ALLE mogelijke manieren waarop een gebruiker ernaar zou kunnen verwijzen
  
  name: [
    "name", "full name", "fullname", "employee name", "naam"
  ],
  
  salary: [
    "salary", "salaries", "pay", "wage", "compensation", 
    "income", "earnings", "salaris", "loon"
  ],
  
  department: [
    "department", "dept", "division", "team", "afdeling"
  ],
  
  yearsInService: [
    "years in service", "tenure", "how long", 
    "years of service", "worked here", "been here",
    "employment length", "service years", "dienstjaren"
  ],
  
  // ... continue for ALL fields
};
```

**Best Practices**:
- ✅ Voeg **meervoud EN enkelvoud** toe (employee, employees)
- ✅ Voeg **informele termen** toe (boss voor manager)
- ✅ Voeg **vragen-formuleringen** toe ("how old" voor age)
- ✅ Voeg **Nederlandse EN Engelse** termen toe (multi-language support)
- ✅ Test met **echte gebruikers-queries** en voeg missing synonyms toe

#### 2b. Definieer Known Values

Voor filter fields, definieer alle mogelijke waarden:

```typescript
const DEPARTMENTS = [
  "IT", "HR", "Finance", "Operations", 
  "Sales", "Marketing", "Customer Support", "Legal"
];

const LOCATIONS = [
  "Amsterdam", "Rotterdam", "Utrecht", 
  "Den Haag", "Eindhoven"
];

const CONTRACT_TYPES = [
  "Permanent", "Temporary"
];

const EDUCATION_LEVELS = [
  "High School", "Bachelor's Degree", 
  "Master's Degree", "PhD"
];
```

**Waarom?** Dit helpt bij filter detection - als de query "IT" bevat, weet het systeem dat dit een department filter is.

#### 2c. Definieer Query Patterns

Regex patterns voor het detecteren van query intents:

```typescript
// Aggregation detection
const AGGREGATION_PATTERNS = [
  /\btotal\s+of\s+people/i,
  /\bcount\s+of/i,
  /\bhow\s+many\s+(people|employees)/i,
  /\baverage\s+salary/i,
];

// Sorting detection
const SORT_KEYWORDS = {
  descending: ["highest", "maximum", "max", "most", "top", "best"],
  ascending: ["lowest", "minimum", "min", "least", "bottom", "worst"]
};

// Limit detection
const LIMIT_PATTERNS = [
  /(?:top|first)\s+(\d+)/i,
  /(\d+)\s+(?:employees?|people|persons?)/i,
];

// Timeline detection
const TIMELINE_KEYWORDS = [
  "timeline", "trend", "over time", "historical", 
  "development", "history", "since", "progression"
];
```

#### 2d. Definieer Context Rules

Regels voor wanneer context behouden of resetten:

```typescript
function shouldResetContext(query: string): boolean {
  // Reset indicators (nieuwe query)
  const isNewQuery = 
    /^(?:show|list|find|get|display)\s+(?:\d+|all)\s+employees?/i.test(query) ||
    /\b(total|count|average|sum)\b/i.test(query) ||
    /^(?:show|list|find)/i.test(query);
  
  // Refinement indicators (behoud context)
  const isRefinement =
    /\b(?:their|them|these|those)\b/i.test(query) ||
    /^(?:also|and|additionally)\b/i.test(query) ||
    /^(?:sort|order|filter)\b/i.test(query);
  
  return !isRefinement && isNewQuery;
}
```

### 4.3 Stap 3: De Parser Engine

**Doel**: Bouw clause-based parser die queries omzet in gestructureerde data.

#### 3a. ParsedQuery Interface

Definieer de output van de parser:

```typescript
export interface ParsedQuery {
  // Employee selection
  employees: Employee[];           // Matched employees (if person-specific)
  isPersonSpecific: boolean;       // Is this about specific employees?
  
  // Display
  fields: string[];                // Which fields to show
  outputType: "widget" | "table" | "chart" | "wordcloud";
  chartType?: "bar" | "pie" | "line";
  
  // Filtering
  filters: {
    department?: string;
    officeLocation?: string;
    contractType?: string;
    minSalary?: number;
    maxSalary?: number;
  };
  
  // Sorting & Limiting
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  
  // Aggregation
  isAggregation?: boolean;
  groupBy?: string;
  aggregationType?: "count" | "sum" | "average";
  aggregateField?: string;
  
  // Context
  shouldResetContext: boolean;
}
```

#### 3b. Clause Parser Functions

Implementeer een parser voor elke clause:

**Display Clause Parser**:
```typescript
function parseDisplayClause(query: string): string[] {
  const fields: Array<{name: string; position: number}> = [];
  
  // Extract display section
  const displayMatch = query.match(/\bshow\s+(?:their|me|only)\s+(.+?)(?:\.|$)/i);
  const searchText = displayMatch ? displayMatch[1] : query;
  
  // Find all field mentions
  for (const [fieldName, synonyms] of Object.entries(FIELD_MAPPINGS)) {
    for (const synonym of synonyms) {
      const index = searchText.toLowerCase().indexOf(synonym);
      if (index !== -1 && !fields.find(f => f.name === fieldName)) {
        fields.push({ name: fieldName, position: index });
        break;
      }
    }
  }
  
  // Sort by position (preserve user order!)
  fields.sort((a, b) => a.position - b.position);
  
  return fields.map(f => f.name);
}
```

**Filter Clause Parser**:
```typescript
function parseFilterClause(query: string): any {
  const filters: any = {};
  
  // Extract the part BEFORE display keywords
  const beforeDisplay = query.split(/\bshow\s+their/i)[0];
  
  // Check for department
  for (const dept of DEPARTMENTS) {
    if (new RegExp(`\\b${dept}\\b`, 'i').test(beforeDisplay)) {
      filters.department = dept;
      break;
    }
  }
  
  // Check for location
  for (const loc of LOCATIONS) {
    if (new RegExp(`\\b${loc}\\b`, 'i').test(beforeDisplay)) {
      filters.officeLocation = loc;
      break;
    }
  }
  
  // Check for salary range
  const salaryMatch = beforeDisplay.match(/salary\s*>\s*(\d+)/i);
  if (salaryMatch) {
    filters.minSalary = parseInt(salaryMatch[1]);
  }
  
  return filters;
}
```

**Sort Clause Parser**:
```typescript
function parseSortClause(query: string): { field?: string; order?: "asc" | "desc" } {
  // Determine direction
  let order: "asc" | "desc" | undefined;
  if (/\b(highest|maximum|max|most|top)\b/i.test(query)) {
    order = "desc";
  } else if (/\b(lowest|minimum|min|least|bottom)\b/i.test(query)) {
    order = "asc";
  }
  
  if (!order) return {};
  
  // Find field to sort by
  for (const [fieldName, synonyms] of Object.entries(FIELD_MAPPINGS)) {
    for (const synonym of synonyms) {
      if (query.toLowerCase().includes(synonym)) {
        return { field: fieldName, order };
      }
    }
  }
  
  return { order };
}
```

**Limit Clause Parser**:
```typescript
function parseLimitClause(query: string): number | undefined {
  const patterns = [
    /(?:top|first)\s+(\d+)/i,
    /(\d+)\s+(?:employees?|people)/i,
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return parseInt(match[1]);
  }
  
  return undefined;
}
```

**Employee Clause Parser**:
```typescript
function parseEmployeeClause(query: string): Employee[] {
  const matched: Employee[] = [];
  const words = query.toLowerCase().split(/\s+/);
  
  for (const employee of employees) {
    const firstName = employee.firstName.toLowerCase();
    const lastName = employee.lastName.toLowerCase();
    const fullName = employee.fullName.toLowerCase();
    
    if (words.includes(firstName) || 
        words.includes(lastName) || 
        query.toLowerCase().includes(fullName)) {
      matched.push(employee);
    }
  }
  
  return matched;
}
```

**Aggregation Clause Parser**:
```typescript
function parseAggregationClause(query: string): {
  isAggregation: boolean;
  groupBy?: string;
  aggregationType?: "count" | "sum" | "average";
} {
  // Detect aggregation keywords
  const isAggregation = /\b(total|count|average|sum|how many)\b/i.test(query);
  if (!isAggregation) return { isAggregation: false };
  
  // Determine type
  let aggregationType: "count" | "sum" | "average" = "count";
  if (/\baverage|mean\b/i.test(query)) aggregationType = "average";
  else if (/\bsum|total salary\b/i.test(query)) aggregationType = "sum";
  
  // Determine groupBy
  let groupBy: string | undefined;
  if (/\b(?:by|per)\s+department/i.test(query)) groupBy = "department";
  else if (/\b(?:by|per)\s+location/i.test(query)) groupBy = "location";
  
  return { isAggregation: true, groupBy, aggregationType };
}
```

#### 3c. Main Parser Function

Combineer alle clause parsers:

```typescript
export function parseQuery(query: string): ParsedQuery {
  console.log("PARSING:", query);
  
  // Parse each clause
  const employees = parseEmployeeClause(query);
  const fields = parseDisplayClause(query);
  const filters = parseFilterClause(query);
  const { field: sortBy, order: sortOrder } = parseSortClause(query);
  const limit = parseLimitClause(query);
  const { isAggregation, groupBy, aggregationType } = parseAggregationClause(query);
  
  // Determine output type
  let outputType: "widget" | "table" | "chart" | "wordcloud" = "widget";
  if (/\b(chart|graph)\b/i.test(query)) outputType = "chart";
  else if (/\bword\s*cloud\b/i.test(query)) outputType = "wordcloud";
  else if (fields.length > 2 || sortBy) outputType = "table";
  
  return {
    employees,
    fields,
    filters,
    sortBy,
    sortOrder,
    limit,
    isAggregation,
    groupBy,
    aggregationType,
    isPersonSpecific: employees.length > 0 && employees.length <= 5,
    outputType,
    shouldResetContext: shouldResetContext(query)
  };
}
```

### 4.4 Stap 4: De Query Processor

**Doel**: Verwerk de parsed query en genereer widget configuraties.

#### 4a. Query Processor Main Function

```typescript
export function processNLPQuery(query: string, context?: Employee[]): QueryResponse {
  // 1. Parse query
  const parsed = parseQuery(query);
  
  // 2. Determine employee set
  let targetEmployees: Employee[];
  if (parsed.isPersonSpecific) {
    targetEmployees = parsed.employees;
  } else if (!parsed.shouldResetContext && context) {
    targetEmployees = context;
  } else {
    targetEmployees = employees;
  }
  
  // 3. Apply filters
  if (parsed.filters.department) {
    targetEmployees = targetEmployees.filter(e => 
      e.office.department === parsed.filters.department
    );
  }
  if (parsed.filters.officeLocation) {
    targetEmployees = targetEmployees.filter(e => 
      e.office.location === parsed.filters.officeLocation
    );
  }
  
  // 4. Apply sorting
  if (parsed.sortBy && parsed.sortOrder) {
    targetEmployees = sortEmployees(targetEmployees, parsed.sortBy, parsed.sortOrder);
  }
  
  // 5. Apply limit
  if (parsed.limit) {
    targetEmployees = targetEmployees.slice(0, parsed.limit);
  }
  
  // 6. Build response
  return buildResponse(targetEmployees, parsed.fields, parsed);
}
```

#### 4b. Response Builder

```typescript
function buildResponse(
  employees: Employee[], 
  fields: string[], 
  parsed: ParsedQuery
): QueryResponse {
  
  // AGGREGATION queries
  if (parsed.isAggregation) {
    const aggregatedData = performAggregation(employees, parsed);
    return {
      type: "aggregation",
      message: "",
      data: { aggregatedData, groupBy: parsed.groupBy, aggregationType: parsed.aggregationType }
    };
  }
  
  // CHART queries
  if (parsed.outputType === "chart") {
    const chartData = buildChartData(employees, fields[0] || "department");
    return {
      type: "chart",
      message: "",
      data: { data: chartData, chartType: parsed.chartType || "bar" }
    };
  }
  
  // WORD CLOUD queries
  if (parsed.outputType === "wordcloud") {
    const words = buildWordCloudData(employees, fields[0] || "function");
    return {
      type: "wordCloud",
      message: "",
      data: { words, title: "Word Cloud" }
    };
  }
  
  // TABLE queries (3+ fields or sorting)
  if (fields.length > 2 || parsed.sortBy) {
    const columns = fields.map(field => ({
      field,
      label: getFieldDisplayName(field)
    }));
    
    return {
      type: "employeeTable",
      message: "",
      data: { employees, columns, title: `${employees.length} Employees` }
    };
  }
  
  // WIDGET queries (simple display)
  const columns = (fields.length > 0 ? fields : ["name", "function"]).map(field => ({
    field,
    label: getFieldDisplayName(field)
  }));
  
  return {
    type: "employees",
    message: "",
    data: { employees, columns, title: employees[0]?.fullName || "Employees" }
  };
}
```

#### 4c. Helper Functions

```typescript
function sortEmployees(
  employees: Employee[], 
  sortBy: string, 
  order: "asc" | "desc"
): Employee[] {
  return [...employees].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case "salary": 
        aValue = a.salary.amount; 
        bValue = b.salary.amount; 
        break;
      case "age": 
        aValue = a.personal.age; 
        bValue = b.personal.age; 
        break;
      case "name": 
        aValue = a.fullName; 
        bValue = b.fullName; 
        break;
      default: 
        return 0;
    }
    
    if (order === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });
}

function getFieldDisplayName(field: string): string {
  const displayNames: Record<string, string> = {
    name: "Name",
    salary: "Salary",
    department: "Department",
    // ... all fields
  };
  return displayNames[field] || field;
}
```

### 4.5 Stap 5: De Render Engine

**Doel**: Map widget configuraties naar React components.

#### 5a. Message State

```typescript
interface Message {
  id: string;
  type: "user" | "ai";
  text: string;
  widget?: {
    type: "employeeTable" | "chart" | "wordCloud" | "stats" | "aggregation";
    data: any;
  };
}

const [messages, setMessages] = useState<Message[]>([]);
```

#### 5b. Chat Container

```tsx
export function ChatContainer({ messages }: { messages: Message[] }) {
  return (
    <div className="max-w-6xl mx-auto px-6">
      {messages.map((message) => (
        <div key={message.id}>
          {message.type === "user" ? (
            <UserMessage text={message.text} />
          ) : (
            <AIMessage message={message} />
          )}
        </div>
      ))}
    </div>
  );
}
```

#### 5c. AI Message Renderer

```tsx
function AIMessage({ message }: { message: Message }) {
  return (
    <div className="mb-6">
      {/* Text response (optional) */}
      {message.text && (
        <div className="mb-4 text-gray-700">{message.text}</div>
      )}
      
      {/* Widget renderer */}
      {message.widget && (
        <DraggableWidget id={message.id}>
          {message.widget.type === "employeeTable" && (
            <EmployeeTableWidget {...message.widget.data} />
          )}
          
          {message.widget.type === "chart" && (
            <ChartWidget {...message.widget.data} />
          )}
          
          {message.widget.type === "wordCloud" && (
            <WordCloudWidget {...message.widget.data} />
          )}
          
          {message.widget.type === "aggregation" && (
            <AggregationWidget {...message.widget.data} />
          )}
          
          {message.widget.type === "stats" && (
            <StatsWidget {...message.widget.data} />
          )}
          
          {message.widget.type === "timeline" && (
            <TimelineChartWidget {...message.widget.data} />
          )}
        </DraggableWidget>
      )}
    </div>
  );
}
```

#### 5d. Widget Components

Elk widget is een standalone React component:

**EmployeeTableWidget.tsx**:
```tsx
interface EmployeeTableWidgetProps {
  title: string;
  employees: Employee[];
  columns: Array<{ field: string; label: string }>;
}

export function EmployeeTableWidget({ title, employees, columns }: EmployeeTableWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <table className="w-full">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.field}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map(employee => (
            <tr key={employee.id}>
              {columns.map(col => (
                <td key={col.field}>
                  {renderCellValue(employee, col.field)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCellValue(employee: Employee, field: string): React.ReactNode {
  switch (field) {
    case "name": return employee.fullName;
    case "email": return <a href={`mailto:${employee.office.email}`}>{employee.office.email}</a>;
    case "salary": return `€${employee.salary.amount.toLocaleString()}`;
    case "department": return employee.office.department;
    // ... all other fields
    default: return null;
  }
}
```

**ChartWidget.tsx** (using Recharts):
```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface ChartWidgetProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  chartType: "bar" | "pie" | "line";
}

export function ChartWidget({ title, data, chartType }: ChartWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      {chartType === "bar" && (
        <BarChart width={600} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#00467b" />
        </BarChart>
      )}
    </div>
  );
}
```

### 4.6 Stap 6: Transitie naar Echte API

**Doel**: Replace mock data met echte database calls.

#### 6a. Huidige State (Mock Data)

```typescript
// utils/nlpQueryProcessor.ts
import { employees } from "../data/employees";

export function processNLPQuery(query: string, context?: Employee[]): QueryResponse {
  const parsed = parseQuery(query);
  let targetEmployees = employees;  // ← Mock data
  // ... rest of logic
}
```

#### 6b. API Integration

**Stap 1**: Creëer een data service:

```typescript
// services/employeeService.ts
export class EmployeeService {
  private baseUrl = "/api/employees";
  
  async getAllEmployees(): Promise<Employee[]> {
    const response = await fetch(this.baseUrl);
    return response.json();
  }
  
  async getEmployeeById(id: number): Promise<Employee> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    return response.json();
  }
  
  async searchEmployees(filters: {
    department?: string;
    location?: string;
    minSalary?: number;
  }): Promise<Employee[]> {
    const params = new URLSearchParams(filters as any);
    const response = await fetch(`${this.baseUrl}/search?${params}`);
    return response.json();
  }
}

export const employeeService = new EmployeeService();
```

**Stap 2**: Update query processor:

```typescript
// utils/nlpQueryProcessor.ts
import { employeeService } from "../services/employeeService";

export async function processNLPQuery(
  query: string, 
  context?: Employee[]
): Promise<QueryResponse> {
  const parsed = parseQuery(query);
  
  // Fetch from API instead of using mock data
  let targetEmployees: Employee[];
  
  if (parsed.isPersonSpecific) {
    // If we have matched employees by name, we need to search for them
    targetEmployees = await employeeService.searchEmployees({
      // Implement name-based search in your API
    });
  } else if (Object.keys(parsed.filters).length > 0) {
    // Use API filtering for better performance
    targetEmployees = await employeeService.searchEmployees(parsed.filters);
  } else if (!parsed.shouldResetContext && context) {
    targetEmployees = context;
  } else {
    targetEmployees = await employeeService.getAllEmployees();
  }
  
  // Client-side sorting and limiting (or move to API)
  if (parsed.sortBy) {
    targetEmployees = sortEmployees(targetEmployees, parsed.sortBy, parsed.sortOrder!);
  }
  if (parsed.limit) {
    targetEmployees = targetEmployees.slice(0, parsed.limit);
  }
  
  return buildResponse(targetEmployees, parsed.fields, parsed);
}
```

**Stap 3**: Update App.tsx voor async:

```typescript
// App.tsx
const handleSubmit = async (question: string) => {
  const userMessage: Message = {
    id: `user-${Date.now()}`,
    type: "user",
    text: question
  };
  
  setMessages(prev => [...prev, userMessage]);
  
  // Add loading state
  setIsLoading(true);
  
  try {
    const response = await processNLPQuery(question, contextRef.current);
    
    const aiMessage: Message = {
      id: `ai-${Date.now()}`,
      type: "ai",
      text: response.message,
      widget: { type: response.type, data: response.data }
    };
    
    setMessages(prev => [...prev, aiMessage]);
    
    if (response.context) {
      contextRef.current = response.context;
    }
  } catch (error) {
    console.error("Query processing failed:", error);
    // Show error message
  } finally {
    setIsLoading(false);
  }
};
```

#### 6c. Performance Optimization

**Server-Side Filtering**:
```typescript
// Backend API endpoint
app.get("/api/employees/search", (req, res) => {
  const { department, location, minSalary, sortBy, sortOrder, limit } = req.query;
  
  let query = db.select().from(employees);
  
  if (department) query = query.where("department", department);
  if (location) query = query.where("location", location);
  if (minSalary) query = query.where("salary", ">=", minSalary);
  if (sortBy) query = query.orderBy(sortBy, sortOrder || "asc");
  if (limit) query = query.limit(parseInt(limit));
  
  const results = await query;
  res.json(results);
});
```

**Caching**:
```typescript
const cache = new Map<string, { data: Employee[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedEmployees(): Promise<Employee[]> {
  const cached = cache.get("all");
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await employeeService.getAllEmployees();
  cache.set("all", { data, timestamp: Date.now() });
  return data;
}
```

### 4.7 Stap 7: Testing & Validation

#### 7a. Unit Tests voor Parsers

```typescript
// __tests__/nlpParser.test.ts
import { parseQuery } from "../utils/nlpParser";

describe("parseDisplayClause", () => {
  it("should extract fields in correct order", () => {
    const result = parseQuery("Show their salary, name, and email");
    expect(result.fields).toEqual(["salary", "name", "email"]);
  });
  
  it("should handle synonyms", () => {
    const result = parseQuery("Show their pay and full name");
    expect(result.fields).toEqual(["salary", "name"]);
  });
});

describe("parseFilterClause", () => {
  it("should detect department filter", () => {
    const result = parseQuery("Show employees in IT");
    expect(result.filters.department).toBe("IT");
  });
  
  it("should not confuse filter with display", () => {
    const result = parseQuery("Employees in IT, show their name");
    expect(result.filters.department).toBe("IT");
    expect(result.fields).toEqual(["name"]);
  });
});

describe("parseSortClause", () => {
  it("should detect highest = descending", () => {
    const result = parseQuery("Show employees with highest salary");
    expect(result.sortBy).toBe("salary");
    expect(result.sortOrder).toBe("desc");
  });
});
```

#### 7b. Integration Tests

```typescript
// __tests__/nlpQueryProcessor.test.ts
import { processNLPQuery } from "../utils/nlpQueryProcessor";

describe("processNLPQuery", () => {
  it("should handle complex query correctly", () => {
    const result = processNLPQuery(
      "Show top 5 employees in IT sorted by salary, show their name and email"
    );
    
    expect(result.type).toBe("employeeTable");
    expect(result.data.employees.length).toBe(5);
    expect(result.data.columns).toEqual([
      { field: "name", label: "Name" },
      { field: "email", label: "Email" }
    ]);
  });
  
  it("should maintain context for refinement queries", () => {
    const result1 = processNLPQuery("Show employees in IT");
    const context = result1.context;
    
    const result2 = processNLPQuery("Show their salaries", context);
    
    expect(result2.data.employees.length).toBe(context?.length);
    expect(result2.data.columns).toContainEqual({ field: "salary", label: "Salary" });
  });
});
```

#### 7c. User Acceptance Testing

Creëer een test matrix met typische queries:

| Query | Expected Output | Status |
|-------|----------------|--------|
| "Show me all employees" | EmployeeWidget with all 45 employees | ✅ |
| "Top 10 highest paid" | EmployeeTableWidget, 10 rows, sorted by salary desc | ✅ |
| "Employees in IT, show name, email, salary" | EmployeeTableWidget, filtered by IT, 3 columns | ✅ |
| "How many employees in each department?" | AggregationWidget with counts | ✅ |
| "Word cloud of functions" | WordCloudWidget showing all job titles | ✅ |
| "Show me Emma" → "Show her manager" | 1st: Emma, 2nd: Her manager (context preserved) | ✅ |

### 4.8 Mock Dataset Details

**Waarom een goede mock dataset essentieel is**:

1. **Realistische Testing**: Je kunt het systeem volledig testen zonder API dependency
2. **Demonstratie**: Stakeholders kunnen het systeem zien werken
3. **Development Speed**: Geen wachten op backend/database setup
4. **Easy Transition**: Als de interface goed gedefinieerd is, is de switch naar echte API triviaal

**Mock Dataset Specificaties** (deze implementatie):

```typescript
export const employees: Employee[] = [
  // 45 employees total
  // Distributed across:
  // - 8 departments (IT, HR, Finance, Operations, Sales, Marketing, Customer Support, Legal)
  // - 5 locations (Amsterdam, Rotterdam, Utrecht, Den Haag, Eindhoven)
  // - 2 contract types (Permanent, Temporary)
  // - Salary range: €2,500 - €15,000/month
  // - Age range: 24 - 58
  // - Years in service: 1 - 13 years
  // - Multiple management levels (some employees manage others)
  // - Diverse names (Dutch, international)
  // - Complete data for ALL fields (no nulls)
];
```

**Voorbeeld Employee**:
```typescript
{
  id: 1,
  firstName: "Emma",
  lastName: "van der Berg",
  fullName: "Emma van der Berg",
  imageUrl: "https://i.pravatar.cc/150?img=1",
  contact: {
    address: "Keizersgracht 123",
    postcode: "1015 CJ",
    city: "Amsterdam",
    country: "The Netherlands"
  },
  personal: {
    mobile: "+31 6 12345678",
    phone: "+31 20 1234567",
    privateEmail: "emma.vdberg@email.com",
    socialSecurityNumber: "123456789",
    nationality: "The Netherlands",
    language: "Dutch",
    placeOfBirth: "Amsterdam",
    dateOfBirth: "15-03-1988",
    age: 37,
    maritalStatus: "Married",
    maritalStatusDate: "12-06-2015"
  },
  office: {
    phone: "+31 20 5551234",
    extension: "1234",
    mobile: "+31 6 87654321",
    email: "emma.vandenberg@company.com",
    location: "Amsterdam HQ",
    manager: "Pieter Jansen",
    subordinates: 0
  },
  incomeRelationship: {
    number: 100001,
    startDate: "01-01-2012",
    endDate: "",
    reasonEnd: "",
    startDateForYearsInService: "01-01-2012",
    yearsInService: 13
  },
  contract: {
    type: "Permanent",
    sequenceNumber: 1,
    reason: "New Hire",
    startDate: "01-01-2012",
    endDate: "",
    probationPeriod: "2 months",
    probationEndDate: "01-03-2012"
  },
  organisation: {
    jobTitle: "Senior Developer",
    department: "IT",
    civilCentre: "Amsterdam",
    costUnit: "IT-DEV-001"
  },
  salary: {
    amount: 5200,
    scale: "10",
    step: "5",
    hoursPerWeek: 40,
    fte: 1.0
  },
  education: {
    level: "Master's Degree",
    degree: "MSc Computer Science",
    fieldOfStudy: "Software Engineering",
    institution: "University of Amsterdam",
    graduationYear: 2011
  }
}
```

**Key Features van de Mock Data**:
- ✅ **Realistische relaties**: "Emma's manager is Pieter" - Pieter exists in dataset
- ✅ **Varied salaries**: Range allows for meaningful "highest/lowest" queries
- ✅ **Multiple filter dimensions**: Can combine department + location + contract type
- ✅ **Rich text fields**: Names, emails, addresses for display testing
- ✅ **Numeric fields**: Salary, age, years in service for sorting and aggregation
- ✅ **Date fields**: Start dates, birthdates for timeline queries
- ✅ **Image URLs**: Profile pictures via pravatar.cc

---

## 5. Voorbeeld JSON-Payload

### 5.1 Voorbeeld 1: Employee Table Query

**User Query**: "Show me top 5 employees in IT sorted by salary, show their name, email, and department"

**ParsedQuery Output** (intermediate):
```json
{
  "intent": ["show"],
  "employees": [],
  "fields": ["name", "email", "department"],
  "filters": {
    "department": "IT"
  },
  "sortBy": "salary",
  "sortOrder": "desc",
  "limit": 5,
  "outputType": "table",
  "isPersonSpecific": false,
  "isAggregation": false,
  "shouldResetContext": true
}
```

**QueryResponse Output** (final widget config):
```json
{
  "type": "employeeTable",
  "message": "",
  "data": {
    "title": "Top 5 Employees",
    "employees": [
      {
        "id": 15,
        "firstName": "Sophie",
        "lastName": "Bakker",
        "fullName": "Sophie Bakker",
        "office": {
          "email": "sophie.bakker@company.com",
          "department": "IT",
          "location": "Amsterdam HQ"
        },
        "salary": {
          "amount": 6200
        }
      },
      {
        "id": 1,
        "firstName": "Emma",
        "lastName": "van der Berg",
        "fullName": "Emma van der Berg",
        "office": {
          "email": "emma.vandenberg@company.com",
          "department": "IT",
          "location": "Amsterdam HQ"
        },
        "salary": {
          "amount": 5200
        }
      }
      // ... 3 more employees
    ],
    "columns": [
      { "field": "name", "label": "Name" },
      { "field": "email", "label": "Email" },
      { "field": "department", "label": "Department" }
    ]
  },
  "context": [
    // Same 5 employees (for potential drill-down)
  ]
}
```

### 5.2 Voorbeeld 2: Aggregation Query

**User Query**: "Show me all departments and the total of people"

**ParsedQuery Output**:
```json
{
  "intent": ["show"],
  "employees": [],
  "fields": [],
  "filters": {},
  "sortBy": null,
  "sortOrder": null,
  "limit": null,
  "outputType": "table",
  "isPersonSpecific": false,
  "isAggregation": true,
  "groupBy": "department",
  "aggregationType": "count",
  "shouldResetContext": true
}
```

**QueryResponse Output**:
```json
{
  "type": "aggregation",
  "message": "",
  "data": {
    "title": "Employees by Department (Count)",
    "groupBy": "department",
    "aggregationType": "count",
    "aggregatedData": [
      { "department": "IT", "count": 8 },
      { "department": "Sales", "count": 7 },
      { "department": "Finance", "count": 6 },
      { "department": "HR", "count": 5 },
      { "department": "Marketing", "count": 5 },
      { "department": "Operations", "count": 5 },
      { "department": "Customer Support", "count": 5 },
      { "department": "Legal", "count": 4 }
    ]
  }
}
```

### 5.3 Voorbeeld 3: Chart Query

**User Query**: "Show me a bar chart of employees by location"

**ParsedQuery Output**:
```json
{
  "intent": ["show"],
  "employees": [],
  "fields": ["location"],
  "filters": {},
  "sortBy": null,
  "sortOrder": null,
  "limit": null,
  "outputType": "chart",
  "chartType": "bar",
  "isPersonSpecific": false,
  "fieldToAnalyze": "location",
  "shouldResetContext": true
}
```

**QueryResponse Output**:
```json
{
  "type": "chart",
  "message": "",
  "data": {
    "title": "Employees by Location",
    "chartType": "bar",
    "data": [
      { "name": "Amsterdam HQ", "value": 15 },
      { "name": "Rotterdam", "value": 10 },
      { "name": "Utrecht", "value": 8 },
      { "name": "Den Haag", "value": 7 },
      { "name": "Eindhoven", "value": 5 }
    ]
  }
}
```

### 5.4 Voorbeeld 4: Multi-Widget Dashboard

**User Queries Sequence**:
1. "How many people does Pieter Jansen manage?"
2. "Show me income development over time by education"

**Dashboard State** (Messages Array):
```json
[
  {
    "id": "user-1643021234567",
    "type": "user",
    "text": "How many people does Pieter Jansen manage?"
  },
  {
    "id": "ai-1643021234568",
    "type": "ai",
    "text": "",
    "widget": {
      "type": "stats",
      "data": {
        "title": "Pieter Jansen manages 5 employees",
        "stats": [
          { "name": "Employees", "value": 5, "color": "#00467b" }
        ],
        "chartType": "none"
      }
    }
  },
  {
    "id": "ai-1643021234569",
    "type": "ai",
    "text": "",
    "widget": {
      "type": "employeeTable",
      "data": {
        "title": "Team Members",
        "employees": [
          { "fullName": "Emma van der Berg", "office": { "jobTitle": "Senior Developer" } },
          { "fullName": "Sophie Bakker", "office": { "jobTitle": "Lead Developer" } }
          // ... 3 more
        ],
        "columns": [
          { "field": "name", "label": "Name" },
          { "field": "function", "label": "Function" }
        ]
      }
    }
  },
  {
    "id": "user-1643021245678",
    "type": "user",
    "text": "Show me income development over time by education"
  },
  {
    "id": "ai-1643021245679",
    "type": "ai",
    "text": "",
    "widget": {
      "type": "timeline",
      "data": {
        "title": "Income Development by Education Level (2010-2025)",
        "data": [
          { 
            "year": 2010, 
            "High School": 32000, 
            "Bachelor's Degree": 48000,
            "Master's Degree": 65000,
            "PhD": 80000
          },
          { 
            "year": 2011, 
            "High School": 33200, 
            "Bachelor's Degree": 49800,
            "Master's Degree": 67500,
            "PhD": 83500
          }
          // ... years 2012-2025
        ],
        "lines": [
          { "key": "High School", "name": "High School", "color": "#3b82f6" },
          { "key": "Bachelor's Degree", "name": "Bachelor's Degree", "color": "#10b981" },
          { "key": "Master's Degree", "name": "Master's Degree", "color": "#f59e0b" },
          { "key": "PhD", "name": "PhD", "color": "#ef4444" }
        ]
      }
    }
  }
]
```

Dit dashboard state object bevat:
- Alle user queries (voor geschiedenis)
- Alle AI responses (voor referentie)
- Alle widget configuraties (voor rendering)
- Context informatie (voor drill-down)

De widgets worden gerenderd in de volgorde waarin ze toegevoegd zijn, en zijn **draggable** zodat de gebruiker het dashboard kan reorganiseren.

---

## 6. Geavanceerde Functionaliteit

### 6.1 Context Refinement Deep Dive

**Challenge**: Hoe weet het systeem wanneer een query een nieuwe vraag is vs. een verfijning?

**Solution**: Context Reset Detection Algorithm

```typescript
function shouldResetContext(query: string): boolean {
  // RESET indicators (nieuwe query)
  const hasExplicitCount = /(?:top|first|all)\s+\d+\s+employees?/i.test(query);
  const hasAggregation = /\b(total|count|average|sum)\b/i.test(query);
  const hasStandaloneFilter = /\b(?:in|from)\s+(?:IT|HR|Finance)/i.test(query);
  const startsWithNewAction = /^(?:show|list|find)/i.test(query);
  
  // KEEP indicators (verfijning)
  const hasReferentialPronouns = /\b(?:their|them|these|those)\b/i.test(query);
  const isContinuation = /^(?:also|and|additionally)\b/i.test(query);
  const isOnlySortOrLimit = /\b(?:sort|order|first|top)\b/i.test(query);
  
  // Logic
  if (hasReferentialPronouns || isContinuation) return false;
  if (hasAggregation || hasExplicitCount) return true;
  if (startsWithNewAction && !isOnlySortOrLimit) return true;
  
  return false;
}
```

**Voorbeelden**:

| Query | Reset? | Reasoning |
|-------|--------|-----------|
| "Show employees in IT" | ✅ Yes | Starts with "Show", no pronouns |
| "Show their emails" | ❌ No | Contains "their" (referential) |
| "Also show managers" | ❌ No | Starts with "Also" (continuation) |
| "How many in Finance?" | ✅ Yes | Aggregation keyword "How many" |
| "Sort by age" | ❌ No | Only sorting, no new data requested |

### 6.2 Management Hierarchy Queries

**Challenge**: "How many people does X manage?" requires relationship traversal.

**Solution**: Dedicated management query handler

```typescript
// Detection
const managementPattern = /how\s+many\s+(people|employees?)\s+does\s+([a-z\s]+?)\s+manage/i;

if (managementPattern.test(query)) {
  const managerName = query.match(managementPattern)![2];
  
  // Find manager
  const manager = employees.find(e => 
    e.fullName.toLowerCase() === managerName.toLowerCase()
  );
  
  // Find subordinates (employees where manager field matches)
  const subordinates = employees.filter(e => 
    e.office.manager.toLowerCase() === manager.fullName.toLowerCase()
  );
  
  // Return TWO widgets
  return {
    type: "managerReport",
    data: {
      manager,
      count: subordinates.length,
      subordinates
    }
  };
}
```

**Output**: Dual-widget response (Stats + Table)

### 6.3 Timeline Data Generation

**Challenge**: Databases typically don't have historical snapshots.

**Solution**: Generate plausible fictional trends based on current state.

```typescript
function generateTimelineDataByEducation(): QueryResponse {
  const startYear = 2010;
  const endYear = 2025;
  
  // Define realistic growth rates per education level
  const educationLevels = {
    "High School": { start: 32000, growth: 0.025 },      // 2.5% annual
    "Bachelor's Degree": { start: 48000, growth: 0.03 }, // 3% annual
    "Master's Degree": { start: 65000, growth: 0.035 },  // 3.5% annual
    "PhD": { start: 80000, growth: 0.04 }                // 4% annual
  };
  
  const data = [];
  for (let year = startYear; year <= endYear; year++) {
    const yearIndex = year - startYear;
    const dataPoint: any = { year };
    
    Object.entries(educationLevels).forEach(([level, config]) => {
      // Compound growth with random variation (±5%)
      const randomFactor = 0.95 + Math.random() * 0.1;
      const salary = Math.round(
        config.start * Math.pow(1 + config.growth, yearIndex) * randomFactor
      );
      dataPoint[level] = salary;
    });
    
    data.push(dataPoint);
  }
  
  return {
    type: "timeline",
    data: {
      data,
      lines: [
        { key: "High School", name: "High School", color: "#3b82f6" },
        { key: "Bachelor's Degree", name: "Bachelor's Degree", color: "#10b981" },
        { key: "Master's Degree", name: "Master's Degree", color: "#f59e0b" },
        { key: "PhD", name: "PhD", color: "#ef4444" }
      ],
      title: "Income Development by Education Level (2010-2025)"
    }
  };
}
```

**Why This Works**:
- Realistic growth rates (different per education level)
- Random variation (makes it look natural, not too perfect)
- Based on current salary distributions (maintains realism)
- Covers sufficient time span (15 years = meaningful trends)

### 6.4 Drag-and-Drop Dashboard

**Challenge**: Users want to organize their dashboard.

**Solution**: Draggable widgets with reordering.

```tsx
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Draggable wrapper
export function DraggableWidget({ id, children, onRemove }: { 
  id: string; 
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// In ChatContainer
function ChatContainer({ messages, onReorderMessages }: Props) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = messages.findIndex(m => m.id === active.id);
    const newIndex = messages.findIndex(m => m.id === over.id);
    
    const reordered = arrayMove(messages, oldIndex, newIndex);
    onReorderMessages(reordered);
  };
  
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={messages.map(m => m.id)} strategy={verticalListSortingStrategy}>
        {messages.map(message => (
          <DraggableWidget key={message.id} id={message.id}>
            <AIMessage message={message} />
          </DraggableWidget>
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### 6.5 Column Order Preservation

**Critical Feature**: Columns appear in EXACT order user specifies.

**Implementation**:

```typescript
function parseDisplayClause(query: string): string[] {
  // Store fields WITH their position
  const fields: Array<{name: string; position: number}> = [];
  
  const displayText = extractDisplaySection(query);
  
  for (const [fieldName, synonyms] of Object.entries(FIELD_MAPPINGS)) {
    for (const synonym of synonyms) {
      const index = displayText.indexOf(synonym);
      if (index !== -1 && !fields.find(f => f.name === fieldName)) {
        fields.push({ name: fieldName, position: index });
        break;
      }
    }
  }
  
  // CRITICAL: Sort by position to preserve order
  fields.sort((a, b) => a.position - b.position);
  
  return fields.map(f => f.name);
}
```

**Example**:
```
Query: "Show salary, name, city, and email"

Step-by-step:
1. Find "salary" at position 5 → { name: "salary", position: 5 }
2. Find "name" at position 13 → { name: "name", position: 13 }
3. Find "city" at position 19 → { name: "city", position: 19 }
4. Find "email" at position 29 → { name: "email", position: 29 }
5. Sort by position → [5, 13, 19, 29]
6. Result: ["salary", "name", "city", "email"]  ✅ CORRECT ORDER
```

**Without position tracking** (WRONG):
```
Fields found: ["name", "salary", "email", "city"]  ❌ ALPHABETICAL, NOT USER ORDER
```

### 6.6 Field-Agnostic Design

**Principle**: The system should work with ANY field, not just predefined ones.

**Implementation Strategy**:

1. **Dynamic field mapping**:
```typescript
const FIELD_MAPPINGS = {
  // Define ALL possible fields
  name: ["name", "full name", ...],
  salary: ["salary", "pay", ...],
  // ... 30+ fields
};
```

2. **Generic field access**:
```typescript
function getFieldValue(employee: Employee, field: string): any {
  // Use path-based access for nested fields
  const paths: Record<string, string> = {
    name: "fullName",
    email: "office.email",
    salary: "salary.amount",
    department: "office.department",
  };
  
  const path = paths[field] || field;
  return path.split('.').reduce((obj, key) => obj?.[key], employee);
}
```

3. **Generic rendering**:
```typescript
function renderCellValue(employee: Employee, field: string): React.ReactNode {
  const value = getFieldValue(employee, field);
  
  // Type-specific formatting
  if (field === "email") return <a href={`mailto:${value}`}>{value}</a>;
  if (field === "phone") return <a href={`tel:${value}`}>{value}</a>;
  if (field === "salary") return `€${value.toLocaleString()}`;
  if (field === "image") return <img src={value} className="w-10 h-10 rounded-full" />;
  
  return value;
}
```

**Result**: Adding a new queryable field only requires:
1. Add to FIELD_MAPPINGS (synonyms)
2. Add to field path map (if nested)
3. Add to render function (if special formatting)

No changes to parser, processor, or widget logic!

### 6.7 Error Handling & User Feedback

**Challenge**: What if the query can't be parsed or returns no results?

**Solution**: Graceful degradation with helpful messages.

```typescript
export function processNLPQuery(query: string, context?: Employee[]): QueryResponse {
  try {
    const parsed = parseQuery(query);
    let targetEmployees = determineEmployeeSet(parsed, context);
    
    // Apply all transformations...
    
    // Check if we have results
    if (targetEmployees.length === 0) {
      return {
        type: "error",
        message: "No employees found matching your criteria. Try adjusting your filters."
      };
    }
    
    return buildResponse(targetEmployees, parsed.fields, parsed);
    
  } catch (error) {
    console.error("Query processing error:", error);
    return {
      type: "error",
      message: "I couldn't understand that query. Try rephrasing it or use simpler terms."
    };
  }
}
```

**User-Friendly Error Messages**:
```tsx
{message.widget?.type === "error" && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-800">{message.text}</p>
    <div className="mt-2 text-sm text-red-600">
      <p>Try asking:</p>
      <ul className="list-disc ml-4">
        <li>"Show me all employees"</li>
        <li>"Top 10 employees by salary"</li>
        <li>"Employees in IT department"</li>
      </ul>
    </div>
  </div>
)}
```

---

## Conclusie

Je hebt nu een complete blauwdruk voor het bouwen van een **Liquid Display: Text-to-Dashboard** systeem.

**Samenvatting van de Key Components**:

1. ✅ **Data Model**: TypeScript interfaces + mock dataset (45 employees, 30+ fields)
2. ✅ **Field Mappings**: Natuurlijke taal → database fields (30+ field mappings)
3. ✅ **Clause-Based Parser**: 7 independent parsers (display, filter, sort, limit, employee, aggregation, context)
4. ✅ **Query Processor**: Orchestration layer die filters/sorting/limiting toepast
5. ✅ **Response Builder**: Widget type selection logic (table vs. widget vs. chart)
6. ✅ **Widget Library**: 7+ widget types (table, chart, word cloud, timeline, stats, aggregation)
7. ✅ **Render Engine**: Component mapping (JSON config → React component)
8. ✅ **State Management**: Context-based refinement met `useRef` + `useState`
9. ✅ **Drag & Drop**: Sortable widgets via dnd-kit
10. ✅ **API Integration Pattern**: Mock → Real API transition strategy

**Wat maakt dit systeem Liquid?**

- ❌ Geen vooraf gedefinieerde dashboards
- ❌ Geen hardcoded queries
- ❌ Geen developer involvement voor nieuwe vragen
- ✅ **100% dynamische UI generatie**
- ✅ **Natuurlijke taal als interface**
- ✅ **Onbeperkte query mogelijkheden**
- ✅ **Context-aware conversaties**

**Next Steps voor Production**:

1. **Expand Field Mappings**: Test met echte gebruikers, voeg missing synonyms toe
2. **Optimize Parsers**: Verbeter detection accuracy met machine learning
3. **Add More Widgets**: Heatmaps, Gantt charts, geographical maps
4. **API Integration**: Connect naar echte database met proper error handling
5. **Authentication**: Add user context (alleen eigen team tonen, etc.)
6. **Caching**: Implement smart caching voor performance
7. **Analytics**: Track welke queries populair zijn
8. **Export Functionality**: Save/share dashboard configurations

**Deze documentatie geeft een AI-engineer alles wat nodig is om dit systeem vanaf nul op te bouwen.** 🚀
