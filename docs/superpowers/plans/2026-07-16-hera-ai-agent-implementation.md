# HeRa AI Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bouw een veilige persoonlijke HeRa-webchat met conversations, compressed memory, export/verwijderen, persona en één bevestigbare bestaande actie.

**Architecture:** Een RLS-beveiligde Supabase-conversationlaag is de bron van waarheid. Een dunne, stateless Gemini-adapter gebruikt alleen centrale server-env en een typed tool registry. De webadapter communiceert via API-routes; de bestaande reminder-service blijft de enige schrijfweg.

**Tech Stack:** Next.js App Router, React, strict TypeScript, Supabase SSR/RLS/Postgres, Zod, Gemini REST API, Tailwind v4, Vitest.

## Global Constraints

- Bouw altijd `schema -> API route/service -> UI`.
- Gebruik geen `any`, geen browser-secret en geen providerconversatie-state.
- Iedere blootgestelde tabel krijgt RLS, owner/tenant-policies, indexes en grants in dezelfde migratie.
- Actor, tenant, administratie en permissions zijn server-afgeleid; het model bepaalt die nooit.
- Elke zichtbare tekst heeft een Nederlandse en Engelse sleutel.
- Schrijfacties volgen `voorstel -> concept -> controlekaart -> expliciete bevestiging -> uitvoering`.

---

### Task 1: Schema, types en RLS voor persoonlijke HeRa-data

**Files:**
- Create: `apps/hr-suite/supabase/migrations/<timestamp>_add_hera_ai_agent.sql`
- Create: `apps/hr-suite/supabase/tests/hera_ai_agent.sql`
- Create: `apps/hr-suite/lib/hera/schemas.ts`
- Create: `apps/hr-suite/lib/hera/schemas.test.ts`
- Modify: `packages/db/types.ts`

**Interfaces:** produces `ai_conversations`, `ai_messages`, `ai_memory_items`, `ai_action_drafts` with `(tenant_id, owner_user_id)` ownership and typed Zod inputs.

- [ ] Write failing test: `userMessageSchema` accepts nonblank bounded text and rejects empty/oversize text.
- [ ] Run `npm.cmd test -w @liquid-hr/hr-suite -- lib/hera/schemas.test.ts`; confirm module-not-found RED.
- [ ] Add schema tables with conversation summary/cursor, visible messages only, opt-in memory, expiry/idempotency-bound drafts, cascade child deletion, RLS/policies/grants/indexes.
- [ ] Add strict schemas and manually refresh `packages/db/types.ts` pending linked-Supabase generation.
- [ ] Re-run focused test and `npm.cmd run type-check -w @liquid-hr/hr-suite`; expect exit 0.
- [ ] Commit: `git commit -m "feat: add HeRa conversation schema"`.

### Task 2: Test-first pure persona and context policy

**Files:**
- Create: `apps/hr-suite/lib/hera/types.ts`
- Create: `apps/hr-suite/lib/hera/persona.ts`
- Create: `apps/hr-suite/lib/hera/persona.test.ts`
- Create: `apps/hr-suite/lib/hera/context.ts`
- Create: `apps/hr-suite/lib/hera/context.test.ts`

**Interfaces:** produces `resolvePersona(context, locale)`, `buildModelContext(input)` and `isMemoryCandidate(content)` without a database dependency.

- [ ] Write failing test: `DIRECT_MANAGER` resolves to concise manager tone while permissions are not modified.
- [ ] Write failing test: context includes the compressed summary and newest messages within a fixed budget.
- [ ] Run `npm.cmd test -w @liquid-hr/hr-suite -- lib/hera/persona.test.ts lib/hera/context.test.ts`; confirm RED.
- [ ] Implement role precedence `HR -> MANAGER -> EMPLOYEE`, locale-safe instructions, bounded deterministic context and opt-in-only memory candidates.
- [ ] Re-run focused tests; expect all pass.
- [ ] Commit: `git commit -m "feat: add HeRa context policies"`.

### Task 3: Gemini provider and minimal secure tool registry

**Files:**
- Create: `apps/hr-suite/lib/hera/gemini.ts`
- Create: `apps/hr-suite/lib/hera/gemini.test.ts`
- Create: `apps/hr-suite/lib/hera/tools.ts`
- Create: `apps/hr-suite/lib/hera/tools.test.ts`
- Modify: `apps/hr-suite/.env.example`

**Interfaces:** produces `generateHeRaResponse(input)` and `executeHeRaTool(authContext, call)` with typed provider/tool errors.

- [ ] Write failing adapter test proving the endpoint uses the configured model, never includes a key in the request body and parses typed tool calls.
- [ ] Write failing tool test proving `draft_personal_reminder` returns a draft and never calls `createPersonalReminder`.
- [ ] Run focused tests; confirm RED.
- [ ] Implement a thin stateless `generateContent` adapter using `GEMINI_KEY` and `GEMINI_MODEL`; fail safely if unavailable.
- [ ] Implement only `get_my_profile`, `list_my_reminders`, `draft_personal_reminder`; derive all identity from `AuthContext`.
- [ ] Re-run focused tests; expect pass. Commit: `git commit -m "feat: add HeRa Gemini tools"`.

