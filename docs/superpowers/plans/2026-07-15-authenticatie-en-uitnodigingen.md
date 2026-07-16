# Authenticatie en uitnodigingen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang magic-link-login door Google en e-mail/wachtwoord en lever een gesloten, tenantveilige uitnodigingsflow op.

**Architecture:** Supabase Auth blijft identityprovider; `user_access` blijft de enige bron van applicatietoegang. Een nieuwe invitation-laag koppelt een geverifieerde Auth-gebruiker atomair aan Employee en tenantrechten. De bestaande automatische Employee-koppeling op alleen e-mail wordt verwijderd.

**Tech Stack:** Next.js App Router, strict TypeScript, Supabase Auth/Postgres/RLS, Server Actions, Vitest, SQL-isolatietests.

## Global Constraints

- Bouw altijd `schema → API/server → UI`.
- Gebruik nooit `any`, React Query of SWR.
- Iedere nieuwe tabel krijgt RLS en policies in dezelfde migratie.
- Database-identifiers zijn Engels; UI, documentatie en comments zijn Nederlands en i18n-klaar.
- Secrets blijven server-only.
- Git-commits worden op verzoek van de gebruiker uitgesteld.
- Lokale verificatie gebruikt altijd poort 3000; de mijlpaal eindigt met een publieke preview.

---

### Task 1: Uitnodigingsschema en permissions

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715100000_add_user_invitations.sql`
- Create: `apps/hr-suite/supabase/tests/user_invitation_isolation.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces: `public.user_invitations`, enums `invitation_email_kind`, `invitation_purpose`, `invitation_status`, permissions `user:read` en `user:invite`.

- [ ] **Step 1: Write the failing SQL isolation test**

```sql
begin;
set local role authenticated;
select id from public.user_invitations limit 1;
rollback;
```

- [ ] **Step 2: Verify RED**

Run: `npx supabase test db --file supabase/tests/user_invitation_isolation.sql` from `apps/hr-suite`  
Expected: FAIL with `relation "public.user_invitations" does not exist`.

- [ ] **Step 3: Add enums, table, invariants and RLS**

```sql
create type public.invitation_email_kind as enum ('PRIVATE', 'BUSINESS');
create type public.invitation_purpose as enum ('PREBOARDING_EMPLOYEE', 'BUSINESS_USER');
create type public.invitation_status as enum ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  administration_id uuid,
  employee_id uuid,
  management_role_id uuid not null references public.management_roles(id) on delete restrict,
  scope_type public.access_scope_type not null,
  email text not null,
  email_kind public.invitation_email_kind not null,
  purpose public.invitation_purpose not null,
  token_hash text not null unique,
  status public.invitation_status not null default 'PENDING',
  expires_at timestamptz not null,
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  accepted_by_user_id uuid references auth.users(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_invitations_email_normalized check (email = lower(btrim(email))),
  constraint user_invitations_scope_valid check (
    (scope_type = 'TENANT' and administration_id is null)
    or (scope_type = 'ADMINISTRATION' and administration_id is not null)
  ),
  constraint user_invitations_preboarding_employee check (
    (purpose = 'PREBOARDING_EMPLOYEE' and employee_id is not null)
    or purpose = 'BUSINESS_USER'
  ),
  foreign key (tenant_id, administration_id)
    references public.administrations(tenant_id, id),
  foreign key (tenant_id, employee_id)
    references public.employees(tenant_id, id)
);

alter table public.user_invitations enable row level security;
create policy user_invitations_select_scoped on public.user_invitations
for select to authenticated
using (internal_security.has_tenant_access(tenant_id));
```

Use the existing `internal_security.current_user_has_permission(tenant_id, administration_id, permission_code)` helper for restrictive insert/update/delete policies; expose no anon policy. Add indexes for pending email, tenant/status/expiry and foreign keys. Add the updated-at trigger and permissions in the same migration.

- [ ] **Step 4: Reset, test and regenerate types**

Run: `npx supabase db reset`  
Run: `npx supabase test db --file supabase/tests/user_invitation_isolation.sql`  
Run: `npx supabase gen types typescript --local > ../../packages/db/types.ts`  
Expected: reset succeeds; isolation test passes; generated types contain `user_invitations`.

- [ ] **Step 5: Checkpoint without Git**

Record Task 1 as complete only after `npm run type-check` passes.

### Task 2: Atomaire uitnodigingsacceptatie

**Files:**
- Modify: `apps/hr-suite/supabase/migrations/20260715100000_add_user_invitations.sql`
- Create: `apps/hr-suite/supabase/tests/accept_user_invitation.sql`

