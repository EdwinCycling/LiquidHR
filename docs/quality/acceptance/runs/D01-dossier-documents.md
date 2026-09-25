# D01 — Dossier / Documents acceptance

- **Run ID:** `D01-20260924`
- **Run date:** 2026-09-24 to 2026-09-25
- **Status:** GREEN WITH UNRELATED BASELINE TYPECHECK/BUILD EXCEPTION
- **Branch:** `work/acceptance-D01-20260924`
- **Worktree:** `.codex-worktrees/acceptance-D01-20260924`
- **Base SHA:** `3f9de359c76524306de057455861da734217f252`
- **Final SHA:** verified as the remote branch HEAD in the D01 close-out
- **Environment:** SINGLE_TEST_ENVIRONMENT; shared Supabase test project `wnpfloqpjvaacobppbpk`
- **Version:** `1.20260923.1` (unchanged)
- **Deployment:** none; no merge, deployment, or version bump

## Result

The D01 dossier flow passed the tested category, DOCUMENT custom-field, HR upload, scoped Manager upload, Employee/Manager Full and Focus access, salary gate, expiry/reminder, file validation, delete/restore, and database/storage checks. Ordinary defects found during those scenarios were fixed and retested. No D01 document, audience, reminder, or storage orphan remained in the readback.

The only final quality exception is the pre-existing strict TypeScript failure in two unchanged absence-service files. The production build compiled, then stopped at those same errors. Per the D01 acceptance criteria, this is reported separately and is not changed in this scoped branch.

## Functional Surface Inventory

- **Dossier UI:** `/employees/[employeeId]` Documents tab; list, upload, detail, metadata editing, download/preview, soft delete and restore.
- **Settings UI:** `/master-data` document categories; Settings → Vrije velden → Document (dossier).
- **Focus UI:** `/focus/documenten`, reading the same employee-document domain and authorization services.
- **API:** employee document list/create, metadata update, download and same-origin preview; document-category list/create/update/delete.
- **Services/RPCs:** `create_employee_document_metadata_atomic`, `get_accessible_employee_document_custom_fields`, `can_access_document`, `can_access_employee_dossier`, `can_manage_employee`, and canonical reminder services.
- **Tables:** `document_categories`, `employee_documents`, `document_audiences`, `employee_document_acknowledgements`, `custom_field_definitions`, `custom_field_select_options`, and canonical reminder tables.
- **Storage:** private `employee-documents` bucket with authenticated, dossier-scoped policies.
- **Security:** table RLS is enabled for document/category/audience rows and storage objects. The recursion helper is actor-bound, `SECURITY DEFINER`, has fixed empty `search_path`, and has no anon execute grant. The salary gate remains in the canonical access check.
- **Other behaviors:** expiry/reminders and soft delete are implemented. Acknowledgement is not exposed in the Dossier UI.

## Personas and browser scenarios

| Actor | Scenario and result |
|---|---|
| HR Admin (`hradmin.fixture`) | Created/edited/deactivated/reactivated categories; created DOCUMENT fields; uploaded basic, extended, date/reminder, and salary-sensitive documents; edited metadata; opened/downloaded; deleted and restored a document. |
| Manager Yara, in scope | Opened Noah's dossier in Full and Focus; uploaded a document through the real browser file chooser; edited/verified scoped data; saw Manager-READ fields and not HIDDEN fields; reminder creation succeeded through the document flow. |
| Manager Yara, out of scope | Direct Full route returned to the employee list containing only in-scope employees. SQL negative regression rejected out-of-scope document creation/access. |
| Employee Noah, owner | Opened own Full and Focus dossier and a same-origin preview. Allowed fields appeared; employee-HIDDEN, HR-only, and salary-sensitive fields/documents did not. |
| Different employee | SQL/RLS checks returned no access to Noah's or Yara's representative documents or storage. |
| Anonymous | No category/document access; private storage and authenticated RPC grants deny access. |

The D01 UI exercised `EMPLOYEE` and `MANAGEMENT_ROLE` audience behavior. `DEPARTMENT_BRANCH` was not forced through a UI flow that does not expose that target. Direct CUA calls that returned `ERR_BLOCKED_BY_CLIENT` are recorded as browser-harness failures, not misreported as HTTP denials; database/RLS negative checks supplied the access-denial evidence.

