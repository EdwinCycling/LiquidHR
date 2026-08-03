# LiquidHR Workforce & Talent Management
## Acceptance Test Pack v1.0

**Auteur:** Edwin Dingjan  
**E-mail:** edwin@editsolutions.nl  
**Datum:** 31 juli 2026  
**Bron:** Product Blueprint v2.0

---

## 1. Doel en gebruik

Dit testpack definieert de minimale productacceptatie voor fase 1 van LiquidHR Talent Foundation. Het is technologieneutraal: implementerende teams vertalen de tests naar unit-, database-, integration-, component- en end-to-endtests.

### Prioriteiten

- **Critical:** release blocker; tenantisolatie, autorisatie, historische integriteit of kernflow.
- **High:** kernfunctionaliteit of belangrijke datakwaliteit.
- **Medium:** bruikbaarheid, beheerkwaliteit of niet-kritieke edge case.

### Standaard testpersona’s

- `HR_ADMIN_A` — HR Admin in tenant A.
- `MANAGER_A` — manager in tenant A met teamleden A1 en A2.
- `EMPLOYEE_A1` — medewerker in tenant A, team van MANAGER_A.
- `EMPLOYEE_A3` — medewerker in tenant A, buiten scope van MANAGER_A.
- `HR_ADMIN_B` — HR Admin in tenant B.
- `EMPLOYEE_B1` — medewerker in tenant B.

### Standaard testdata

Tenant A:

- Talent Level Model: 4 levels — Basis, Zelfstandig, Gevorderd, Expert.
- Seniorities: Junior, Medior, Senior.
- Job Group: HR Advies.
- Functions: HR Adviseur — Junior, HR Adviseur — Medior, HR Adviseur — Senior, Directeur zonder seniority.
- Competency: Stakeholdermanagement.
- Skill: Data-analyse.
- Knowledge: Arbeidsrecht.
- Language: Engels.
- Certificate: Payroll Professional.

Tenant B bevat gelijknamige maar afzonderlijke objecten om tenantisolatie te testen.

---

# 2. Navigatie en contextscheiding

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-NAV-001 | Critical | HR_ADMIN_A opent Instellingen → Talent | Configuratiepagina opent met beheerfuncties. |
| AT-NAV-002 | Critical | MANAGER_A probeert Instellingen → Talent direct via URL te openen | Toegang geweigerd; geen configuratiedata lekt. |
| AT-NAV-003 | Critical | EMPLOYEE_A1 probeert Instellingen → Talent direct via URL te openen | Toegang geweigerd. |
| AT-NAV-004 | High | MANAGER_A opent Workforce → Talent | Read-only operationele ingang opent. |
| AT-NAV-005 | High | EMPLOYEE_A1 opent Mijn Talent | Alleen persoonlijke read-only weergave opent. |
| AT-NAV-006 | High | HR_ADMIN_A opent Workforce | Beheeracties blijven onder Settings; Workforce toont operationele toegang. |
| AT-NAV-007 | Medium | Een toekomstige moduletegel staat disabled | Tegel start geen lege of halfwerkende route. |
| AT-NAV-008 | High | UI-mockup toont out-of-scope actie zoals Import | Actie is niet actief of niet aanwezig in fase 1. |

---

# 3. Rollen en autorisatie

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-AUTH-001 | Critical | HR_ADMIN_A maakt een capability aan | Actie slaagt en audit wordt geschreven. |
| AT-AUTH-002 | Critical | MANAGER_A roept dezelfde create-API direct aan | Actie wordt server-side geweigerd. |
| AT-AUTH-003 | Critical | EMPLOYEE_A1 roept update-profile API direct aan | Actie wordt server-side geweigerd. |
| AT-AUTH-004 | Critical | HR_ADMIN_B vraagt capability-ID uit tenant A op | Geen data; not found/forbidden zonder informatielek. |
| AT-AUTH-005 | Critical | MANAGER_A vraagt My Talent/read model van EMPLOYEE_A3 buiten scope | Toegang geweigerd. |
| AT-AUTH-006 | Critical | MANAGER_A vraagt profile van EMPLOYEE_A1 binnen scope | Actief profiel is read-only zichtbaar. |
| AT-AUTH-007 | Critical | EMPLOYEE_A1 vraagt data van EMPLOYEE_A3 | Toegang geweigerd. |
| AT-AUTH-008 | High | Niet-geautoriseerde gebruiker bekijkt UI | Verboden knoppen worden niet gerenderd. |
| AT-AUTH-009 | Critical | Een role-claim wordt client-side gemanipuleerd | Server blijft actie weigeren. |
| AT-AUTH-010 | Critical | Directe RPC wordt zonder juiste rechten aangeroepen | RPC valideert actor/tenant en weigert. |

