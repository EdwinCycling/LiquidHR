# PERF-QSET-01 — Optional question sets for performance reviews

Status: locally implemented; hosted acceptance and release remain open.
Product source: [GitHub issue #104](https://github.com/EdwinCycling/LiquidHR/issues/104).
Implementation baseline: PERF-V2-01 on `origin/main` SHA `96139de19eeb9eebf11d80a3d7f1ed6f9ccff083`.

## Product boundary

Performance review question sets are an optional tenant module, `PERFORMANCE_REVIEW_QUESTION_SETS`, and an optional round setting. Both remain off by default. V1/V2 review fields and workflow stay usable without a set. When a set is selected, the assigned role receives a separate **Questions** section below the existing review fields.

Only HR Admin manages question sets and assigns them to rounds or participants. Managers, additional reviewers and employees answer only the immutable questions assigned to their own dossier role. Question sets and personal answers remain in performance review records; Survey and eNPS tables and their privacy contracts are unchanged.

## Functional contract

- HR Admin can search, create, edit, duplicate, preview, publish and archive question sets within the active HR-group scope. A set contains at least one question and keeps an ordered definition, version and audit trail.
- Supported types are short text, long text, single choice, multiple choice, yes/no or agree/disagree, scale 1–4/1–5/1–10 with optional localized labels, and choice or scale matrices.
- The builder's preview supports Employee, GV and AB display, NL/EN, desktop/mobile width, required-answer checks and temporary answer entry. Preview state is client-only and is discarded on close.
- A round can optionally select independent Employee, GV and AB defaults. Before publication HR Admin can override a set or choose no set per participant and role, then restore the round default and review the effective assignments.
- Publication copies the selected set name, source identity/version and complete ordered question definition into a dossier/role snapshot. Later set edits or archive actions do not change existing snapshots. New participants on an active round use the published defaults; an explicit HR override applies before their dossier is started. A dossier without an AB has no AB snapshot or task.
- Answers are saved as drafts through the existing role workflow and can be resumed by their author. Required answers are checked on final submission. Existing immutable submission and audit behavior applies to final answers. Draft archives carry question answers during the existing reviewer reassignment flow.
- Authorization is checked in server services and database RPCs. RLS scopes set management to HR Admin, and question snapshots to HR Admin or the dossier's own Employee/GV/AB role. No direct client writes are granted to question-set, snapshot or override tables.

## Data and component boundaries

Migration `20261127140000_performance_review_question_sets.sql` adds the module code, set/audit/config/snapshot tables, server RPCs, RLS and snapshot/answer guards. `question_answers` are stored in `performance_review_submissions` and `performance_review_draft_archives`, never in Survey/eNPS data.

The question schema and renderer are performance-review-specific. Existing Research survey and eNPS builders carry survey campaign, anonymization or separate lifecycle contracts, and the Forms Studio runtime owns process tasks; reusing those domain components would couple personal review answers to the wrong ownership or workflow. The implementation follows their localized question patterns and uses existing LiquidHR UI primitives while keeping review authorization, answer storage and workflow in the performance-review domain.

## Acceptance and release boundary

Local implementation evidence is recorded in [`PERF-QSET-01-LOCAL-20261127.md`](../../quality/acceptance/runs/PERF-QSET-01-LOCAL-20261127.md). PGlite migration and role-scope contracts, strict TypeScript, ESLint, i18n, Vitest and production build are required local gates. This feature branch does not apply the migration to Core TEST, run live persona/browser acceptance, merge to `main`, push to GitHub or deploy to Vercel. Those remain separate actions under the repository's authorization rules.