## Categories

The three required categories were created through Settings and read back after reload:

| Name | Code | Salary permission | Result |
|---|---|---:|---|
| D01 Algemeen D01-20260924 | `d01_general_d01-20260924` | false | Active; persisted and editable |
| D01 Tijdelijk en verval D01-20260924 | `d01_expiry_d01-20260924` | false | Active; persisted |
| D01 Vertrouwelijk beloning D01-20260924 | `d01_salary_d01-20260924` | true | Active; salary gate verified |

Settings edit, active/inactive, required-value validation, delete guard, duplicate rejection and database readback passed. An earlier uppercase duplicate (`D01_GENERAL_D01-20260924`) was created by the pre-fix UI, which uppercased codes while the unique constraint compared case-sensitively. It is an identifiable D01 test row, has no linked documents, and remains active. The fix canonicalizes codes to lowercase and returns a localized conflict response; it prevents new duplicates. No unrelated category was changed.

## DOCUMENT custom fields

Settings created and persisted the eight requested definitions and one additional field because the UI exposed `AUTO_INCREMENT` for DOCUMENT:

| Key | Type | HR | Manager | Employee | Notes |
|---|---|---|---|---|---|
| `d01_reference` | TEXT | WRITE | READ | READ | Required |
| `d01_internal_context` | TEXTAREA | WRITE | READ | HIDDEN | Hidden from employee payloads |
| `d01_score` | NUMBER | WRITE | READ | READ | |
| `d01_review_date` | DATE | WRITE | READ | READ | |
| `d01_verified` | BOOLEAN | WRITE | READ | READ | |
| `d01_classification` | SELECT | WRITE | READ | READ | `INTERNAL`, `EMPLOYEE`, `CONFIDENTIAL` |
| `d01_topics` | MULTI_SELECT | WRITE | READ | READ | `CONTRACT`, `POLICY`, `TRAINING`, `COMPLIANCE` |
| `d01_hr_only_note` | TEXT | WRITE | HIDDEN | HIDDEN | Not returned to unauthorized actors |
| `d01_auto_number` | AUTO_INCREMENT | WRITE | HIDDEN | HIDDEN | UI-exposed option; persisted |

Definitions and options survived reload. D01 values are stored in the canonical `employee_documents.custom_fields` JSON object. Metadata edits updated TEXT, NUMBER, DATE, BOOLEAN, SELECT and MULTI_SELECT values while unchanged values remained stable. Unit coverage rejects invalid number/date/options, duplicate multi-select values, missing required values, and unauthorized writes. Role-filtered readback proves HIDDEN values are absent from the returned payload, not merely hidden with CSS. The current Settings UI stores all tested fields with `sort_order=0` and does not expose explicit reordering.

## Upload fixtures and file validation

Generated deterministic, harmless fixtures under `.artifacts/D01-20260924/fixtures/`; all are gitignored and uncommitted.

| Fixture | Result |
|---|---|
| `D01-basis.pdf` | Accepted; 786 bytes; `application/pdf`; SHA-256 `b47133fb0f94f7597b9e0d14f6005815af023247f2acc604c73f7b8eb0093c30` |
| `D01-notitie.txt` | Accepted; 132 bytes; `text/plain`; SHA-256 `0f58285641452a44984264bc09004d3f10a84c0d19020db2fedfc6bbd331dc14` |
| `D01-afbeelding.png` | Accepted; 70 bytes; `image/png`; SHA-256 `be91bf3f81ab4615941b6e78de7c3d32cb469e4c0e4e441d289944cceceb01e9` |
| `D01-document.docx` | Accepted; 1,024 bytes; DOCX MIME; SHA-256 `37c6cb748ccb6951d0311b2ac5d5579d0f81cd0f1e38f07475f3dac63849f6c8` |
| Zero-byte `.txt` | Rejected with a localized empty-file message; no document/audience/reminder/storage row |
| Unsupported inert `.exe` | Rejected with localized unsupported-type message; no residue |
| Malformed PDF | Rejected by server with `DOCUMENT_TYPE_INVALID`; form remained usable; no residue |
| File over 25 MiB | Rejected with localized size-limit message; no residue |
| Duplicate basename | Accepted as a separate document with a distinct UUID storage key |
| Unicode filename | Accepted; original name preserved; storage name safely sanitized |
| Long filename | Accepted; original metadata preserved; storage filename bounded to 180 characters |
| Path-like filename | Accepted safely; path segments removed from storage filename |

