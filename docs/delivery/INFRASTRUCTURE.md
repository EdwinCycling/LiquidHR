# LiquidHR infrastructure

Updated: 2026-09-23

## Environment identity

- LiquidHR currently has a **SINGLE TEST ENVIRONMENT**.
- Vercel Production means the published test deployment; it is not a separate customer Production environment.
- Vercel Production and the acceptance workflow use Supabase project `wnpfloqpjvaacobppbpk`. There is no separate customer Production database.
- Treat environment labels as workflow context, not database identity. Use the project ref to distinguish physical Supabase projects.

## Migration identity

- Canonical repository migrations remain named by their filenames, including:
  - `20260922210000_fix_talent_review_current_placement_uniqueness.sql`
  - `20260922230000_allow_focus_act_as_leave_workflow.sql`
- Supabase MCP `apply_migration` accepts a logical migration name and SQL, then may assign its own server-side history version. The accepted Focus migration is recorded under server version `20260923164105` and logical name `20260922230000_allow_focus_act_as_leave_workflow`.
- For MCP-applied migrations, establish identity with the exact logical name, canonical SQL/content and successful post-apply schema/security verification. Do not require the server timestamp to match the repository filename timestamp, rename the canonical file, or repair history for that difference.
- Both migrations above are applied once and verified on the shared project. Do not reapply either as release work.

## Release 1.20260923.1

- Keep the release version at `1.20260923.1`; no version bump is part of the security remediation.
- Direct avatar processing uses patched `sharp@0.35.4`. It blocks the HEIF loader before decode, checks actual JPEG/PNG/WebP signatures against the declared MIME, and confirms Sharp's detected format before normal processing. AVIF/HEIF and spoofed or malformed input are rejected before storage access.
- Focused avatar/runtime tests, strict TypeScript, `git diff --check`, and the production build (`296/296` pages) passed. The resolved workspace Sharp dependency is `0.35.4`.
- Existing lint friction is unchanged: `typescript-eslint` rejects TypeScript 7.0. No lint repair loop was run.
- T01 and F02 accepted evidence remains reused. Broad Focus browser acceptance remains pending; it is a separate gate.