---

# 4. Talent Level Model

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-LVL-001 | Critical | Nieuwe tenant opent Level Model | Precies één configureerbaar model bestaat of wordt veilig geïnitialiseerd. |
| AT-LVL-002 | High | HR_ADMIN_A configureert vier levels | Vier geordende levels worden opgeslagen. |
| AT-LVL-003 | High | HR_ADMIN_A configureert tien levels | UI en service ondersteunen tien; geen hardcoded vijf. |
| AT-LVL-004 | High | Twee levels krijgen dezelfde naam/code | Validatiefout met veldmelding. |
| AT-LVL-005 | High | Levels worden herschikt vóór gebruik | Nieuwe volgorde wordt overal consistent weergegeven. |
| AT-LVL-006 | Critical | Eerste profile requirement gebruikt een Talent Level | Modelstatus wordt atomair In Use. |
| AT-LVL-007 | Critical | HR_ADMIN_A probeert na In Use een level toe te voegen via UI | Controls zijn locked en wijziging kan niet worden opgeslagen. |
| AT-LVL-008 | Critical | HR_ADMIN_A probeert dezelfde wijziging direct via API/RPC | Server/database weigert. |
| AT-LVL-009 | Critical | Tenant B wijzigt eigen model | Tenant A-model blijft ongewijzigd. |
| AT-LVL-010 | High | Language requirement wordt aangemaakt | Geen Talent Level; CEFR wordt gebruikt. |
| AT-LVL-011 | High | Certificate requirement wordt aangemaakt | Geen Talent Level-veld wordt geaccepteerd. |
| AT-LVL-012 | Medium | Level Model UI toont organisatiedistributie zonder persoonlijke data | Grafiek wordt niet getoond. |

---

# 5. Senioriteit

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-SEN-001 | High | Nieuwe tenant initialiseert Talent | Junior, Medior en Senior bestaan als bewerkbare tenantdata. |
| AT-SEN-002 | High | Initialisatie draait opnieuw | Geen dubbele seniorities. |
| AT-SEN-003 | High | HR_ADMIN_A voegt Principal toe | Senioriteit wordt volgens sort order weergegeven. |
| AT-SEN-004 | High | HR_ADMIN_A hernoemt Medior naar Professional | Gekoppelde presentaties tonen nieuwe naam; function base name blijft gelijk. |
| AT-SEN-005 | Critical | Function wordt zonder seniority aangemaakt | Actie slaagt. |
| AT-SEN-006 | High | Inactieve seniority wordt geselecteerd voor nieuwe function | Selectie niet beschikbaar/server weigert. |
| AT-SEN-007 | High | Senioriteit met actieve functions wordt geïnactiveerd | Impact wordt getoond; actie volgt gedefinieerde referentieregel. |
| AT-SEN-008 | High | Mockup “Standaard”-radio wordt verwacht | Er is geen automatisch default seniority-productgedrag. |
| AT-SEN-009 | Critical | MANAGER_A wijzigt seniority via API | Geweigerd. |
| AT-SEN-010 | Critical | HR_ADMIN_B gebruikt seniority-ID van tenant A | Geweigerd. |
| AT-SEN-011 | Medium | Seniority order wijzigt | Lijsten en selectors gebruiken nieuwe volgorde. |
| AT-SEN-012 | High | Seniority van function wijzigt | Capability requirements veranderen niet automatisch. |

---

