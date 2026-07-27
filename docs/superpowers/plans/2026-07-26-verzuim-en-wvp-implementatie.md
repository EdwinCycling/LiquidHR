# Uitvoeringsplan: Verzuim, herstel en Wet verbetering poortwachter

Status: **PLAN — nog niet uitvoeren zonder expliciete vervolgopdracht**

Datum broncontrole: **2026-07-26**

Bronnen van de gebruiker:

- `C:\Users\Edwin\Downloads\Verzuim_de_basis.md`
- `C:\Users\Edwin\Downloads\Verzuim_de_admin_instellignen.md`

Beoogde leidende requirements na stap 0:

- `docs/requirements/absence/VERZUIM_EN_HERSTEL.md`
- `docs/requirements/absence/WVP_POORTWACHTER_ENGINE.md`
- `docs/requirements/absence/VERZUIM_INSTELLINGEN.md`

Dit plan vertaalt de aangeleverde conceptdocumenten naar het bestaande LiquidHR-model. De brondocumenten zijn bruikbare functionele input, maar zijn **niet direct uitvoerbaar**: zij verwijzen naar niet-bestaande entiteiten, mengen herstel met archivering, maken verzuim persoonsbreed en bevatten juridisch en privacytechnisch onveilige aannames.

## 1. Doel en concrete gebruikersuitkomst

Lever een veilig, administratie- en dienstverbandgebonden verzuimdomein op volgens `schema → API/service → UI`.

Na de eerste voltooide verticale slice kan een bevoegde HR-gebruiker of leidinggevende:

1. een medewerker ziek melden vanuit:
   - het verzuimvenster op het medewerkerdashboard;
   - een geselecteerde medewerkerdag in `/hr-calendar`;
   - het nieuwe tabblad **Verzuim** op `/employees/[employeeId]`;
2. bij één geldig dienstverband automatisch door en bij meerdere geldige dienstverbanden verplicht één `employment_id` kiezen;
3. volledig of gedeeltelijk herstel registreren;
4. een lopende casus, historie, actuele mate van verzuim en eerstvolgende actie bekijken;
5. echte verzuimgegevens in het bestaande dashboardvenster en in de medewerkerskalender zien, zonder fictieve waarden;
6. administratiegebonden verzuiminstellingen beheren;
7. in latere, afzonderlijk afgetekende slices contacten, taken, WvP-mijlpalen en niet-medische re-integratiedocumenten beheren.

Dit is in de eerste release **geen medewerker-selfservice**. “Medewerkerdashboard” betekent hier de bestaande interne medewerkerkaart op `/employees/[employeeId]`. Voeg geen `self:absence:write` toe.

## 2. Niet-onderhandelbare correcties op de aangeleverde documenten

| Concept uit brondocument | LiquidHR-besluit |
|---|---|
| `EmploymentContract` / `contractId` | Bestaat niet. Gebruik de bestaande `employments` en altijd `employment_id`. |
| Verzuim per `employeeId` | Elke casus hoort bij precies één `employment_id`, plus dezelfde `tenant_id`, `administration_id` en `employee_id`. |
| Dynamische `SicknessContractTypeLookup` | Niet bouwen. Gebruik bestaande `employment_type` en `contract_type`. Voeg alleen een afzonderlijke workflowmapping toe als later aantoonbaar verschillende protocollen nodig zijn. |
| Nieuwe casus met `parentCaseId` | Niet bouwen. Modelleer één `absence_case` met meerdere `absence_spells` binnen dezelfde wettelijke keten. |
| Ketenkans bij `<= 28` dagen met vraag naar “andere medische oorzaak” | Onjuist en privacy-onveilig. Binnen vier weken automatisch dezelfde keten; vanaf vier weken een nieuwe keten. Vraag nooit naar diagnose, oorzaak of behandeling. |
| Vrije keuze om dossiers niet te koppelen | Niet in de kernflow. Een eventuele juridische uitzonderingsflow komt pas na expliciete juridische requirement en mag geen medische reden opslaan. |
| `wvpClockStartDate` als los handmatig veld | Ziekteperioden zijn de bron van waarheid. Een effectieve klokdatum mag alleen door de engine als afgeleide projectie worden bijgewerkt. |
| Volledig herstel zet status direct op `ARCHIVED` | Herstel en archivering zijn verschillende gebeurtenissen. Na herstel volgt eerst de wettelijke vierwekentermijn; daarna wordt de casus gesloten. Bewaring/verwijdering is een afzonderlijke lifecycle. |
| Toekomstige taken direct verwijderen of deactiveren bij herstel | Tijdens de vierwekentermijn pauzeren. Bij hervatting binnen vier weken worden termijnen herberekend. Pas na definitieve sluiting worden niet-relevante toekomstige taken geannuleerd. |
| Zeswekelijkse evaluatie op `completedAt + 42 dagen` | Niet laten verschuiven door te late voltooiing. Wettelijke cadans blijft aan de casusklok verankerd; een te late taak blijft te laat. |
| Eigen `SicknessReminder`-systeem | Niet dupliceren. `absence_tasks` is de workflowbron; het bestaande `reminders`-domein verzorgt signalering/ontvangers. |
| Eigen `SicknessAuditLog` | Niet dupliceren. Gebruik `audit_logs` en `internal_security.audit_hr_change()`. Gevoelige dossierinzage krijgt een expliciete server-side leesaudit. |
| `fileUrl` in een verzuimtabel | Nooit een publieke URL bewaren. Gebruik een private bucket, een storage-key en kort geldige signed downloads na casusautorisatie. |
| Categorie “Medisch advies” voor werkgever | Niet als medische dossiercategorie aanbieden. LiquidHR bewaart alleen gegevens/documenten die de werkgever voor verzuimbegeleiding en re-integratie mag verwerken. |
| Instelbare encryptie in de HR-UI | Niet bouwen. Encryptie en storagebeveiliging zijn platformbeleid, geen tenantinstelling. |
| Vast “2 jaar na herstel” als configureerbare bewaartermijn | Niet als eenvoudige waarheid of vrije instelling bouwen. Maak eerst een juridisch gevalideerde bewaarmatrix per gegevenssoort en uitzonderingssituatie. |
| Hardcoded rol `HR_ADMIN` als singleton-fallback | LiquidHR staat meerdere rolhouders toe. Als geen casemanager of directe manager kan worden opgelost, blijft de taak zichtbaar in een geautoriseerde onbehandelde werkvoorraad; wijs niet willekeurig één gebruiker toe. |
| 13-wekenmodel direct baseren op `TimeEntry` | LiquidHR heeft `employment_work_hour_entries`, maar de volledigheid als loongrondslag is niet vastgesteld. Bouw dit pas na payrollrequirement en bronkwaliteitscontract. |

