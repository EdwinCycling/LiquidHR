# LiquidHR — DG2 + DG3 Documents & Signing

**Status:** DEVELOPMENT ACCEPTANCE GREEN — dev/test applied; not released
**Baseline:** `main` / `6484b12d4a01d9b1433496cb8cce4828ceab6c97`
**Branch:** `work/document-studio-dg2-dg3-implementation`

## 1. Reconciliation with the baseline

DG1 already provides the trusted single-employee generation flow:

- active native Document Studio template resolution;
- known, temporal and free placeholder resolution;
- immutable PREVIEW → FINAL PDF snapshots;
- idempotent generation/finalization;
- optional exactly-once linkage into `employee_documents`;
- HR Admin generation history and controlled download.

DM-1 already owns the native template model and atomic free placeholders. DG2/DG3 do not change that model, the renderer, the DG1 RPC contracts or accepted editor behaviour. The current baseline contains no Word/DOCX replace-code adapter; introducing one here would reopen the explicitly excluded DM-1 import/export work, so this candidate keeps the agreed template concepts intact and routes distribution through the accepted native/DG1 path.

The repository baseline did not contain a separate DG2/DG3 requirement file. This document records the bounded delta derived from the frozen delivery scope supplied for this implementation run.

## 2. Frozen delta

### DG2 — distribution and visibility

- HR Admin can send one active document template to a selected employee group in one controlled batch.
- A batch stores only operational request metadata; each recipient still receives an independent DG1 snapshot and immutable PDF artifact.
- Free/custom placeholders are entered once for the batch and are applied to every recipient. Unresolved values remain a blocking generation error; they are never silently omitted.
- HR Admin gets batch/recipient status and failure visibility.
- Final documents continue through the existing employee-dossier bridge. Employee self-read is enabled only for an explicitly audience-linked document; no broad document exposure is introduced.
- Manager visibility is limited to the existing management-scope authorization and the explicitly included signing/status overview. It does not grant HR Admin template or distribution write access.

### DG3 — internal signing

- HR Admin can prepare an internal signing request for a finalized DG1 artifact.
- The employee can read and complete their own pending internal signing request.
- HR Admin and authorized managers can read signing status within their existing HR-group/employee management scope.
- Signing is an immutable status transition with an event trail. This phase has one internal employee signer per generated artifact.
- `provider_code = INTERNAL` is the only executable provider. The provider-neutral reference fields are an architectural seam for a later external-signing phase; no external provider, webhook, invitation or remote signature service is added here.

## 3. Explicit non-goals

- No Payroll, AI Everywhere, sidebar redesign or unrelated refactor.
- No DOCX/Word import/export change; existing Word/replace-code concepts remain represented by the accepted template/editor model.
- No redesign of DM-1 or DG1.
- No production Supabase change, merge to `main`, production deploy, version bump or Production acceptance.

## 4. Vertical implementation order

1. Additive schema, RLS, grants, authorization functions and audit contracts.
2. Server-only batch orchestration over the existing DG1 preview/finalize seam.
3. HR Admin distribution/overview UI and internal signing preparation/status UI.
4. Employee self-signing and scoped start-page visibility.
5. Targeted contract/domain tests, strict typecheck, i18n and relevant browser checks.
