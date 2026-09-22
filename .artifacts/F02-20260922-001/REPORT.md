# F02 Acceptance Report — Navigation / Sidepanel / Help

## 1. Executive Summary

F02 was executed from clean `origin/main` SHA `5c1191b3907d56622deb7c3d3c12a6012785b8c6` in dedicated branch `work/acceptance-F02-20260922`, DEV only, using the canonical DEV project `wnpfloqpjvaacobppbpk`. The authenticated browser run used the explicitly permitted local port `3010`.

The navigation/help surface is broadly functional and fail-closed. Two genuine in-scope defects were fixed and regression-tested: Manager recruitment participation was linked to an unauthorized overview route, and the recruitment overview heading contradicted the Dutch navigation label. The HR Admin Setup Assistant completion state persisted through refresh and relogin and was restored to its original incomplete state; the visibility setting was restored enabled. No Production, deployment, migration, authorization, RLS or unrelated business-data mutation occurred.

Final classification is `PARTIAL / PRODUCT_DECISION`: the specification calls for a literal `Niet meer tonen` control, but the implemented product has the canonical group-level `Setup Assistent tonen` switch and no separate literal control. The equivalent hide/re-enable lifecycle was tested; deciding whether that canonical switch satisfies the exact acceptance wording remains a product decision.

## 2. Coverage

The Functional Surface Inventory covers full-mode primary navigation, Focus navigation and bottom navigation, More, Settings categories, breadcrumbs, browser back, deep links, active state, role/module-dependent visibility, inaccessible destinations, drawers, side panels, contextual panels, tooltips, info/help affordances, empty states, setup guidance, onboarding checklist lifecycle, mobile `390x844`, keyboard/Escape interactions, dead-link/routing-loop checks and browser console/network classification.

The textual inventory and report are committed under `.artifacts/F02-20260922-001/`. Browser screenshots for desktop/mobile shells, drawers, role switching, HR-group switching and Setup Assistant are retained in the local acceptance worktree only and were deliberately excluded from the pushed branch because they contain DEV organization/persona context.

## 3. Role Matrix

| Persona/surface | Result | Evidence |
|---|---|---|
| HR Admin | TESTED | Full shell, Settings, recruitment overview, journeys, Setup Assistant, Help/HeRa, Product Updates, employee detail and mobile shell. |
| Manager in scope | TESTED | Work, employee directory, workforce, research, insights/salary surface and assigned recruitment route. |
| Employee self | TESTED | Focus routes, Focus More/bottom navigation, quick actions, direct negative routes and authorized empty Insights/Journeys behavior. |
| Act-as Employee | TESTED | HR Admin entered Focus preview for an existing employee and stopped the session; no business action was taken. |
| Manager out of scope (`DEMO-001`) | ENVIRONMENT-GATED | No separate authenticated out-of-scope persona was available without changing role boundaries; available negative checks were fail-closed. |
| Preboarding Employee | ENVIRONMENT-GATED | No dedicated authenticated preboarding persona/mail path was available; no identity or fixture data was invented. |

## 4. Functional Results

The complete row-level result is in the inventory. Primary navigation, Focus routes, Settings route catalogs, drawers and onboarding/help controls resolved without dead links or routing loops. Active states were observed on Startpagina, Werk, Medewerkers, Settings and Focus. HR Admin mobile shell and Setup Assistant mobile drawer had no horizontal overflow; Employee Focus evaluated to `innerWidth=390`, `scrollWidth=390`, `bodyScrollWidth=390`.

The Manager recruitment mismatch was found during direct verification, fixed, and retested: participation-only navigation now points to `/recruitment/assigned`, while overview permissions point to `/recruitment`. The HR Admin overview now renders `Sollicitaties`, aligned with the shell and requirements.

## 5. Negative/Security Results

Direct `/recruitment`, `/settings` and `/document-studio` checks for Employee, plus direct `/recruitment` for Manager participation, failed closed at `/geen-toegang` where the destination was not authorized. Employee direct Insights showed an authorized empty state without report data. A direct other-employee detail route returned to the bounded directory behavior without exposing private detail. Menu visibility was not treated as authorization; direct routes were checked independently.

No permission, role, RLS or server-side authorization was broadened. No token, secret, environment value or act-as URL was recorded in this report.

## 6. Mobile/Responsive Results

At `390x844`, Employee Focus navigation, bottom navigation, More, quick actions and all exercised Focus destinations remained usable with no horizontal overflow. HR Admin Startpagina, navigation drawer and Setup Assistant drawer remained usable at the same viewport. Escape closed account, HR-group, HeRa, quick-actions and Setup Assistant overlays. Full-mode desktop navigation was also checked in expanded and collapsed sidebar states.

