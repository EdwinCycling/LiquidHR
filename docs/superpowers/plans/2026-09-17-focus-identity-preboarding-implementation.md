# Focus + Identity / Preboarding implementation plan

Base: exact `origin/main` SHA `6f9f61b85d2b488557d066fcabdbb39e60f2b39b`.

## Vertical slices

1. **Contracts and effective-date state** — add pure presentation/access contracts, preboarding allowlist, mode/default resolution, date-boundary tests and typed Focus view model.
2. **Security and canonical server reads** — extend the request authorization context with effective employment state; add the database preboarding guard and invitation acceptance compatibility fix; build the Focus projection from existing Employee/Journey reads.
3. **Invitation lifecycle** — harden seven-day expiry and redirect, add employee status/candidate projection, individual resend/revoke and bulk per-recipient service/API behavior with existing invitation infrastructure.
4. **Focus experience** — add the compact `/focus` shell/home and invitation workspace, reuse Foundation components, add NL/EN namespaces and route-safe integration links. The UI is implemented in an isolated Astra task only after the contracts are fixed.
5. **Acceptance** — targeted tests during each slice, then i18n, lint, type-check, focused/full Vitest gate, Next build and local browser/persona acceptance where the local environment is available.

## Security matrix

| Capability | Employee | Manager | HR admin | Preboarding |
| --- | --- | --- | --- | --- |
| Focus home | own | own + manager shell | full suite default, Focus available | own safe projection |
| Invitation management | no | only exact `user:invite` scope | exact `user:invite` scope | no |
| Journey self projection | exact `self:journey:read` | exact self permission | exact self/management permission | exact self permission |
| Employee personal completion | exact self permission | own exact self permission | target permission | allowlisted own self permission |
| Leave / Actual Work / directory / manager work | exact existing permission | exact existing permission | exact existing permission | denied by server and RLS guard |

## Self-review before implementation

- No new table, identity system, workflow engine, UI library, state framework or dependency is required.
- The Focus service will not query sensitive domains to construct a card.
- Preboarding restrictions are not represented by hidden links alone: the request permission layer and database authorization helpers share the same allowlist boundary.
- Invitation mutation paths continue to require `user:invite`, validate input with Zod, use the existing secure token hash and service-role email delivery, and never return tokens or secrets.
- No file under `apps/hr-suite/next-env.d.ts` is in scope.
- The other active worktree is not read or modified; convergence is represented only by documented route/read-model seams.

## Execution outcome

- All five vertical slices were implemented in this isolated worktree, including the explicit preboarding bank-account self-permission and matching RLS boundary discovered during final security review.
- Final local code gate: targeted security tests `16/16`, full Vitest `402 files / 1600 tests`, strict TypeScript, ESLint, i18n parity (`38` namespaces), diff-check and Webpack production build (`283` static pages) passed.
- Deferred gates: authenticated browser personas/responsive acceptance, local/DEV migration application, Supabase advisors/type generation and ESS/MSS integration. No remote or Production mutation is part of this candidate.
