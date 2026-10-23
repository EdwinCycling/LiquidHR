# PMUX-06B — Herinneringen en escalaties

Datum: 23 oktober 2026
Status: **PARTIAL — lokale configuratie en queue-afhandeling; periodieke scheduling en remote acceptatie OPEN**
Roadmap: [PMUX geconsolideerde roadmap](PMUX_CONSOLIDATED_ROADMAP_20261022.md)

## Productdoel en capabilitymatrix

Maak PMUX-06A-deadlines opvolgbaar met de bestaande Processtudio, queue, LiquidHR-reminders, assignmentcontracten, audit events en procesprojecties. Deze slice voegt geen tweede workflow- of notificatiesysteem toe.

| Onderdeel | Bestaand / hergebruikt | Ontbrekend / UX-gat |
| --- | --- | --- |
| SLA en versies | Typed slaSchema, compiler, immutable gepubliceerde versies en PMUX-06A opgeslagen deadlines. | Optionele notifications-keuzes binnen hetzelfde SLA-contract. |
| Queue en worker | workflow_jobs, PROCESS_REMINDER, worker-locking, retries/backoff, dead-letter, bevoegde heruitvoering en operations-status. | Per werkitem deterministische BEFORE/AT/BREACH-jobs aanmaken. |
| Ontvangers | process_work_item_candidates, bestaande participant-resolver, actieve employee/user-koppelingen. | Gewone reminders naar actuele eligible kandidaten; escalatie naar gekozen bestaande participant. |
| Levering en projectie | Bestaande reminders, reminder_targets, reminder_recipients, Tijdhub/Focus en procesdetail. | Bestaande /work/<id>-route vanuit reminder activeren en deadline-events leesbaar tonen. |
| Scheduling | Runner en best-effort scheduleWorkflowDrain()-after-hooks op processtart/-actie; bevoegde handmatige runner. | Geen periodieke scheduler aangetroffen; toekomstige jobs worden niet gegarandeerd automatisch uitgevoerd. |

## HR Admin-configuratie

Bij een stap met deadline kiest HR Admin:

- Geen of één herinnering vooraf: 1 uur of 24 verstreken uren.
- Wel of geen herinnering op het deadline-instant.
- Bestaande breach-actie: verantwoordelijke informeren, escaleren naar een bestaande participant, of markeren voor procesbeheer.

24 uur is een verstreken interval. Er zijn geen cronexpressies, JSON, vrije ontvangers of nieuwe rollen. Zonder deadline legt de Processtudio uit waarom deadlineherinneringen niet kunnen worden ingesteld. ESCALATE vereist een bestaande participant en gebruikt de bestaande compilervalidatie.

De UI hergebruikt RadioGroup, DropdownSelect, TextInput, de bestaande Processtudio-layout en participantlabels. NL/EN keys zijn gelijk; er is geen nieuwe algemene UI-primitive.

## Servergedrag en grenzen

- Alleen de opgeslagen PMUX-06A-deadline op het werkitem is bron voor planning. Deze migratie herberekent geen deadline.
- Vooraf-job: deadline minus 1 uur of 24 uur. Op-deadline-job: exact deadline. Breach-job: deadline plus 1 seconde, zodat het deadline-event en overschrijding een vaste volgorde hebben.
- Idempotency keys zijn deterministisch per werkitem en gebeurtenistype. Bestaande versies zonder notifications behouden de legacy deadline-job.
- Nieuwe instellingen werken niet terug op al actieve werkitems. Gepubliceerde procesversies blijven immutable.
- Afgeronde/geannuleerde stap, proces of werkitem wordt overgeslagen.
- Gewone reminders gebruiken de laatste assignment resolution revision met eligible, actieve employee/user-koppeling. Bij geclaimd werkitem krijgt alleen de claimer de reminder.
- Escalatie resolveert de gekozen participant met dezelfde gepinde versie en tenant-/scopecontext. Geen ontvanger geeft PROCESS_ESCALATION_RECIPIENT_MISSING, zodat de bestaande queue retry/dead-letter kan toepassen.
- Directe delivery-RPC vereist bestaande process-operations:write, gelijk aan de runner-servicecontrole. Geen RLS-, auth-, role- of testbypass gewijzigd.
- Payloads bevatten alleen reminder-eventtype; er worden geen formulier-, salaris-, medische of verborgen waarden meegestuurd.
- BLOCK maakt alleen een idempotent audit-event voor procesbeheer; geen reminder of nieuwe goedkeuringstaak.
- Een reminder opent de bestaande geautoriseerde /work/<id>-route. De melding verleent zelf geen toegang.

## Acceptatiegrenzen

Lokale PGlite-tests dekken jobmaterialisatie, legacy-versies, idempotency, assignmentselectie, gesloten werk, tenantisolatie, escalatie, ontbrekende ontvanger, BLOCK-audit en directe autorisatie. Bestaande worker-tests dekken concurrent runners, retries en dead-letter.

Een periodieke scheduler/cronconfiguratie ontbreekt. De runner verwerkt due jobs wanneer hij wordt aangeroepen, maar after()-hooks garanderen geen uitvoering op een toekomstige deadline. Daadwerkelijke automatische scheduling en runtime-aflevering blijven **OPEN**. Geen externe provider/e-mail, remote migratie/databasewrite, browserlogin, push, merge of deployment hoort bij deze lokale slice.
