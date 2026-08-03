# LiquidHR Workforce & Talent Management
## Decision Register & Glossary v1.0

**Auteur:** Edwin Dingjan  
**E-mail:** edwin@editsolutions.nl  
**Datum:** 31 juli 2026

---

## 1. Doel

Dit document legt de definitieve productbeslissingen vast die ten grondslag liggen aan Product Blueprint v2.0. Het voorkomt dat toekomstige ontwikkelaars, AI-agents of ontwerpers oude discussies opnieuw openen of afwijkend productgedrag afleiden uit mockups.

Een besluit blijft geldig totdat het formeel wordt vervangen door een nieuw besluit met impactanalyse en migratieplan.

---

# 2. Decision Register

| ID | Besluit | Rationale | Impact |
|---|---|---|---|
| DR-001 | LiquidHR Talent is eigendom/productontwerp van Edwin Dingjan, niet van Exact. | Correcte auteurschap- en productcontext. | Documentatie, copyright en communicatie gebruiken Edwin Dingjan en edwin@editsolutions.nl. |
| DR-002 | Product Blueprint v2.0 is de single source of truth. | Voorkomt productgedrag op basis van losse prompts of mockups. | Alle afgeleide documenten verwijzen naar de Blueprint. |
| DR-003 | UI-mockups zijn ondersteunend en niet pixel-perfect. | De set illustreert richting, niet definitieve requirements. | Tekst wint bij inconsistentie. |
| DR-004 | Configuratie staat uitsluitend onder Instellingen. | Duidelijke mentale scheiding en minder complexiteit. | Geen beheerflows onder Workforce of Mijn Talent. |
| DR-005 | Operationeel gebruik staat uitsluitend onder Workforce. | Managers en HR gebruiken daar processen, zonder configuratie te mengen. | Workforce bevat read/operationele toegang. |
| DR-006 | Medewerkers consumeren eigen Talent-informatie via hun dashboard. | Eenvoudige, veilige employee experience. | Geen configuratie- of teamtoegang voor medewerkers. |
| DR-007 | Fase 1 kent drie rollen: HR Admin, Manager, Medewerker. | MKB-eenvoud, geen overmatige rolmatrix. | HR Admin volledig beheer; Manager en Medewerker read-only binnen scope. |
| DR-008 | HR Admin wijzigt direct. | Geen onnodige enterprise-workflow. | Geen approval, review of publish. |
| DR-009 | Functieprofielstatussen zijn Draft, Active en Inactive. | Eenvoudige lifecycle. | Geen extra statuswaarden. |
| DR-010 | Functieprofiel is het centrale bedrijfsobject. | Verwachtingen horen bij een functie, niet los bij iedere medewerker. | Performance, Learning en AI bouwen later op profile requirements. |
| DR-011 | Eén logisch functieprofiel per functie. | Voorkomt meerdere concurrerende profielsets. | Inhoud verandert via datumversies. |
| DR-012 | Versiebeheer wordt primair door opvolgende geldigheidsdatums gepresenteerd. | HR denkt in ingangsdatums, niet technische versienummers. | UI toont valid from/to; intern nummer optioneel. |
| DR-013 | Actieve profielperioden mogen niet overlappen. | Historische eenduidigheid. | Database- en serviceregels zijn transactioneel. |
| DR-014 | Een nieuwe actieve versie sluit de vorige open periode automatisch af. | Minder handmatige foutkans. | Eén atomair activation command. |
| DR-015 | Toekomstige ingangsdatums zijn toegestaan. | HR moet wijzigingen kunnen voorbereiden. | Current en planned version duidelijk onderscheiden. |
| DR-016 | Historische versies zijn read-only. | Behoud van audit en betekenis. | Correcties vereisen aparte beheeractie. |
| DR-017 | De minimaal vereiste functiehuisstructuur is Functiegroep → Functie. | Sluit aan op MKB en expliciete productkeuze. | Functiefamilie mag nooit verplicht zijn. |
| DR-018 | Functiefamilie is een optionele bovenlaag. | Ondersteunt grotere structuren zonder MKB te belasten. | Tenants zonder families hebben volledige functionaliteit. |
| DR-019 | Een functiegroep bevat één of meer functies zodra operationeel gebruikt. | Duidelijke containerrelatie. | Groups zonder functions zijn alleen voorlopige inrichting. |
| DR-020 | Een functie behoort tot precies één functiegroep. | Eenduidige classificatie en rapportage. | Verplaatsen wordt geaudit. |
| DR-021 | Senioriteit is een zelfstandig tenantbreed stamgegeven. | Geen hardcoded enterprise-model. | HR Admin beheert naam, beschrijving, volgorde en status. |
| DR-022 | De initiële senioriteitsset is Junior, Medior, Senior. | Direct bruikbare startconfiguratie. | Waarden zijn bewerkbaar, niet hardcoded. |
| DR-023 | Senioriteit is optioneel per functie. | Niet iedere functie heeft junior/medior/senior. | Nullable relation. |
| DR-024 | Een functie heeft maximaal één senioriteit. | Eenvoudige betekenis en filtering. | Senioriteit 1-n naar functions. |
| DR-025 | Senioriteit wordt niet verplicht in de basisfunctienaam opgeslagen. | Schone namen en betrouwbare rapportage. | UI mag samengestelde presentatienaam tonen. |
| DR-026 | Gelijknamige functies met verschillende senioriteit zijn toegestaan. | Ondersteunt HR Adviseur Junior/Medior/Senior zonder vervuilde basisnaam. | Unieke combinatie group + name + seniority. |
| DR-027 | Senioriteit en capabilityniveau zijn volledig gescheiden concepten. | “Senior” betekent niet automatisch “Expert”. | Profile requirements blijven expliciet. |
| DR-028 | Er is één intern generiek Capability-model. | Minder dubbele techniek en betere uitbreidbaarheid. | Types bepalen validatie en UI. |
| DR-029 | UI-types zijn Competency, Skill, Knowledge, Language en Certificate. | Herkenbare HR-terminologie. | Eén bibliotheekcontainer, afzonderlijke weergaven. |
| DR-030 | Competency, Skill en Knowledge gebruiken het Talent Level Model. | Consistent niveaugebruik. | Dynamic level relation. |
| DR-031 | Language gebruikt CEFR. | Internationale standaard en aparte semantiek. | Geen Talent Level voor talen. |
| DR-032 | Certificate gebruikt eigen geldigheid/statussemantiek. | Certificaten zijn geen proficiency levels. | Geen Talent Level voor certificaten. |
| DR-033 | Iedere tenant heeft precies één Talent Level Model. | Consistentie over Talent, Performance en Development. | Geen parallelle modellen. |
| DR-034 | Het aantal Talent Levels is configureerbaar. | Organisaties gebruiken 4, 5, 10 of andere aantallen. | UI en database zijn dynamisch. |
| DR-035 | Naam, beschrijving en volgorde zijn vóór gebruik configureerbaar. | Organisaties gebruiken eigen terminologie. | Geen hardcoded labelset. |
| DR-036 | Het Level Model is na ingebruikname vergrendeld in fase 1. | Voorkomt betekenisverlies van historische data. | Wijziging vereist toekomstige migratiefunctie. |
| DR-037 | Cloud Tags worden hergebruikt. | Tags bestaan al en moeten generiek blijven. | Geen Talent-specifieke tag-engine. |
| DR-038 | Categorie en tags zijn verschillende concepten. | Categorie biedt primaire ordening; tags dwarsdoorsneden. | Maximaal één primaire categorie in fase 1. |
| DR-039 | Import valt buiten fase 1. | Eerst betrouwbaar fundament, daarna bulkcomplexiteit. | Geen importknoppen of endpoints in fase 1. |
| DR-040 | Export en templates zijn niet nodig voor de fase 1-kern. | Scopebeheersing. | Alleen toevoegen in latere fase na besluit. |
| DR-041 | Profile comparison valt buiten fase 1. | Vereist betrouwbare vergelijkingsregels en data. | Later binnen dezelfde functiegroep. |
| DR-042 | Employee self assessment valt buiten fase 1. | Geen scores zonder proces en governance. | Mijn Talent is read-only. |
| DR-043 | Manager assessment valt buiten fase 1. | Zelfde reden; voorkomt halve beoordelingsmodule. | Manager read-only. |
| DR-044 | Persoonlijke matchpercentages vallen buiten fase 1. | Geen betrouwbare brondata. | Mockuppercentages niet bouwen. |
| DR-045 | Team Talent valt buiten fase 1. | Vereist persoonlijke capabilityrecords. | UI-008 is toekomstconcept. |
| DR-046 | AI valt volledig buiten fase 1. | Geen halve AI-functies; eerst datafundament. | Geen AI-knoppen, suggesties of analytics. |
| DR-047 | Architectuur moet wel AI-ready zijn. | Later waarde uit gestructureerde data. | Getypte data, historie, audit en provenance. |
| DR-048 | Dashboards tonen alleen echte data. | Vertrouwen en productkwaliteit. | Geen fake KPI, demo employee of arbitrary score. |
| DR-049 | Configuration Dashboard is een werkdashboard, geen BI-dashboard. | HR Admin moet acties en kwaliteit zien. | Tellingen, aandachtspunten, recent changes. |
| DR-050 | Employee-function assignment blijft in bestaand HR/employmentdomein. | Geen tweede medewerkersadministratie. | Talent leest de bestaande relation. |
| DR-051 | Bestaande Functions/Groups worden waar mogelijk hergebruikt. | Voorkomt duplicatie en migratierisico. | Repositoryanalyse verplicht vóór schema. |
| DR-052 | Hard delete is uitzondering. | Historie en referenties moeten intact blijven. | Inactivation als standaard. |
| DR-053 | Alle beheeracties worden geaudit. | Governance en herstelbaarheid. | Actor, tenant, before/after, correlation ID. |
| DR-054 | Autorisatie is server-side en deny-by-default. | UI is geen securitygrens. | RLS/policies/services en negatieve tests. |
| DR-055 | Tenantisolatie is release blocker. | Multi-tenant HR-data vereist strikte grens. | Cross-tenant tests verplicht. |
| DR-056 | Optimistic concurrency voorkomt stille overschrijving. | Meerdere HR Admins kunnen tegelijk werken. | Conflict UX en servicecheck. |
| DR-057 | Profile activation is transactioneel. | Geen half actieve historie. | Period close, activation en audit consistent. |
| DR-058 | Het bestaande LiquidHR Design System is leidend voor componenten. | Visuele en technische consistentie. | Geen aparte Talent UI-kit in code. |
| DR-059 | UI is desktop-first voor beheer en responsive voor My Talent. | Beheercomplexiteit versus employeegebruik. | Tables mogen op mobiel transformeren. |
| DR-060 | WCAG 2.2 AA is ontwerpdoel. | Toegankelijke enterprisekwaliteit. | Keyboard, focus, labels en contrast in DoD. |
| DR-061 | Ownership van entiteiten wordt per module expliciet gekozen volgens `ENTITEIT_EIGENAARSCHAP_EN_KOPPELMODEL.md`. | Tenantbrede bedrijfsdata mag niet per BV dupliceren en juridische data mag niet tenantbreed lekken. | Elk schema, API-contract, RLS-policy en test benoemt owner scope en access scope. |
| DR-062 | Functiefamilies, functiegroepen, functies, senioriteiten, levels, capabilities en functieprofielen zijn tenant-owned. | Eén functiehuis moet gelden wanneer een persoon tussen administraties beweegt. | Bestaande administrationeel opgeslagen functies worden gemigreerd met behoud van IDs; er komt geen tweede Talent-functiecatalogus. |
| DR-063 | `Employee` is tenant-owned; `Employment` en concrete plaatsingen zijn administration-owned en koppelen naar de tenantfunctie. | Eén persoon kan meerdere juridische contracten hebben zonder dubbele persoons- of functiebron. | Employment-, payroll-, verlof- en verzuimflows blijven administrationeel; Talent leest de bestaande koppeling. |
| DR-064 | Afdelingen/divisies zijn tenant-owned tenzij zij expliciet juridisch exclusief zijn. | Organisatiestructuur is meestal bedrijfsbreed, maar sommige eenheden horen bij één werkgever. | Gemengde scope gebruikt expliciet `scope_type`; een lege `administration_id` is nooit impliciete tenant-scope. |
| DR-065 | Ownership scope en access scope zijn onafhankelijke controles. | Een administratiecookie is een operationele context, geen eigendoms- of autorisatiebewijs. | Tenantcatalogi worden tenantbreed beheerd; RLS, permissions en managementscope bepalen wie ze ziet of wijzigt. |
| DR-066 | De ownershipmatrix geldt voor Talent en alle toekomstige LiquidHR-modules. | Dezelfde fout mag niet opnieuw in verlof, performance, organisatie of andere domeinen ontstaan. | Nieuwe requirements bevatten vóór schemaontwerp een ownershipclassificatie, koppelmodel en twee-administratietest. |

