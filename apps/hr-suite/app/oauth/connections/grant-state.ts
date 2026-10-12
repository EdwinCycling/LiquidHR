export type OAuthGrantActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'revoked'; readonly clientId: string }
  | { readonly status: 'error' }

export type OAuthManagerConsentActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'consented'; readonly clientId: string }
  | { readonly status: 'error' }

export const initialOAuthGrantActionState: OAuthGrantActionState = { status: 'idle' }
export const initialOAuthManagerConsentActionState: OAuthManagerConsentActionState = { status: 'idle' }
