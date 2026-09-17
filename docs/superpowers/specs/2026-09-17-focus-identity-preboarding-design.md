# Focus + Identity / Preboarding — approved design reconciliation

Status: approved execution slice, implemented on branch `work/focus-identity-preboarding-20260917`.

## Scope

This slice owns the `/focus` product experience, presentation defaults, employee and manager Focus homes, Preboarding Focus, employee-linked invitation lifecycle, individual/bulk invitation presentation, post-activation routing, and effective-dated Preboarding-to-Employee transition.

It does not own Process Automation internals, Leave or Actual Work workflow semantics, or the shared My Requests/My Work backend. Focus exposes narrow navigation seams to those domains and does not create parallel storage or workflow engines.

## Reconciliation decisions

- Focus is a route namespace in the existing HR Suite, not a second app or shell.
- Existing `components/ui`, `components/patterns`, `components/layout`, Tailwind tokens, Work Sans, Lucide and existing Supabase clients remain the only UI/runtime foundation.
- Existing Employee identity, effective-dated `employments`, Journey projection RPCs, `user_invitations`, `accept_user_invitation`, `user_access`, `user_hr_group_access`, and permission/RLS helpers remain canonical.
- Browser/device presentation preference is UI state only. It never grants access and never bypasses `requirePermission` or RLS.
- Preboarding is resolved from the canonical employment timeline: a confirmed future employment with no confirmed employment effective today. The same account becomes Employee Focus on the effective start date.
- Preboarding capability is a product-governed allowlist. The allowlist is duplicated only as a typed server contract and a database authorization guard; it is not tenant-configurable.
- Preboarding home reads only safe employee shell data and the existing actor-safe Journey projection. Sensitive salary, BSN, general directory, Leave, Actual Work, manager work and general workforce reads remain unavailable.
- Invitation resend revokes the prior pending token before creating a new secure token. Accepted/active employees are never reinvited.
- Bulk invitation results are per employee and retain actionable failure codes; partial success is visible.
- The existing invitation acceptance redirect is normalized to `/invite/[token]`, and successful activation routes to `/focus`.

## UX translation

The attached screenshots are interaction references only. Focus uses compact, mobile-first cards, clear progress, touch-sized controls and concise flows, but renders them with LiquidHR Foundation surfaces, semantic tokens, Work Sans, existing spacing/radius/focus states and Lucide icons. No Officient branding or copied design system is introduced.

## Deferred integration seams

- `Mijn aanvragen` and manager `Mijn werk` link to the existing/canonical routes and expose typed empty/count seams; the other ESS/MSS run owns the eventual shared read model and workflow mutation integration.
- Leave, Actual Work, calendar, team and normal P-mutation links are capability-filtered and deep-link only; their domain APIs and approval semantics remain outside this branch.
- Secure onboarding documents remain in `employee_documents`/document-studio/signing architecture. Focus/Journey owns task presentation, never generic blob storage or a second dossier.
