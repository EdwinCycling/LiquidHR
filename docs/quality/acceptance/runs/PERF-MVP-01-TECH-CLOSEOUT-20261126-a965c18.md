# PERF-MVP-01 technische closeout — 26 november 2026

## Besluit

De lokale featurekandidaat `a965c18ee131a43938d8886abac38a4720ca349b` is technisch geverifieerd. De kandidaat is **niet geïntegreerd naar GitHub `main`**: de effectieve Vercel Deployment Sources erven van het team en konden niet worden uitgelezen; het webhook-endpoint gaf 403. De lokale `vercel.json` is onvoldoende bewijs dat de eerste push geen deployment triggert. Conform de opdracht is vóór push/merge gestopt.

Dit is geen volledige functionele/securityacceptatie en geen productiegeschiktheidsclaim. A13, A26 en A27 blijven OPEN. Er is geen push, merge, remote databasewrite of Vercel-release uitgevoerd.

## Kandidaat en scope

- Branch: `work/perf-mvp-01-20261122`.
- Geteste code-SHA: `a965c18ee131a43938d8886abac38a4720ca349b`.
- Productcodebasis vóór closeout: `07444df5dc163dbf070f6b3115fa49282ab70463`; gerichte historiecorrectie staat op `c3d5fa8e13124b0d3555c7d3d391505ddcb2b244`.
- GitHub `main` read-only bevestigd: `b2dd65090acb6a371cf6597fe3fade8b68a61bdb`; featurebranch bevat lokaal 19 commits vóór deze baseline.
- Diffcontrole: geen Payroll-, WVP-, absence- of leave-bestanden in de featurebranch.
- Beschermde `apps/hr-suite/next-env.d.ts` in de featureworktree behield SHA-256 `B8B3A344484B959AF5E4E3FC1A1609DAC3CB9ECE0CDEB6C145BE29BC4C491000`. De production-build draaide geïsoleerd; alleen buildgegenereerde bestanden in die geïsoleerde worktree zijn hersteld.

## Technische gates

| Gate | Resultaat | Bewijs |
|---|---|---|
| Volledige relevante Vitest-suite | PASS — 4.302 tests; plus 2 aparte Payroll-calendar-contracttests; 8 overgeslagen tests | Finale-run op kandidaat-SHA; bestaande Happy DOM `blob:`-waarschuwingen waren niet fataal. |
| TypeScript | PASS | `npm.cmd run type-check` op kandidaat-SHA. |
| ESLint | PASS — 0 fouten, 9 bestaande waarschuwingen | `npm.cmd run lint`; waarschuwingen zitten in bestaande documentgeneratie-, payroll-import- en payroll-autorisatietests. |
| i18n | PASS — 44 NL/EN-namespaceparen met gelijke sleutels | `npm.cmd run check:i18n`. |
| Production-build | PASS | Geïsoleerde schone buildworktree, kandidaat-SHA; Next compile/typecheck, 368 statische pagina's, Payroll client-boundaryscanner en function-tracecheck geslaagd. Buildprovenance bevestigd. |
| Beschermde buildstate | PASS | Featureworktree `next-env.d.ts` hash bleef gelijk; geïsoleerde buildworktree is na herstel schoon. |

## A30 — Engelse UI

PASS op gecombineerde, kandidaat-relevante evidence:

- HR Admin: `Conversation rounds`; keyboardroute PASS; taalvoorkeur teruggezet.
- Manager: `My team`; keyboardroute PASS; taalvoorkeur teruggezet.
- Employee: `My conversations`; keyboardroute PASS; taalvoorkeur teruggezet.
- Run: [persona-browser-ui-closeout-a965c18.json](PERF-MVP-01-20261126/persona-browser-ui-closeout-a965c18.json); code-SHA `a965c18ee131a43938d8886abac38a4720ca349b`.
- Screenshots: [HR Admin](PERF-MVP-01-20261126/screenshots/hr-admin-en-desktop.png), [Manager](PERF-MVP-01-20261126/screenshots/manager-en-desktop.png), [Employee](PERF-MVP-01-20261126/screenshots/employee-en-desktop.png).
- Bestaande, ongewijzigde UI-evidence op `07444df5`: desktop/390px, zes axe-scans zonder gemelde overtredingen en 403/404/409-conflictproeven. Toetsenbordnavigatie en zichtbare focus voor NL-routes van alle rollen is op `c3d5fa8e` vastgelegd. De huidige EN-run heeft de voorkeuren teruggezet; er is geen blijvende persona-instelling gewijzigd.

