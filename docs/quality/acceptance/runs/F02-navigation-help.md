# F02 — Navigation / Sidepanel / Help

- **Run ID:** F02
- **Name:** Navigation, sidepanel, help and setup guidance acceptance
- **Status:** PARTIAL / PRODUCT_DECISION
- **Execution mode:** PARALLEL_SAFE
- **Mutation risk:** LOW
- **Expected runtime:** MEDIUM
- **Required personas:** HR Admin, Manager in scope, Manager out of scope, Employee self, Preboarding Employee if available, Act-as Employee where relevant
- **External dependencies:** Browser harness, route authorization, module configuration, i18n and help/setup content
- **Preferred branch name:** `work/acceptance-F02-YYYYMMDD`
- **Fixture isolation strategy:** Read-mostly execution; no business writes and no shared fixture mutation
- **Harness reference:** [HARNESS-V2.md](../HARNESS-V2.md)
- **Reporting reference:** [REPORTING-STANDARD.md](../REPORTING-STANDARD.md)

## Visible navigation inventory

Inventory primary navigation, subnavigation, Focus bottom navigation, More menus, Settings navigation, breadcrumbs, back links, deep links, drawers, side panels, tooltips, info icons, empty-state CTAs, setup guidance, help links and onboarding/setup checklist. For every visible item record expected route, page, permission, module gate and mobile behavior.

## Per-item acceptance

For every visible item, perform and record: click; route; render; authorization; reload; browser back; deep link; and mobile check where relevant. Verify active/selected state, preserved query/filter state when implemented, 404 handling, unauthorized redirect and no dead link. Include HR Admin, Manager and Employee variants, plus Preboarding Employee and Act-as Employee where relevant.

## HR Admin onboarding sidepanel

Verify initial visibility, checklist items, checklist progress, every CTA, completed detection, module-dependent items, permission-dependent items, refresh persistence, relogin persistence, `Niet meer tonen`, reopen/re-enable when supported, no dead links and no stale completed/incomplete state. Assert checklist state is scoped to the correct actor/tenant and does not create unintended business rows.

## Help quality and mobile

Check dead links, obsolete routes, old product/module names, missing translations, guidance that contradicts the current UI and help exposing unauthorized functions. At 390x844 verify no covered controls, no broken Focus bottom navigation, no horizontal overflow and usable drawers/side panels. Record console/network errors separately as `HARNESS_FRICTION` or `PRODUCT_FAILURE`.
