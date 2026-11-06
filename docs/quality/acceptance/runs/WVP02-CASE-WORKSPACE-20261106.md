# WVP02 — casuswerkplek en taakafhandeling

**Status: codefix toegevoegd; CONTROLLED securityverificatie OPEN.** PR #94 blijft open/draft tot de verplichte security- en testgates aantoonbaar slagen.

## Gebouwd

- De WVP-definitie gebruikt voor de permission queue en participant de bestaande PMUX-uitvoerpermission `process-task:act`. De aanmaak en start van een proces houden afzonderlijk `process-definition:write` en `process-definition:publish` vereist.
- `/work` toont de WVP-mijlpaal, deadline en urgency voor niet-gesloten dossiers binnen de bestaande `canManage`-scope, ook wanneer de actor geen publicatierecht heeft. Voor een medewerker wordt alleen een eigen open kennisname getoond.
- De WVP-casus vraagt de bestaande PMUX-instance projection op en toont de gelokaliseerde processtatus uitsluitend wanneer die bestaande read-permission de actor toelaat; bij `FORBIDDEN` wordt de status niet getoond.
- Het dossier toont dezelfde eerstvolgende open taak. De actieve open `currentMilestone` krijgt voorrang; wanneer die niet beschikbaar is, wordt de vroegste open taak getoond.
- `canStartProcess` houdt de UI-startactie achter de bestaande schrijf- en publicatierechten; task-actiepermissies geven geen impliciet recht om een nieuwe procesinstantie te starten.

De bestaande WVP-casusquery, PMUX-definitie, process-task service, task-claim-/act-RPC, WVP-commandotransactie, audit-events, 22 mijlpalen en urgencyregels zijn hergebruikt. De PMUX-kandidaat-, claim-, actor-, tenant-, HR-groep-, administratie-, team- en casusguards zijn niet gewijzigd. De nieuwe migratie is alleen als code toegevoegd; ze is niet op Core TEST toegepast. Er zijn geen rollen, grants, RLS-policies, remote definitie, casus of procesinstantie gewijzigd.

## Verificatie

- Broncontrole bevestigt dat de queue/participant `process-task:act` gebruikt. De nieuwe migratie vervangt `internal_security.wvp_command` forward-only en eist bij START beide definitierechten met `process_scope_has_permission` op de werkelijke administratie, vóór idempotente return en nieuwe dossier-/procesmutaties. De bestaande `public.start_process`-kernel blijft daarnaast `process-instance:start` eisen. De applicatieservice eist de twee definitierechten ook voordat zij een bestaande processInstanceId idempotent retourneert.
- Gerichte regressietests zijn toegevoegd voor START met volledige/reducerende rechten, weigering vóór mutaties, tenant-/groep-/administratie-/team-/casusscope, idempotentie met bevoegde actor, PMUX-kernelstartrecht, `process-task:act` voor claim/taakuitvoering, en bestaande Employee-/AGREEMENT-/CLOSE-guards.
- `git diff --check`: **PASS**.
- Gerichte Vitest/PGlite-contracttests: **NOT RUN**. De bestaande Vitest-binary ontbreekt zowel in `node_modules/.bin` als `apps/hr-suite/node_modules/.bin`; er is geen dependency-installatie herhaald.
- TypeScript en ESLint: **NOT RUN**; de bestaande lokale dependencies/binaries ontbreken. Geen npm-/Windows-herstelronde uitgevoerd.
- Browser- en personaacceptatie (HR Admin, Manager en Employee), inclusief cross-administration/team-negatives, taakclaim/actie, idempotentie, audit en reminders: **NOT RUN**. De bestaande lokale runtime was niet direct beschikbaar; er is geen live rolprobe of remote TEST-write gedaan.

## Securityreview en integratiebesluit

**Securityreview: OPEN (geen resterende afwijking gevonden in de gewijzigde code; runtimecontract nog niet uitgevoerd).** De RPC- en applicatieroute eisen nu beide definitierechten vóór START, ook bij idempotente return. De scoped permission helper ontvangt de casusadministratie en de bestaande kernel-check op `process-instance:start` blijft staan. De gewijzigde `MILESTONE`, `AGREEMENT`, `ACKNOWLEDGE` en `CLOSE`-paden behouden hun bestaande casus-, taak-, actor- en PMUX-guards in de nieuwe function body. De directe-RPC-contractsuite is uitgebreid maar NOT RUN; dit is geen PASS totdat de PGlite-regressies en toepasselijke CONTROLLED-suite slagen.

De migratie en tests zijn als code toegevoegd; **geen migratie is op Core TEST uitgevoerd**. Bij de uitgangsmeting meldde GitHub PR #94 mergeable en rapporteerde het geen statuschecks. Base-SHA: `7243300fccd691fc8f76f8f1fc5a7e23c4ec3fe9`; oorspronkelijke PR-head: `a3fb75ba8786e4fb4d89215e1129ccad51d11c30`. PR #94 blijft open/draft zolang de verplichte CONTROLLED-tests niet uitgevoerd en PASS zijn. Geen Vercel-release of wijziging aan bestaande gepubliceerde WVP-versies/instanties.

WVP03 is als volgende bouwslice in AA-ROAD vastgelegd, na herstel van de WVP02-blokkade; wettelijke RIV-compleetheid blijft afhankelijk van gevalideerde requirements.

## Open

- De lokaal gewijzigde definitie verandert de reeds gepubliceerde WVP-definitie of de bestaande actieve procesinstantie niet. De door de gebruiker bevestigde actieve casus/instantie blijft daarom buiten scope ongewijzigd; een wijziging van die gepubliceerde versie vereist een afzonderlijk geautoriseerde normale publicatieflow.
- Native positieve en negatieve rolacceptatie, de echte PMUX-taakactie en reminder-/auditreadback blijven nodig voordat WVP02 live functioneel geaccepteerd kan worden.
