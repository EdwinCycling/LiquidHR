export {
  authenticateDelegatedRequest,
  DelegatedAuthError,
  loadCurrentLiquidHrAuthContext,
  parseAuthorizationHeader,
  parseBearerToken,
  resolveDelegatedAccount,
  verifyDelegatedRequest,
} from './delegated'

export {
  assertDelegatedAuthContext,
  authenticateDelegatedBearerRequest,
  createSupabaseBearerRlsBinding,
  createSupabaseBearerRlsClient,
  loadBearerAuthContext,
  requireDelegatedPermission,
  requireDelegatedSelfEmployee,
} from './bearer-rls'

export type {
  DelegatedAccessTokenVerifier,
  DelegatedAccountLink,
  DelegatedAccountLinkResolver,
  DelegatedAudienceClaim,
  DelegatedAuthorizationHeaders,
  DelegatedAuthContextLoader,
  DelegatedAuthErrorCode,
  DelegatedIdentity,
  DelegatedRequestAuthentication,
  DelegatedRequestAuthenticationInput,
  DelegatedRevocationStatus,
  DelegatedTokenVerificationInput,
  DelegatedVerifiedRequest,
  DelegatedVerificationInput,
  VerifiedDelegatedToken,
} from './delegated'

export type {
  DelegatedBearerAuthContextLoader,
  DelegatedBearerAuthContextInput,
  DelegatedBearerAuthErrorCode,
  DelegatedBearerRequestAuthentication,
  DelegatedBearerRlsClient,
  DelegatedBearerRlsClientFactory,
  SupabaseBearerRlsBindingInput,
  SupabaseBearerClientConfig,
  SupabaseBearerRlsClient,
} from './bearer-rls'