## Read-only remindercontrole

De eerdere rapportage noemde 12 `PROCESS_REMINDER:READY`-jobs. De huidige read-only TEST-readback vond 8 READY-jobs bij twee gesloten procesinstanties, beide `CANCELLED`; nul `RUNNING` en nul afleveringen. Een derde eerder bekende proces-ID ontbreekt nu in `process_instances` en had geen bijbehorende jobs in de gelezen groep. De telling staat in [pmux-reminder-readonly-a965c18.json](PERF-MVP-01-20261126/pmux-reminder-readonly-a965c18.json). Er is geen queue-cleanup of jobverwerking uitgevoerd. De bestaande reminderfunctie slaat niet-`RUNNING` processen, inactieve/completed stappen en niet-open taken over; een contracttest dekt dit guardgedrag.

## PERF-A01 t/m A34

| ID | Status | Bewijs / resterende grens |
|---|---|---|
| A01 | PASS | Finale persona-evidence 07444: HR Admin bewaart rondeconcept en leest persistentie terug. |
| A02 | PASS | Finale persona-evidence 07444: naam- en populatiefilters, preview en scope. |
| A03 | PASS | 07444 en PMUX-contracttests: publiceren, dossieraanmaak, idempotency en taak-koppeling. |
| A04 | PASS | 07444: geplande ronde en idempotente activatie; schedulercontract. |
| A05 | PASS | PGlite-contracttests: beoordelingsschalen, labels en snapshotvalidatie. |
| A06 | PASS | Persona- en contracttests: scorevelden en verplichte onderbouwing volgen rondeconfiguratie. |
| A07 | PASS | 07444: deelnemers toevoegen, duplicaten en scopefouten. |
| A08 | PASS | 07444: self-reflectiondraft afgeschermd; definitieve tekst vergrendeld. |
| A09 | PASS | 07444: manager kan pas indienen na definitieve zelfreflectie. |
| A10 | PASS | 07444 en contracttests: optionele datum en scorevalidatie. |
| A11 | PASS | 07444: managerdocument upload/retry/vervangen/verwijderen en metadata-contract. |
| A12 | PASS | 07444: vrijgegeven document gelezen; document vóór vrijgave geweigerd. |
| A13 | BLOCKED / OPEN | Directe Storage- en Employee-mutatieproeven met bestaande persona: Employee-upload/delete 403, pre-release read geweigerd. Volledige onafhankelijke cross-employee objectproef ontbreekt; daarvoor ontbreekt een reeds toegestane tweede Employee-identiteit met bestaand dossierobject. Geen account/fixture aangemaakt. |
| A14 | PASS | c3 persona-closeout: private-note-canary ontbreekt uit dossier-, Continuous Appraisal-, historie-, algemene documenten- en self-exportresponses; Employee note-endpoint 403. |
| A15 | PASS | 07444: medewerker leest definitieve reactie en bevestigt; readback geslaagd. |
| A16 | PASS | 07444/contracttests: niet-akkoord vereist reden; herhaalde acknowledgement geweigerd. |
| A17 | PASS | Contracttests: definitieve submissions/acknowledgement immutable; ongeldige status- en versionwrites geweigerd. |
| A18 | PASS | 07444: verlopen zachte streefdatum blijft zichtbaar en formulier invulbaar. |
| A19 | PASS | c3: dossiers in `WAITING_EMPLOYEE`, `WAITING_MANAGER` en `WAITING_ACKNOWLEDGEMENT` gesloten; historische fasen bleven behouden en process/workitems stopten. Huidige read-only jobcontrole staat hierboven. |
| A20 | PASS | 07444: HR Admin-, Manager- en Employee-dashboards en scope, desktop/390px. |
| A21 | PASS | PGlite/PMUX-contracttests: bestaande `/work`-taken; geen tweede takenmodel. |
| A22 | PASS | 07444: medewerkerkaart-tab Gesprekken en eigen/team/HR-scopes. |
| A23 | PASS | c3: definitieve inhoud, auteurs/timestamps, twee vrijgegeven bijlagen, akkoord/niet-akkoord en voortijdige sluiting in historie. |
| A24 | PASS | 07444: veilige verwijzing naar bestaand Continuous Appraisal-item; inhoud niet gekopieerd. |
| A25 | PASS | c3: private-note-canary afwezig uit Continuous Appraisal, algemene documenten, dossier, historie en self-export. |
| A26 | NOT_RUN / OPEN | Cross-employee, cross-team, cross-HR-group, cross-administration en Storage-subsets uitgevoerd met bestaande persona's; onafhankelijke cross-tenant-proef niet uitgevoerd. Ontbreekt: bestaande geautoriseerde persona in tweede tenant plus bestaand doelobject. |
| A27 | BLOCKED / OPEN | Reviewerwisselcontract verifieert taakoverdracht. Geen bestaande actieve deputy/managerrelatie met twee bestaande Manager-identiteiten beschikbaar om oude-managerhistorietoegang live te bewijzen. |
| A28 | PASS | 07444 en contracttests: dubbele submit/upload, optimistic conflict en parallelle rondeafsluiting. |
| A29 | PASS | c3: relevante audit/log/export/API-projecties gecontroleerd; geen private-note-canary of note-bodyprojectie gevonden. Geen externe AI-aanroep gedaan. |
| A30 | PASS | Gecombineerd bewijs: 390px, axe, 403/404/409 op 07444; NL keyboard op c3; EN koppen, keyboardroute en taalherstel voor drie rollen op a965. Zie sectie A30. |
| A31 | PASS | Featuremigraties forward-only; RLS/grants, PGlite, generated types en Supabase-advisors in eerder finaal bewijs. Geen extra migratie uitgevoerd. |
| A32 | PASS | Bestaande HR Admin-, Manager- en Employee-identiteiten via ondersteunde role switch, zonder account- of rechtenmutatie. Persona-evidence op 07444/c3/a965. |
| A33 | PASS | Finale Vitest-, typecheck-, lint-, i18n- en geïsoleerde production-buildgates op a965; zie technische tabel. |
| A34 | PASS | Geen Payroll-diff, push, merge, databasewrite, Auth-mutatie of Vercel-release. Git/remote en status read-only gecontroleerd. |