## 3. Juridische en privacygrenzen die de uitvoering moet respecteren

Deze bronnen zijn leidend voor de requirementcorrecties, maar vervangen geen formele juridische goedkeuring van een productieproduct:

- UWV: ziekteperioden binnen vier weken worden samengeteld; vanaf vier weken begint een nieuwe periode:  
  `https://www.uwv.nl/nl/ziek/ziekteperiodes-optellen`
- UWV: probleemanalyse rond week 6, plan van aanpak rond week 8 en 42e-weeksmelding uiterlijk op de eerste werkdag na week 42:  
  `https://www.uwv.nl/en/employers/sickness/a-step-by-step-guide-to-employee-sickness`
- Rijksoverheid: werkgever en werknemer bespreken de voortgang iedere zes weken:  
  `https://www.rijksoverheid.nl/themas/werk/ziekteverzuim-van-het-werk/regels-en-verplichtingen-bij-ziekte`
- Autoriteit Persoonsgegevens: een werkgever mag niet vragen naar of registreren wat de werknemer mankeert of wat de medische oorzaak is; alleen beperkte noodzakelijke ziekmeldings- en re-integratiegegevens zijn toegestaan:  
  `https://autoriteitpersoonsgegevens.nl/uploads/imported/beleidsregels_de_zieke_werknemer.pdf`

Daarom gelden deze harde productregels:

1. Geen veld voor diagnose, symptomen, behandeling, medicatie of naam van de aandoening.
2. Ook vrijwillig gedeelde medische details worden niet opgeslagen.
3. Vangnet wordt alleen als `ja / nee / onbekend` vastgelegd; niet welke vangnetgrond geldt.
4. Arbeidsongeval en verkeersongeval worden alleen als noodzakelijke indicator vastgelegd.
5. Functionele mogelijkheden komen uitsluitend uit informatie die werkgever mag ontvangen; geen medisch oordeel nabouwen.
6. Verzuimgegevens liften niet mee in algemene employeeprojecties, zoekresultaten, logs, analytics of AI-context.
7. Dashboard- en kalenderprojecties tonen alleen minimaal noodzakelijke operationele gegevens.
8. Dossierdetail, documentmetadata en downloads vereisen afzonderlijke casusautorisatie.

## 4. Canonieke domeintaal

Gebruik in code Engelse identifiers en in UI/documentatie Nederlandse termen.

| Nederlandse term | Canonieke identifier | Betekenis |
|---|---|---|
| Verzuimcasus | `absence_case` | Eén wettelijke/verzuimtechnische keten voor precies één dienstverband. |
| Ziekteperiode | `absence_spell` | Een ononderbroken ziek-tot-hersteld-periode binnen een casus. |
| Mate van verzuim | `absence_percentage` | Percentage van de geplande inzet dat de medewerker verzuimt, `> 0` en `<= 100`. |
| Gedeeltelijk herstel | `absence_capacity_change` | Een effective-dated wijziging van het verzuimpercentage binnen een open ziekteperiode. |
| Volledig herstel | `recovered_on` | Einddatum van een ziekteperiode; de casus gaat daarna de vierwekentermijn in. |
| Samengesteld verzuim | `compound_absence` | Meerdere ziekteperioden binnen vier weken in dezelfde casus. |
| Casemanager | `case_manager_employee_id` | Expliciet toegewezen actieve LiquidHR-medewerker met toepasselijke toegang. |
| WvP-taak | `absence_task` | Operationele of wettelijke casustaak; reminder is alleen het signaleringskanaal. |
| Definitief gesloten | `CLOSED` | De vierwekentermijn na volledig herstel is verstreken zonder nieuwe ziekteperiode. |
| Gearchiveerd | `archived_at` | Operationeel uit actieve overzichten gehaald, los van herstel en bewaartermijn. |

Gebruik in de codebasis consequent `absence`, passend bij de bestaande modulecode `ABSENCE`, kalendercopy, insights-permission `report-absence:read` en dashboardwidget-id `absence`. Gebruik niet afwisselend `sickness` en `absence`.

## 5. Afbakening in verticale slices

### Slice A — kernregistratie en de drie ingangen

Moet als eerste volledig groen zijn:

- kernschema, permissions, RLS, grants, indexes en audit;
- pure keten-/herstelengine en transactionele schrijf-RPC’s;
- options-, summary- en caseprojecties;
- gedeeld ziekmeldingsformulier;
- ziekmelden vanuit medewerkerdashboard, kalender en tab Verzuim;
- volledig/gedeeltelijk herstel;
- dashboardvenster met echte brondata;
- kalenderoverlay;
- minimale administratie-instellingen: drempel frequent verzuim en standaardcasemanager.

### Slice B — casusdossier

Pas starten nadat slice A volledig is geverifieerd:

- contacttypen en contactmomenten;
- privacybegrensde casusnotities;
- niet-medische documentcategorieën en documenten;
- ad-hoctaken gekoppeld aan bestaande reminders;
- volledige tijdlijn en correctieflow.

### Slice C — WvP-engine

Pas starten na expliciete inhoudelijke goedkeuring van de wettelijke milestone-set:

- versiegebonden wettelijke mijlpalen;
- administratiegebonden eigen taken;
- vaste klok/cadans en herberekening bij samengesteld verzuim;
- 42e-weeksmelding, eerstejaarsevaluatie en vervolgacties;
- document-/bewijsvoorwaarden voor taakvoltooiing;
- onbehandelde werkvoorraad en casemanagerresolutie.

### Slice D — rapportage, bewaring en payrolluitbreidingen

Bewust niet vermengen met de eerste release:

- rapport Verzuim in Insights;
- bewaarmatrix, vernietiging/anonimisering en legal hold;
- oproepkracht-/13-wekenberekening en loondoorbetaling;
- externe arbodienst/casemanager;
- UWV-, payroll- of arbodienstintegraties;
- ESS/selfservice en notificaties naar medewerker;
- automatische AI-samenvatting of HeRa-tools voor verzuim.

## 6. Doelarchitectuur schema

Alle publieke tabellen bevatten `tenant_id` en, waar het domein administratiegebonden is, `administration_id`. Elke FK gebruikt samengestelde scopeconstraints. Elke tabel krijgt in dezelfde migratie RLS, policies, expliciete grants, indexes en audittriggers.

### 6.1 `absence_settings`

Administratiegebonden configuratie, exact één rij per administratie:

- `tenant_id uuid not null`
- `administration_id uuid not null`
- `frequent_absence_threshold smallint not null default 3`
- `default_case_manager_employee_id uuid null`
- `created_at`, `updated_at`

Constraints:

- uniek `(tenant_id, administration_id)`;
- drempel tussen `1` en `20`;
- casemanager hoort bij dezelfde tenant;
- de service accepteert alleen een niet-gearchiveerde medewerker met een actieve gebruikerskoppeling en bruikbare casustoegang;
- instellingen slaan geen wettelijke bewaartermijn als vrij getal op.