---

# 3. Glossary

## Active

Status van een object dat voor normaal gebruik of nieuwe relaties beschikbaar is. Bij een Profile Version betekent Active dat de versie operationeel geldig is binnen de geldigheidsperiode.

## AI-ready

Een datastructuur die toekomstige AI-functies ondersteunt door getypte entiteiten, expliciete relaties, versiehistorie, herkomst en audit. AI-ready betekent niet dat fase 1 AI bevat.

## Capability

Interne generieke entiteit voor een Competency, Skill, Knowledge item, Language of Certificate.

## Capability Requirement

Relatie tussen een Profile Version en een Capability, inclusief importance, typeafhankelijk niveau en toelichting.

## Category

Primaire classificatie voor bibliotheekobjecten. Een categorie is specifieker en hiërarchischer bedoeld dan een tag.

## CEFR

Common European Framework of Reference for Languages. LiquidHR gebruikt A1, A2, B1, B2, C1 en C2 voor taalbeheersing. Moedertaal is een afzonderlijke aanduiding.

## Certificate

Bewijs, licentie of kwalificatie met uitgevende instantie en eigen geldigheidssemantiek. Gebruikt geen Talent Level.

## Competency / Competentie

Observeerbaar gedrag of vermogen dat relevant is voor succesvol functioneren, bijvoorbeeld Stakeholdermanagement of Samenwerken.