For successful rows, database and storage readback matched original filename, MIME, size, checksum, storage key and category. Authorized open/download was tested. The bucket is private. Negative cases left zero `employee_documents`, audience, reminder, or storage artifacts. The complete D01 readback showed 12 D01 document rows after restore, all with a matching storage object, no unlinked D01 reminder, and no D01 object without a document row.

## HR upload, metadata, expiry and reminder

- HR basic PDF upload to D01 Algemeen succeeded through the real browser. Category, employee, original filename, MIME, size, checksum, storage object, actor and database/UI reload matched.
- Extended TXT/DOCX uploads persisted description, tags, category, expiry, audience and canonical custom-field values. The extended TXT metadata update retained unchanged values and changed representative TEXT, NUMBER, DATE, BOOLEAN, SELECT and MULTI_SELECT values.
- Initial upload regression: the form regression test asserts that DATE custom fields, `expires_on`, and reminder data are in the canonical initial-upload request. A real native browser date-input interaction uploaded HR record `18c4e1a0-...`; database readback shows `d01_review_date=2026-11-30`, `expires_on=2027-01-31`, and one linked PUBLISHED reminder for `2027-01-01 08:00Z`. Reloaded UI showed the same values. With native input events, the reported mismatch did not reproduce; no UI-only or parallel storage workaround was introduced.
- Expiry states exercised: no expiry, more than 30 days, within 30 days, tomorrow (`2026-09-26`), today (`2026-09-25`), and past (`2026-09-24`). The UI and DB reflected the final values after reload. The PNG currently expires `2026-10-10` (within 30 days). No unsupported expiry behavior was inferred.
- HR TXT reminder: linked, PUBLISHED, correct target/rules/recipients, no duplicate on refresh. D01 HR date record: one linked PUBLISHED reminder. There were three D01 reminders in final readback; every reminder linked to a D01 document.

## Manager upload and access

Manager Yara uploaded for in-scope employee Noah through the real browser. Document `c2fb7324-e9ad-4bed-b6b3-df3c7ba50f13` uses `D01-notitie.txt`, `text/plain`, 132 bytes and the matching SHA-256. The database records Yara as actor and Noah as subject; management and employee audiences, storage object, canonical metadata and linked PUBLISHED reminder were read back. The document remained visible after reload in Manager Full/Focus and Employee Noah's own dossier.

An out-of-scope Manager route returned to the employee list and showed only scoped rows. The SQL contract rejected a forged/out-of-scope create. The Manager reminder fix permits only the single EMPLOYEE reminder target for the document subject under the already validated scoped document-write path; wrong-person or multi-target requests remain denied. No global Manager `reminder:write` or document-write grant was added.

## Salary-sensitive document and privacy

HR uploaded salary document `dffb1694-3907-4b6f-8152-36d09195e581` to the salary-required D01 category. The storage object, metadata and audience rows were read back; HR with `salary:read` could preview/download. Employee Noah did not see the document in Full or Focus. SQL negative checks prove an actor with audience membership but without salary permission cannot access the document or storage object. Manager Yara has `salary:read`, so she is not used as the negative salary actor.

Employee and Manager Full/Focus lists and details returned only role-allowed custom fields. `d01_internal_context` is visible to an in-scope Manager but absent for Employee; `d01_hr_only_note` is absent for both. Hidden values remain canonical for authorized HR but are not returned to unauthorized actors. Storage open/download follows the same effective document authorization.

## Delete and restore