### 6.2 `absence_cases`

Bron voor één casusketen:

- scope: `tenant_id`, `administration_id`, `employee_id`, `employment_id`;
- `status`: `ACTIVE | RECOVERY_WINDOW | CLOSED`;
- `first_absence_on date not null`;
- `effective_clock_start_on date not null`, alleen door de engine bijgewerkt;
- `case_manager_employee_id uuid null`;
- beperkte indicatoren als nullable boolean:
  - `has_sickness_benefit_safety_net`;
  - `is_work_accident`;
  - `is_third_party_traffic_accident`;
- frequentsnapshot:
  - `prior_case_count_12_months smallint not null`;
  - `threshold_at_report smallint not null`;
  - `is_frequent_absence boolean not null`;
- lifecycle:
  - `recovery_window_ends_on date null`;
  - `closed_at timestamptz null`;
  - `archived_at timestamptz null`;
- actor/tijd:
  - `created_by uuid`;
  - `created_at`, `updated_at`;
- unieke scopesleutels voor alle kind-FK’s.

Constraints:

- `employment_id` hoort bij dezelfde tenant, administratie en medewerker;
- bij een nieuwe casus was het dienstverband op `first_absence_on` geldig en `CONFIRMED`;
- een casus mag na einde dienstverband wel verder worden gevolgd;
- maximaal één `ACTIVE` of `RECOVERY_WINDOW` casus per `employment_id`;
- gesloten en gearchiveerd zijn afzonderlijke toestanden;
- status en lifecycledata zijn onderling consistent.

### 6.3 `absence_spells`

Bron van waarheid voor afzonderlijke ziekteperioden binnen een keten:

- scope en `case_id`;
- `started_on date not null`;
- `reported_at timestamptz not null`;
- `reported_by uuid not null`;
- `expected_recovery_on date null`;
- `recovered_on date null`;
- `recovered_at timestamptz null`;
- `recovered_by uuid null`;
- `created_at`, `updated_at`.

Constraints:

- perioden binnen een case overlappen niet;
- maximaal één open periode per case;
- `recovered_on >= started_on`;
- een nieuwe periode binnen vier weken wordt door de engine aan de bestaande case toegevoegd;
- vanaf vier weken wordt een nieuwe case gemaakt;
- directe inserts/updates door routes zijn verboden: alleen de transactionele RPC’s schrijven.

### 6.4 `absence_capacity_changes`

Effective-dated verzuimpercentage binnen een ziekteperiode:

- scope, `case_id`, `spell_id`;
- `effective_on date not null`;
- `absence_percentage numeric(5,2) not null`;
- optioneel `expected_next_review_on date`;
- actor/timestamps.

Constraints:

- percentage `> 0` en `<= 100`;
- eerste record ligt op `started_on`;
- vervolgdatums zijn uniek en oplopend;
- datum valt binnen de ziekteperiode;
- volledig herstel is geen percentage `0`, maar de aparte herstelactie;
- kalenderuren worden afgeleid van effective-dated werkpatroon/rooster en niet als concurrerende waarheid opgeslagen.

### 6.5 Slice B-tabellen

Voeg pas in slice B toe:

- `absence_contact_types`: administratiegebonden, `code`, `name`, `sort_order`, `is_active`, `is_system`;
- `absence_contacts`: case, type, contactmoment, deelnemers en maximaal noodzakelijke afspraken;
- `absence_case_notes`: case, auteur, beperkte tekst, geen medische inhoud;
- `absence_document_categories`: administratiegebonden, immutable systeemcode, actief/inactief;
- `absence_documents`: case, categorie, private storage-key, metadata, soft-delete en documentaudit.

Gebruik een afzonderlijke private bucket `absence-documents`. Hergebruik niet automatisch `employee_documents`, omdat verzuimdocumenten een strengere casusscope hebben.

Systeemcategorieën bevatten alleen niet-medische re-integratiestukken, bijvoorbeeld:

- `PROBLEM_ANALYSIS`;
- `ACTION_PLAN`;
- `ACTION_PLAN_EVALUATION`;
- `FIRST_YEAR_EVALUATION`;
- `CURRENT_ASSESSMENT`;
- `FINAL_EVALUATION`;
- `OTHER_REINTEGRATION`.

Voeg geen categorie `MEDICAL_ADVICE` toe.

### 6.6 Slice C-tabellen

Gebruik:

- een niet-blootgesteld, versiegebonden systeemregister voor wettelijke milestones;
- `absence_custom_milestone_rules` voor administratiegebonden eigen taken;
- `absence_tasks` als casusgebonden workflowbron;
- optioneel `reminder_id` als koppeling naar de bestaande reminders.

`absence_tasks` bevat minimaal:

- case en milestone-identiteit;
- `due_on`;
- `status: OPEN | COMPLETED | CANCELLED`;
- `assigned_employee_id` of een expliciete onbehandelde werkvoorraadstatus;
- `completed_at`, `completed_by`;
- vereiste evidencecategorie indien van toepassing;
- `reminder_id`;
- idempotente unieke sleutel per case/milestone/volgnummer.

Maak geen nieuwe reminder-ontvangerstabellen. Gebruik de bestaande `reminders`, `reminder_target_rules` en `reminder_recipients`.

## 7. Autorisatie- en casusscope

Voeg minimaal deze canonieke permissions via migratie toe:

- `absence:read`
- `absence:write`
- `absence:recover`
- `absence-settings:read`
- `absence-settings:write`
- later in slice B:
  - `absence-contact:read`
  - `absence-contact:write`
  - `absence-document:read`
  - `absence-document:write`
  - `absence-document:delete`
- later in slice C:
  - `absence-task:read`
  - `absence-task:write`
  - `absence-task:assign`

Regels:

1. Permission en scope worden afzonderlijk gecontroleerd.
2. Nieuwe permissions worden standaard alleen bewust aan bestaande systeem-/tenantrollen gekoppeld; geen rolnaamcheck in componenten.
3. `TENANT_ADMIN` mag administratieoverstijgend alleen handelen als de actieve context dat toestaat.
4. Een directe leidinggevende handelt alleen binnen actuele organisatiescope en met de exacte permission.
5. Een casemanager krijgt alleen casusscope voor toegewezen cases en niet automatisch de volledige medewerkerkaart.
6. Een werknemer krijgt in deze release geen selfservice-verzuimrecht.
7. Dashboard- en kalenderdata worden server-side volledig verwijderd wanneer `absence:read` ontbreekt.
8. Een gebruiker met alleen write zonder read is een ongeldige rolconfiguratie; seed en beheer-UI moeten dit voorkomen of waarschuwen.
9. RLS dwingt tenant, administratie, employment en casus af; UI-verberging is nooit voldoende.