## Configuration Health

Set van objectieve, oplosbare configuratiesignalen, zoals functies zonder actief profiel of inactieve references. Geen arbitraire totaalscore.

## Draft

Bewerkbare Profile Version die niet operationeel geldig is.

## Effective Date / Ingangsdatum

Datum vanaf wanneer een Active Profile Version geldig is.

## Employee / Medewerker

Persoon in het bestaande HR-domein. Talent maakt geen aparte employee-entiteit.

## Function / Functie

Concrete rolvariant binnen een Functiegroep, optioneel gekoppeld aan één Senioriteit.

## Function Base Name / Basisfunctienaam

Naam zonder automatisch ingevoegde Senioriteit, bijvoorbeeld “HR Adviseur”.

## Function Family / Functiefamilie

Optionele groeperingslaag boven Functiegroepen. Niet vereist voor gebruik.

## Function Group / Functiegroep

Verplichte organisatorische container voor één of meer Functions.

## Function House / Functiehuis

Gehele structuur van optionele Families, Groups, Functions, Seniorityrelations en gekoppelde Profiles.

## Function Profile / Functieprofiel

Logisch centraal object dat de verwachtingen voor één Function beschrijft. Bevat datumgebonden Profile Versions.

## HR Admin

Rol met volledige Talent-configuratierechten binnen de eigen tenant.