## 7. Data/DB Readback

The run used the canonical DEV project only. The only controlled state changes were Setup Assistant completion and visibility preference checks through the normal application APIs. One first checklist item was marked complete, observed through refresh and a fresh authentication session, restored incomplete, and the assistant visibility switch was toggled off/on and left enabled. No business row was created, no shared business fixture was altered, and no database migration or Production database action was performed.

## 8. Quality Gates

| Gate | Result |
|---|---|
| Targeted navigation/recruitment regression tests | GREEN — 2 files, 5 tests |
| Strict TypeScript | GREEN |
| ESLint | GREEN |
| i18n parity | GREEN — 39 NL/EN namespaces |
| Full Vitest | GREEN — 438 files, 1,718 tests |
| Next production build | GREEN — 296/296 static pages generated |
| `git diff --check` | GREEN |
| Authenticated DEV browser | PARTIAL overall only because of the product-decision item; tested routes/negative/mobile surfaces GREEN |

The earlier 3000 browser connection loss was classified as `HARNESS_FRICTION` after the F02 server ended and an unrelated local process reclaimed that port. The dedicated F02 server on 3010 was used for the completed browser evidence.

## 9. Fixed During Run

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| F02-NAV-001 | Role/module-dependent navigation | Manager participation saw `Sollicitaties` linking to `/recruitment`, which returned `Nog geen toegang`. | Shell visibility accepted `recruitment-participation:read`, while the root page required overview permissions. | Added a shared permission-to-destination resolver; participation-only users route to `/recruitment/assigned`, overview permissions route to `/recruitment`. | `sidebar-navigation.test.ts`; Manager browser retest of assigned route and fail-closed root route. | TESTED / fixed |
| F02-COPY-001 | Navigation/help naming | HR Admin recruitment overview rendered `Recruitment` while navigation and requirements use `Sollicitaties`. | Dutch overview message diverged from the implemented shell contract. | Changed the NL overview title to `Sollicitaties`. | `recruitment-overview-dashboard.test.tsx`; HR Admin browser H1 retest. | TESTED / fixed |

## 10. Environment-Gated

| Gate | Classification | Boundary |
|---|---|---|
| Preboarding Employee | ENVIRONMENT-GATED | No dedicated authenticated persona/mail path available. |
| Manager out of scope | ENVIRONMENT-GATED | No separate authenticated out-of-scope session available without changing role boundaries. |
| Canonical browser port 3000 | HARNESS_FRICTION | Port was reclaimed by a pre-existing unrelated local server; F02 completed on explicitly permitted 3010. |

## 11. Product Decisions

The F02 specification names a literal `Niet meer tonen` control for onboarding. The current implementation instead exposes the HR-group-level Settings switch `Setup Assistent tonen`; this switch was tested for hide/re-enable behavior and left enabled. The code contains no separate literal `Niet meer tonen` control. Product must decide whether the existing canonical switch satisfies the acceptance requirement or whether a distinct actor-scoped dismissal control is required. No new persistence model or control was invented during this run.

## 12. Not Fixed

No unresolved authorization or routing defect remains from the exercised surfaces. The only unimplemented acceptance wording is the literal `Niet meer tonen` control described above; it is not silently treated as passed and remains the reason for the PARTIAL verdict.

## 13. Lessons/Patterns

- Navigation visibility and authorization must use the same permission contract, but visibility alone is never authorization.
- Direct URL checks found the Manager recruitment mismatch that menu inspection alone would have missed.
- Setup Assistant completion is actor/tenant-scoped application state and should be checked through refresh and relogin readback.
- DEV fixture labels such as `[TEST]` and `[TEST OWNER]` in Product Updates are fixture content, not product defects.
- Browser port ownership and harness connectivity must be separated from product console/network evidence.

## 14. Commits/Remote Head

The dedicated branch is `work/acceptance-F02-20260922`, based on `5c1191b3907d56622deb7c3d3c12a6012785b8c6`. Final local and remote head: `5a59bcedadee1118b1bca003c77a54756ba56761`. The branch was pushed normally to `origin`; no merge was performed.

No merge to `main`, Production deploy or Production mutation was performed.

## 15. Final Verdict

`F02 ACCEPTANCE PARTIAL — PRODUCT_DECISION` because all exercised navigation/help, role-boundary, persistence, responsive and quality gates passed, but the literal `Niet meer tonen` requirement is not implemented and requires an explicit product decision.
