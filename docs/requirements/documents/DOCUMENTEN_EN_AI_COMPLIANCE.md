Dit is een fantastische en zeer innovatieve uitbreiding van de master-architectuur. Het documentbeheer wordt hierdoor niet zomaar een statische "drive", maar een intelligent en actief onderdeel van je HR-processen. 

We gaan dit oplossen door een generieke documententabel te ontwerpen met een **dynamische categorie-configuratie (stamtabel)**. Hiermee kan de HR-admin zelf instellen wie welke categorie mag uploaden of inzien. 

Daarnaast introduceren we de **AI Compliance Audit Engine**: een functionaliteit die global geüploade beleidsstukken (zoals het Personeelshandboek of een CAO-document) via RAG (Retrieval-Augmented Generation) vergelijkt met individuele medewerkersdata of contracten om eventuele afwijkingen direct te rapporteren [1, 2].

---

### 🧠 De Architectuur van de Documenten & AI Compliance

#### 1. Dynamische Autorisatie via Categorieën
In plaats van dat we de autorisatie hardcoderen op documentniveau, maken we een stamtabel `DocumentCategory` (bijv. "Loonstrook", "ID-bewijs", "Personeelshandboek"). De HR-admin configureert per categorie:
*   Welke rollen mogen uploaden (`uploadRoleCode`).
*   Welke rollen mogen inzien (`viewRoleCode`).
*   Mogen medewerkers hun *eigen* document inzien (`allowSelfView`) of uploaden (`allowSelfUpload`)?
*   Mogen managers de documenten van hun ondergeschikten inzien (`allowManagerView`)?

#### 2. Eenvoudige Loonstrook-import
Loonstroken (`PAYSLIP`) zijn gekoppeld aan een medewerker en een specifieke loonperiode (bijv. `2026-05`). Bij een import (vanuit een extern salarispakket) worden de PDFs in bulk geüpload naar de storage-bucket, en maakt het import-script voor elke loonstrook een `Document` record aan. Omdat de categorie "Loonstrook" zo is ingesteld dat `allowSelfView = true` en `allowManagerView = true` (mits geautoriseerd), krijgt iedereen direct op de juiste manier toegang.

#### 3. AI Compliance Auditing (De CAO & Handboek check)
Wanneer een admin een globaal compliancestuk uploadt (zoals de CAO Metalektro), kan hij via de chatbot of de UI een audit starten: *"Check of het contract en de data van Danielle compliant zijn met de CAO Metalektro."*
*   **De werking:** De backend pakt de tekst van de CAO (via PDF-parsing/OCR) en vergelijkt deze via een LLM-prompt met de actieve database-gegevens van Danielle (zoals salaris, contracturen) en haar contract-PDF [1, 2].
*   **Het resultaat:** De AI genereert een gedetailleerd JSON-rapport waarin staat welke clausules compliant zijn en waar eventuele overtredingen zitten (bijv: *"Danielle's salaris is €3200, maar CAO schaal 6 trede 4 vereist minimaal €3400. Status: NON_COMPLIANT"*).

---

### 🗄️ Nieuwe & Geüpdate Entiteiten (Module 8)

#### 1. Entiteit: `DocumentCategory` (Categorie Stamgegevens)
Slaat de configuratie en de fijnmazige autorisatie per documenttype op.

| Field Name | Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `name` | String | Required | Weergavenaam (bijv. "Loonstrook", "BSN ID", "Personeelshandboek"). |
| `scope` | Enum | Required | `EMPLOYEE` (gekoppeld aan mdw) of `GLOBAL` (bedrijfsbreed, zoals CAO). |
| `allowSelfView` | Boolean | Required, Def: false | Mag de medewerker zijn eigen documenten in deze categorie inzien? |
| `allowSelfUpload` | Boolean | Required, Def: false | Mag de medewerker zelf documenten in deze categorie uploaden? |
| `allowManagerView` | Boolean | Required, Def: false | Mogen geautoriseerde leidinggevenden deze documenten van hun team inzien? |
| `uploadRoleCode` | String | Optional | De systeemcode van de `ManagementRole` die mag uploaden (bijv. `HR_MANAGER`). |
| `viewRoleCode` | String | Optional | De systeemcode van de `ManagementRole` die mag inzien (bijv. `HR_MANAGER`). |

