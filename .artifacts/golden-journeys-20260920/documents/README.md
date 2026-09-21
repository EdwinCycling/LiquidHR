# GJ02 — Documents / Document Studio / Signing

## Verdict

**GJ02 GREEN** — one controlled document completed the canonical distribution,
dossier and internal-signing lifecycle in DEV. The authenticated Employee,
HR, Manager and negative server checks are recorded below. No Production
project, Vercel deployment, global role or RLS policy was changed.

## Scope and fixture

- Branch: `work/post-release-golden-journeys-20260920`
- Release baseline: `1.20260920.1`
- Baseline/main commit: `874098d9c0675d17774ad027c7a8b4fbadb37c39`
- DEV project: `wnpfloqpjvaacobppbpk`
- HR group: Planeten (`6ba6f1df-e376-40f2-abff-ffdf000172e1`)
- Employee: Noah Hendriks / `DEMO-035`
  (`c6b1c7a9-c250-3d19-b1a0-87e317e80b13`)
- Manager: Yara Meijer / `DEMO-028`

## Template and manifest

The normal HR Document Studio UI loaded the existing active template
`TEST DG1 Generation Acceptance`, template version
`59388dd0-022e-4617-89bc-e11888a798f2`, version 1. Its DEV readback is
`ACTIVE`, schema `liquid-hr.document-studio.native.v1`, validation `VALID`,
revision 3 and `default_dossier = true`.

The active version has an empty placeholder manifest: zero known, free and
temporal placeholders. Therefore no replace-code or optional/free/temporal
variant was invented for this acceptance run. The active version was not
edited, activated or replaced; the `/edit` route correctly remained closed
because there was no draft.

## One controlled lifecycle

The normal HR distribution workbench selected exactly one employee and created:

- Batch `1135255b-eb2d-4288-9f3c-04c6975ada49`: HTTP `201`, `COMPLETED`,
  `requested_count = 1`, `final_count = 1`, `failed_count = 0`.
- Batch item `14a236a3-d8aa-4b85-8572-16e96ff1f80d`: `FINAL`.
- Immutable snapshot `82b65813-4080-4de2-8eeb-3303fdf38b4c`: `FINAL`, PDF size
  5265 bytes, final storage key and PDF hash present.
- Resolved document JSON contained no unresolved `{{...}}`, `[[...]]` or
  angle-bracket placeholder marker.
- Exactly one dossier link points to employee document
  `2e5a82ef-3c07-474f-abfa-70e9a18f4b0f`; the linked record is a PDF with the
  generated title and `default_dossier = true`.
- The DEV same-day readback found exactly one new batch, one Noah snapshot,
  one dossier link and one Noah signing request for this lifecycle.

The distribution and signing preparation were performed through the normal
HR UI. No direct snapshot, dossier, signing-request or audience row was
fabricated.

## Employee acceptance

Noah logged in through the normal Employee fixture account.

- `/focus/documenten` showed the generated title and metadata, with no HR-only
  metadata. Focus now reuses the existing secure dossier viewer and download
  endpoint: `Bekijken` opens the PDF viewer and `Downloaden` points to the
  employee-scoped download route.
- The Employee dossier opened the target document viewer and the download
  endpoint returned the expected private-storage redirect (`307` before the
  signed-storage hop).
- `/my-signatures` showed the target request. Exactly one Employee signing click
  was made. The target request became `SIGNED`; the persisted event sequence is
  exactly `PREPARED,SIGNED`, with Noah as signer and actor. A historical second
  signed request already existed on the fixture; it was not clicked again.
- The Employee’s own document API returned the target document. The API for
  another employee returned HTTP `200` with zero rows and no target document.
- An Employee POST to the HR generation endpoint returned HTTP `403` and did
  not create a snapshot or batch.
- Desktop and mobile evidence covers Focus documents, dossier/viewer and
  signing.

## HR, act-as and Manager privacy

- HR Document Studio signing overview showed the target request as `SIGNED`.
- HR’s direct attempt to complete the Employee signing request returned HTTP
  `403` (`DOCUMENT_SIGNING_EMPLOYEE_REQUIRED`). It did not add a signing event.
- HR act-as opened Noah’s Focus context with the `NAMENS MEDEWERKER` banner,
  but no `Ondertekenen` action was available. The generated dossier record has
  an `EMPLOYEE`-only audience; it is consequently not exposed through the HR
  act-as self-document surface or to the Manager. The HR lifecycle status
  remains available through Document Studio and the server-side dossier and
  signing readback. No audience broadening was performed.
- Yara’s direct document API reads for Noah and the out-of-scope `Test test100`
  returned HTTP `403`. The out-of-scope employee route returned to the
  employee-list boundary and did not show the generated document.

## Evidence

- `distribution-run.json`
- `employee-acceptance.json`
- `role-privacy.json`
- `gj02-distribution-trace.zip`
- `gj02-employee-trace.zip`
- `template-active-view-1440x1000.png`
- `distribution-one-noah-selected-1440x1000.png`
- `distribution-final-1440x1000.png`
- `distribution-signing-prepared-1440x1000.png`
- `employee-focus-documents-1440x1000.png` and `employee-focus-documents-390x844.png`
- `employee-document-dossier-1440x1000.png` and `employee-document-viewer-1440x1000.png`
- `employee-signing-current-signed-1440x1000.png` and `employee-signing-signed-390x844.png`
- `hr-signing-overview-signed-1440x1000.png`
- `hr-act-as-noah-documents-1440x1000.png`
- `manager-focus-documents-1440x1000.png` and `manager-focus-documents-390x844.png`

Tracing was local-only against `http://localhost:3000`; no trace was taken
against a hosted or Production deployment.

## Checks

- GJ02-focused Vitest: **11 files / 20 tests passed**
- Strict TypeScript: **passed**
- ESLint: **passed**; temporary probe scripts were removed before commit
- `check:i18n`: **passed** — 39 NL/EN namespaces with equal keys
- `git diff --check`: **passed**; repository line-ending warnings only
- Production build: **passed** — Next.js generated **296/296** pages

The Focus document controls added in this slice are covered by
`components/focus/focus-documents.test.tsx`; authorization remains enforced by
the existing employee-scoped document service, API route and RLS policy.
