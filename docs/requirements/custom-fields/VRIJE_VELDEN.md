# Datamodel: Dynamische Vrije Velden (Extra Velden)

## 1. Inleiding
Dit document beschrijft de architectuur voor het dynamisch toevoegen van 'extra velden' (custom fields) op diverse entiteiten binnen het HR-systeem. 

Om de code-complexiteit laag te houden en de prestaties te maximaliseren, gebruiken we een **Hybrid JSONB Metadata** aanpak:
1. We definiëren de velden in een centrale metadata-tabel (`CustomFieldDefinition`).
2. De daadwerkelijke waarden worden per entiteit opgeslagen in een `customFields` JSONB-kolom op de doeltabel zelf (bijv. in de `Employee` of `Asset` tabel).

**Implementatiestatus 2026-07-15:** de volledige verticale slice voor `EMPLOYEE` is gerealiseerd. Definities, selectopties en tellers zijn administratiegebonden. Waarden worden via een afzonderlijke RLS-tabel per definitie afgeschermd en door een interne trigger gespiegeld naar `employees.custom_fields[administrationId]`. Hierdoor kan een gebruiker nooit via de algemene medewerkerquery verborgen vrije velden uitlezen.

### Vastgestelde beveiligingsuitbreidingen

- Iedere definitie heeft afzonderlijke `HIDDEN`, `READ` of `WRITE` toegang voor HR, manager en medewerker-selfservice.
- Een veldsleutel en de tenant-/administratie-identiteit zijn na aanmaak onveranderlijk.
- Selectopties hebben een samengestelde foreign key naar dezelfde tenant en administratie.
- `AUTO_INCREMENT` gebruikt een atomaire tellertabel; `MAX(JSONB) + 1` is wegens race conditions niet toegestaan.
- Waarden van verschillende administraties delen nooit dezelfde JSON-keyspace.
- Alle mutaties worden geaudit; technische BSN-, fingerprint- en ciphertextwaarden worden nooit in auditpayloads opgenomen.

---

## 2. Aanwijzingen voor de AI (Vibe Coding Instructions)
- **Taal:** Genereer alle tabellen, kolommen en relaties in het **Engels**.
- **Doeltabellen:** Voeg aan de tabellen `Employee`, `EmploymentContract` (en toekomstige tabellen zoals `Asset`, `Declaration`, `Education`) een JSONB-kolom toe genaamd `customFields` (Nullable, Default: `{}`).
- **Sortering:** Gebruik de `sortOrder` kolom om de velden in de UI in de juiste volgorde te tonen (omhoog/omlaag pijltjes in de UI).

---

## 3. Enums

Definieer de volgende Enums in de database/ORM:

- `CustomFieldEntityType`: EMPLOYEE, ASSET, VEHICLE, SOFTWARE_LICENSE, SOFTWARE, EDUCATION, EDUCATION_PARTICIPANT, CONTRACT, DECLARATION
- `CustomFieldType`: TEXT, TEXT_AREA, SELECT, DATE, INTEGER, DECIMAL, CURRENCY, EMAIL, HYPERLINK, AUTO_INCREMENT
- `CustomFieldVisibility`: VISIBLE_AND_EDITABLE, VISIBLE, HIDDEN

Voor de huidige Employee-slice zijn de database-enums bewust beperkt tot daadwerkelijk ondersteunde typen: `TEXT`, `TEXTAREA`, `NUMBER`, `DATE`, `BOOLEAN`, `SELECT`, `MULTI_SELECT` en `AUTO_INCREMENT`. Nieuwe entiteit- of veldtypen worden pas in een migratie toegevoegd wanneer hun schema-, API- en UI-slice tegelijk wordt gebouwd.

---

## 4. Technische Specificatie van Veldtypes (Gedrag & Validatie)

Hieronder staat beschreven hoe de AI elk veldtype moet renderen, valideren en opslaan in de JSONB-kolom:

### 1. `TEXT` (Tekst)
- **UI Render:** Standaard `<input type="text" />` veld.
- **JSONB Opslag:** Opgeslagen als een `String`.
- **Validatie:** Geen specifieke validatie, optioneel max length.

### 2. `TEXT_AREA` (Tekst met meerdere lijnen)
- **UI Render:** `<textarea rows={4}></textarea>`.
- **JSONB Opslag:** Opgeslagen als een `String` (inclusief newline karakters `\n`).
- **Validatie:** Geen specifieke validatie.

