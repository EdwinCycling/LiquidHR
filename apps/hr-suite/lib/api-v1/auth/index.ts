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
  assertDelegatedBearerVerifiedToken,
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

export {
  OAuthProtocolError,
  createLiveDelegatedAccessTokenVerifier,
  createOAuthAuthorizationRequest,
  createOAuthPkcePair,
  discoverOAuthProviderMetadata,
  exchangeOAuthAuthorizationCode,
  revokeAndConfirmOAuthAccessToken,
  revokeOAuthGrant,
  validateOAuthAuthorizationResponse,
  validateOAuthClientConfiguration,
} from './oauth'

export type {
  OAuthAuthorizationCodeExchangeInput,
  OAuthAuthorizationRequest,
  OAuthAuthorizationResponseInput,
  OAuthClientConfiguration,
  OAuthCrypto,
  OAuthDiscoveryInput,
  OAuthErrorCode,
  OAuthPkcePair,
  OAuthProviderMetadata,
  OAuthRevocationConfirmationInput,
  OAuthRevocationInput,
  OAuthTokenSet,
  ProviderAccessTokenVerifier,
} from './oauth'

export {
  bindIdentityBridgeToSupabaseAuth,
  resolveIdentityBridge,
} from './identity-bridge'

export type {
  IdentityBridgeAccountLinkResolver,
  IdentityBridgeGrantResolver,
  IdentityBridgeLink,
  IdentityBridgeResolution,
  IdentityBridgeResolutionInput,
  IdentityBridgeSupabaseBinding,
  IdentityBridgeSupabaseBindingInput,
} from './identity-bridge'
