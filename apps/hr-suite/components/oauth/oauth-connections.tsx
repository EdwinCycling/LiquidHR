'use client'

import { useActionState, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { isChatGptOAuthGrant, type UserOAuthGrantSummary } from '@/lib/oauth/user-grants'
import type { Locale } from '@/lib/i18n/config'
import { initialOAuthGrantActionState } from '@/app/oauth/connections/grant-state'
import { revokeChatGptOAuthGrant } from '@/app/oauth/connections/actions'

interface OAuthConnectionsProps {
  readonly grants: readonly UserOAuthGrantSummary[]
  readonly locale: Locale
  readonly labels: OAuthConnectionsLabels
}

export interface OAuthConnectionsLabels {
  readonly application: string
  readonly scopes: string
  readonly noScopes: string
  readonly authorizedAt: string
  readonly revoke: string
  readonly confirmTitle: string
  readonly confirmDescription: string
  readonly confirmRevoke: string
  readonly cancel: string
  readonly revoked: string
  readonly revokeFailed: string
  readonly empty: string
}

export function OAuthConnections({ grants, labels, locale }: OAuthConnectionsProps) {
  const [state, formAction, pending] = useActionState(
    revokeChatGptOAuthGrant,
    initialOAuthGrantActionState,
  )
  const [confirmGrant, setConfirmGrant] = useState<UserOAuthGrantSummary | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const visibleGrants = state.status === 'revoked'
    ? grants.filter((grant) => grant.clientId !== state.clientId)
    : grants

  return (
    <div className="space-y-4">
      {state.status === 'revoked' ? (
        <Surface className="p-4" role="status">
          <p className="text-sm leading-6 text-foreground">{labels.revoked}</p>
        </Surface>
      ) : null}
      {state.status === 'error' ? (
        <Surface className="p-4" role="alert">
          <p className="text-sm leading-6 text-foreground">{labels.revokeFailed}</p>
        </Surface>
      ) : null}

      {visibleGrants.length === 0 ? (
        <Surface className="p-5" role="status">
          <p className="text-sm leading-6 text-muted-foreground">{labels.empty}</p>
        </Surface>
      ) : (
        <div className="space-y-3">
          {visibleGrants.map((grant) => (
            <Surface className="space-y-3 p-4" key={grant.clientId}>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{labels.application}</p>
                <h2 className="mt-1 break-words text-base font-semibold text-foreground">{grant.clientName}</h2>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{labels.scopes}</p>
                <p className="mt-1 break-words text-sm leading-6 text-foreground">
                  {grant.scopes.length > 0 ? grant.scopes.join(', ') : labels.noScopes}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{labels.authorizedAt}</p>
                <time className="mt-1 block text-sm text-foreground" dateTime={grant.authorizedAt}>
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(grant.authorizedAt))}
                </time>
              </div>
              {isChatGptOAuthGrant(grant) ? (
                <Button
                  disabled={pending}
                  onClick={() => setConfirmGrant(grant)}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  {labels.revoke}
                </Button>
              ) : null}
            </Surface>
          ))}
        </div>
      )}

      <form action={formAction} className="hidden" ref={formRef}>
        <input name="clientId" type="hidden" value={confirmGrant?.clientId ?? ''} />
      </form>
      <ConfirmDialog
        cancelLabel={labels.cancel}
        confirmLabel={labels.confirmRevoke}
        description={labels.confirmDescription}
        destructive
        onConfirm={() => {
          formRef.current?.requestSubmit()
          setConfirmGrant(null)
        }}
        onOpenChange={(open) => { if (!open && !pending) setConfirmGrant(null) }}
        open={confirmGrant !== null}
        pending={pending}
        title={labels.confirmTitle}
      />
    </div>
  )
}