### 3. `SELECT` (Selecteer een optie / Dropdown)
- **UI Render:** `<select>` of een custom Combobox/Dropdown component.
- **JSONB Opslag:** Opgeslagen als een `String` (de geselecteerde waarde).
- **Validatie:** De geselecteerde waarde *moet* voorkomen in de array `CustomFieldDefinition.selectOptions`.

### 4. `DATE` (Datum)
- **UI Render:** `<input type="date" />` of een Datepicker component.
- **JSONB Opslag:** Opgeslagen als een `String` in ISO 8601 formaat (`YYYY-MM-DD`).
- **Validatie:** Moet een geldige datum zijn.

### 5. `INTEGER` (Getal)
- **UI Render:** `<input type="number" step="1" />`.
- **JSONB Opslag:** Opgeslagen als een `Number` (Integer).
- **Validatie:** Moet een heel getal zijn (geen decimalen toegestaan).

### 6. `DECIMAL` (Decimaal getal)
- **UI Render:** `<input type="number" step="any" />`.
- **JSONB Opslag:** Opgeslagen als een `Number` (Float).
- **Validatie:** Moet een geldig numeriek getal zijn (decimalen toegestaan).

### 7. `CURRENCY` (Geld)
- **UI Render:** Numeriek invoerveld met een valutasymbool (bijv. "€") visueel vooropgezet. `<input type="number" step="0.01" />`.
- **Display:** Toon in tabellen altijd netjes geformatteerd (bijv. € 2.950,00).
- **JSONB Opslag:** Opgeslagen als een `Number` (Float).
- **Validatie:** Moet een geldig getal zijn, maximaal 2 decimalen.

### 8. `EMAIL` (E-mail)
- **UI Render:** `<input type="email" />`.
- **JSONB Opslag:** Opgeslagen als een `String`.
- **Validatie:** Moet voldoen aan een standaard e-mailadres regex.

### 9. `HYPERLINK` (Hyperlink)
- **UI Render:** `<input type="url" />`. In weergavemodus renderen als een klikbare link (`<a href="..." target="_blank">`).
- **JSONB Opslag:** Opgeslagen als een `String`.
- **Validatie:** Moet een geldige URL zijn (moet starten met `http://` of `https://`).

### 10. `AUTO_INCREMENT` (Automatisch oplopend getal)
- **UI Render:** Dit veld is **Read-Only / Disabled** in het formulier voor de gebruiker. Er staat een placeholder zoals *"Wordt automatisch gegenereerd"*.
- **JSONB Opslag:** Opgeslagen als een `Number` (Integer).
- **Systeemlogica (Berekening):**
  Bij het aanmaken van een nieuw record (bijv. een nieuwe `Asset`):
  1. Zoek de actieve `CustomFieldDefinition` binnen exact dezelfde tenant en administratie.
  2. Reserveer atomair het volgende nummer in `custom_field_counters` met `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
  3. Sla de gereserveerde waarde op via de enige toegestane schrijfservice.

Deze teller mag gaten bevatten na een afgebroken transactie of verwijderd record; bestaande nummers worden nooit hergebruikt.

---

## 5. Entiteiten

### 5.1 CustomFieldDefinition (De Velddefinities)
Slaat de configuratie op van de extra velden die de gebruiker zelf aanmaakt.

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `name` | String | Required | De naam/label van het veld (bijv. "Allergieën", "Aantal opladers"). |
| `entityType` | Enum `CustomFieldEntityType`| Required | Voor welke entiteit is dit veld bedoeld? (bijv. `EMPLOYEE`). |
| `fieldType` | Enum `CustomFieldType`| Required | Het type invoerveld (bijv. `SELECT` of `TEXT_AREA`). |
| `selectOptions` | JSONB | Optional | Alleen gebruikt bij `SELECT`. Bevat de array met opties: `["Optie 1", "Optie 2"]`. |
| `visibility` | Enum `CustomFieldVisibility`| Required, Def: VISIBLE | Bepaalt wat de medewerker zelf mag zien/aanpassen in zijn self-service. |
| `sortOrder` | Int | Required, Def: 0 | Bepaalt de volgorde van weergave in de UI. |

---

## 6. Voorbeeld van Opslag in de Doeltabel

Wanneer een medewerker gegevens invult voor de vrije velden, worden deze als key-value pairs opgeslagen in de `customFields` JSONB-kolom van de medewerker.

### Voorbeeld JSON in `Employee.customFields`:
```json
{
  "aantal_opladers": 2,
  "allergieen": "Pinda-allergie. Graag rekening mee houden bij de lunch.",
  "bereid_avonduren_werken": "Ja",
  "commercieel": "Nee",
  "schoenmaat": 43,
  "interne_code": 1005
}