The HR UI soft-deleted D01 PDF `c78842f5-2804-486d-8e7e-1c41de6c461d`, confirmed normal-list disappearance and read back `deleted_at`, `deleted_by_user_id`, `delete_reason`; the private storage object remained per current behavior. HR then used the UI restore action. Final DB readback shows the three deletion fields null, the object still present, and the document visible again. No restore feature was invented; this behavior already existed.

## 42P17 and migration lineage

Read-only diagnosis established the exact recursion: category read policy checked `employee_documents`, and the document salary-gate policy referenced categories again. The minimal fix is the actor-bound `internal_security.employee_has_accessible_document_category(uuid)` helper plus category policy delegation through `current_employee_id()` and `can_access_document()`. The helper uses a fixed empty `search_path`, has `SECURITY DEFINER` only for this required policy-boundary check, and grants execution to authenticated users only. An authenticated category read now succeeds without `42P17`; anon sees zero categories. The salary gate remains enforced in the canonical access function.

All five D01 migration logical names exist in remote history. The remote history versions are server-stamped and differ from local filename timestamps, but names and desired canonical state match. No migration history was edited and no applied migration was reapplied. A clean database can reach the same intended state through the repository's current ordered migrations; no convergence migration is needed.

| Local migration | Remote history name |
|---|---|
| `20260924090000_d01_document_access_and_metadata.sql` | `d01_document_access_and_metadata` |
| `20260924093000_d01_document_policy_recursion_fix.sql` | `d01_document_policy_recursion_fix` |
| `20260924093600_fix_d01_document_reminder_id_ambiguity.sql` | `fix_d01_document_reminder_id_ambiguity` |
| `20260924143533_fix_d01_document_actor_audience_scope.sql` | `d01_document_actor_audience_scope` |
| `20260925091348_allow_scoped_document_expiry_reminders.sql` | `allow_scoped_document_expiry_reminders` |

Read-only post-apply inspection confirmed document/category/audience/storage RLS, helper/function definitions and grants. The reminder helper only adds the scoped subject-target exception; other targets continue to require general reminder permission. No service-role bypass or broad grant was introduced. The rollback-only SQL regression completed successfully and left no fixture records.

## Bugs fixed and verification

| Bug | Root cause | Fix | Regression and retest | Status |
|---|---|---|---|---|
| Category read raised `42P17` | RLS policy recursion through the salary gate | Actor-bound private helper and narrow category policy; one forward migration | SQL authenticated/anon read; live function/policy/grant readback | Fixed; migration applied once |
| Dossier list raised `42501` / hidden-field exposure risk | Direct select included restricted `custom_fields` | Use the canonical actor-filtered custom-field RPC | Component/service tests plus Employee/Manager Full and Focus payload/UI checks | Fixed |
| Reminder create had ambiguous `reminder_id` | Local PL/pgSQL identifier collided with target-rule column | Rename local variable to `document_reminder_id` | SQL contract and three linked live reminder readbacks | Fixed |
| Manager upload with expiry failed at nested reminder permission | Scoped document path reached helper requiring generic `reminder:write` | Permit only one reminder target equal to the scoped document subject | SQL allows in-scope subject, rejects wrong/multiple target; real Manager upload and readback | Fixed; no global permission added |
| Implicit uploader audience could miss complete scope validation | Actor/subject active, tenant and HR-group checks were incomplete | Enforce active same-tenant, same-HR-group actor/subject scope in canonical write path | SQL forged/out-of-scope checks; Manager audit/audience readback | Fixed |
| Category duplicate could persist with different casing | UI uppercased codes but uniqueness was case-sensitive | Lowercase canonicalization and localized conflict response | API/category schema tests; browser duplicate rejected; DB readback | Fixed; one earlier D01-only duplicate remains unlinked |
| Category Settings lacked supported lifecycle controls | UI did not expose complete edit/active/delete-guard behavior | Extend existing category manager UI with edit, state and salary controls | Component/API tests and real Settings create/edit/state/validation flow | Fixed |
| Manager Focus list could include employees outside current management scope | Grouping did not filter through canonical manager scope | Filter using existing scope service | Focus tests and Yara in-scope/out-of-scope browser/SQL checks | Fixed |
| Focus document action row collapsed title at mobile width | Actions and title competed in one narrow row | Use a second responsive action row | Browser at 390×844: no horizontal overflow; title width 268 px | Fixed |
| Document preview was blank under framing policy | Authenticated same-origin viewer conflicted with default frame header | Canonical same-origin preview route and route-specific frame policy | Browser opened and displayed fixture text; signed/authenticated authorization path retained | Fixed |
| DATE/expiry/reminder initial form roundtrip concern | Could not reproduce once native date inputs emitted actual browser events; prior synthetic input did not represent the real interaction | No alternate storage or UI workaround; retain canonical payload flow and add initial-request regression | Real HR browser upload, DB/custom-field/reminder/storage readback and reload all match | Verified; no product failure reproduced |

