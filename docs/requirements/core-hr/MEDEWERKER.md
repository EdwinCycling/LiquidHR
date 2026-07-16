# Datamodel: Medewerker Record (Core HR)

## 1. Inleiding
Dit document beschrijft de architectuur en het datamodel voor de 'Core HR' module van een nieuw, modern HR-systeem. De focus ligt hierbij op de entiteit `Employee` (de medewerker) en alle direct gekoppelde gegevens zoals adressen, bankrekeningen en relaties/noodcontacten. Dit document dient als "Single Source of Truth" voor het genereren van de database tabellen (bijv. via Prisma, Drizzle, TypeORM of SQL) en de bijbehorende backend logica.

**Implementatiestatus 2026-07-15:** de Employee-slice is volledig gebouwd met schema, RLS, API, responsive UI, audit en tests. Het personeelsnummer is uniek per tenant, wordt oplopend voorgesteld en mag gecontroleerd worden overschreven. BSN-ciphertext en tenantgebonden BSN-fingerprint staan bewust in `employee_secure_identifiers`, niet in de algemene medewerkerstabel. Alleen HR-admins met expliciete functiepunten en de medewerker zelf mogen het BSN via een gelogde reveal bekijken; managers nooit.

## 2. Besproken Informatie & Architectuur Keuzes
Tijdens het ontwerpproces (gebaseerd op best-practices en vergelijkingen met bestaande Nederlandse HR-applicaties) zijn de volgende cruciale beslissingen genomen:

1. **Nederlandse Naamconventies:** De logica rondom geboortenaam, partnernaam en de weergave daarvan (samenstelling) is volledig verwerkt in de database via prefix-velden en een `NameUsage` enum.
2. **Historie in Adressen:** Adressen worden niet plat op de medewerker opgeslagen, maar in een eigen entiteit (`EmployeeAddress`) met een `startDate` en `endDate`. Dit maakt verhuis-historie mogelijk.
3. **Meerdere Bankrekeningen:** Een medewerker kan 0 tot meerdere bankrekeningen hebben. Met een `isPrimary` boolean wordt de hoofdrekening voor salarisbetalingen gemarkeerd.
4. **Relaties & Noodcontacten Gecombineerd:** In plaats van een aparte tabel voor noodcontacten, is er gekozen voor één brede `EmployeeRelation` tabel (voor partners, kinderen, huisarts, etc.). Een simpel boolean veld (`isEmergencyContact`) bepaalt of de persoon in geval van nood gebeld moet worden.
5. **Geen Leeftijd in DB:** De leeftijd wordt dynamisch berekend op basis van `birthDate`. Dit veld bestaat dus niet in de database.
6. **Audit Trail (Activiteitenfeed):** Alle wijzigingen op deze entiteiten moeten worden bijgehouden (wie, wat, wanneer) in een generieke `AuditLog` om een activiteitenfeed te genereren.

## 3. Aanwijzingen voor de AI (Vibe Coding Instructions)
- **Taal:** Genereer alle tabellen, kolommen, en relaties in het **Engels**, zoals hieronder beschreven.
- **ID's:** Gebruik `UUID` (of CUID2) voor alle Primary Keys.
- **Soft Deletes:** Voeg (indien gebruikelijk in de gekozen ORM) standaard `createdAt`, `updatedAt` en eventueel `deletedAt` velden toe aan elke tabel (hieronder weggelaten voor leesbaarheid).
- **Encryptie:** Velden zoals `bsn` (Burgerservicenummer) moeten in de applicatielaag of database encrypted worden opgeslagen in verband met de AVG/GDPR.
- **Audit Log:** Implementeer database triggers of ORM middleware (bijv. Prisma Middleware of spatie/laravel-activitylog) om wijzigingen automatisch weg te schrijven naar de `AuditLog` tabel.

---

## 4. Enums

Voordat we de tabellen maken, moeten deze Enums gedefinieerd worden:

- `Gender`: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
- `NameUsage`: BIRTH_NAME, PARTNER_NAME, PARTNER_BEFORE_BIRTH_NAME, BIRTH_NAME_BEFORE_PARTNER_NAME
- `MaritalStatus`: SINGLE, MARRIED, REGISTERED_PARTNERSHIP, DIVORCED, WIDOWED
- `RelationType`: PARTNER, CHILD, PARENT, SIBLING, DOCTOR, DENTIST, OTHER
- `EducationLevel`: MBO, HBO, WO, HIGHSCHOOL, OTHER, UNKNOWN

---

## 5. Datamodel (Entiteiten)