Maak herbruikbare helpers in `internal_security`, bijvoorbeeld:

- `can_manage_absence_employee(employee_id, administration_id, permission_code, as_of_date)`;
- `can_access_absence_case(case_id, permission_code)`;
- `current_user_is_assigned_case_manager(case_id)`.

Schrijf vóór implementatie positieve en negatieve SQL-proeven voor:

- HR met geldige administratie;
- directe manager met geldige targetscope;
- directe manager buiten targetscope;
- toegewezen casemanager op eigen case;
- dezelfde casemanager op een andere case;
- werknemer op zichzelf;
- andere administratie binnen dezelfde tenant;
- andere tenant;
- gearchiveerde medewerker;
- parallelle dienstverbanden.

## 8. Enginecontracten

Maak `apps/hr-suite/lib/absence/engine.ts` volledig puur en test-first.

### 8.1 Dienstverbandselectie

- Zoek alleen `CONFIRMED`, niet-verwijderde employments die op de eerste ziektedag geldig zijn.
- Exact één optie: server kiest automatisch.
- Meer dan één optie: retourneer typed `ABSENCE_EMPLOYMENT_SELECTION_REQUIRED` met alleen veilige selectievelden.
- Geen optie: `ABSENCE_EMPLOYMENT_REQUIRED`.
- Vertrouw nooit een clientgestuurde `administration_id`, `employee_id` of `tenant_id`; leid deze af uit de gekozen employment en sessiecontext.

### 8.2 Vierwekenketen

- Zoek de meest recente gesloten ziekteperiode voor hetzelfde `employment_id`.
- “Binnen vier weken” en “vanaf vier weken” krijgen expliciete grensgevallen in tests.
- Uitvoeringsbesluit: gebruik **minder dan 28 volledige kalenderdagen** als keten en behandel exact 28 dagen als nieuwe periode, overeenkomstig “binnen” versus “vanaf” vier weken.
- Leg voorbeelden met concrete datums vast in de testnamen.
- Binnen de grens: voeg een nieuwe `absence_spell` toe aan dezelfde case.
- Vanaf de grens: sluit de vorige casus indien nodig en maak een nieuwe case.
- Vraag nooit of de oorzaak dezelfde is.

### 8.3 Frequent verzuim

- Instelling is per administratie.
- Tel eerdere **casuswortels**, niet losse ziekteperioden binnen dezelfde keten.
- Tel in de voortschrijdende twaalf maanden vóór de nieuwe eerste ziektedag.
- Markeer de nieuwe casus wanneer `prior_count + 1 >= threshold`.
- Sla count en threshold als snapshot op voor audit/reproduceerbaarheid.
- Genereer idempotent maximaal één taak “Frequent verzuimgesprek plannen”.
- Een ketenhervatting maakt geen tweede frequent-verzuimincident.

### 8.4 Gedeeltelijk herstel

- Registreer een nieuw `absence_capacity_change`.
- Percentage moet lager, gelijk of hoger kunnen worden voor een geauditeerde re-integratiewijziging; noem een verhoging in de UI **Mate van verzuim wijzigen**, niet “herstel”.
- Deeltijdherstel sluit de ziekteperiode niet.
- Bereken kalenderprojectie met het effectieve werkpatroon.
- Bewaar geen afgeleid dagurenveld als tweede bron van waarheid.

### 8.5 Volledig herstel en hervatting

- Herstel sluit de open `absence_spell`.
- Casusstatus wordt `RECOVERY_WINDOW`.
- Zet `recovery_window_ends_on` via de centrale datumfunctie.
- Pauzeer toekomstige WvP-taken en reminders; verwijder ze niet.
- Nieuwe ziekmelding binnen de grens heropent dezelfde case, voegt een spell toe, herberekent klok en deadlines en activeert relevante taken idempotent.
- Zonder hervatting sluit een job of een lazy serveractie de case na de grens als `CLOSED`.
- Sluiting en archivering blijven gescheiden.

### 8.6 WvP-klok en taakcadans

- `absence_spells` is de bron van waarheid.
- Bereken opgebouwde ziekteduur exclusief herstelgaten.
- `effective_clock_start_on` is een afgeleide, door de engine bewaakte projectie.
- Mijlpalen worden verankerd aan opgebouwde ziekteduur.
- Een late taakvoltooiing verschuift een volgende wettelijke taak niet automatisch.
- Een hersteltussenperiode verschuift toekomstige deadlines wel volgens dezelfde pure datumfunctie.
- Voltooiing van een evidenceplichtige taak is atomair: valideer document/evidence, voltooi taak, plan volgende taak en synchroniseer reminder in één transactie.

## 9. API- en servicelaag

Maak:

- `apps/hr-suite/lib/absence/schemas.ts`
- `apps/hr-suite/lib/absence/schemas.test.ts`
- `apps/hr-suite/lib/absence/engine.ts`
- `apps/hr-suite/lib/absence/engine.test.ts`
- `apps/hr-suite/lib/absence/service.ts`
- `apps/hr-suite/lib/absence/service.test.ts`
- `apps/hr-suite/lib/absence/projection.ts`
- `apps/hr-suite/lib/absence/projection.test.ts`
- `apps/hr-suite/lib/absence/errors.ts`

Gebruik gedeelde Zod-schema’s voor client en server. Geen `any`.

Kernroutes:

- `GET /api/absence/options?employeeId=&date=`
- `POST /api/absence/cases`
- `GET /api/absence/cases/[caseId]`
- `POST /api/absence/cases/[caseId]/capacity-changes`
- `POST /api/absence/cases/[caseId]/recovery`
- `GET /api/employees/[employeeId]/absence-summary`
- `GET/PATCH /api/settings/absence`

Latere routes:

- casecontacten;
- casusnotities;
- casustaken;
- document upload/download/delete;
- custom milestones en categorieën.

Routevolgorde:

1. authenticatie en exacte permission;
2. Zod-validatie;
3. server-side target-/employment-/casusresolutie;
4. RLS-gebonden service of transactionele RPC;
5. typed foutcode naar gelokaliseerde UI;
6. `revalidatePath()` voor medewerkerdashboard, tab, kalender en relevante settings.

Alle mutaties krijgen een clientgegenereerde idempotency key. Dubbel klikken, route retry of netwerkretry mag geen tweede case, spell, capacity change, taak of reminder maken.

Gebruik alleen service-role als een bestaande architectuurregel dit voor storage absoluut vereist én pas na expliciete autorisatie. Alle normale dataflows gebruiken de ingelogde serverclient en RLS.

## 10. Database-uitvoering

Maak meerdere kleine, inhoudelijk geordende migraties; stop geen volledige module in één onleesbaar bestand.

