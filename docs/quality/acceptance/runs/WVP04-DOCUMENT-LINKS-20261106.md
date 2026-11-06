# WVP04 — documentkoppelingsstatus

**Status: lokale read-only slice gebouwd; functionele acceptatie NOT RUN.** Branch `work/wvp04-20261106`, gebaseerd op `origin/main` `8c580cda76cd2ea641ddaafe13a7b55213d89833`.

## Modelreview

- `employee_documents` is gekoppeld aan medewerker, administratie en categorie. De `tags` en `document_audiences` bevatten geen gevalideerde WVP-case- of mijlpaalrelatie.
- `absence_guidance_events` kan via `task_id` aan een WVP-taak hangen, maar heeft geen document-ID. `wvp_list` retourneert geen documentreferenties.
- `employee_document_acknowledgements` koppelt documenten aan een aparte procesinstantie en werkitem voor documentkennisname. Dat is geen relatie naar een WVP-mijlpaal; de WVP-procesdefinitie heeft geen documentreferentieveld.

## Gebouwd

- De WVP-caseworkspace toont bij iedere bestaande mijlpaal **Geen WVP-documentkoppeling**.
- De uitleg maakt duidelijk dat dit niet betekent dat er geen document bestaat en geen RIV-compleetheidsbeoordeling is.
- De medewerkerdocumentlink gebruikt de bestaande medewerkerpagina en daarmee `listEmployeeDocuments`, `document:read` en `can_access_employee_dossier`. De WVP-view leest geen losse documentmetadata.
- WVP-case en taakdata blijven via `wvp_list` binnen de bestaande tenant-, HR-groep-, administratie-, team- en eigen-casusscope. Medewerkers blijven beperkt tot hun eigen case en de bestaande eigen documenttoegang.
- Geen documentmutatie, nieuwe opslag, automatisch document, medische documentmetadata, schemawijziging, migratie, grant, RLS-wijziging of databasewrite.

## Checks en open punten

- `git diff --check`: PASS op de lokale kandidaat.
- `node scripts/check-i18n.mjs`: PASS, 43 namespaces met gelijke NL/EN-sleutels.
- Vitest, TypeScript en lint: **NOT RUN** zolang de bestaande lokale binaries ontbreken.
- Browser/personaacceptatie: **NOT RUN**; de bestaande browserinventaris bevat geen HR Suite-tab. Er is niet ingelogd en geen runtime gestart.
- Core TEST-write/readback, migratie en Vercel-release: **NOT RUN**.
- **OPEN:** een gevalideerde WVP-case-/mijlpaal-documentrelatie met server-side scopes, permission/RLS en auditcontract. Tot die tijd blijft “geen koppeling” iets anders dan “document ontbreekt”. Wettelijke dossieronderdelen vereisen gevalideerde requirements voordat RIV-readiness kan worden geclaimd.

WVP03 blijft afzonderlijk in Draft PR [#95](https://github.com/EdwinCycling/LiquidHR/pull/95). Deze WVP04-slice is onafhankelijk van PR #95 en verandert die niet.
