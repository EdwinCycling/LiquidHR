# R5 Shared TEST dataset

## Scope

Deze fixture maakt een reproduceerbare `R5-TEST`-dataset voor Roadmap 5 Work & Automation op het bestaande P9/P10 Process Automation-contract. De fixture introduceert geen task-entiteit, automation-rule, trigger, scheduler of domain adapter. Er zijn geen migrations gemaakt of toegepast.

Remote TEST-project: `wnpfloqpjvaacobppbpk`
Werkbranch: `work/r5-shared-test-dataset`
Baseline: `e13c50f418cb327a6e4e99e266d58ab7370e4885`
Zichtbare versie: `1.20260825.1`

## Gebruik

Voer uit vanuit `apps/hr-suite` met de canonical, ignored `.env.local`:

```text
npm.cmd run fixtures:r5
npm.cmd run fixtures:r5 -- readback
npm.cmd run fixtures:r5 -- cleanup
```

`setup` gebruikt bestaande studio-, process-, work-item-, document- en job-API/RPC-contracten, vaste `R5-TEST`-idempotency keys en readback. Een geslaagde setup is opnieuw uitvoerbaar zonder nieuwe process instances of acknowledgement-documenten; bestaande acknowledgement-documenten worden via het bestaande acknowledgement-RPC teruggevonden. `cleanup` is uitsluitend voor het gekoppelde TEST-project en de canonieke tenant/admin: storage wordt via het bestaande Storage-contract verwijderd en productrecords worden exact op geïnventariseerde IDs hard verwijderd. Omdat append-only process-triggers ook service-role REST-DELETE blokkeren, gebruikt de cleanup één tijdelijke, transactionele en exact gescopeerde SQL-delete met `session_replication_role = replica`; dit is geen setup- of statusmechanisme en wijzigt geen schema. Het resultaat bevat IDs, statussen, deadlines, output/job-readback, before/after-counts en residuals.

## Aangemaakte dataset

De vijf R5-definities zijn:

- `r5-test-internal-transfer` — `0aca0f53-1434-4a4d-9333-6604b678b7c4` — `PUBLISHED`
- `r5-test-document-acknowledgement` — `002cdf7c-2567-4e1e-a7bf-c55df6b31d9e` — `PUBLISHED`
- `r5-test-overdue-transfer` — `387078ce-f5c1-471b-b300-233452cd5185` — `PUBLISHED`
- `r5-test-draft-process` — `f38473a8-3685-4087-a819-8919aa04e8e5` — `DRAFT`
- `r5-test-retired-process` — `4a594eb5-d59a-491d-80e6-67da16ea20ff` — `RETIRED`

De runtime gebruikt voor acknowledgement bewust de bestaande gecertificeerde P10-definitie `document-acknowledgement-v1`; de start-route vereist de certified recipe binding. De R5-clone blijft als catalogusfixture beschikbaar.

Readback van de ondersteunde positieve categorieën:

- `CLAIMED`: process `2b929cf1-9264-4258-92ec-bfdd6bde2fea`, work item `d5af1e9c-0575-478d-87c9-7068027c0b5d`, assigned to the Manager and `CLAIMED`.
- `REJECTED`: process `c4c8176b-e1ac-47df-8b38-84824238d2b5`, status `REJECTED`.
- `REQUEST_CHANGES`: process `f54db6ac-12c7-499c-b0ed-ae6cf149b810`, current step `request`, source approval completed.
- Employee acknowledgement open: process `002a965a-acf6-43e5-b2c2-bfc3d376fad6`, work item `46963bde-7761-470b-ad1b-6c40d40c3cd6`, `OPEN`.
- Employee acknowledgement completed: process `6b601fd8-e81f-46da-a295-d1a6f4292e75`, `COMPLETED`.
- Successful output/job: output `8d577726-039b-4c15-89db-c0d27fa4d1fc`, generated document `068f77a2-9341-4746-b69d-3b2a6f331d9d`, both `AVAILABLE`; workflow job `a12b2271-45ab-4abf-8649-b64931e1f341`, `SUCCEEDED`. The helper prints these IDs on every run.

## Bekende unsupported scenarios op huidige TEST-runtime

De fixture markeert deze categorieën als unsupported en maakt geen kunstmatige status/timestamp:

- `OPEN_HR_QUEUE_UNCLAIMED`: de bestaande P9 resolver geeft bij de legitieme same-manager route HTTP `409 NO_ASSIGNEE`. De remote function bevat de lokale same-manager patch niet; er is geen migration toegepast.
- `UPCOMING_DEADLINE` en `OVERDUE_DEADLINE`: de published SLA wordt niet naar `deadline_at` gematerialiseerd. De remote trigger leest `definition_json.steps`, terwijl de bestaande definitie de steps onder `definition_json.content.steps` bewaart. Daarom blijft de readback `deadlineAt: null` en `isOverdue: false`.
- `BLOCKED_UNRESOLVED_ASSIGNMENT`: de bestaande start-route weigert de beschikbare niet-strikt-UUID persona-input met HTTP `400 PROCESS_RUNTIME_INPUT_INVALID`; er is geen `BLOCKED`-rij gefabriceerd.
- Retry/dead-letter: niet toegevoegd; er is geen veilig bestaand fixture/job-contract gevonden waarmee dit zonder kunstmatige status- of timestampmutatie bereikt wordt.

## Scope evidence

HR, Manager en Employee kregen via `get_process_work_projection_with_administration` voor de normale `TODO`-tab HTTP/service-status `200`. De actuele readback gaf HR 7 items, Manager 3 direct-report items en Employee 3 self-items. De Manager-projectie bevat de eigen direct-report-scope; de Employee-projectie bevat de self-scope van de fixturemedewerker. De bestaande `/api/process-work` query accepteert deze canonical databaseUuid-context niet door zijn strikte `z.uuid()`-validatie (`400`), daarom is de service-RPC-readback apart vastgelegd.

De Employee-read op het Manager approval-item van hetzelfde Employee-subject gaf HTTP `200`; dit is volgens het bestaande self-process-instance contract toegestaan en is geen cross-scope negatieve test. Een tweede strict-UUID Employee-persona met niet-eigen subject kon binnen deze opdracht niet veilig worden aangemaakt. Daarom is de volledige negatieve cross-scope matrix niet bewezen; dit blijft een bekende unsupported capability gap en geen acceptance blocker.

Authenticated browser-readback op `http://localhost:3001/work` is uitgevoerd voor HR, Manager en Employee op `1440x900` en `390x844`. De pagina was populated; Employee zag alleen self-items, Manager de direct-report scope en HR de beschikbare tenant-scope. De definitieve screenshots zijn `r5-hard-cleanup-{hr,manager,employee}-work-{desktop-1440x900,mobile-390x844}.png` in `.artifacts`. Alle zes viewports hadden `scrollWidth` gelijk aan de viewportbreedte en de console had alleen React/HMR-ontwikkellogs, geen relevante foutmelding.

## Status

Rerunnable: **YES**. Setup is tweemaal direct na elkaar uitgevoerd met stabiel resultaat: 5 definities, 7 process instances en 12 work items; er was geen ongecontroleerde groei. De hard cleanup had vóór de delete 5 definitions, 8 drafts, 4 versions, 9 instances, 15 work items, 2 outputs, 2 jobs, 59 documents en 59 audiences in de herkenbare TEST-scope; na de transactionele delete waren alle geïnventariseerde tabellen `0`. De 59 documenten waren 57 `R5-TEST`-titelrecords plus 2 outputdocumenten met een producttitel. Storage-readback liet daarna 0 scoped objecten over. Na deze bewijsrun is de canonical dataset opnieuw opgebouwd en bewust in TEST achtergelaten voor gedeeld R5-gebruik.
Migrations: **NO**.
Productie, version bump, Vercel, main-merge en main-push: **NO**.
Eindstatus: **GREEN FOR SHARED R5 FIXTURE — WITH UNSUPPORTED SCENARIOS**. De helper kan intern `safeAsSharedR5Fixture: NO` rapporteren; dit is **KNOWN FIXTURE CLASSIFIER MISMATCH — UNSUPPORTED SCENARIOS ARE NON-BLOCKING**. HR-queue assignment, deadline materialization, blocked-path en een echte non-self negative persona zijn bekende capability gaps, geen reden om de canonical fixture af te keuren.