# 6. Capability Library

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-CAP-001 | High | HR_ADMIN_A maakt Competency aan | Active competency in tenant A. |
| AT-CAP-002 | High | HR_ADMIN_A maakt Skill, Knowledge, Language en Certificate aan | Elk type gebruikt juiste UI en validatie. |
| AT-CAP-003 | Critical | Zelfde active naam binnen hetzelfde type wordt opnieuw aangemaakt | Duplicate geblokkeerd na normalisatie. |
| AT-CAP-004 | High | Zelfde naam bestaat als Competency en Skill | Toegestaan omdat type verschilt. |
| AT-CAP-005 | Critical | Zelfde naam bestaat in tenant B | Toegestaan; data blijft geïsoleerd. |
| AT-CAP-006 | High | Competency krijgt level indicators | Alleen levels uit tenantmodel beschikbaar. |
| AT-CAP-007 | High | Language krijgt CEFR B2 | Opslag slaagt zonder Talent Level-ID. |
| AT-CAP-008 | High | Language krijgt Talent Level via gemanipuleerde API | Geweigerd. |
| AT-CAP-009 | High | Certificate krijgt permanent-valid metadata | Opslag slaagt zonder Talent Level. |
| AT-CAP-010 | High | Capability wordt aan bestaande Cloud Tag gekoppeld | Bestaande tagengine wordt gebruikt; geen duplicate tagsysteem. |
| AT-CAP-011 | High | Capability wordt geïnactiveerd zonder references | Verdwijnt uit nieuwe selectors. |
| AT-CAP-012 | Critical | Capability met active profile references wordt geïnactiveerd | Impact wordt getoond; bestaande references blijven zichtbaar. |
| AT-CAP-013 | High | Inactieve capability wordt nieuw aan profile gekoppeld via UI | Niet selecteerbaar. |
| AT-CAP-014 | Critical | Inactieve capability wordt direct via API gekoppeld | Server weigert. |
| AT-CAP-015 | High | Capability list wordt gefilterd op category/tag/status | Resultaat en telling gebruiken dezelfde filters. |
| AT-CAP-016 | Medium | Search heeft geen resultaten | Neutrale empty state, filters wissen mogelijk. |
| AT-CAP-017 | High | Usage count wordt geopend | Alleen echte profile references binnen tenant. |
| AT-CAP-018 | Critical | MANAGER_A opent capability configuration endpoint | Geweigerd. |
| AT-CAP-019 | High | Category met references wordt verwijderd | Hard delete geblokkeerd; inactivation beschikbaar. |
| AT-CAP-020 | Medium | Competency detail toont analytics zonder bron | Analytics wordt niet getoond. |

---

# 7. Functiehuis

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-JOB-001 | Critical | Tenant heeft geen Job Families | Job Groups en Functions kunnen volledig worden beheerd. |
| AT-JOB-002 | High | HR_ADMIN_A maakt optionele Family aan | Group kan eraan worden gekoppeld. |
| AT-JOB-003 | High | Group wordt zonder Family aangemaakt | Actie slaagt. |
| AT-JOB-004 | High | Twee actieve Groups met dezelfde naam zonder Family | Duplicate geblokkeerd volgens contextregel. |
| AT-JOB-005 | High | Group met actieve Functions wordt verwijderd | Delete geblokkeerd. |
| AT-JOB-006 | Critical | Function HR Adviseur + Junior wordt aangemaakt | Actie slaagt. |
| AT-JOB-007 | Critical | Function HR Adviseur + Medior wordt in dezelfde Group aangemaakt | Actie slaagt. |
| AT-JOB-008 | Critical | Exact dezelfde combinatie Group + name + Junior opnieuw | Duplicate geblokkeerd. |
| AT-JOB-009 | Critical | Directeur zonder seniority wordt aangemaakt | Actie slaagt. |
| AT-JOB-010 | High | Tweede Directeur zonder seniority in dezelfde Group | Duplicate geblokkeerd. |
| AT-JOB-011 | High | Zelfde basisnaam in andere Group | Toegestaan. |
| AT-JOB-012 | High | Function selector toont presentatienaam | “HR Adviseur — Junior”; opgeslagen basisnaam blijft HR Adviseur. |
| AT-JOB-013 | High | Function wordt geïnactiveerd met active employments | Impactmelding met werkelijk aantal employments. |
| AT-JOB-014 | Critical | Inactieve Group wordt gebruikt voor nieuwe Function via API | Geweigerd. |
| AT-JOB-015 | Critical | Inactieve Senioriteit wordt gebruikt voor nieuwe Function via API | Geweigerd. |
| AT-JOB-016 | High | Explorer zonder Families opent | Root begint bij Groups; geen lege familylaag. |
| AT-JOB-017 | High | Explorer met Families opent | Families groeperen Groups correct. |
| AT-JOB-018 | High | Explorer toont seniority | Als property/badge van Function, niet verplichte node. |
| AT-JOB-019 | Medium | Search vindt twee gelijknamige functions | Group en senioritycontext onderscheiden resultaten. |
| AT-JOB-020 | Critical | Bestaande employee-function mapping na migratie | Zelfde functionele relatie en geen duplicate assignment. |