**Totaal: 31 PASS, 1 NOT_RUN, 2 BLOCKED, 0 FAIL, 0 NOT_IMPLEMENTED.** A13/A26/A27 blijven expliciet OPEN; er is geen volledige securityacceptatie.

## Integratieadvies en volgende fase

**NO-GO voor integratie naar `main` op deze run.** De Vercel-projectpagina toont dat Deployment Sources van teaminstellingen worden geërfd, maar hun effectieve waarde is niet zichtbaar voor deze account; de project-webhookreadback gaf 403. De repo-instelling `git.deploymentEnabled: false` alleen bewijst niet dat de effectieve teamtrigger en Preview-bronnen uit staan. Remote `main` bleef `b2dd65090acb6a371cf6597fe3fade8b68a61bdb`.

GitHub issue [#102 — PERF-V2-01 Tweede manager](https://github.com/EdwinCycling/LiquidHR/issues/102) is ontwerptechnisch nog passend: tweede reviewer per dossier via bestaande PMUX-taken, zonder tweede workflow-engine of vermenging met vertrouwelijke notities. De issue houdt V2 afhankelijk van functionele én securityacceptatie van de MVP; A13/A26/A27 staan open, dus V2 blijft PARKED. Peerfeedback en configureerbare vragensets blijven aparte uitbreidingen. Er is geen V2-code gebouwd.
