# LiquidHR AI Everywhere V1

## Scope

AI Everywhere V1 exposes exactly four proposal-only capabilities through the existing AI Foundation:

- `EMPLOYEE_SUMMARY` — “Vat medewerker samen” on the employee overview.
- `CONVERSATION_PREPARATION` — “Bereid gesprek voor” on the employee overview.
- `DEVELOPMENT_GOAL_SMART` — “Maak doel SMART” in the development-goal editor.
- `VACANCY_DRAFT` — “Schrijf vacaturetekst” in the vacancy editor.

Summary and conversation preparation are read-only outputs. SMART goals and vacancy text can only replace the active local form value after explicit human action; no AI action saves, publishes, changes status, or overwrites persisted data automatically.

## Data and safety contract

All four capabilities use the server-side AI Foundation lifecycle, `ai:use`, the feature-specific business permission, Liquid Credits and existing audit/usage recording. Context is loaded server-side and reduced to the minimum required fields. Employee summary and conversation preparation exclude absence, medical and protected HR context and do not produce performance scores, classifications or disciplinary advice. Vacancy generation must not invent salary, benefits, employment conditions, skills or company facts.

The provider receives only structured authorized context and a server-owned prompt. Provider output must be the canonical `PROPOSAL` shape with `requiresHumanReview: true`; the browser never receives provider credentials or internal metadata.

## Delivery boundary

The implementation is a candidate on isolated branch `work/ai-everywhere-v1` and worktree `C:\Users\Edwin\Documents\Apps\LiquidHR-AI1`, based on the freshly fetched `origin/main` baseline recorded in delivery documentation. The credit catalog migration is source-only until separately authorized for remote application. No main merge, version bump, production deployment or remote database mutation is part of this requirement.
