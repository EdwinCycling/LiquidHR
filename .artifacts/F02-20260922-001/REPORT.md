# F02 Acceptance Report — Navigation / Sidepanel / Help

## 1. Executive Summary

F02 was executed from clean `origin/main` SHA `5c1191b3907d56622deb7c3d3c12a6012785b8c6` in dedicated branch `work/acceptance-F02-20260922`, DEV only, using the canonical DEV project `wnpfloqpjvaacobppbpk`. The authenticated browser run used the explicitly permitted local port `3010`.

The navigation/help surface is functional and fail-closed. Three genuine in-scope defects were fixed and regression-tested: Manager recruitment participation was linked to an unauthorized overview route, the recruitment overview heading contradicted the Dutch navigation label, and the HR Admin Setup Assistant lacked the required contextual hide action. The Setup Assistant hide action now reuses the canonical visibility setting; completion state remained unchanged and the final visibility setting was restored enabled. No Production, deployment, migration, authorization, RLS or unrelated business-data mutation occurred.

Final classification is `GREEN`. The prior product ambiguity is resolved: `Niet meer tonen` is a contextual hide action inside the Setup Assistant, while the existing `Setup Assistent tonen` Settings control remains the administrative/user re-enable path. Both paths use the existing canonical persistence mechanism and the hide, refresh, relogin, Settings and re-enable lifecycle was proven in DEV.

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

At `390x844`, Employee Focus navigation, bottom navigation, More, quick actions and all exercised Focus destinations remained usable with no horizontal overflow. HR Admin Startpagina, navigation drawer, Settings and Setup Assistant drawer remained usable at the same viewport; the Setup Assistant exposed `Niet meer tonen` without overflow. Escape closed account, HR-group, HeRa, quick-actions and Setup Assistant overlays. Full-mode desktop navigation was also checked in expanded and collapsed sidebar states.

## 7. Data/DB Readback

The run used the canonical DEV project only. The only controlled state changes were Setup Assistant completion and visibility preference checks through the normal application APIs. One first checklist item was marked complete, observed through refresh and a fresh authentication session, restored incomplete, and the assistant was hidden through `Niet meer tonen`, observed hidden after refresh and relogin, then re-enabled through Settings and left enabled. The regression coverage confirms the sidepanel action and Settings form both call the same existing `/api/setup-assistant` setting path; the service coverage retains the same `setup_guide_settings` conflict target, with no second preference model or duplicate configuration path introduced. No business row was created, no shared business fixture was altered, and no database migration or Production database action was performed.

## 8. Quality Gates

| Gate | Result |
|---|---|
| Targeted navigation/setup-assistant regression tests | GREEN — 5 files, 14 tests |
| Strict TypeScript | GREEN |
| ESLint | GREEN |
| i18n parity | GREEN — 39 NL/EN namespaces |
| Full Vitest | GREEN — 438 files, 1,718 tests |
| Next production build | GREEN — 296/296 static pages generated |
| `git diff --check` | GREEN |
| Authenticated DEV browser | GREEN — hide, refresh, relogin, Settings disabled state, re-enable, checklist preservation and 390x844 usability proven |

The earlier 3000 browser connection loss was classified as `HARNESS_FRICTION` after the F02 server ended and an unrelated local process reclaimed that port. During the long-lived 3010 dev session, the server log also emitted one transient Next.js webpack module/client-render fallback; a fresh 3010 server and authenticated `/dashboard/start` request reproduced no browser or server error, so this was classified as `HARNESS_FRICTION`, not a product defect. The dedicated F02 server on 3010 was used for the completed browser evidence.

## 9. Fixed During Run