## In Use

Status van het Talent Level Model nadat minimaal één level in relevante profieldata wordt gebruikt. Het model is daarna structureel locked in fase 1.

## Inactive

Object blijft historisch bestaan maar is niet beschikbaar voor nieuwe relaties of operationeel gebruik.

## Importance

Classificatie van een Capability Requirement: Required, Important of Optional.

## Job Architecture

Technisch/domeinbegrip voor Functiefamilies, Functiegroepen en Functies.

## Knowledge / Kennis

Theoretische of domeinspecifieke kennis die bij een functie nodig is.

## Manager

Rol met read-only toegang tot actieve profielen en medewerkers binnen bestaande managementscope.

## My Talent / Mijn Talent

Read-only employeeweergave van de eigen actuele Function, Profile en functievereisten.

## Normalized Name

Technisch gestandaardiseerde naam voor betrouwbare duplicatecontrole, bijvoorbeeld case-insensitive en zonder afwijkende whitespace.

## Profile Version / Profielversie

Inhoudelijke snapshot van een Function Profile met status en geldigheidsperiode.

## Seniority / Senioriteit

Tenantconfigureerbare classificatie van een Function, bijvoorbeeld Junior, Medior, Senior of Principal. Is optioneel en staat los van Talent Levels.

## Skill / Vaardigheid