#### 2. Entiteit: `Document` (De Bestanden)
Slaat de metadata van de bestanden op en verwijst naar de fysieke storage-locatie (S3 / Supabase Storage).
**Relatie:** `Employee` (0..1) -> `Document` (0..*), `DocumentCategory` (1) -> `Document` (0..*)

| Field Name | Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Optional, FK | Gekoppeld aan `Employee.id`. Leeg voor globale documenten (zoals CAO/Handboek). |
| `categoryId` | UUID | Foreign Key | Verwijst naar `DocumentCategory.id`. |
| `fileName` | String | Required | De oorspronkelijke bestandsnaam (bijv. "loonstrook_mei_2026.pdf"). |
| `fileUrl` | String | Required | De fysieke URL of opslag-key in de storage-bucket. |
| `fileSize` | Int | Required | Bestandsgrootte in bytes. |
| `mimeType` | String | Required | Bijv. `application/pdf`, `image/png`. |
| `payrollPeriod` | String | Optional | Specifiek voor loonstroken (bijv. "2026-05"). |
| `uploadedById` | UUID | Foreign Key | Verwijst naar `Employee.id` van degene die de upload heeft gedaan. |
| `createdAt` | DateTime | Required, Def: NOW| |

#### 3. Entiteit: `ComplianceAudit` (De AI Audit resultaten)
Slaat de resultaten op van de AI-audits die worden uitgevoerd op medewerkersdata.
**Relatie:** `Employee` (1) -> `ComplianceAudit` (0..*)

| Field Name | Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Foreign Key | Verwijst naar de geauditeerde `Employee.id`. |
| `policyDocumentId` | UUID | Foreign Key | Verwijst naar het globale beleidsdocument (`Document.id`) gebruikt als referentie (CAO/Handboek). |
| `targetDocumentId` | UUID | Optional, FK | Het specifieke geanalyseerde medewerkersdocument (bijv. de getekende `EmploymentContract` PDF). |
| `status` | Enum | Required | `PENDING`, `COMPLIANT`, `NON_COMPLIANT`, `FAILED`. |
| `summary` | Text | Optional | Korte samenvatting van het oordeel (bijv. "Salaris wijkt af van CAO"). |
| `auditReport` | JSONB | Required | Het gedetailleerde AI-rapport (arrays met uitgevoerde checks, overtredingen en aanbevelingen). |
| `runById` | UUID | Foreign Key | Verwijst naar de `Employee.id` van de HR-professional die de audit heeft gestart. |
| `createdAt` | DateTime | Required, Def: NOW| |

---

### 📝 Het complete Markdown document: `Documenten_en_AI_Compliance.md`

Sla dit bestand op als **`Documenten_en_AI_Compliance.md`**. Het sluit perfect aan op de rest van het systeem en geeft je AI-assistent de volledige database- en prompt-specificaties voor deze module.