| ID | Area | What broke | Why | Fix | Regression | Result |
|---|---|---|---|---|---|---|
| F02-NAV-001 | Role/module-dependent navigation | Manager participation saw `Sollicitaties` linking to `/recruitment`, which returned `Nog geen toegang`. | Shell visibility accepted `recruitment-participation:read`, while the root page required overview permissions. | Added a shared permission-to-destination resolver; participation-only users route to `/recruitment/assigned`, overview permissions route to `/recruitment`. | `sidebar-navigation.test.ts`; Manager browser retest of assigned route and fail-closed root route. | TESTED / fixed |
| F02-COPY-001 | Navigation/help naming | HR Admin recruitment overview rendered `Recruitment` while navigation and requirements use `Sollicitaties`. | Dutch overview message diverged from the implemented shell contract. | Changed the NL overview title to `Sollicitaties`. | `recruitment-overview-dashboard.test.tsx`; HR Admin browser H1 retest. | TESTED / fixed |
| F02-HELP-001 | Setup Assistant contextual visibility | HR Admin onboarding sidepanel had no user-facing `Niet meer tonen` action distinct from Settings. | The acceptance wording required a contextual hide action, while the existing Settings switch is the re-enable mechanism. | Added NL/EN sidepanel action using the existing `PATCH /api/setup-assistant` canonical `isEnabled` setting; hide closes and removes the trigger, while Settings retains re-enable. | `setup-assistant-floating.test.tsx`, `setup-assistant-settings-form.test.tsx`, `service.test.ts`; DEV browser hide/refresh/relogin/Settings/re-enable and 390x844 retest. | TESTED / fixed |

## 10. Environment-Gated

| Gate | Classification | Boundary |
|---|---|---|
| Preboarding Employee | ENVIRONMENT-GATED | No dedicated authenticated persona/mail path available. |
| Manager out of scope | ENVIRONMENT-GATED | No separate authenticated out-of-scope session available without changing role boundaries. |
| Canonical browser port 3000 | HARNESS_FRICTION | Port was reclaimed by a pre-existing unrelated local server; F02 completed on explicitly permitted 3010. |

## 11. Product Decisions

`PRODUCT_DECISION RESOLVED`. The prior ambiguity was whether the existing Settings control `Setup Assistent tonen` could stand in for the specification's literal `Niet meer tonen` action. The final product contract is explicit: `Niet meer tonen` is a contextual hide action inside the Setup Assistant; `Setup Assistent tonen` remains the Settings re-enable mechanism. The implementation uses the existing scope semantics and canonical `setup_guide_settings.is_enabled` persistence path. No second preference model, duplicate state or authorization broadening was introduced.

## 12. Not Fixed

No unresolved in-scope authorization, routing or Setup Assistant product defect remains from the exercised surfaces. Preboarding Employee and the separate out-of-scope Manager persona remain explicitly environment-gated as documented; they are not defects in this run.

## 13. Lessons/Patterns

- Navigation visibility and authorization must use the same permission contract, but visibility alone is never authorization.
- Direct URL checks found the Manager recruitment mismatch that menu inspection alone would have missed.
- Setup Assistant completion is actor/tenant-scoped application state and should be checked through refresh and relogin readback.
- DEV fixture labels such as `[TEST]` and `[TEST OWNER]` in Product Updates are fixture content, not product defects.
- Browser port ownership and harness connectivity must be separated from product console/network evidence.

## 14. Commits/Remote Head

The dedicated branch is `work/acceptance-F02-20260922`, based on `5c1191b3907d56622deb7c3d3c12a6012785b8c6`. The prior acceptance payload was pushed normally to `origin`; this product-decision fix and its reporting are committed and pushed normally after the bounded post-fix gate. The exact final branch tip is printed in the acceptance response because this report is itself part of the branch history. No merge was performed.

No merge to `main`, Production deploy or Production mutation was performed.

## 15. Final Verdict

`F02 ACCEPTANCE GREEN` — the previously blocked `Niet meer tonen` scenario is implemented, regression-tested and proven through hide, refresh, relogin, Settings re-enable, persistence, checklist preservation and mobile behavior.