Praktische of technische bekwaamheid, bijvoorbeeld SQL, presenteren of lassen.

## Talent Configuration

HR Admin-context onder Settings voor bibliotheek, framework en functiehuis.

## Talent Foundation

Het gestructureerde fundament van capabilities, levels, seniorities, job architecture en profiles waarop latere Talent-processen bouwen.

## Talent Level

Eén geordend niveau binnen het tenantbrede Talent Level Model, gebruikt voor Competency, Skill en Knowledge.

## Talent Level Model

Precies één configureerbare niveauordening per tenant, na ingebruikname locked in fase 1.

## Tenant

Geïsoleerde klantorganisatie binnen LiquidHR.

## UI Reference

Conceptuele mockup met ID UI-001 tot en met UI-013. Ondersteunt de Blueprint maar bepaalt geen productregels.

## Workforce

Operationele context voor HR Admin en Manager. Bevat raadpleging en toekomstige HR-processen, niet configuratie.

## Tenant-owned

Entiteit waarvan de brondata en betekenis binnen één tenant over alle administraties heen gelijk zijn, bijvoorbeeld een functie of capability. Tenant-owned betekent niet automatisch onbeperkte lees- of schrijfrechten.

## Administration-owned

Entiteit die juridisch, fiscaal, financieel of operationeel bij één administratie hoort, bijvoorbeeld een employment, salarisregel, verlofsaldo of verzuimdossier.

## Link entity / Koppelentiteit

Een record dat een tenant-owned bron koppelt aan administration-owned uitvoering, bijvoorbeeld een employment die een persoon en functie verbindt. Een koppelentiteit wordt niet zelf een tweede broncatalogus.

## Ownership scope

De scope waarin een entiteit wordt beheerd en uniek is. Deze scope staat los van de access scope van de ingelogde gebruiker.

## Scope type

Een expliciete databasewaarde voor een entiteit die tenantbreed of administratiegebonden kan zijn. `TENANT` vereist een lege administratie-FK; `ADMINISTRATION` vereist een geldige administratie-FK. Een nullable administratiekolom zonder deze check is geen scopeontwerp.

---

# 4. Verboden synoniemen en terminologieafspraken

Gebruik in Nederlandstalige productcopy bij voorkeur:

| Voorkeur | Vermijd tenzij technisch noodzakelijk |
|---|---|
| Functiegroep | Job Group in gebruikersinterface |
| Functie | Rol wanneer een formele functie wordt bedoeld |
| Senioriteit | Functieniveau wanneer dit verward kan worden met Talent Level |
| Functieprofiel | Job Description als generiek synoniem |
| Niveaumodel | Hardcoded “5-level model” |
| Competentie | Skill wanneer gedrag wordt bedoeld |
| Vaardigheid / Skill | Competentie wanneer een concrete technische skill wordt bedoeld |
| Ingangsdatum | Publish date |
| Activeren | Publiceren/Goedkeuren |
| Mijn Talent | Mijn Skills wanneer de pagina breder is dan skills |

Technische code mag Engelse namen gebruiken, mits mapping naar productterminologie eenduidig is.

---

# 5. Wijzigingssjabloon

Nieuwe besluiten worden toegevoegd als:

```text
Decision ID:
Datum:
Status: Proposed | Accepted | Superseded
Eigenaar:
Aanleiding:
Besluit:
Rationale:
Impact op Blueprint:
Impact op data/migratie:
Impact op UX:
Impact op API/security:
Impact op tests:
Vervangt besluit:
```

Geen bestaand besluit wordt stilzwijgend aangepast.

---

**Einde Decision Register & Glossary**