---

# 8. Functieprofielen en datumversies

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-PRO-001 | Critical | Nieuwe Function wordt aangemaakt | Precies één logisch Job Profile bestaat. |
| AT-PRO-002 | High | Eerste Profile Version wordt aangemaakt | Status Draft; geen operationele geldigheid. |
| AT-PRO-003 | High | HR_ADMIN_A bewerkt Draft | Opslag slaagt en audit wordt geschreven. |
| AT-PRO-004 | Critical | MANAGER_A bewerkt Draft via API | Geweigerd. |
| AT-PRO-005 | High | Capability wordt toegevoegd aan Draft | Relation met importance en correct typelevel. |
| AT-PRO-006 | High | Dezelfde capability wordt tweemaal toegevoegd | Duplicate geblokkeerd. |
| AT-PRO-007 | Critical | Competency requirement zonder Talent Level wordt geactiveerd | Activatievalidatie faalt. |
| AT-PRO-008 | High | Language requirement met CEFR wordt toegevoegd | Geldige relation zonder Talent Level. |
| AT-PRO-009 | High | Certificate requirement krijgt Talent Level via API | Geweigerd. |
| AT-PRO-010 | Critical | Eerste Draft wordt per 01-01-2026 geactiveerd | Active vanaf datum; audit aanwezig. |
| AT-PRO-011 | Critical | Nieuwe version per 01-06-2026 wordt geactiveerd | Vorige period eindigt vóór 01-06; nieuwe is current vanaf 01-06. |
| AT-PRO-012 | Critical | Overlappende Active-period wordt aangevraagd | Database/service weigert atomair. |
| AT-PRO-013 | Critical | Future version per 01-01-2027 wordt geactiveerd | Huidige blijft current tot ingangsdatum; future zichtbaar als gepland. |
| AT-PRO-014 | Critical | Profile query op 15-03-2026 | Eerste geldige version wordt teruggegeven. |
| AT-PRO-015 | Critical | Profile query op 15-07-2026 | Tweede geldige version wordt teruggegeven. |
| AT-PRO-016 | High | Historical version wordt regulier bewerkt | Read-only; wijziging geblokkeerd. |
| AT-PRO-017 | High | New Version kopieert huidige inhoud | Nieuwe Draft bevat inhoud/requirements maar geen active dates/auditmetadata. |
| AT-PRO-018 | Critical | Twee admins activeren gelijktijdig conflicterende versions | Eén slaagt; andere krijgt concurrency/overlap conflict. |
| AT-PRO-019 | High | Draft met ontbrekende activatieverplichting | Duidelijke validatielijst; niets gedeeltelijk geactiveerd. |
| AT-PRO-020 | High | Active version wordt op pagina getoond | Geldigheidsperiode is primaire versionweergave. |
| AT-PRO-021 | Medium | UI toont intern versienummer | Alleen secundair; datumwerking blijft hoofdconcept. |
| AT-PRO-022 | High | Senioriteit van Function wijzigt | Bestaande Profile Requirements blijven inhoudelijk gelijk. |
| AT-PRO-023 | Critical | Activering faalt tijdens auditwrite | Gehele transactie rolt terug of gebruikt gegarandeerde consistente strategie. |
| AT-PRO-024 | Critical | Tenant B probeert profileversion tenant A te kopiëren | Geweigerd. |
| AT-PRO-025 | Medium | Profile “completeness” wordt getoond | Alleen deterministische checklist; geen willekeurige score. |

---

