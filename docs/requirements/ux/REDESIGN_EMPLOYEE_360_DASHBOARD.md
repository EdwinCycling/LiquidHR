# Employee 360 Dashboard / Overview

Status: **GEIMPLEMENTEERD / WACHT OP ACCEPTANCE**
Route: `/employees/[employeeId]` met tab `overview`

## Doel

Maak het Employee 360-dashboard rustig, consistent en goed leesbaar binnen UX Foundation v1. De dashboardheader geeft alleen globale context; inhoudelijke wijzigingen blijven bij de relevante kaart of tab.

## Dashboardstructuur

- De bestaande brede en smalle widgetkolommen blijven behouden.
- Desktop gebruikt `DetailColumns` met ongeveer 2/3 hoofdinhoud en 1/3 aside; mobiel stapelt de inhoud logisch.
- Compact en uitgebreid blijven URL-/voorkeursgedrag volgen.
- Opgeslagen widgetvolgorde, drag-and-drop, omhoog/omlaag, save-status en PATCH-payload blijven ongewijzigd.
- De dashboardheader bevat titel en ondersteunende context, zonder dubbele actie naar Personal/edit.

## Behouden functionele contracten

Employee-, employment-, salary-reveal-, permissions-, profile-link-, activity-, documents-, payslips-, reminders-, notes-, absence-, processes- en journeys-data blijven via de bestaande serverprojecties, routes en API-contracten lopen. Er zijn geen route-, schema-, migration-, RLS-, permission- of businesslogicawijzigingen onderdeel van deze redesign.

## Foundation reuse

De lokale dashboardcomposities gebruiken `Surface`, `EmptyState`, `Button`, `IconButton`, `TextInput`, `Textarea`, `FormField`, canonical `TabButton`, `SectionHeader` en `DetailColumns`. Dashboardkaarten hebben semantische borders, Foundation-radius en geen standaard shadow. Placeholdermodules zijn expliciet toekomstig en niet-actionable; betekenisvolle titels, e-mails, adressen, namen, filenames en notes wrappen natuurlijk.

## Responsive en acceptance

- Controleer desktop, tablet en circa 390px.
- Belangrijke tekst en acties mogen niet betekenisloos truncaten of overlappen.
- 2/3 + 1/3 stackt zonder horizontale paginaoverflow.
- Reorder-controls blijven zichtbaar bij hover/focus en bruikbaar met toetsenbord.
- Populated, empty, compact, expanded, loading, saving en error states blijven begrijpelijk.
- Controleer default en LinkedHR met dezelfde componenten en alleen theme tokens.
- Acceptance-GREEN vereist een geauthenticeerde branch-previewcontrole; lokale compile/test-gates alleen zijn daarvoor niet voldoende.

## Integratie A/B/C

De branch integreert de reeds gereviewde slices Documents + Payslips, Reminders + Notes en Absence + Processes. Het dashboard toont hun bestaande samenvattingen en links; geen slicefunctionaliteit is opnieuw geïmplementeerd.

## FOUNDATION_GAPs

Voor deze slice is geen nieuwe generieke gap gevonden. De eerder geregistreerde Dialog- en Multiselect-behoefte blijft **FOUNDATION_GAP — LATER**.