Aanbevolen volgorde:

1. permissions, enums, `absence_settings`, `absence_cases`, `absence_spells`, `absence_capacity_changes`;
2. constraints, indexes, guards, RLS, grants en audit;
3. transactionele RPC’s voor ziekmelding, percentagewijziging, herstel en ketenhervatting;
4. slice B-tabellen en private storage;
5. slice C-milestones, tasks en reminderkoppeling;
6. eventuele rapport-RPC.

Verplichte transactionele functies:

- `report_absence`;
- `change_absence_capacity`;
- `report_absence_recovery`;
- `close_expired_absence_recovery_windows`;
- later `complete_absence_task`.

Elke functie:

- staat buiten vrij misbruikbare clientlogica;
- valideert `auth.uid()`, permission en targetscope;
- heeft een vast `search_path`;
- heeft minimale executegrants;
- verifieert alle samengestelde scopes;
- gebruikt een advisory lock per `employment_id` om dubbele open cases te voorkomen;
- schrijft audit en idempotency in dezelfde transactie;
- retourneert typed foutcodes.

Na iedere schemastap:

- alleen ontbrekende migraties remote toepassen;
- lokale en remote migratiehistorie vergelijken;
- `packages/db/types.ts` opnieuw genereren;
- Supabase security- en performance-advisors draaien;
- alle nieuwe bevindingen in scope oplossen;
- geen bestaande fixtures muteren om een roltest “groen” te maken.

## 11. UI: één gedeeld ziekmeldingsformulier

Maak één gedeelde component, bijvoorbeeld:

- `apps/hr-suite/components/absence/absence-report-dialog.tsx`
- `apps/hr-suite/components/absence/absence-report-form.tsx`

De drie ingangen gebruiken exact dezelfde schema’s, options-route en submitroute.

Formuliervelden in slice A:

- medewerker: read-only context;
- eerste ziektedag, standaard de gekozen kalenderdatum of vandaag;
- dienstverband alleen zichtbaar en verplicht bij meerdere geldige opties;
- mate van verzuim, standaard `100%`;
- vermoedelijke hersteldatum, optioneel;
- afwijkend meldmoment: gebruik een echte server timestamp en alleen aanvullende datum/tijd als functioneel nodig;
- toegestane indicatoren `ja / nee / onbekend`:
  - vangnet van toepassing;
  - arbeidsongeval;
  - verkeersongeval met mogelijk aansprakelijke derde;
- optionele casemanager indien actor `absence-task:assign` heeft;
- permanente privacywaarschuwing: geen diagnose, klachten, behandeling of andere medische details.

Niet opnemen:

- ziekteoorzaak;
- diagnose;
- medische notitie;
- behandelaar;
- vrije reden om een vierwekenketen te verbreken;
- handmatig tenant-/administratie-id;
- contracttypekeuze die bestaande employmentdata dupliceert.

UX:

- autofocus op het eerste wijzigbare veld;
- concrete primaire knop **Ziekmelding opslaan**;
- samenvatting vóór bevestiging;
- serverfouten per veld waar mogelijk;
- na succes echte casegegevens tonen;
- volledig toetsenbordbedienbaar;
- geen horizontale overflow op 390 px;
- alle tekst uit `messages/nl/absence.json` en `messages/en/absence.json`.

## 12. UI-ingang 1: medewerkerdashboard

Wijzig:

- `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`
- `apps/hr-suite/components/employees/employee-dashboard.tsx`
- `apps/hr-suite/lib/preferences/employee-dashboard-layout.ts` alleen als de bestaande widget-id of parser moet veranderen; behoud id `absence`.

Projectie:

- laad op `tab=overview` alleen een compacte `getEmployeeAbsenceSummary(employeeId)` als de actor toegang heeft;
- geen casecontacten, documenten of notities in de dashboardpayload;
- fouten niet stil als “geen verzuim” behandelen;
- onderscheid `FORBIDDEN`, `EMPTY`, `ACTIVE`, `RECOVERY_WINDOW` en technisch mislukt.

Vensterinhoud:

- geen lopende casus: **Geen lopend verzuim**;
- lopend: sinds-datum, huidig verzuimpercentage, duur en eerstvolgende actie;
- hersteltermijn: duidelijk **Hersteld gemeld — vierwekentermijn loopt**;
- compacte historie: maximaal drie vorige casussen, alleen als toegestaan;
- CTA **Ziek melden** als er geen actuele keten is en actor mag schrijven;
- CTA **Mate wijzigen / herstel melden** bij een open spell;
- CTA **Verzuim bekijken** naar `?tab=absence`.

Autorisatie:

- zonder `absence:read` verdwijnt het widgetvenster server-side uit de renderprojectie;
- zonder `absence:write` geen ziekmeldknop;
- geen gevoelige case-id of status in RSC-payload voor onbevoegde gebruikers.

## 13. UI-ingang 2: nieuw tabblad Verzuim

Breid de tab-union en actieve-tabprojectie in:

- `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`

uit met `absence`.

Maak:

- `apps/hr-suite/components/absence/employee-absence-tab.tsx`
- `apps/hr-suite/components/absence/absence-case-summary.tsx`
- `apps/hr-suite/components/absence/absence-timeline.tsx`
- `apps/hr-suite/components/absence/absence-recovery-dialog.tsx`
- `apps/hr-suite/components/absence/absence-capacity-dialog.tsx`

Tabstructuur:

1. duidelijke actiebalk;
2. actuele casuskaart;
3. huidig percentage en effective-dated capaciteitswijzigingen;
4. WvP-/actietijdlijn zodra slice C bestaat;
5. eerdere casussen, begrensd en gepagineerd;
6. slice B: contacten, notities en documenten als afzonderlijke casussecties.

Regels:

- laad alleen de absenceprojectie wanneer `tab=absence`;
- geen salaris, volledige documentenlijst of algemene medewerkerdetails opnieuw laden;
- historie standaard maximaal 25 cases met paginering;
- recovery- en capacity-mutaties werken alleen op actuele caseversie; stale state geeft typed conflict;
- heropen/correctie van gesloten historie is geen gewone editknop maar een afzonderlijke geauditeerde beheerflow.

## 14. UI-ingang 3: medewerkerskalender

Wijzig:

- `apps/hr-suite/lib/hr-calendar/calendar-service.ts`
- `apps/hr-suite/lib/hr-calendar/calendar-model.ts`
- `apps/hr-suite/lib/hr-calendar/calendar-model.test.ts`
- `apps/hr-suite/lib/hr-calendar/schemas.ts`
- `apps/hr-suite/app/(dashboard)/hr-calendar/page.tsx`
- `apps/hr-suite/components/hr-calendar/hr-month-calendar.tsx`
- relevante kalender-CSS tokens in `apps/hr-suite/app/globals.css`

