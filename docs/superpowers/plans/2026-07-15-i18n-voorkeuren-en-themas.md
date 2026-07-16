# I18n, voorkeuren en thema’s Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lever volledige NL/EN-ondersteuning, zes CSS-token-thema’s en tenantonafhankelijke persoonlijke voorkeuren.

**Architecture:** Een kleine eigen i18n-laag leest server-side een locale-cookie en namespace-JSON. `user_preferences` bewaart locale en thema self-only; een Server Action schrijft database en cookie atomair vanuit gebruikersperspectief. Het documentthema wordt vóór de eerste render gezet.

**Tech Stack:** Next.js Server Components/Actions, TypeScript, JSON namespaces, Tailwind v4, Supabase RLS, Vitest.

## Global Constraints

- Nederlands is standaard; Nederlands en Engels wijzigen altijd samen.
- Geen hardcoded gebruikersgerichte tekst in nieuwe of aangeraakte componenten.
- Geen hexwaarden in componenten; uitsluitend semantische CSS-tokens.
- Git-commits worden uitgesteld.
- Schema → server → UI; lokaal poort 3000 en publieke preview.

---

### Task 1: User preferences-schema

**Files:**
- Create: `apps/hr-suite/supabase/migrations/20260715110000_add_user_preferences.sql`
- Create: `apps/hr-suite/supabase/tests/user_preferences_isolation.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces: `user_preferences`, `ui_locale`, `ui_theme`.

- [ ] **Step 1: Write failing self-only RLS tests**

Test select/insert/update as owner and zero visible rows as a different `auth.uid()`.

- [ ] **Step 2: Add schema and policies**

```sql
create type public.ui_locale as enum ('nl', 'en');
create type public.ui_theme as enum (
  'liquid-navy', 'noordzee', 'bos', 'warm-zand', 'aubergine', 'nacht'
);
create table public.user_preferences (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  locale public.ui_locale not null default 'nl',
  theme public.ui_theme not null default 'liquid-navy',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.user_preferences enable row level security;
create policy user_preferences_self_select on public.user_preferences
for select to authenticated using (auth_user_id = (select auth.uid()));
create policy user_preferences_self_insert on public.user_preferences
for insert to authenticated with check (auth_user_id = (select auth.uid()));
create policy user_preferences_self_update on public.user_preferences
for update to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));
```

Add trigger/grants; no admin-readable policy.

- [ ] **Step 3: Verify and regenerate**

Run reset, SQL test, type generation and typecheck. Expected: PASS.

### Task 2: Namespace-i18n en parity check

**Files:**
- Create: `apps/hr-suite/lib/i18n/config.ts`
- Create: `apps/hr-suite/lib/i18n/server.ts`
- Create: `apps/hr-suite/lib/i18n/translator.ts`
- Create: `apps/hr-suite/lib/i18n/translator.test.ts`
- Create: `apps/hr-suite/scripts/check-i18n.mjs`
- Create: `apps/hr-suite/messages/nl/{common,navigation,settings,departments,employees,employment,validation,errors}.json`
- Create: matching files under `apps/hr-suite/messages/en/`
- Modify: `apps/hr-suite/package.json`

**Interfaces:**
- Produces: `getLocale(): Promise<Locale>`, `getTranslator(namespace): Promise<Translator>`, script `check:i18n`.

- [ ] **Step 1: Write failing translator tests**

```ts
expect(createTranslator({ save: 'Opslaan' })('save')).toBe('Opslaan')
expect(() => createTranslator({})('missing')).toThrow('MISSING_TRANSLATION:missing')
```

- [ ] **Step 2: Implement strict locale config**

```ts
export const locales = ['nl', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'nl'
export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value)
}
```

`server.ts` reads `liquid-locale`; invalid/missing becomes `nl`. Namespace loaders are an explicit typed map, not arbitrary filesystem input.

- [ ] **Step 3: Add parity script**

Recursively compare JSON key paths in every EN file with the NL source. Exit 1 and print exact missing/extra keys.

- [ ] **Step 4: Add package script and verify**

```json
"check:i18n": "node scripts/check-i18n.mjs"
```

Run: `npm run check:i18n -w @liquid-hr/hr-suite`  
Expected: PASS; deliberately removing one EN key must produce FAIL before restoring it.

### Task 3: Voorkeurenservice en Server Action

**Files:**
- Create: `apps/hr-suite/lib/preferences/user-preferences.ts`
- Create: `apps/hr-suite/lib/preferences/user-preferences.test.ts`
- Create: `apps/hr-suite/app/actions/update-user-preferences.ts`

**Interfaces:**
- Produces: `loadUserPreferences(userId)`, `updateUserPreferences(input)`.

- [ ] **Step 1: Write failing validation/sync tests**

Test defaults, invalid locale/theme, upsert payload and cookie options (`httpOnly: true`, `sameSite: 'lax'`, `secure` in production).

- [ ] **Step 2: Implement immutable types**

```ts
export interface UserPreferences {
  locale: 'nl' | 'en'
  theme: 'liquid-navy' | 'noordzee' | 'bos' | 'warm-zand' | 'aubergine' | 'nacht'
}
export const defaultPreferences: UserPreferences = {
  locale: 'nl', theme: 'liquid-navy',
}
```

- [ ] **Step 3: Implement action**

Authenticate with `getClaims`, upsert only `auth.uid()`, write `liquid-locale` and `liquid-theme` cookies, call `revalidatePath('/', 'layout')`, return a typed result.

- [ ] **Step 4: Verify**

Run focused tests and typecheck. Expected: PASS.

### Task 4: Zes semantische thema’s

**Files:**
- Modify: `apps/hr-suite/app/globals.css`
- Modify: `apps/hr-suite/app/layout.tsx`
- Create: `apps/hr-suite/lib/preferences/theme.ts`
- Create: `apps/hr-suite/lib/preferences/theme.test.ts`

- [ ] **Step 1: Write failing theme resolver tests**

Test all six values and fallback from an invalid cookie to `liquid-navy`.

- [ ] **Step 2: Expand Tailwind tokens**

Add semantic variables for background, foreground, surface, primary, accent, muted, border, focus, success, warning, danger and sidebar. Define one `[data-theme='...']` block per theme in `globals.css`; keep every hex value inside this token file only.

- [ ] **Step 3: Set SSR document attributes**

```tsx
const locale = await getLocale()
const theme = await getTheme()
return <html lang={locale} data-theme={theme}><body>{children}</body></html>
```

- [ ] **Step 4: Verify**

Run theme tests, lint, typecheck and build. Expected: PASS and no hydration warning.

### Task 5: Mobiele instellingenpopup

**Files:**
- Create: `apps/hr-suite/components/settings/user-settings-dialog.tsx`
- Create: `apps/hr-suite/components/settings/user-settings-trigger.tsx`
- Create: `apps/hr-suite/components/settings/user-settings-dialog.test.tsx`
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `updateUserPreferences`, translated settings labels.

- [ ] **Step 1: Add a DOM test environment and failing interaction tests**

Add `@testing-library/react`, `@testing-library/user-event` and `jsdom` as dev dependencies. Test open/close, Escape, focus return, locale selection, six themes and saving.

- [ ] **Step 2: Implement dialog semantics**

Use native `<dialog>` where supported, labeled controls, focus trapping and a mobile full-height layout. Pass translated strings from the dashboard Server Component; do not fetch client-side.

- [ ] **Step 3: Connect sidebar and action**

The trigger is visible for every authenticated user. Optimistically apply `data-theme` for preview, revert on cancel/error, persist on save.

- [ ] **Step 4: Verify**

Run component tests, lint, typecheck and build. Expected: PASS.

### Task 6: Bestaande UI volledig NL/EN maken

**Files:**
- Modify: `apps/hr-suite/components/layout/sidebar.tsx`
- Modify: `apps/hr-suite/components/layout/administration-switcher.tsx`
- Modify: `apps/hr-suite/app/(dashboard)/departments/page.tsx`
- Modify: `apps/hr-suite/app/api/departments/route.ts`
- Modify: `apps/hr-suite/app/login/page.tsx`

- [ ] **Step 1: Scan current hardcoded UI strings**

Run: `rg -n "Afdelingen|Uitloggen|Inloggen|Opslaan|Annuleren|Geen toegang" apps/hr-suite/app apps/hr-suite/components`.

- [ ] **Step 2: Move every user-facing string to namespaces**

Server Components call translators; client components receive a typed `labels` prop. API errors return stable codes, and the UI translates those codes.

- [ ] **Step 3: Verify parity and rendering**

Run i18n check, tests, lint, typecheck and build. Expected: PASS in NL and EN.

### Task 7: Documentatie, browsercontrole en preview

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/README.md`
- Modify: `docs/architecture/ENVIRONMENT_AND_AI_RULES.md`
- Modify: `docs/delivery/IMPLEMENTATION_STATUS.md`

- [ ] **Step 1: Add permanent rules**

Document NL/EN parity, namespace-only copy, semantic tokens, local port 3000 and mandatory public preview URL.

- [ ] **Step 2: Run full checks**

Run lint, typecheck, test, `check:i18n` and build. Expected: all pass.

- [ ] **Step 3: Browser verification**

On `http://localhost:3000`, verify all six themes, NL/EN, reload persistence, different tenant context, keyboard use, 390px mobile and desktop viewport.

- [ ] **Step 4: Public preview**

Deploy, repeat iPhone smoke test, and record URL and date in `IMPLEMENTATION_STATUS.md`.

- [ ] **Step 5: Final checkpoint without Git**

Report evidence and leave all changes uncommitted.

