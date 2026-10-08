export type OAuthGrantActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'revoked'; readonly clientId: string }
  | { readonly status: 'error' }

export const initialOAuthGrantActionState: OAuthGrantActionState = { status: 'idle' }