Uitbreiding:

- voeg `ABSENCE` toe aan de getypeerde kalender-eventsoorten;
- projecteer per dag en employment het effectieve verzuimpercentage en afgeleide verzuimuren;
- gebruik een CSS-variabele/token, geen hex in componenten;
- toon verlof en verzuim als afzonderlijke markers als beide bestaan;
- pas verlofboekingen niet stil aan wegens verzuim;
- voeg een conflictindicator toe voor overlap die later door HR kan worden beoordeeld;
- de kalenderfilter **Verzuim tonen** gebruikt vanaf deze slice echte data.

Acties in medewerker-dagpaneel:

- geen actuele case: **Ziek melden vanaf deze datum**;
- actuele open spell: **Mate van verzuim wijzigen** en **Volledig herstel melden**;
- hersteltermijn: **Verzuim bekijken**; hervatting loopt via de gewone ziekmeldactie en de engine koppelt automatisch;
- toon acties alleen met server-derived capability.

Gebruik het gedeelde formulier. Maak geen aparte kalenderbusinesslogica.

## 15. HR Admin-instellingen

Voeg een tegel **Verzuim** toe op `/settings` en maak:

- `apps/hr-suite/app/(dashboard)/settings/absence/page.tsx`
- `apps/hr-suite/components/absence/absence-settings-form.tsx`
- `apps/hr-suite/lib/absence/settings-service.ts`
- `apps/hr-suite/lib/absence/settings-service.test.ts`
- `apps/hr-suite/app/api/settings/absence/route.ts`

Slice A:

- drempel frequent verzuim;
- standaardcasemanager;
- uitleg dat telling per administratie en per casusketen gebeurt.

Slice B:

- contacttypen;
- documentcategorieën;
- veilig activeren/inactiveren;
- verwijderen alleen als ongebruikt;
- immutable systeemcodes;
- geen encryptieschakelaar.

Slice C:

- wettelijke milestones read-only met bron en versie;
- eigen bedrijfstaken toevoegen/wijzigen/inactiveren;
- trigger in ziektedagen of weken met expliciete conversie;
- toewijzing aan casemanager, directe manager of onbehandelde HR-werkvoorraad;
- preview van deadlines op een fictieve datum mag uitsluitend een rekensimulatie zijn en geen fictieve productiedata opslaan.

Maak geen verzuim-dienstverbandtypestamtabel. Als protocollen nodig blijken, maak later een mapping van bestaande `employment_type`/`contract_type` naar een beperkt, versiegebonden protocol.

## 16. Reminders en WvP-taken

Het bestaande reminderplatform blijft het enige notificatiekanaal.

Aanpassingen:

- voeg alleen de minimale bronkoppeling toe die nodig is om een `absence_task` idempotent met één reminder te verbinden;
- taakstatus blijft in `absence_tasks`;
- recipientstatus blijft in `reminder_recipients`;
- voltooien van een reminder voltooit niet automatisch een wettelijke taak tenzij de domein-RPC alle bewijs- en autorisatiechecks uitvoert;
- herstel pauzeert/cancelt via de casusengine, niet via losse UI-updates;
- een ontbrekende casemanager resulteert in een zichtbare onbehandelde taak, niet in willekeurige toewijzing.

Wettelijke basisset moet vóór seed inhoudelijk worden goedgekeurd. Neem in elk geval als te verifiëren kandidaten op:

- probleemanalyse rond week 6;
- plan van aanpak rond week 8;
- voortgang iedere zes weken zonder completion drift;
- 42e-weeksmelding;
- eerstejaarsevaluatie rond week 52;
- WIA-/re-integratieverslagmomenten.

Bewaar per systeemmilestone:

- stabiele code;
- versie;
- ingangs-/einddatum;
- triggerdefinitie;
- bron-URL;
- verantwoordelijke rolsoort;
- eventuele evidencecategorie.

## 17. Documenten en gevoelige inzage

Slice B mag pas worden opgeleverd wanneer:

1. private bucket en storagepolicies casusscope afdwingen;
2. upload/download/delete via serverroutes lopen;
3. signed URL kort geldig is;
4. documentmetadata niet in algemene employee- of dashboardprojecties lekt;
5. elke download en dossierdetailinzage een server-side leesaudit schrijft;
6. categorie en taakbewijs atomair worden gevalideerd;
7. geen medische categorie of vrije medische omschrijving wordt aangeboden;
8. soft-delete, herstel en eventuele vernietiging afzonderlijke permissions hebben.

Gebruik een generieke waarschuwing niet als enige privacymaatregel. Beperk schema, velden, categorieën, permissions, projecties en storage gezamenlijk.

## 18. Tests per laag

### Pure unit-tests

Minimaal:

- één/geen/meerdere geldige employments;
- parallelle employments blijven gescheiden;
- 27-dagengrens koppelt en 28-dagengrens start nieuw;
- herstelgaten tellen niet als ziektedagen;
- frequente telling markeert exact bij de ingestelde drempel;
- spell binnen keten telt niet als nieuw incident;
- percentagegrenzen `0`, `0.01`, `100`, `>100`;
- volledig herstel is geen nulpercentage;
- deadlineherberekening bij ketenhervatting;
- late voltooiing veroorzaakt geen wettelijke deadline drift;
- kalenderprojectie over roosterwijzigingen;
- datum- en tijdzonegedrag rond zomertijd, hoewel domeindatums als `date` worden behandeld.

### Service-/routetests

- permission vóór dataquery;
- client kan scopevelden niet vervalsen;
- idempotente retry;
- stale caseversie;
- gesloten case kan niet normaal worden gewijzigd;
- settings zijn administratiegebonden;
- dashboardprojectie bevat alleen samenvatting;
- onbevoegd dashboard levert geen verborgen data;
- kalender capability en acties zijn targetgebonden;
- typed fouten worden correct naar HTTP-status vertaald.

### SQL-isolatietests

Maak:

- `apps/hr-suite/supabase/tests/absence_core.sql`
- `apps/hr-suite/supabase/tests/absence_authorization.sql`
- later `absence_documents.sql`
- later `absence_wvp_tasks.sql`

Bewijs:

- cross-tenant deny;
- cross-administration deny;
- employee/self deny in eerste slice;
- directe manager positief/negatief;
- casemanager alleen eigen case;
- samengestelde FK-scope;
- één actuele casus per employment onder concurrency;
- immutable audit;
- storage objectisolatie;
- interne functies niet uitvoerbaar door `anon`/`PUBLIC`;
- rollback van alle testfixtures.

### Component-/browsertests

Controleer ingelogd:

- HR-admin met één employment;
- HR-admin met parallelle employments;
- directe manager in scope;
- directe manager buiten scope;
- medewerker/self zonder beheerrecht;
- ziekmelden vanuit alle drie ingangen;
- gedeeltelijk herstel en volledig herstel;
- dashboardstatus direct bijgewerkt;
- kalenderindicator en dagdetail;
- desktop en 390 px;
- toetsenbordflow en focus;
- geen consoleerrors/warnings;
- geen verzuimdata in response/RSC-payload voor onbevoegde rol.

## 19. Strikt uitvoerprotocol voor eenvoudige agents

Iedere agent die dit plan uitvoert, volgt deze regels:

1. Lees vóór wijzigingen `AGENTS.md`, `docs/README.md`, `docs/delivery/CURRENT_CONTEXT.md` en de drie leidende verzuimrequirements.
2. Controleer `git status` en behoud alle bestaande gebruikerswijzigingen. Overschrijf of herstel geen onbekende wijzigingen.
3. Werk exact één genummerde taak tegelijk af.
4. Begin een volgende taak pas als de acceptatiecriteria en kleinste relevante tests van de vorige taak groen zijn.
5. Bouw altijd `schema → API/service → UI`.
6. Maak geen placeholderwaarden, demo-verzuimcases of productiefixtures.
7. Gebruik `employment_id`; nooit persoonsbreed aggregeren voor mutaties.
8. Gebruik de centrale engine/RPC; nooit directe inserts vanuit routes of componenten.
9. Voeg geen diagnose-, symptoom-, behandelings- of oorzaakveld toe.
10. Voeg geen nieuwe reminder- of auditinfrastructuur toe.
11. Voeg geen rolnaamcheck in UI/component toe.
12. Gebruik strict TypeScript en nooit `any`.
13. Alle zichtbare tekst staat in NL/EN met gelijke sleutels.
14. Stop en rapporteer wanneer een requirement juridisch, privacytechnisch of payrollinhoudelijk onduidelijk is; vul dit niet zelf “logisch” in.
15. Noem een slice pas klaar na code, remote schema, types, RLS-tests, advisors, runtime en browserbewijs.

## 20. Genummerde uitvoeringstaken

### Taak 0 — requirements en besluiten vastleggen

Bestanden:

- Create `docs/requirements/absence/VERZUIM_EN_HERSTEL.md`
- Create `docs/requirements/absence/WVP_POORTWACHTER_ENGINE.md`
- Create `docs/requirements/absence/VERZUIM_INSTELLINGEN.md`
- Create `docs/decisions/ADR-0005-verzuimcasus-en-ziekteperioden.md`
- Create `docs/decisions/FDR-0002-verzuim-casusscope-en-privacy.md`
- Modify `docs/README.md`
- Modify `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify `docs/delivery/CURRENT_CONTEXT.md`

Acties:

- verwerk alle correcties uit hoofdstuk 2;
- markeer de Downloads-documenten als externe conceptinput, niet als bron van waarheid;
- leg case/spell-model, employmentbinding, vierwekenketen, privacyvelden en herstel/closure/archief vast;
- zet wettelijke milestones op **TE VALIDEREN** totdat de basisset inhoudelijk is afgetekend;
- zet 13-wekenmodel en bewaarmatrix expliciet buiten slice A.

Acceptatie:

- geen verwijzing naar `EmploymentContract`, `parentCaseId`, medische oorzaak of direct archiveren bij herstel;
- README bevat het nieuwe domein en leesrouting;
- open juridische/payrollpunten zijn zichtbaar, niet verstopt.

### Taak 1 — test-first enginecontract

Bestanden:

- Create `apps/hr-suite/lib/absence/engine.ts`
- Create `apps/hr-suite/lib/absence/engine.test.ts`
- Create `apps/hr-suite/lib/absence/schemas.ts`
- Create `apps/hr-suite/lib/absence/schemas.test.ts`
- Create `apps/hr-suite/lib/absence/errors.ts`

Acties:

- schrijf eerst falende tests voor alle grenzen uit hoofdstuk 18;
- implementeer pure datum-, keten-, frequentie-, percentage- en deadlinefuncties;
- gebruik geen database of React in de engine.

Acceptatie:

- gerichte Vitest groen;
- 27/28-dagengrens staat met concrete datums vast;
- geen `any`;
- geen medische inputvelden.

### Taak 2 — schema, RLS en transactionele schrijfweg

Bestanden:

- Create geordende migraties onder `apps/hr-suite/supabase/migrations/`
- Create `apps/hr-suite/supabase/tests/absence_core.sql`
- Create `apps/hr-suite/supabase/tests/absence_authorization.sql`
- Regenerate `packages/db/types.ts`

Acties:

- bouw slice A-tabellen;
- seed permissions;
- voeg guards, indexes, RLS, grants, audit en RPC’s toe;
- maak idempotency en concurrency veilig;
- voer remote alleen ontbrekende migraties uit.

Acceptatie:

- positieve/negatieve SQL-tests groen;
- cross-scope en concurrency bewezen;
- advisors gecontroleerd;
- gegenereerde types actueel;
- geen directe tabelschrijfroute nodig.

### Taak 3 — services, projecties en routes

Bestanden:

- Create `apps/hr-suite/lib/absence/service.ts`
- Create `apps/hr-suite/lib/absence/service.test.ts`
- Create `apps/hr-suite/lib/absence/projection.ts`
- Create `apps/hr-suite/lib/absence/projection.test.ts`
- Create routes onder `apps/hr-suite/app/api/absence/`
- Create `apps/hr-suite/app/api/employees/[employeeId]/absence-summary/route.ts`
- Create `apps/hr-suite/app/api/settings/absence/route.ts`

Acties:

- bouw options, create, capacity, recovery, summary en settings;
- gebruik RLS-serverclient;
- revalidateer exacte paden;
- audit gevoelige dossierlezing.

Acceptatie:

- route-/servicetests groen;
- scopevelden niet clientgestuurd;
- idempotency bewezen;
- dashboardsummary lekt geen dossierdata.

### Taak 4 — gedeeld formulier en medewerkerdetailtab

Bestanden:

- Create `apps/hr-suite/components/absence/*`
- Modify `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`
- Create `apps/hr-suite/messages/nl/absence.json`
- Create `apps/hr-suite/messages/en/absence.json`

Acties:

- bouw gedeeld formulier;
- voeg tab `absence` toe;
- bouw actuele casus, capaciteit, herstel en historie;
- laad alleen tabprojectie.

Acceptatie:

- één en meerdere employments werken;
- focus, fouten en bevestiging werken;
- i18n-check groen;
- gerichte typecheck/lint groen;
- desktop/390 px visueel gecontroleerd.

### Taak 5 — medewerkerdashboardvenster

Bestanden:

- Modify `apps/hr-suite/components/employees/employee-dashboard.tsx`
- Modify `apps/hr-suite/app/(dashboard)/employees/[employeeId]/page.tsx`
- Modify `apps/hr-suite/messages/nl/employees.json`
- Modify `apps/hr-suite/messages/en/employees.json`
- Tests naast de absenceprojectie/dashboardlayout

Acties:

- vervang toekomstige lege staat door echte bron;
- voeg status, compact verleden en juiste CTA toe;
- filter server-side op toegang;
- behoud persoonlijke widgetvolgorde.

Acceptatie:

- geen fake data;
- geen widget/payload zonder toegang;
- ziekmelden opent hetzelfde formulier;
- dashboard ververst na mutatie;
- bestaande widgetlayout blijft geldig.

### Taak 6 — kalenderingang en overlay

Bestanden: hoofdstuk 14.

Acties:

- voeg `ABSENCE`-projectie en filter toe;
- toon markering en dagdetail;
- voeg ziekmeld-/herstelacties met servercapability toe;
- gebruik gedeeld formulier;
- behoud verlof- en werkurenweergave.

Acceptatie:

- verlof, werkuren, overuren en verzuim kunnen samen renderen;
- geen dubbele events;
- geen horizontale overflow;
- klik op medewerkerdag gebruikt gekozen datum;
- onbevoegde actor ziet geen actie of data;
- kalendertests en browsercontrole groen.

### Taak 7 — minimale instellingen

Bestanden: hoofdstuk 15.

Acties:

- tegel en pagina;
- drempel en standaardcasemanager;
- administratiecontext en guardrails;
- uitleg van telling.

Acceptatie:

- cross-administratie deny;
- ongeldige casemanager geblokkeerd;
- wijziging geaudit;
- instellingen hebben NL/EN-pariteit.

### Taak 8 — slice B casusdossier

Start alleen na nieuwe expliciete uitvoeropdracht of bevestiging dat slice A is afgerond.

Acties:

- schema/RLS eerst;
- contacten, beperkte notities, documenten en ad-hoctaken;
- private storage en leesaudit;
- settingscatalogi;
- casustijdlijn.

Acceptatie:

- geen medische categorie/velden;
- documentbytes en metadata casusgebonden;
- bestaande reminders hergebruikt;
- storage- en autorisatietests groen.

### Taak 9 — slice C WvP

Start alleen na goedgekeurde milestone-set.

Acties:

- versioneer wettelijke templates;
- bouw custom milestones;
- bouw task engine en reminderkoppeling;
- veranker zeswekencadans;
- voeg evidencevalidatie toe;
- bouw werkvoorraad en casemanagerresolutie.

Acceptatie:

- geen deadline drift;
- herstel/hervatting herberekent idempotent;
- wettelijke templates niet tenantwijzigbaar;
- ontbrekende assignee blijft zichtbaar;
- volledige taak- en RLS-tests groen.

### Taak 10 — rapportage, retentie en payroll als afzonderlijke besluiten

Niet uitvoeren als “restpunt” van slice A-C.

Voor ieder onderdeel eerst een eigen requirement:

- Verzuimrapportage met aggregatiedrempels en `report-absence:read`;
- bewaarmatrix en vernietigings-/anonimiseringsproces;
- oproepkracht/13-wekenbron, broncompleetheid, handmatige fallback en salarisimpact.

Geen van deze drie mag op basis van aannames uit de Downloads-documenten worden gebouwd.

### Taak 11 — releasegate en oplevering

Werk bij:

- `docs/README.md`
- `docs/delivery/IMPLEMENTATION_STATUS.md`
- `docs/delivery/CURRENT_CONTEXT.md`
- applicatieversie volgens projectconventie.

Voer uit:

- gerichte en volledige Vitest-suite;
- ESLint;
- strict TypeScript;
- `check:i18n`;
- productiebuild;
- migration history;
- SQL-isolatietests;
- Supabase advisors;
- DB-typegeneratie;
- lokale HTTP- en ingelogde browsercontrole op poort 3000;
- desktop en 390 px;
- publieke preview;
- na expliciete releaseopdracht: main, GitHub-commit en exacte Vercel Production-commit/status.

Rapporteer afzonderlijk:

- code gereed;
- remote database gereed;
- types/advisors gereed;
- lokale runtime gereed;
- roltests gereed;
- preview gereed;
- main/GitHub gereed;
- Production gereed.

## 21. Definitie van klaar voor slice A

Slice A is pas klaar als:

1. de drie requirements en twee besluiten leidend zijn;
2. schema, RLS, grants, audit, indexes en RPC’s remote aantoonbaar aanwezig zijn;
3. types opnieuw zijn gegenereerd;
4. ziekmelden vanuit alle drie ingangen dezelfde transactionele flow gebruikt;
5. één/multiple employment correct werkt;
6. dashboardvenster echte, geautoriseerde data toont;
7. kalender echte verzuimdata en acties toont;
8. gedeeltelijk en volledig herstel werken;
9. vierwekenketen en frequent-verzuimdrempel bewezen zijn;
10. self, andere administratie en andere tenant aantoonbaar worden geweigerd;
11. NL/EN, tests, lint, typecheck, build, advisors en browserchecks groen zijn;
12. geen medische details of fictieve productiedata zijn toegevoegd;
13. documentatie en CURRENT_CONTEXT exact vermelden wat nog buiten scope is.

## 22. Expliciete stopvoorwaarden

Stop de uitvoering en vraag om een besluit wanneer:

- de gewenste ketenregel afwijkt van de gecontroleerde vierwekenregel;
- de gebruiker toch medische oorzaken/diagnoses wil opslaan;
- externe casemanagers zonder bestaand LiquidHR-user-/accessmodel nodig zijn;
- meerdere employments in één mutatie tegelijk ziek moeten worden gemeld;
- een casus na einde dienstverband moet worden overgedragen aan UWV/andere werkgever;
- de wettelijke milestone-set inhoudelijk niet is goedgekeurd;
- bewaartermijnen of vernietiging zonder gevalideerde bewaarmatrix moeten worden gebouwd;
- het 13-wekenmodel moet steunen op een nog niet betrouwbaar verklaarde urenbron;
- bestaande gebruikerswijzigingen overlappen en niet veilig kunnen worden behouden.

## 23. Skills en werkwijze bij uitvoering

- Gebruik de Supabase-skill voor iedere schema-, RLS-, grant-, advisor- en typegeneratiestap.
- Gebruik TDD voor de engine, RPC-contracten en kritieke autorisatie.
- Gebruik de browser-/Playwrightskill voor de drie ingangen, desktop/390 px en payload-/consolecontrole.
- Gebruik geen subagents: repository-instructies verbieden delegatie tenzij de gebruiker die expliciet vraagt.
- Voer het plan inline in de actieve chat uit en geef na iedere voltooide taak een compacte, bewijsbare status.