**Interfaces:**
- Consumes: `user_invitations`, `user_access`, `employees.auth_user_id`.
- Produces: server-only RPC `public.accept_user_invitation(invitation_token text, accepted_user_id uuid, accepted_email text)`, uitvoerbaar door `service_role` en niet door `anon` of `authenticated`.

- [ ] **Step 1: Write failing transaction tests**

Create cases for valid acceptance, expired token, wrong authenticated email, reused token, cross-tenant Employee and Employee already linked to another user.

```sql
select * from public.accept_user_invitation('plain-test-token');
```

Expected before implementation: FAIL because the function does not exist.

- [ ] **Step 2: Implement the server-only atomic RPC**

```sql
create or replace function public.accept_user_invitation(
  invitation_token text,
  accepted_user_id uuid,
  accepted_email text
)
returns table (tenant_id uuid, employee_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.user_invitations%rowtype;
  current_user_id uuid := accepted_user_id;
  current_email text := lower(btrim(accepted_email));
begin
  if current_user_id is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into invitation
  from public.user_invitations i
  where i.token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
  for update;

  if not found or invitation.status <> 'PENDING' then raise exception 'INVITATION_INVALID'; end if;
  if invitation.expires_at <= now() then raise exception 'INVITATION_EXPIRED'; end if;
  if invitation.email <> current_email then raise exception 'INVITATION_EMAIL_MISMATCH'; end if;

  if invitation.employee_id is not null then
    update public.employees
    set auth_user_id = current_user_id
    where id = invitation.employee_id
      and tenant_id = invitation.tenant_id
      and auth_user_id is null;
    if not found then raise exception 'EMPLOYEE_ALREADY_LINKED'; end if;
  end if;

  insert into public.user_access
    (user_id, tenant_id, management_role_id, scope_type, administration_id)
  values
    (current_user_id, invitation.tenant_id, invitation.management_role_id,
     invitation.scope_type, invitation.administration_id)
  on conflict do nothing;

  update public.user_invitations
  set status = 'ACCEPTED', accepted_by_user_id = current_user_id,
      accepted_at = now()
  where id = invitation.id;

  return query select invitation.tenant_id, invitation.employee_id;
end;
$$;

```

Enable `pgcrypto` in schema `extensions`. Revoke the function from `public`, `anon` en `authenticated`; grant execute only to `service_role`. The server validates the current session and passes its user ID/e-mail; the definer function verifies these opnieuw against `auth.users` before any write.

- [ ] **Step 3: Run database tests**

Run: `npx supabase db reset && npx supabase test db --file supabase/tests/accept_user_invitation.sql`  
Expected: every positive and negative transaction case passes.

- [ ] **Step 4: Checkpoint without Git**

Run all SQL tests; stop if any tenant-isolation regression occurs.

### Task 3: Uitnodigingsdomein en e-mailstart

**Files:**
- Create: `apps/hr-suite/lib/auth/invitations.ts`
- Create: `apps/hr-suite/lib/auth/invitations.test.ts`
- Create: `apps/hr-suite/app/api/invitations/route.ts`
- Modify: `apps/hr-suite/lib/auth/permissions.ts`

**Interfaces:**
- Produces: `createInvitation(input: CreateInvitationInput): Promise<CreatedInvitation>` and POST `/api/invitations`.

- [ ] **Step 1: Write failing unit tests**

```ts
expect(normalizeInvitationEmail(' Edwin@Example.COM ')).toBe('edwin@example.com')
expect(validateInvitationPurpose({ purpose: 'BUSINESS_USER', emailKind: 'PRIVATE' })).toEqual({
  ok: false,
  code: 'BUSINESS_EMAIL_REQUIRED',
})
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @liquid-hr/hr-suite -- invitations.test.ts`  
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement strict domain types and token generation**

```ts
export interface CreateInvitationInput {
  email: string
  emailKind: 'PRIVATE' | 'BUSINESS'
  purpose: 'PREBOARDING_EMPLOYEE' | 'BUSINESS_USER'
  employeeId?: string
  administrationId?: string
  managementRoleId: string
  scopeType: 'TENANT' | 'ADMINISTRATION'
}

export interface CreatedInvitation { id: string; expiresAt: string }
```

Generate 32 random bytes, persist only SHA-256, and call `requirePermission('user:invite')`. Use the admin client only after server-side tenant/scope validation. Start the Supabase Auth invitation with `auth.admin.inviteUserByEmail(email, { redirectTo })`; this one-time link is onboarding only, not recurring login.

- [ ] **Step 4: Implement POST route and typed responses**