# 9. Talent Configuration landing en dashboard

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-DASH-001 | High | Capability card toont 12 Skills | Doorkliklijst met dezelfde filters toont 12. |
| AT-DASH-002 | High | Function count is nul | Kaart toont 0 en bruikbare empty action; geen fake value. |
| AT-DASH-003 | High | Level Model is In Use | Status correct weergegeven. |
| AT-DASH-004 | High | Vier Draft profiles bestaan | Aandachtspunt toont 4 en linkt naar gefilterde lijst. |
| AT-DASH-005 | High | Function heeft geen geldige Active profileversion | Aandachtspunt verschijnt. |
| AT-DASH-006 | High | Aandachtspunt is opgelost | Telling verdwijnt na consistente refresh/invalidation. |
| AT-DASH-007 | High | Recent changes wordt geladen | Alleen tenantgebonden audit events; actor/tijd/object correct. |
| AT-DASH-008 | Medium | Eén dashboardquery faalt | Gedegradeerde kaartfout; rest pagina bruikbaar indien architectuur dit ondersteunt. |
| AT-DASH-009 | Critical | Tenant A en B hebben verschillende aantallen | Iedere admin ziet uitsluitend eigen tellingen. |
| AT-DASH-010 | Medium | Mockup bevat health score | Score wordt niet getoond zonder transparante definitie. |
| AT-DASH-011 | High | Families worden niet gebruikt | Family card is verborgen of duidelijk optioneel, geen verplichte configuratiefout. |
| AT-DASH-012 | High | Import/template card in fase 1 | Niet actief en suggereert geen werkende functie. |

---

# 10. Workforce en Manager

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-WF-001 | High | MANAGER_A opent Workforce Talent | Active profile search is beschikbaar. |
| AT-WF-002 | Critical | MANAGER_A ziet Function van teamlid A1 | Profile read slaagt. |
| AT-WF-003 | Critical | MANAGER_A zoekt Function van medewerker A3 buiten scope via employeecontext | Geen persoonscontextdata. |
| AT-WF-004 | High | Manager opent profile detail | Read-only; geen Save/Activate/New Version. |
| AT-WF-005 | Critical | Manager gebruikt mutation endpoint | Geweigerd. |
| AT-WF-006 | High | Draft profile bestaat | Niet standaard operationeel zichtbaar. |
| AT-WF-007 | High | Historical version bestaat | Niet als current gepresenteerd. |
| AT-WF-008 | Medium | Future modules zichtbaar | Disabled met correcte roadmapcopy, geen click naar lege functie. |
| AT-WF-009 | High | HR Admin opent hetzelfde Active profile via Workforce | Dezelfde source of truth als Settings read mode. |
| AT-WF-010 | Medium | Search heeft gelijknamige functions | Group en seniority zijn zichtbaar. |

---

# 11. Mijn Talent

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-MY-001 | Critical | EMPLOYEE_A1 opent Mijn Talent met geldige mapping | Eigen Function en current Profile zichtbaar. |
| AT-MY-002 | Critical | EMPLOYEE_A1 probeert employee-ID A3 in URL/API | Geweigerd of genegeerd; alleen eigen identity. |
| AT-MY-003 | Critical | EMPLOYEE_B1 probeert tenant A-object | Geweigerd. |
| AT-MY-004 | High | Function heeft seniority | Seniority wordt weergegeven. |
| AT-MY-005 | High | Function heeft geen seniority | Scherm werkt zonder lege/foutieve senioritysectie. |
| AT-MY-006 | High | Profile bevat requirements | Als functievereisten getoond, niet als persoonlijke score. |
| AT-MY-007 | High | Geen Active profile op huidige datum | Neutrale melding; geen 500 en geen oude/future version als current. |
| AT-MY-008 | High | User is niet aan employee gekoppeld | Veilige empty/support state. |
| AT-MY-009 | High | Geen actuele employment/function relation | Veilige empty state. |
| AT-MY-010 | Critical | Mijn Talent bevat matchpercentage in fase 1 | Test faalt; match mag niet aanwezig zijn. |
| AT-MY-011 | High | Mijn Talent bevat persoonlijke progressbars zonder bron | Niet aanwezig. |
| AT-MY-012 | Medium | Mobiele viewport | Inhoud blijft leesbaar en bruikbaar. |
| AT-MY-013 | High | Medewerker probeert editcontrol te vinden | Geen editcontrols of editendpointrechten. |

---