## Responsive, localization and UX

- At 390×844, Manager Full document view measured 390px document width and Manager Focus 375px content width inside a 390px viewport; neither overflowed horizontally. Focus title width was 268px.
- HR upload and category/custom-field Settings flows were exercised on desktop. The browser viewport could not be held at 390×844 for the Settings screens during the final run; individual mobile checks of those Settings screens are not claimed.
- Dutch browser flows were exercised. `npm run check:i18n` found 39 NL/EN namespaces with equal keys; no raw key was reported. Full English browser scenario was not repeated.
- Focus preview, loading/error feedback for rejected file types, required category fields, and restored/deleted document states were checked. Full keyboard-only traversal was not separately recorded.

## Acknowledgement

The current Dossier UI does not expose acknowledgement / kennisname. The canonical backend table/workflow was inspected, but no acknowledgement feature was expanded and no D01 acknowledgement row was created. This is outside this UI run.

## Quality gate

| Gate | Result | Evidence |
|---|---|---|
| D01-targeted Vitest | PASS | 16 files / 80 tests across targeted commands |
| SQL/RLS contract | PASS | `employee_document_dossiers.sql` completed on shared TEST project; transaction rolled back |
| Changed-file ESLint | PASS | Exit 0; changed TypeScript/TSX files linted |
| NL/EN parity | PASS | 39 namespaces have equal keys |
| `git diff --check` | PASS | Exit 0 after the report and delivery-status updates; only standard Windows line-ending notices |
| Strict TypeScript | BASELINE FAILURE | Only `lib/absence/confirmation-service.ts:51` and `lib/absence/service.ts:339`; both verified unchanged from base SHA |
| Production build | BASELINE FAILURE | Optimized production compilation succeeded; type phase stopped at the same two unchanged absence-service errors |

No Docker or local Supabase was started. Generated fixtures are ignored; no binaries are committed. Version, main and Vercel deployment were not changed.

## ENVIRONMENT-GATED

- This run used only the canonical shared test project. Test data is identifiable by `D01-20260924`; all D01 rows and objects were read back together. The one old uppercase duplicate is D01-created and unlinked; it remains as explicit acceptance evidence rather than being confused with unrelated data.
- Vercel deployment and main integration were intentionally not part of D01.

## PRODUCT DECISIONS

- `DEPARTMENT_BRANCH` audience was not forced through an upload UI that does not expose it. Existing canonical audience/permission gates remain in place.
- Acknowledgement is not exposed in the current Dossier UI; no new workflow was added.
- The DOCUMENT field manager currently persists `sort_order=0` for these fields and exposes no reordering control; no new ordering UX was invented.

## NOT FIXED

- The two unchanged absence-service nullability errors remain outside D01 and block strict TypeScript and the production build after compilation.
- English browser flows, Settings-specific mobile viewport checks and full keyboard-only traversal were not separately executed. Static NL/EN parity and representative 390×844 Full/Focus checks passed.

## LESSONS / PATTERNS

- For RLS recursion, diagnose the full policy dependency chain first; use an actor-bound helper with minimal grants and validate both authenticated and anonymous reads.
- A Manager document upload may create an expiry reminder, but the reminder target must remain the same scoped employee; do not grant generic reminder write to Managers.
- Native date inputs need real input/change events during browser automation. Verify the initial canonical request as well as database, reminder, storage metadata and same-UI reload.
- Track the user's original filename separately from a sanitized, bounded storage key. Negative upload assertions must cover document, audience, reminder and storage rows.