Validate JSON with Zod and return only invitation ID and expiry. Never return token hashes. Map validation to 400, authentication to 401, authorization to 403 and duplicate pending invitation to 409.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -w @liquid-hr/hr-suite -- invitations.test.ts`  
Run: `npm run type-check`  
Expected: PASS.

### Task 4: Wachtwoord- en Google-login

**Files:**
- Create: `apps/hr-suite/lib/auth/login-actions.ts`
- Create: `apps/hr-suite/lib/auth/login-actions.test.ts`
- Create: `apps/hr-suite/components/auth/login-form.tsx`
- Modify: `apps/hr-suite/app/login/page.tsx`
- Create: `apps/hr-suite/app/auth/callback/route.ts`
- Remove after replacement: `apps/hr-suite/app/auth/confirm/route.ts`
- Modify: `apps/hr-suite/proxy.ts`

**Interfaces:**
- Produces: `signInWithPassword`, `signInWithGoogle`, `requestPasswordReset`, OAuth callback.

- [ ] **Step 1: Write failing redirect and validation tests**

Test invalid email, missing password, preserved safe `next`, rejected external `next`, provider error and authenticated user without access.

- [ ] **Step 2: Implement server actions**

```ts
export async function signInWithPassword(input: LoginInput): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID_CREDENTIALS' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  return error ? { ok: false, code: 'INVALID_CREDENTIALS' } : { ok: true }
}
```

Google uses `signInWithOAuth({ provider: 'google', options: { redirectTo: '/auth/callback' } })`. Do not reveal whether an e-mail exists.

- [ ] **Step 3: Replace the magic-link UI**

Render e-mail, password, Google button and password-reset link. Move every label to `messages/nl/auth.json` and `messages/en/auth.json`; create a minimal server translator used by this page so no new text is hardcoded.

- [ ] **Step 4: Update proxy rules**

Protect all dashboard routes, permit `/login`, `/invite/*`, `/auth/*`, and redirect an authenticated user without `user_access` to `/geen-toegang` instead of `/departments`.

- [ ] **Step 5: Run focused tests**

Run: `npm test -w @liquid-hr/hr-suite -- login-actions.test.ts`  
Run: `npm run lint && npm run type-check`  
Expected: PASS and no magic-link copy remains.

### Task 5: Uitnodiging accepteren en wachtwoord instellen

**Files:**
- Create: `apps/hr-suite/app/invite/accept/page.tsx`
- Create: `apps/hr-suite/components/auth/invitation-acceptance-form.tsx`
- Create: `apps/hr-suite/lib/auth/accept-invitation.ts`
- Create: `apps/hr-suite/lib/auth/accept-invitation.test.ts`
- Create: `apps/hr-suite/app/geen-toegang/page.tsx`

**Interfaces:**
- Consumes: RPC `accept_user_invitation`.
- Produces: verified acceptance flow and access-denied page.

- [ ] **Step 1: Write failing state-machine tests**

```ts
expect(mapInvitationError('INVITATION_EXPIRED')).toBe('expired')
expect(mapInvitationError('INVITATION_EMAIL_MISMATCH')).toBe('emailMismatch')
```

- [ ] **Step 2: Implement acceptance service**

Require a valid session, optionally set a password with `supabase.auth.updateUser`, invoke the RPC, clear the invitation token from browser history, and redirect to the allowed active context.

- [ ] **Step 3: Build accessible page states**

Implement loading, password setup, expired, wrong email, already used and success. Add Dutch and English messages in the auth namespace.

- [ ] **Step 4: Verify**

Run focused Vitest tests, lint, typecheck and production build. Expected: all pass.

### Task 6: Documentatie, end-to-endcontrole en publieke preview

**Files:**
- Modify: `docs/architecture/BLUEPRINT.md`
- Modify: `docs/architecture/UI_FLOW_BLUEPRINT.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`
- Modify: `docs/README.md`
- Create: `docs/decisions/ADR-0002-gesloten-authenticatie-en-uitnodigingen.md`

- [ ] **Step 1: Run full local verification**

Run: `npm run lint`  
Run: `npm run type-check`  
Run: `npm test`  
Run: `npm run build`  
Run: `npm run dev` and verify `http://localhost:3000`.

- [ ] **Step 2: Browser scenarios**

Verify password login, Google start/callback, invalid credentials, invited preboarder, business invite, reused invite, no-access user, sign-out and mobile layout.

- [ ] **Step 3: Supabase manual checklist**

Record exact Site URL, redirect URLs, Google callback URL, SMTP, password policy and secrets still required from Edwin. Never paste secrets into documentation.

- [ ] **Step 4: Public preview**

Deploy a Vercel preview with the required Supabase environment variables, repeat the smoke tests on the public URL, and record that URL in `IMPLEMENTATION_STATUS.md`.

- [ ] **Step 5: Final checkpoint without Git**

Do not commit. Report changed files, database migration result, test evidence, public URL and remaining manual Supabase steps.