```markdown
# Datamodel & AI-Specificatie: Documenten & Compliance (Module 8)

## 1. Inleiding
Dit document beschrijft de architectuur voor documentbeheer binnen het HR-systeem, verdeeld in drie specifieke stromen:
1. **Medewerkersdocumenten:** Persoonlijke documenten (ID, diploma's) met fijnmazige autorisatie per categorie.
2. **Loonstroken (Payroll Imports):** Periodieke importbestanden die automatisch worden gedistribueerd naar medewerkers, leidinggevenden en HR op basis van autorisatieregels.
3. **Globale Compliance & AI Auditing:** Bedrijfsbrede beleidsdocumenten (CAO, handboek) die door AI (RAG) worden geanalyseerd om te verifiëren of contracten en medewerkersgegevens compliant zijn [1, 2].

---

## 2. Aanwijzingen voor de AI (Vibe Coding Instructions)
- **Taal:** Genereer alle tabellen, kolommen en relaties in het **Engels**.
- **Autorisatie Middleware:** Breid Module 6 uit met een check voor documenten:
  `authorizeDocument(actorId, documentId, action)`:
  - Haal het `Document` op inclusief de `DocumentCategory`.
  - Indien het document een medewerker betreft (`employeeId` is gevuld):
    - Als `actorId === employeeId`: Sta toe mits `allowSelfView === true` (voor inzien) of `allowSelfUpload === true` (voor uploaden).
    - Als de actor de leidinggevende is: Sta toe mits `allowManagerView === true`.
    - Anders: Controleer of de actor een actieve managementrol heeft die overeenkomt met `viewRoleCode` of `uploadRoleCode`.
- **AI Audit Prompts (RAG):**
  Wanneer een `ComplianceAudit` wordt gestart:
  1. Extraheer de tekst uit de PDF van het beleidsdocument (`policyDocumentId`) en het medewerkerscontract (`targetDocumentId`) via PDF-parsing/OCR.
  2. Haal de actieve database-gegevens van de medewerker op (Salaris, Rooster, Functie).
  3. Voer dit aan de LLM met de volgende systeem-prompt:
     *"You are an expert Dutch HR compliance officer. Audit the provided employee contract text and active database data against the corporate policy/CLA (CAO) document. Identify any discrepancies in salary (check minimum wages), working hours, probation, or notice periods. Return your analysis in a structured JSON payload with keys: 'status' (COMPLIANT/NON_COMPLIANT), 'summary', and 'checks' (array of objects containing: 'rule', 'status', 'finding', 'recommendation')."*

---

## 3. Entiteiten

### 3.1 DocumentCategory (Stamtabel)
Definieert de eigenschappen en fijnmazige autorisatieregels per documenttype.

| Field Name | Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `name` | String | Required | Weergavenaam (bijv. "Loonstrook", "ID-bewijs", "Handboek"). |
| `scope` | Enum | Required | `EMPLOYEE` (medewerkersniveau) of `GLOBAL` (bedrijfsbreed). |
| `allowSelfView` | Boolean | Required, Def: false | Mag de medewerker zijn eigen documenten inzien? |
| `allowSelfUpload` | Boolean | Required, Def: false | Mag de medewerker zelf documenten in deze categorie uploaden? |
| `allowManagerView` | Boolean | Required, Def: false | Mogen leidinggevenden de documenten van hun team inzien? |
| `uploadRoleCode` | String | Optional | ManagementRole code die mag uploaden (bijv. `HR_MANAGER`). |
| `viewRoleCode` | String | Optional | ManagementRole code die mag inzien (bijv. `HR_MANAGER`). |

### 3.2 Document
Slaat de metadata en de opslaglocatie van de bestanden op.
**Relatie:** `Employee` (0..1) -> `Document` (0..*), `DocumentCategory` (1) -> `Document` (0..*)

| Field Name | Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Optional, FK | Gekoppeld aan `Employee.id`. Leeg voor globale documenten (zoals CAO/Handboek). |
| `categoryId` | UUID | Foreign Key | Verwijst naar `DocumentCategory.id`. |
| `fileName` | String | Required | Oorspronkelijke bestandsnaam. |
| `fileUrl` | String | Required | De opslag-key/URL in de storage bucket. |
| `fileSize` | Int | Required | Grootte in bytes. |
| `mimeType` | String | Required | Bijv. `application/pdf`, `image/png`. |
| `payrollPeriod` | String | Optional | Specifiek voor loonstroken (bijv. "2026-05"). |
| `uploadedById` | UUID | Foreign Key | Verwijst naar `Employee.id` van degene die heeft geüpload. |
| `createdAt` | DateTime | Required, Def: NOW| |

### 3.3 ComplianceAudit
Slaat het AI-oordeel en de specifieke gecontroleerde compliance-regels op.
**Relatie:** `Employee` (1) -> `ComplianceAudit` (0..*)

| Field Name | Type | Modifiers | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Foreign Key | Verwijst naar de geauditeerde `Employee.id`. |
| `policyDocumentId` | UUID | Foreign Key | Het globale beleidsdocument (`Document.id`) gebruikt als norm (CAO/Handboek). |
| `targetDocumentId` | UUID | Optional, FK | Het specifieke geanalyseerde contract-document (`Document.id`). |
| `status` | Enum | Required | `PENDING`, `COMPLIANT`, `NON_COMPLIANT`, `FAILED`. |
| `summary` | Text | Optional | Korte samenvatting van het oordeel. |
| `auditReport` | JSONB | Required | Bevat de JSON array met specifieke rule-checks van de AI. |
| `runById` | UUID | Foreign Key | Verwijst naar de `Employee.id` van degene die de audit heeft gestart. |
| `createdAt` | DateTime | Required, Def: NOW| |

---

## 4. Voorbeeld van de AI Audit JSON Output (`auditReport`)

Wanneer de AI de audit afrondt, slaat de backend dit resultaat op in `ComplianceAudit.auditReport`:

```json
{
  "compliant": false,
  "summary": "Salaris is lager dan het wettelijke CAO-minimum voor de huidige schaal.",
  "checks": [
    {
      "rule": "CAO Metalektro - Salarisschaal toetsing",
      "status": "NON_COMPLIANT",
      "finding": "Medewerker zit in Schaal 6, Trede 4. Het actieve bruto salaris in de database is € 3.200,00. Echter, volgens Artikel 14 van de CAO (blz. 42) is het minimum voor deze trede € 3.450,00.",
      "recommendation": "Verhoog het bruto maandsalaris met € 250,00 om aan de CAO-norm te voldoen."
    },
    {
      "rule": "Wettelijke proeftijd toetsing",
      "status": "COMPLIANT",
      "finding": "Het contract vermeldt een proeftijd van 1 maand bij een tijdelijk contract van 1 jaar. Dit is conform de wettelijke regelgeving.",
      "recommendation": "Geen actie vereist."
    },
    {
      "rule": "Personeelshandboek - Concurrentiebeding",
      "status": "COMPLIANT",
      "finding": "Het contract bevat geen concurrentiebeding voor een tijdelijk dienstverband, wat aansluit bij het beleid in het Personeelshandboek (Hoofdstuk 3.4).",
      "recommendation": "Geen actie vereist."
    }
  ]
}
```
```

