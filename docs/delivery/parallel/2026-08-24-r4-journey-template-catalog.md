# Roadmap 4 — Journey Template Catalog

Datum: 2026-08-24

- Baseline: `1471aa224e2318b0c216d95e16b2ba1c4cd3ec64`
- Worktree: `.codex-worktrees/r4-journey-template-catalog`
- Branch: `work/r4-journey-template-catalog`
- Runtime: poort `3153`
- Test prefix: `R4-JNY-CAT`

## Scope

- `/settings/journeys` en `components/journeys/template-catalog.tsx` zijn naar Foundation v1.2 gebracht.
- De catalogus gebruikt `CollectionToolbar`, `EntityList`, `EmptyState`, `TextInput`, `Badge`, `Button`, `FormField` en `FormDrawer`.
- De eigen fixed overlay/modal is verwijderd. De bestaande FormDrawer/Dialog-semantiek verzorgt dialog- en dirty-closegedrag.
- Zoekstatus staat in URL-state (`q`), inclusief expliciete zero-result-state.
- Het create-contract is ongewijzigd: `POST /api/journeys/templates` met `{ key, draft }`, waarbij `draft` dezelfde `newDraft(...)`-structuur behoudt.
- Succesvolle create leest het response-id uit en navigeert naar het bestaande detail-/designercontract. Designer en detailroute zijn niet gewijzigd.
- Dubbele submits worden met een ref en disabled saving-state geblokkeerd; validatie-, duplicate- en netwerkfouten tonen een Foundation-compatible alert.
- Alleen catalogus/API-testdekking en de benodigde Journey-labels zijn toegevoegd; geen generieke Foundation-componenten zijn gewijzigd.

## Permissions and API contract

- Write-acties blijven server-side afhankelijk van het bestaande journey-template permissioncontract; de UI verbergt de create-actie voor read-only gebruikers.
- API-tests dekken GET 200, POST 201 met exacte service-argumenten, ongeldige key 400 (`JOURNEY_TEMPLATE_INPUT_INVALID`) en duplicate 409 (`JOURNEY_TEMPLATE_OPERATION_FAILED`).
- Er is geen migration, RLS-wijziging, remote schema-apply, seed of andere remote write uitgevoerd.

## Real acceptance evidence

- TEST HR Admin: catalogus geladen met bestaande templates; desktopcatalogus had 0 console errors en 0 warnings in de normale flow.
- HR search: `r4-no-such-result` zette `q` in de URL en toonde `Geen templates gevonden voor deze zoekopdracht.`.
- HR create: unieke TEST-key `r4_jny_cat_20260824191622`, namen `R4-JNY-CAT-20260824191622`.
- Exacte browser network-evidence: `POST /api/journeys/templates` → HTTP `201 Created`.
- Response bevatte id `d348eea0-92fb-438d-af26-cfb1dc8f81dd`, draftId `48af171e-1622-4550-8516-7e85e11d9ad3` en revision `1`.
- Readback: catalogus bevatte de nieuwe key/naam en linkte naar `/settings/journeys/templates/d348eea0-92fb-438d-af26-cfb1dc8f81dd`; de bestaande detailroute toonde de nieuwe templategegevens.
- Negatieve HR API-tests: duplicate gaf HTTP `409`; ongeldige key gaf HTTP `400`. De bijbehorende resource-consolemeldingen zijn verwachte signalen van deze bewust uitgevoerde negatieve requests, geen normale runtime-errors.
- TEST Manager: eindroute `/geen-toegang`, heading `Nog geen toegang`, 0 console errors op de eindroute.
- TEST Employee: eindroute `/geen-toegang`, heading `Nog geen toegang`, 0 console errors en 0 warnings op de eindroute.
- 390×844: catalogus en create-drawer zijn geopend; `innerWidth`, `scrollWidth` en `bodyScrollWidth` bleven 390. Geen horizontale overflow vastgesteld.
- Create drawer: role `dialog`, Foundation close/cancel/save semantics, dirty close confirmation en saving-disabled state zijn browsermatig gecontroleerd.

## Cleanup

- Permanent delete is niet beschikbaar in het bestaande templatecontract.
- Bestaande retire-flow gebruikt: `POST /api/journeys/templates/d348eea0-92fb-438d-af26-cfb1dc8f81dd/retire` → HTTP `200`, lifecycle `RETIRED`.
- Authenticated GET-readback bevestigde dezelfde template met lifecycle `RETIRED`; de catalogus toont `Uitgefaseerd` en behoudt de drilldown-link.
- Residual TEST-record is permanent aanwezig door retire/archive-semantiek: id `d348eea0-92fb-438d-af26-cfb1dc8f81dd`, key `r4_jny_cat_20260824191622`, lifecycle `RETIRED`.

## Verification

- Targeted API/component tests: 2 files, 7 tests passed.
- TypeScript: `npm.cmd run type-check` — groen.
- i18n: `npm.cmd run check:i18n --workspace @liquid-hr/hr-suite` — 33 namespaces met gelijke NL/EN-sleutels.
- ESLint: targeted gewijzigde files — groen; volledige hr-suite lint — groen met alleen bestaande warnings buiten deze scope.
- `git diff --check` — exit 0; alleen bekende LF/CRLF-normalisatieberichten.
- Full hr-suite test suite: 236 testfiles, 906 tests passed.

## Integration notes

- Gedeelde wijzigingen zijn beperkt tot Journey-labels in de bestaande NL/EN namespaces en `lib/journeys/labels.ts`; controleer bij integratie uitsluitend eventuele gelijktijdige wijzigingen op deze bestanden.
- `template-designer.tsx`, de template detail route, database, RLS, permissions, centrale deliverydocs, versie en deployment zijn niet gewijzigd.
- Canonical `apps/hr-suite/.env.local` is tijdelijk gekopieerd naar de worktree; secrets zijn niet gelogd of gecommit.
- Geen push, merge of deploy uitgevoerd. De devserver op poort 3153 is gestopt vóór oplevering.