### Task 4: Conversation, memory, export and draft-confirmation services

**Files:**
- Create: `apps/hr-suite/lib/hera/service.ts`
- Create: `apps/hr-suite/lib/hera/service.test.ts`
- Create: `apps/hr-suite/lib/hera/export.ts`
- Create: `apps/hr-suite/lib/hera/export.test.ts`
- Create: `apps/hr-suite/lib/hera/http-errors.ts`

**Interfaces:** produces personal conversation CRUD, message send, explicit memory save/delete, Markdown/JSON export, delete and idempotent `confirmHeRaDraft`.

- [ ] Write failing service test: a potential preference is not stored as memory without explicit approval.
- [ ] Write failing service test: the first confirm creates one reminder; a second confirm returns `DRAFT_NOT_CONFIRMABLE`.
- [ ] Write failing export test: output excludes secrets, system prompt and untrusted tool metadata.
- [ ] Run focused tests; confirm RED.
- [ ] Implement RLS-scoped owner/tenant queries, bounded summarization, content-redacted export, transactional delete and revalidated draft execution through existing `createPersonalReminder`.
- [ ] Re-run focused tests; expect pass. Commit: `git commit -m "feat: persist HeRa conversations"`.

### Task 5: API routes and i18n namespace

**Files:**
- Create: `apps/hr-suite/app/api/hera/conversations/route.ts`
- Create: `apps/hr-suite/app/api/hera/conversations/[conversationId]/route.ts`
- Create: `apps/hr-suite/app/api/hera/conversations/[conversationId]/messages/route.ts`
- Create: `apps/hr-suite/app/api/hera/conversations/[conversationId]/export/route.ts`
- Create: `apps/hr-suite/app/api/hera/drafts/[draftId]/confirm/route.ts`
- Create: `apps/hr-suite/app/api/hera/memory/route.ts`
- Create: co-located route tests
- Create: `apps/hr-suite/messages/nl/hera.json`
- Create: `apps/hr-suite/messages/en/hera.json`
- Modify: `apps/hr-suite/lib/i18n/config.ts`
- Modify: `apps/hr-suite/lib/i18n/server.ts`

- [ ] Write failing route tests for empty message (400), unauthenticated call (401), owner-only delete and one-time draft confirmation.
- [ ] Run `npm.cmd test -w @liquid-hr/hr-suite -- app/api/hera`; confirm RED.
- [ ] Implement Zod-validated routes with consistent `{ data }`/`{ error }`, streaming-safe message response and download-safe export headers.
- [ ] Add matching NL/EN keys for all states, errors and actions.
- [ ] Re-run route tests plus `npm.cmd run check:i18n -w @liquid-hr/hr-suite`; expect pass. Commit: `git commit -m "feat: expose HeRa API"`.

### Task 6: HeRa webchat, start page and navigation

**Files:**
- Create: `apps/hr-suite/app/(dashboard)/hera/page.tsx`
- Create: `apps/hr-suite/components/hera/hera-workspace.tsx`
- Create: `apps/hr-suite/components/hera/conversation-list.tsx`
- Create: `apps/hr-suite/components/hera/message-thread.tsx`
- Create: `apps/hr-suite/components/hera/draft-card.tsx`
- Create: focused component tests
- Modify: `apps/hr-suite/app/page.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/layout.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`
- Modify: `apps/hr-suite/messages/nl/navigation.json`
- Modify: `apps/hr-suite/messages/en/navigation.json`

- [ ] Write failing pure UI helper test: no draft card is rendered before a draft response exists.
- [ ] Run `npm.cmd test -w @liquid-hr/hr-suite -- components/hera`; confirm RED.
- [ ] Build an accessible workspace with personal conversation rail, message stream, compact composer, memory consent, delete/export actions and a clearly separate confirmation card.
- [ ] Add `/hera` to the sidebar; redirect the root route to `/hera` as the first authenticated destination.
- [ ] Re-run UI tests, type check, lint and i18n check; expect exit 0. Commit: `git commit -m "feat: add HeRa webchat"`.

### Task 7: Version, documentation, reset and verification

**Files:**
- Modify: `apps/hr-suite/lib/app-version.ts`
- Modify: `docs/README.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/delivery/CURRENT_CONTEXT.md`
- Modify: `docs/delivery/HANDMATIGE_ACTIES.md`

- [ ] Increment central version to `1.20260716.2`.
- [ ] Document actual implemented scope and remaining external blockers without secrets.
- [ ] Run `npm.cmd test -w @liquid-hr/hr-suite`, lint, type check, i18n check and production build; inspect every exit code.
- [ ] Run linked Supabase advisor/type generation only if the CLI has access; otherwise record exact block.
- [ ] Reset the local port-3000 server, start the current worktree app and smoke test `/login` plus `/hera`.
- [ ] Commit: `git commit -m "chore: prepare HeRa test release"`.