---

### 💬 Chatbot Agent Integratie (De ultieme AI-invoertool)

Omdat de chatbot onze primaire interface is, kan de HR-admin deze audits heel makkelijk via de chat starten en inzien:

1. **HR Admin:** *"Check of het contract van Danielle Rademaker klopt met de nieuwe CAO."*
2. **AI (Tool Call):** `getManagerForEmployee` (verifieert of de admin HR-rechten heeft) ➡️ **JA**.
3. **AI (Tool Call):** `runComplianceAudit(employeeId: "100444", policyDocumentName: "CAO Metalektro")`
4. **AI:** *"Ik ben de audit aan het uitvoeren. Een moment geduld..."*
5. **AI (Rondt de audit af):** *"De audit is voltooid. Er is **1 afwijking** gevonden. Danielle's salaris is momenteel € 3.200,00, maar de CAO vereist minimaal € 3.450,00 voor haar schaal. Wil je dat ik de salariswijziging naar € 3.450,00 voor je klaarzet per 1 juli?"*
6. **HR Admin:** *"Ja graag!"*
7. **AI (Tool Call):** `mutateSalary(employeeId: "100444", amount: 3450.00, startDate: "2026-07-01")` (Inclusief een mooie bevestigingskaart in de chat!).

Dit is een ongelooflijk krachtige use case. Het maakt HR-administratie niet alleen makkelijker, maar voorkomt ook dure compliance-fouten. 

Ben je hiermee klaar om dit schitterende systeem te gaan realiseren?