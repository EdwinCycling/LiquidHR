'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import type { PayrollAdministration, PayrollCompanyBinding, PayrollConnection, PayrollProviderCompany } from '@/lib/payroll/domain/types'

type Labels = {
  connect: string
  reconnect: string
  check: string
  discover: string
  bind: string
  unbind: string
  disconnect: string
  confirmDisconnect: string
  selectCompany: string
  selectAdministration: string
  search: string
  noCompanies: string
  noAdministrations: string
  noBinding: string
  working: string
  succeeded: string
  failed: string
  discoveredCompanies: string
  bindingHint: string
  remoteRevocationWarning: string
}

type PayrollSettingsActionsProps = {
  connection: PayrollConnection | null
  reconnectConnection: PayrollConnection | null
  companies: readonly PayrollProviderCompany[]
  bindings: readonly PayrollCompanyBinding[]
  administrations: readonly PayrollAdministration[]
  labels: Labels
}

type BusyAction = 'check' | 'discover' | 'bind' | 'unbind' | 'disconnect' | null

function isConnectionUsable(connection: PayrollConnection | null): boolean {
  return connection?.status === 'CONNECTED'
}

export function PayrollSettingsActions({ connection, reconnectConnection, companies, bindings, administrations, labels }: PayrollSettingsActionsProps): React.ReactElement {
  const router = useRouter()
  const [busy, setBusy] = useState<BusyAction>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedAdministrationId, setSelectedAdministrationId] = useState('')
  const connected = isConnectionUsable(connection)
  const activeCompanies = companies.filter((company) => company.status === 'ACTIVE' && company.connectionId === connection?.id)

  async function request(url: string, action: Exclude<BusyAction, null>, init?: RequestInit): Promise<void> {
    setBusy(action)
    setMessage(null)
    try {
      const response = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), 'Content-Type': 'application/json' } })
      if (!response.ok) throw new Error('request failed')
      setMessage(labels.succeeded)
      router.refresh()
    } catch {
      setMessage(labels.failed)
    } finally {
      setBusy(null)
    }
  }

  function connect(): void {
    router.push('/api/payroll/providers/nmbrs/authorize')
  }

  function reconnect(): void {
    if (!reconnectConnection) return
    router.push(`/api/payroll/providers/nmbrs/authorize?connectionId=${encodeURIComponent(reconnectConnection.id)}&reconnect=1`)
  }

  async function bind(): Promise<void> {
    if (!selectedCompanyId || !selectedAdministrationId) return
    await request('/api/payroll/company-bindings', 'bind', { method: 'POST', body: JSON.stringify({ providerCompanyId: selectedCompanyId, administrationId: selectedAdministrationId }) })
    setSelectedCompanyId('')
    setSelectedAdministrationId('')
  }

  async function disconnect(): Promise<void> {
    if (!connection || !window.confirm(labels.confirmDisconnect)) return
    await request(`/api/payroll/connections/${encodeURIComponent(connection.id)}/disconnect`, 'disconnect', { method: 'POST' })
  }

  return <div className="mt-5 space-y-5">
    <div className="flex flex-wrap gap-2">
      <Button disabled={Boolean(busy) || Boolean(connection)} onClick={connect} variant="primary">{labels.connect}</Button>
      {reconnectConnection ? <Button disabled={Boolean(busy)} onClick={reconnect} variant="secondary">{labels.reconnect}</Button> : null}
      <Button disabled={Boolean(busy) || !connected} loading={busy === 'check'} onClick={() => connection ? request(`/api/payroll/connections/${encodeURIComponent(connection.id)}/check`, 'check', { method: 'POST' }) : undefined} variant="secondary">{labels.check}</Button>
      <Button disabled={Boolean(busy) || !connected} loading={busy === 'discover'} onClick={() => connection ? request(`/api/payroll/connections/${encodeURIComponent(connection.id)}/companies`, 'discover', { method: 'POST' }) : undefined} variant="secondary">{labels.discover}</Button>
      {connection && connection.status !== 'DISCONNECTED' ? <Button disabled={Boolean(busy)} loading={busy === 'disconnect'} onClick={disconnect} variant="danger">{labels.disconnect}</Button> : null}
    </div>
    {message ? <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p> : null}
    {connected ? <div className="border-t border-subtle pt-5">
      <p className="font-medium">{labels.discoveredCompanies}</p>
      <p className="mt-1 text-sm text-muted-foreground">{labels.bindingHint}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DropdownSelect aria-label={labels.selectCompany} onChange={(event) => setSelectedCompanyId(event.target.value)} searchable searchPlaceholder={labels.search} value={selectedCompanyId}>
          <option disabled value="">{activeCompanies.length ? labels.selectCompany : labels.noCompanies}</option>
          {activeCompanies.map((company) => <option key={company.id} value={company.id}>{company.externalCompanyDisplayName}{company.externalCompanyNumber ? ` (${company.externalCompanyNumber})` : ''}</option>)}
        </DropdownSelect>
        <DropdownSelect aria-label={labels.selectAdministration} onChange={(event) => setSelectedAdministrationId(event.target.value)} searchable searchPlaceholder={labels.search} value={selectedAdministrationId}>
          <option disabled value="">{administrations.length ? labels.selectAdministration : labels.noAdministrations}</option>
          {administrations.map((administration) => <option key={administration.id} value={administration.id}>{administration.name} ({administration.code})</option>)}
        </DropdownSelect>
      </div>
      <Button className="mt-3" disabled={Boolean(busy) || !selectedCompanyId || !selectedAdministrationId} loading={busy === 'bind'} onClick={bind} variant="primary">{labels.bind}</Button>
    </div> : null}
    {bindings.length ? <div className="border-t border-subtle pt-5"><ul className="space-y-3">{bindings.map((binding) => { const administration = administrations.find((item) => item.id === binding.administrationId); return <li className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-3 text-sm first:border-t-0 first:pt-0" key={binding.id}><span><span className="block font-medium">{binding.externalCompanyDisplayName}</span><span className="text-muted-foreground">{administration?.name ?? binding.administrationId}{administration?.code ? ` (${administration.code})` : ''}</span></span>{binding.status === 'ACTIVE' ? <Button disabled={Boolean(busy)} loading={busy === 'unbind'} onClick={() => request(`/api/payroll/company-bindings/${encodeURIComponent(binding.id)}`, 'unbind', { method: 'DELETE' })} size="sm" variant="secondary">{labels.unbind}</Button> : null}</li> })}</ul></div> : <p className="border-t border-subtle pt-5 text-sm text-muted-foreground">{labels.noBinding}</p>}
    {message === labels.failed && connection?.lastErrorCode ? <p className="text-sm text-destructive">{labels.remoteRevocationWarning}</p> : null}
  </div>
}
