# F02 Functional Surface Inventory

Run ID: `F02-20260922-001`<br>
Baseline: `5c1191b3907d56622deb7c3d3c12a6012785b8c6`<br>
Branch: `work/acceptance-F02-20260922`<br>
Environment: DEV only; browser server on explicitly permitted port `3010`

Every material implemented navigation/help surface identified from the F02 specification and the authenticated DEV shells is accounted for below. `TESTED` means the route/control and its relevant authorization or interaction behavior were exercised; `NOT APPLICABLE` means the surface is not implemented or not present for the tested tenant; `ENVIRONMENT-GATED` means the specified persona or state was unavailable without inventing credentials or broadening access.

| ID | Implemented surface | Expected route/behavior | Persona/gate | Mobile expectation | Status | Evidence / result |
|---|---|---|---|---|---|---|
| NAV-01 | Full-mode Startpagina | `/dashboard/start`, active Startpagina state | HR Admin; Full | usable at 390x844 | TESTED | HR Admin desktop and 390x844; active shell link; no horizontal overflow. |
| NAV-02 | Full-mode Werk | `/work`, active state and return context | HR Admin/Manager; permission-gated | usable at 390x844 | TESTED | Manager `/work`, work-item deep link, browser back, active Werk state; HR Admin shell route also loaded. |
| NAV-03 | Full-mode Kalender | implemented `/hr-calendar` destination | HR Admin; role/module-gated | usable at 390x844 | TESTED | HR Admin `/hr-calendar` returned successfully; shell exposes Kalender. The spec's `/calendar` shorthand is not the implemented route. |
| NAV-04 | Full-mode Medewerkers | `/employees`, active state and list/detail links | HR Admin/Manager scope | usable at 390x844 | TESTED | HR Admin employee detail breadcrumb/back; Manager directory list and active Medewerkers state. |
| NAV-05 | Full-mode Organogram | `/organization-chart`, active state | HR Admin; role/module-gated | usable at 390x844 | TESTED | HR Admin route rendered the interactive organogram and shell active state. |
| NAV-06 | Full-mode Ontwikkeling | implemented `/workforce` destination | module/permission-gated | usable at 390x844 | TESTED | HR Admin and Manager `/workforce` rendered; shell label Ontwikkeling is routed to the implemented destination. |
| NAV-07 | Full-mode Sollicitaties | overview or assigned-only recruitment destination | module/permission-gated | usable at 390x844 | TESTED | HR Admin `/recruitment` rendered H1 Sollicitaties; Manager participation routes to `/recruitment/assigned`; root is fail-closed. Regression test added. |
| NAV-08 | Full-mode Journeys | `/journeys`, active state | HR Admin; role/module-gated | usable at 390x844 | TESTED | HR Admin journey list and setup-assistant entry/return exercised. |
| NAV-09 | Full-mode Onderzoeken | implemented `/research` destination | module/permission-gated | usable at 390x844 | TESTED | HR Admin and Manager `/research` rendered; shell active state observed. |
| NAV-10 | Full-mode Inzichten | `/insights`, report/query state | report permission/module gate | usable at 390x844 | TESTED | HR Admin/Manager route and Manager salary report surface exercised; Employee direct route showed authorized empty state with no report data. |
| NAV-11 | Full-mode Instellingen | `/settings`, Settings hub | HR Admin/settings permissions | drawer/navigation usable | TESTED | Settings hub, three categories, account menu, sidebar collapse/restore and Escape close exercised. |
| NAV-12 | Full-mode Document Studio | `/document-studio` | HR Admin/permission-gated | usable or explicitly gated | TESTED | HR Admin route and primary Document Studio links rendered. |
| NAV-13 | Sidebar collapse/expand | shell remains navigable and active state survives | Full shell | collapsed controls remain reachable | TESTED | Collapse/restore toggles exercised; links remained reachable and route context stayed on Settings. |
| NAV-14 | HR-group switcher | opens selector; context change is bounded | HR Admin; tenant/group scope | usable drawer | TESTED | HR-group drawer opened, options observed and Escape closed without mutation. |
| NAV-15 | Testrol wisselen | opens role switcher; allowlisted roles only | DEV test guard | usable drawer | TESTED | Allowlist showed own account, Test HR Admin, Test Manager and Test Medewerker; role switching used only existing DEV personas. |
| NAV-16 | Avatar/user menu | opens account/help/logout actions | authenticated all roles | usable overlay | TESTED | HR Admin menu showed Personal settings/Uitloggen; Escape closed it. |
| FOCUS-01 | Focus overview | `/focus` | Employee/Manager/Preboarding policy | stable Focus entry | TESTED | Employee Focus entry and route rendered; Act-as Employee preview entered and stopped cleanly. |
| FOCUS-02 | Focus profile | `/focus/profiel` | Employee self | bottom navigation reachable | TESTED | Employee route rendered Mijn profiel at 390x844. |
| FOCUS-03 | Focus leave | `/focus/verlof` | Employee self | bottom navigation reachable | TESTED | Employee route rendered Mijn verlof at 390x844. |
| FOCUS-04 | Focus requests | `/focus/aanvragen` | Employee self | bottom navigation reachable | TESTED | Employee route rendered Mijn aanvragen at 390x844. |
| FOCUS-05 | Focus team | `/focus/team` | Employee self / manager scope | mobile entry/gate | TESTED | Employee Focus route rendered Mijn team; role visibility remained bounded by shell/persona. |
| FOCUS-06 | Focus bottom navigation | visible selected state and no covered controls | Employee | 390x844 | TESTED | Focus mobile bottom navigation showed Overzicht/Werk/Team/Aanvragen/Meer and selected state; scroll width equaled viewport. |
| FOCUS-07 | Focus More menu | More destinations and close/back behavior | Employee | 390x844 drawer | TESTED | `/focus/meer`, all observed More destinations, quick-actions panel and Escape close exercised. |
| SETTINGS-01 | Settings primary navigation | Settings sections/tabs navigate without dead ends | HR Admin; settings permissions | 390x844 | TESTED | Settings hub and Organisatie & toegang category route catalog rendered. |
| SETTINGS-02 | Settings module navigation | module catalog/settings route and module gates | HR Admin; module config | mobile drawer/sections | TESTED | HR-inrichting route catalog rendered; Platform & uitbreidingen was exercised and had no additional visible child route for this DEV context. |
| SETTINGS-03 | Setup Assistant entry | `/settings/setup-assistant` plus floating entry | HR Admin `settings:read` | fullscreen/usable drawer | TESTED | Settings route, floating edge trigger, drawer and 390x844 setup surface rendered. |
| HELP-01 | Wat is nieuw / Product Updates drawer | opens and closes; links are live | authenticated; permission-safe | usable overlay | TESTED | HR Admin update drawer opened/closed; DEV fixture cards were visible and treated as fixture content. |
| HELP-02 | HeRa contextual panel | opens contextual help/AI panel; no unauthorized data | role/module dependent | panel usable at 390x844 | TESTED | HeRa panel opened with disabled empty prompt state and closed without exposing data or mutating state. |
| HELP-03 | HR Admin onboarding sidepanel | initial visibility, close/reopen, checklist state | HR Admin | mobile fullscreen/usable | TESTED | Setup Assistant initial visibility, open/close/reopen and 390x844 layout exercised. |
| HELP-04 | Setup/onboarding checklist CTAs | every visible CTA has valid route and correct gate | HR Admin | CTA reachable | TESTED | Visible Afdelingen, Functies, Rollen & autorisaties and related-role links had live routes; no CTA was activated to mutate business data. |
| HELP-05 | Checklist lifecycle | incomplete/completed detection, refresh/relogin persistence | HR Admin actor/tenant scope | state remains usable | TESTED | First checklist item marked complete, persisted across refresh and relogin, then restored incomplete; no business row created. |
| HELP-06 | Literal `Niet meer tonen` control | exact label/control requested by spec | HR Admin | control reachable | NOT APPLICABLE | The literal control is not implemented in the current surface; this is recorded as an explicit product decision boundary. The canonical group-level `Setup Assistent tonen` control is covered by HELP-06A. |
| HELP-06A | Setup Assistant visibility toggle | hide/re-enable and persisted visibility | HR Admin/settings write | control usable at 390x844 | TESTED | `/settings/setup-assistant` switch disabled the floating trigger, `/journeys` confirmed it hidden, then switch re-enabled it; final DEV state is enabled. |
| HELP-07 | Tooltips/info affordances | explanatory content appears on hover/focus and is translated | authenticated roles | focus/keyboard usable | TESTED | Start-page view control title/hover affordance exercised; labels came from NL messages; keyboard Escape behavior covered for menus/panels. |
| HELP-08 | Empty-state CTAs/setup guidance | CTA route, copy and permission/module guidance are correct | all relevant roles | no covered CTA | TESTED | Recruitment empty overview, Employee Insights empty report state and Setup Assistant guidance rendered without unauthorized CTA leakage. |
| NAV-17 | Breadcrumbs | correct hierarchy, links and active page | nested routes | wraps/usable | TESTED | Employee detail breadcrumb to Medewerkers and return to detail via browser back; work deep link also preserved context. |
| NAV-18 | Back links/browser back | returns to prior route and preserves supported query/filter state | relevant roles | no dead end | TESTED | Manager work detail and HR Admin employee detail back behavior succeeded; drawer Escape/back behavior succeeded. |
| NAV-19 | Direct/deep links | route renders or fails closed without menu prerequisite | role matrix | no loop/overflow | TESTED | Direct Focus, work detail, recruitment assigned/root, settings and employee routes independently checked. |
| NAV-20 | Active navigation state | current route/subroute selected consistently | all shells | visible at 390x844 | TESTED | Active Startpagina/Werk/Medewerkers/Settings and Focus selected states observed. |
| NAV-21 | Inaccessible destinations | `/geen-toegang` fail closed with no leak | Manager/Employee negative paths | no redirect loop | TESTED | Employee direct Settings/Document Studio/Recruitment root and Manager recruitment root failed closed; no unauthorized detail/report data exposed. |
| NAV-22 | No dead links/routing loops | inventoried links produce intended destination | all applicable | n/a | TESTED | Primary shell, Focus, Setup Assistant and tested Settings links resolved; no routing loop observed. |
| NAV-23 | Keyboard/basic interaction | Tab/focus, Enter, Escape, drawer close/focus restore where material | all applicable | keyboard remains usable | TESTED | Escape closed account, HR-group, HeRa, quick-actions and Setup Assistant overlays; buttons and switches were keyboard-addressable through semantic controls. |
| NAV-24 | Console/network quality | no unexpected product errors; runner friction separated | all browser flows | n/a | TESTED | Current authenticated 3010 session had no browser error output after clear; earlier 3000 connection loss was isolated as harness friction, not product evidence. |

## Explicit environment gates

| Surface/persona | Status | Reason |
|---|---|---|
| Preboarding Employee | ENVIRONMENT-GATED | No dedicated authenticated preboarding persona/mail path was available for this run; no identity or business data was invented. |
| Manager out of scope (`DEMO-001`) | ENVIRONMENT-GATED | No separate authenticated out-of-scope Manager session was available without changing role boundaries; negative authorization was covered through the available Manager/Employee fail-closed routes. |
