# FDR-0005: gedeelde Continuous Appraisal-timeline en handover

**Status:** Geaccepteerd voor de eerste verticale slice
**Datum:** 3 augustus 2026

## Besluit

LiquidHR bouwt Continuous Appraisal als één transparante tenant-owned timeline per medewerker. Medewerker en manager delen dezelfde items en commentaren. Feedback is een manageractie, maar is nooit verborgen voor de medewerker. Historische inhoud blijft immutable; context komt erbij via append-only commentaar.

De eerste handoverdefault is systeemgestuurd: de medewerker behoudt volledige historie, de nieuwe manager ziet toekomstige items en actieve/open acties, afspraken en doelen. Oude notities, feedback en meeting summaries worden niet automatisch vóór de nieuwe managerstartdatum ontsloten. Een managerwissel wordt zichtbaar vastgelegd als systeemitem.

## Rationale

Dit volgt het productprincipe **shared history, clear ownership, no silent changes** en combineert continuïteit met minimale noodzakelijke toegang. Een vrije `administration_id` op de timeline zou de tenant-owned persoon/relatie onnodig juridisch versnipperen en wordt daarom niet toegevoegd.

## Gevolgen

- `tenant_id + employee_id` zijn de bron- en RLS-grens.
- `continuous-appraisal:*` is gescheiden van formele Talent-review-permissions.
- De bestaande manager-scopehelper blijft de autorisatiebron; de UI bepaalt geen scope.
- Bijlagen, reminders, export en wijzigbare handoverinstellingen volgen alleen via een nieuw besluit.