# 12. Audit en historie

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-AUD-001 | Critical | Capability wordt aangemaakt | Create audit event met actor/tenant/object. |
| AT-AUD-002 | Critical | Profile version wordt geactiveerd | Activation event met correlation ID en date impact. |
| AT-AUD-003 | High | Seniority wordt hernoemd | Before/after zichtbaar voor HR Admin. |
| AT-AUD-004 | Critical | Manager probeert privileged mutation | Denied action wordt volgens securitydesign vastgelegd. |
| AT-AUD-005 | Critical | Gebruiker probeert auditrecord te wijzigen | Geweigerd. |
| AT-AUD-006 | Critical | HR_ADMIN_B vraagt audit tenant A | Geen data. |
| AT-AUD-007 | High | Recent Changes dashboard | Zelfde events als auditbron, correct gefilterd. |
| AT-AUD-008 | High | Historisch profile wordt op datum opgevraagd | Juiste content en versionmetadata. |
| AT-AUD-009 | Medium | Auditlog wordt operationeel gelogd | Geen volledige gevoelige profieltekst in standaardlog. |
| AT-AUD-010 | High | Samengestelde activation | Alle gerelateerde changes delen correlation ID. |

---

# 13. Concurrency en foutafhandeling

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-ERR-001 | High | Twee admins wijzigen dezelfde Draft | Tweede save krijgt conflict, geen stille overschrijving. |
| AT-ERR-002 | High | Servervalidatie faalt | Veldspecifieke Nederlandse foutmelding; geen raw SQL. |
| AT-ERR-003 | Critical | Mutatie bestaat uit meerdere stappen en stap 2 faalt | Geen gedeeltelijke data. |
| AT-ERR-004 | Medium | Netwerkfout tijdens lijstladen | Retry/feedback volgens bestaand patroon. |
| AT-ERR-005 | Medium | Object is intussen geïnactiveerd | UI toont actuele status en blokkeert ongeldige actie. |
| AT-ERR-006 | High | Duplicate wordt door race condition aangemaakt | Databaseconstraint voorkomt duplicaat; bruikbare fout. |
| AT-ERR-007 | High | Concurrency conflict wordt opgelost door reload | Gebruiker ziet nieuwste data en kan bewust opnieuw wijzigen. |

---

# 14. Search, filtering en dataconsistentie

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-SRCH-001 | High | Search op function base name | Alle geautoriseerde seniorityvarianten met context. |
| AT-SRCH-002 | High | Filter Active capabilities | Alleen Active; telling gelijk. |
| AT-SRCH-003 | High | Filter profile status Draft | Dashboardlink en lijst leveren hetzelfde resultaat. |
| AT-SRCH-004 | Critical | Search query gebruikt object-ID tenant B | Geen cross-tenant result. |
| AT-SRCH-005 | Medium | Filters in URL worden gedeeld binnen tenant | Zelfde toegestane result; geen gevoelige data in URL. |
| AT-SRCH-006 | Medium | Paginering na mutatie | Stabiele sortering en geldige pagina. |
| AT-SRCH-007 | High | Inactieve capability search in Add-dialog | Niet beschikbaar voor nieuwe link. |
| AT-SRCH-008 | High | Explorer search in tenant zonder Families | Group/function ancestor context correct. |

---

# 15. Toegankelijkheid en UX

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-UX-001 | High | Kernflow met toetsenbord | Alle interactieve elementen bereikbaar en bedienbaar. |
| AT-UX-002 | High | Dialog opent/sluit | Focus wordt correct geplaatst en teruggezet. |
| AT-UX-003 | High | Validatiefout | Fout is programmatisch aan veld gekoppeld. |
| AT-UX-004 | High | Status Active/Inactive | Niet uitsluitend door kleur aangegeven. |
| AT-UX-005 | Medium | Icon-only action | Toegankelijke naam aanwezig. |
| AT-UX-006 | High | Niveaumodel locked | Disabled state plus tekstuele uitleg. |
| AT-UX-007 | Medium | Loading list | Skeleton/progress zonder layoutchaos. |
| AT-UX-008 | Medium | Empty tenant | Duidelijke startactie voor HR Admin. |
| AT-UX-009 | Medium | Manager read-only | Copy spreekt over bekijken/raadplegen, niet beheren. |
| AT-UX-010 | High | Responsive Mijn Talent | Geen horizontaal informatieverlies; headings en cards logisch. |
| AT-UX-011 | Medium | Lokalisatie Nederlands | Datums/getallen volgen locale; technische codes blijven correct. |
| AT-UX-012 | High | Niveaukeuze met 10 levels | Bedienbaar en leesbaar zonder ontwerpbreuk. |

