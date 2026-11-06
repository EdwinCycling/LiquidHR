# WVP02 — casuswerkplek en taakafhandeling

**Status: lokale code aangepast; functionele acceptatie PARTIAL.**

## Gebouwd

- De WVP-definitie gebruikt voor de permission queue en participant de bestaande PMUX-uitvoerpermission `process-task:act`. De aanmaak en start van een proces houden afzonderlijk `process-definition:write` en `process-definition:publish` vereist.
- `/work` toont de WVP-mijlpaal, deadline en urgency voor niet-gesloten dossiers binnen de bestaande `canManage`-scope, ook wanneer de actor geen publicatierecht heeft. Voor een medewerker wordt alleen een eigen open kennisname getoond.
- De WVP-casus vraagt de bestaande PMUX-instance projection op en toont de gelokaliseerde processtatus uitsluitend wanneer die bestaande read-permission de actor toelaat; bij `FORBIDDEN` wordt de status niet getoond.
- Het dossier toont dezelfde eerstvolgende open taak. De actieve open `currentMilestone` krijgt voorrang; wanneer die niet beschikbaar is, wordt de vroegste open taak getoond.
- `canStartProcess` houdt de UI-startactie achter de bestaande schrijf- en publicatierechten; task-actiepermissies geven geen impliciet recht om een nieuwe procesinstantie te starten.

De bestaande WVP-casusquery, PMUX-definitie, process-task service, task-claim-/act-RPC, WVP-commandotransactie, audit-events, 22 mijlpalen en urgencyregels zijn hergebruikt. De PMUX-kandidaat-, claim-, actor-, tenant-, HR-groep-, administratie-, team- en casusguards zijn niet gewijzigd. Er is geen schema, migratie, grant, remote definitie, casus of procesinstantie gewijzigd.

## Verificatie

- Broncontrole bevestigt dat WVP-taakuitvoering via `process-task:act` loopt en dat WVP-start apart de definitie-publicatierechten controleert.
- Gerichte regressietests zijn toegevoegd voor queue-permission, taak/start-capability-scheiding, keuze van eerstvolgende mijlpaal, urgentie-/processtatusweergave en employee-afscherming.
- `git diff --check`: **PASS**.
- Gerichte Vitest: **NOT RUN**. De bestaande Vitest-binary ontbreekt zowel in `node_modules/.bin` als `apps/hr-suite/node_modules/.bin`; er is geen dependency-installatie herhaald.
- Browser- en personaacceptatie (HR Admin, Manager en Employee), inclusief cross-administration/team-negatives, taakclaim/actie, idempotentie, audit en reminders: **NOT RUN**. De bestaande lokale runtime was niet direct beschikbaar; er is geen runtime-/rechtenonderzoek of remote TEST-write gedaan.

## Open

- De lokaal gewijzigde definitie verandert de reeds gepubliceerde WVP-definitie of de bestaande actieve procesinstantie niet. De door de gebruiker bevestigde actieve casus/instantie blijft daarom buiten scope ongewijzigd; een wijziging van die gepubliceerde versie vereist een afzonderlijk geautoriseerde normale publicatieflow.
- Native positieve en negatieve rolacceptatie, de echte PMUX-taakactie en reminder-/auditreadback blijven nodig voordat WVP02 live functioneel geaccepteerd kan worden.
