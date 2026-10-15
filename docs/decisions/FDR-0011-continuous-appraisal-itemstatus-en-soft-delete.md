# FDR-0011 — Continuous Appraisal-statusovergangen en soft delete

Status: productregel vastgesteld via het V2-addendum van 2026-10-14; TEST-migratie vereist afzonderlijke goedkeuring
Scope: Continuous Appraisal V2, timeline-items, statusaudit en gecontroleerde verwijdering

## Besluit

- Iedere itemcategorie heeft altijd een contextgevoelige toevoegknop. De knop in een lege staat gebruikt dezelfde drawer en vooraf gekozen itemtype als de knop boven de tijdlijn. Feedback blijft beperkt tot rollen met de bestaande capability.
- `NOT_RELEVANT` is een expliciete status, verschillend van `CANCELLED`. De status wordt als statusovergang opgeslagen en geaudit; een commentaar is geen vervanging.
- `DONE` en `NOT_RELEVANT` zijn alleen beschikbaar voor open acties, afspraken en doelen. De actuele, geautoriseerde manager behoudt deze statusacties na een managerwissel; een medewerker werkt alleen binnen de eigen self-scope. De server voert de overgang uit met optimistic version-checking. Statusovergangen mogen historische status corrigeren zonder de historische titel, beschrijving of andere inhoud te herschrijven.
- Een notitie krijgt geen automatische afrondstatus. Systeemgebeurtenissen en items buiten de geldige rol-, scope- en historiegrenzen bieden geen status- of verwijderactie.
- Verwijderen is uitsluitend een auditeerbare soft delete via een gecontroleerde servercontract/RPC. Het item krijgt `deleted_at` en `deleted_by_user_id`, verdwijnt uit normale reads en tellers, en wordt nooit fysiek verwijderd als bijwerking van deze UX. Maker of toegewezen eigenaar mag alleen een niet-systeemitem verwijderen waarvan de datum nog binnen de bestaande wijzigingsgrens valt. De bevestiging toont de titel en legt uit dat het item uit de normale tijdlijn verdwijnt.
- Bestaande managerhandover, employee-, tenant- en managementscope blijven leidend. UI-capabilities zijn alleen een weergave; service, API, RLS, databasefunctie en audit blijven de beveiligingsgrens.

## Gevolgen

- De database gebruikt een forward-only migratie met afzonderlijke status- en soft-delete-RPC's, optimistic version-checks, auditactie `STATUS_TRANSITION`/`SOFT_DELETE`, een selectieregel voor verwijderde items en kolomgrants zonder deletevelden.
- TALENT-CONVERGENCE-01 autoriseert alleen de nieuwe, forward-only TEST-migratie. De migratie trekt zowel DELETE als TRUNCATE in voor authenticated; de officiële connector blokkeerde eerst de 9-grid-migratie met Invalid or expired requestState, dus de appraisal-migratie is nog niet toegepast of privilege-gevalideerd. Er is geen fysieke delete-route. Zie [de actuele acceptatierun](../quality/acceptance/runs/TALENT-CONTINUOUS-APPRAISAL-UX-V2-20261015.md).
- `FDR-0005` blijft het historische besluit voor de eerste slice. Dit addendum wijzigt alleen de huidige V2-status-/verwijdercontracten en herschrijft FDR-0005 niet.