### 5.1 Employee
De basisentiteit van de werknemer. *(Let op: Authenticatie en wachtwoorden horen thuis in een aparte `User`/`Account` tabel die een 1-op-1 relatie heeft met `Employee`).*

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeNumber` | String | Unique, Required | Uniek intern personeelsnummer (bijv. "100110"). |
| `title` | String | Optional | Bijv. Mr., Mevr., Dr. |
| `initials` | String | Optional | Voorletters (bijv. "S.A."). |
| `firstName` | String | Required | Roepnaam / Voornaam. |
| `birthNamePrefix` | String | Optional | Tussenvoegsel geboortenaam (bijv. "van der"). |
| `birthName` | String | Required | Achternaam bij geboorte. |
| `partnerNamePrefix` | String | Optional | Tussenvoegsel partnernaam. |
| `partnerName` | String | Optional | Achternaam van de partner. |
| `nameUsage` | Enum `NameUsage` | Required | Bepaalt de opbouw van de volledige weergavenaam. |
| `gender` | Enum `Gender` | Required | Geslacht. |
| `pronouns` | String | Optional | Bijv. "zij/haar". |
| `birthDate` | Date | Optional | Geboortedatum (leeftijd berekenen we on-the-fly). |
| `birthPlace` | String | Optional | Geboorteplaats. |
| `birthCountry` | String | Optional | Geboorteland (ISO Landcode). |
| `nationality` | String | Optional | Nationaliteit (ISO Landcode, bijv. "NL"). |
| `bsn` | String | Optional | Burgerservicenummer (let op: versleutelen). |
| `maritalStatus` | Enum `MaritalStatus`| Optional | Burgerlijke staat. |
| `maritalStatusDate`| Date | Optional | Ingangsdatum van de burgerlijke staat. |
| `educationLevel` | Enum `EducationLevel`| Optional | Hoogst genoten opleiding. |
| `preferredLanguage`| String | Required, Def:"nl" | App/Loonstrook taal (bijv. "nl-NL"). |
| `privateEmail` | String | Optional | Privé e-mailadres. |
| `privatePhone` | String | Optional | Privé telefoon (vast). |
| `privateMobile` | String | Optional | Privé mobiel. |
| `workEmail` | String | Optional | Zakelijk e-mailadres. |
| `workPhone` | String | Optional | Zakelijk telefoon kantoor. |
| `workPhoneExt` | String | Optional | Zakelijk toestelnummer (Extension). |
| `workMobile` | String | Optional | Zakelijk mobiel. |
| `avatarUrl` | String | Optional | Pad of URL naar de profielfoto. |
| `originalHireDate` | Date | Optional | Oorspronkelijke datum in dienst (voor UI weergave). |
| `isActive` | Boolean | Required, Def:true | Is de persoonskaart bruikbaar en niet gearchiveerd? De arbeidsstatus wordt uitsluitend afgeleid uit dienstverbanden. |

> Een Employee is de blijvende persoonsidentiteit binnen één tenant. De persoon kan nul, één of meerdere — ook parallelle — dienstverbanden hebben. Uitdiensttreding archiveert de Employee niet. Bij herintreding wordt dezelfde Employee hergebruikt en ontstaat een nieuw Employment.

### 5.2 EmployeeAddress
Tijdsgebonden tabel voor de adressen. Huidig adres = `endDate` is null.
**Relatie:** `Employee` (1) -> `EmployeeAddress` (0..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Foreign Key | Relatie naar `Employee.id`. |
| `street` | String | Required | Straatnaam. |
| `houseNumber` | String | Required | Huisnummer. |
| `addition` | String | Optional | Toevoeging (bijv. "A", "bis"). |
| `zipCode` | String | Required | Postcode. |
| `city` | String | Required | Plaats. |
| `province` | String | Optional | Provincie. |
| `country` | String | Required, Def:"NL" | ISO Landcode. |
| `startDate` | Date | Required | Vanaf wanneer is dit adres geldig? |
| `endDate` | Date | Optional | Tot wanneer geldig? (Leeg = Huidig adres). |

### 5.3 BankAccount
Tabel voor 0 of meerdere bankrekeningen.
**Relatie:** `Employee` (1) -> `BankAccount` (0..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Foreign Key | Relatie naar `Employee.id`. |
| `iban` | String | Required | IBAN-rekeningnummer. |
| `bic` | String | Optional | SWIFT/BIC code (Internationaal). |
| `accountHolder` | String | Required | Tenaamstelling van de bankrekening. |
| `description` | String | Optional | Omschrijving (bijv. "Gezamenlijke rekening"). |
| `isPrimary` | Boolean | Required, Def:false| Vinkje: Is dit de hoofdrekening voor salaris? |

### 5.4 EmployeeRelation
Brede tabel voor alle relaties van de werknemer (Partner, Kind, Huisarts). Bevat tevens de logica voor noodcontacten.
**Relatie:** `Employee` (1) -> `EmployeeRelation` (0..*)

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `employeeId` | UUID | Foreign Key | Relatie naar `Employee.id`. |
| `relationType` | Enum `RelationType` | Required | Type relatie (Partner, Huisarts, etc). |
| `isEmergencyContact`| Boolean | Required, Def:false| **BELANGRIJK**: Mag deze persoon gebeld worden in nood? |
| `firstName` | String | Optional | Voornaam van de relatie. |
| `initials` | String | Optional | Voorletters. |
| `prefix` | String | Optional | Tussenvoegsel (bijv. "van der"). |
| `lastName` | String | Required | Achternaam van de relatie. |
| `gender` | Enum `Gender` | Optional | Geslacht. |
| `birthDate` | Date | Optional | Geboortedatum (Essentieel voor zorg-/ouderschapsverlof). |
| `phone` | String | Optional | Vast nummer (bijv. praktijklijn dokter). |
| `mobile` | String | Optional | Mobiel nummer. |
| `email` | String | Optional | E-mailadres. |
| `notes` | Text | Optional | Bijv. Patiëntnummer bij de arts. |

### 5.5 AuditLog (Systeem Tabel)
Wordt gebruikt om de activiteitenfeed/historie bij te houden van mutaties.

| Veldnaam | Type | Modifiers | Beschrijving |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Primary Key | |
| `entityName` | String | Required | Bijv. "Employee", "BankAccount". |
| `entityId` | UUID | Required | Het ID van het aangepaste record. |
| `actorId` | UUID | Required | Wie heeft de wijziging gedaan? (Koppeling naar User tabel). |
| `action` | String | Required | `CREATE`, `UPDATE`, of `DELETE`. |
| `changes` | JSON | Required | Payload (bijv. `{ "maritalStatus": {"old": "SINGLE", "new": "MARRIED"} }`). |
| `createdAt` | DateTime | Required | Tijdstip van de aanpassing. |
