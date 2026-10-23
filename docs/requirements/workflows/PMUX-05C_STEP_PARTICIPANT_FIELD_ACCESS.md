# PMUX-05C — Veldrechten per processtap en deelnemer

Status: **LOCAL IMPLEMENTATION GREEN; REMOTE TEST ACCEPTANCE OPEN**

Datum: 2026-10-23

## Doel

HR Admin kan per geselecteerde FORM-stap, deelnemer en formulierveld kiezen voor Verborgen, Lezen, Bewerken of Verplicht. De server blijft de effectieve rechten bepalen op basis van de gepubliceerde formulier-/procesversie, het actieve work item en de bestaande participant-/tenantautorisatie.

## Capabilitymatrix

| Onderdeel | Bestaand vóór PMUX-05C | Gat | Resultaat |
| --- | --- | --- | --- |
| Actor- en work-itemcontrole | Bestaande servercontrole bindt auth-user/employee aan eligible work-item-candidate; tenant en HR-groep worden uit work item/instance gelezen. | Geen veldniveauonderscheid tussen stappen voor dezelfde participant. | Bestaande actorcontrole blijft de buitenste grens; staprechten verfijnen alleen de bestaande participantregel. |
| Veldcontract | FieldDefinition.access heeft getypeerde participantmodi HIDDEN/READ/WRITE_OPTIONAL/WRITE_REQUIRED. | Geen (stepKey, participantKey)-tuple. | Optionele stepAccess[] met stepKey, participantKey en mode, opgeslagen in de bestaande versieerbare definitie. |
| Compiler | Bestaande schema-/form-/participantvalidatie en condition-checks. | Geen validatie van stap-/deelnemerparen of rechten per stap. | Onbekende, niet-formulier-, verkeerde-form- en mismatched participantstappen; dubbele/onvolledige tuples; participant-ceiling en verborgen condition-bronnen worden afgekeurd. |
| Projectie, save en submit | Bestaande runtime-RPC's projecteren velden en valideren type, zichtbaarheid en requiredness. | Evaluatie gebruikt alleen participantrecht. | Dezelfde projectie, active-response-filter, response-save en finale validatie gebruiken de servergelezen item_row.step_key plus item_row.participant_key. |
| Oude procesdefinities | Bestaande participantregels blijven actief. | Nieuwe missende tuples mogen geen rechten geven. | Zonder stepAccess blijft het oude participantgedrag gelden; met een matrix is een ontbrekende of dubbele tuple HIDDEN. |
| Formulierenstudio | Bestaande Formulierenstudio en participantveldrechten. | Geen matrix of preview van effectieve rechten. | Stapkeuze, herkenbare veldnamen, deelnemer, desktop tabel, mobiele gestapelde weergave en stap-/deelnemer-preview. |

## Contract en effectieve toegang

stepAccess verfijnt bestaand FieldDefinition.access; het is geen zelfstandige permissiegrant.

- Maximumcapability blijft de participantmodus: HIDDEN < READ < WRITE. WRITE_REQUIRED en WRITE_OPTIONAL hebben dezelfde schrijfcapability; requiredness is een validatieregel.
- Zonder stepAccess gebruikt de runtime de bestaande participantmodus voor compatibiliteit met oude definities.
- Met stepAccess geldt alleen de exacte (stepKey, participantKey)-tuple. Ontbrekende, ongeldige of dubbele regels worden HIDDEN. Een ruimer stepniveau wordt server-side teruggebracht tot het participantmaximum en door de compiler afgekeurd.
- De client levert geen autoritatieve stap- of participantwaarde aan de runtime. RPC's lezen die uit het actieve process_work_items-record. Bestaande actor-, tenant-, HR-groep-, process-version- en form-version-pins blijven leidend.
- HIDDEN ontbreekt uit projectie en actieve runtimewaarden en kan niet worden geschreven. READ kan worden geprojecteerd maar niet opgeslagen. WRITE_OPTIONAL accepteert geldige optionele waarden. WRITE_REQUIRED wordt bij definitief indienen afgedwongen. Conceptsave blijft onvolledig toegestaan binnen bestaande type-, veld- en actorgrenzen.
- Conditionele zichtbaarheid en requiredness blijven de bestaande ConditionNode, compiler en SQL-evaluator gebruiken. Verborgen condition-bronnen zijn per stap/deelnemer ongeldig.
- Er zijn geen rol-, deelnemer-, stap-, RLS- of grantwijzigingen. Helpers blijven intern en revoked voor public, anon en authenticated.

## Versies, verborgen waarden en historie

De migratie wijzigt geen bestaande process-/form-definities of response-rijen. Nieuwe drafts bewaren stepAccess in het bestaande versieerbare contract; gepubliceerde immutable versies blijven onveranderd. Actieve projectie en conditionwaarden volgen de rechten van het actuele work item. Bestaande append-only revisions worden niet herschreven en er komt geen nieuwe historische leesroute bij.

## Lokale verificatie

De bestaande PGlite-contractsuite wordt hergebruikt. De lokale run laadt evaluator-/form-runtime-/hardeningfuncties, documentcompatibiliteit, scoped projection/save-RPC's en de PMUX-05B- en PMUX-05C-migraties. Tests omvatten Employee/Manager/HR per stap, HIDDEN/READ/WRITE, WRITE_REQUIRED bij finale submit, incomplete draftsave, ontbrekende tuple fail-closed, oude verborgen antwoorden, ongeautoriseerde writes, actor/cross-tenant-denial, immutable pins en legacyformulieren zonder stepAccess.

Zie [PMUX-05C local acceptance evidence](../../quality/acceptance/runs/PMUX-05C-20261023-LOCAL.md).

## Live acceptatie

**Niet aangetoond:** remote Supabase TEST-migratie, RLS/grants/functie-eigenaarschap, echte JWT/persona- en tenantreadback, authenticated save/reopen, browserdesktop en 390px. Er is geen remote write, procespublicatie of echte aanvraag gedaan. Houd live acceptance OPEN totdat deze gates apart zijn toegestaan en met bestaande identiteiten zijn bewezen. PMUX-04 blijft een afzonderlijke security-/releasegate.