---

# 16. Performance en observability

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-PERF-001 | High | Configuration Dashboard laadt representatieve tenant | Geen N+1; binnen bestaande LiquidHR-budgetten. |
| AT-PERF-002 | High | Explorer met grote dataset | Incrementeel/efficiënt; UI blijft bruikbaar. |
| AT-PERF-003 | High | Capabilitylist met filters | Indexed query en server-side pagination. |
| AT-PERF-004 | High | Profile detail | Geen onnodige volledige audit/tree-load. |
| AT-PERF-005 | High | My Talent | Eén veilige resolutionflow zonder cross-tenant scans. |
| AT-PERF-006 | Medium | Eén dashboardkaart faalt | Fout is traceerbaar met correlation ID. |
| AT-PERF-007 | High | Privileged command faalt | Gestructureerde domeinfout, audit/log zonder secret. |

---

# 17. Migratie en release

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-MIG-001 | Critical | Migraties op lege database | Volledige schemaopbouw slaagt. |
| AT-MIG-002 | Critical | Migraties op bestaande productieachtige data | Slaagt zonder verlies van employee/function relations. |
| AT-MIG-003 | Critical | Migration wordt opnieuw gecontroleerd in CI | Deterministisch resultaat. |
| AT-MIG-004 | Critical | Backfill profiles voor bestaande Functions | Eén logisch Draft profile per function; geen verzonnen active content. |
| AT-MIG-005 | High | Seniorityseed op bestaande tenant | Geen duplicates en geen bestaande namen overschreven. |
| AT-MIG-006 | Critical | Rollout wordt teruggedraaid vóór datawrites | Gedefinieerde veilige rollback. |
| AT-MIG-007 | Critical | Rollout na productie-datawrites vereist herstel | Gedocumenteerde forward-fix/herstelstrategie. |
| AT-MIG-008 | High | Feature flag uit | Bestaande LiquidHR blijft normaal functioneren. |
| AT-MIG-009 | High | Feature flag per tenant aan | Alleen geactiveerde tenant ziet module. |
| AT-MIG-010 | Critical | Release candidate | Alle Critical tests slagen en geen high/critical securityfinding open. |

---

# 18. Out-of-scope guard tests

Deze tests voorkomen dat mockups of AI onbedoeld fase 2-functionaliteit toevoegen.

| ID | Prioriteit | Scenario | Verwacht resultaat |
|---|---|---|---|
| AT-SCOPE-001 | Critical | Zoek naar actieve AI-actions in fase 1-routes | Geen AI-action beschikbaar. |
| AT-SCOPE-002 | Critical | Zoek naar importflow | Geen werkende import in fase 1. |
| AT-SCOPE-003 | Critical | Profile statusopties | Alleen Draft, Active, Inactive. |
| AT-SCOPE-004 | Critical | Approval/review/publish endpoint | Bestaat niet als fase 1-productflow. |
| AT-SCOPE-005 | Critical | Employee self assessment | Niet beschikbaar. |
| AT-SCOPE-006 | Critical | Manager assessment | Niet beschikbaar. |
| AT-SCOPE-007 | High | Team Talent route | Niet actief of duidelijk fase 2. |
| AT-SCOPE-008 | High | Skills Matrix | Niet actief. |
| AT-SCOPE-009 | High | Profile comparison | Niet actief. |
| AT-SCOPE-010 | High | 9-grid, Succession, LMS | Niet actief. |
| AT-SCOPE-011 | Critical | Dashboard gebruikt seeded demo employee | Geen productie-demo-inhoud. |
| AT-SCOPE-012 | Critical | Level selector veronderstelt vijf levels | Test met 4 en 10 levels slaagt. |

---

# 19. Release acceptance summary

Een release is geaccepteerd wanneer:

- alle Critical tests slagen;
- minimaal 95% van High tests slaagt en resterende afwijkingen expliciet door Product Owner zijn geaccepteerd;
- geen securityfinding High of Critical openstaat;
- migratie en herstel op productieachtige data zijn bewezen;
- Product Blueprint, code en UI geen bekende productcontradicties hebben;
- out-of-scope guard tests slagen;
- testresultaten aan commit/releasecandidate zijn gekoppeld.

---

**Einde Acceptance Test Pack**
