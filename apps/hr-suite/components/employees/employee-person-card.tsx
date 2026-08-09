'use client'

import { AlertTriangle, Check, ChevronDown, CreditCard, Eye, HeartHandshake, Home, LoaderCircle, Mail, MapPin, Pencil, Phone, Search, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import type { AddressSuggestion } from '@/lib/address/address-suggestions'
import { EmployeeCustomFields } from '@/components/custom-fields/employee-custom-fields'
import type { EmployeeCustomField } from '@/lib/custom-fields/service'
import { NO_EMPLOYEE_CAPABILITIES, type EmployeeBankAccount, type EmployeeDetailViewModel, type EmployeeRelation, type EmployeeRelationTypeOption, type EmployeeRoleAssignment } from './types'
import { EmailLink } from '@/components/shared/email-link'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'
import { DropdownSelect } from '@/components/ui/dropdown-select'

type Tab = 'personal' | 'addresses' | 'bankAccounts' | 'relations' | 'additionalInformation'
type MutationState = 'idle' | 'saving' | 'saved' | 'failed'

export interface EmployeePersonCardLabels {
  tabs: Record<Tab, string>
  additionalInformationTitle: string
  customFields: { title: string; subtitle: string; save: string; saving: string; saved: string; failed: string; readOnly: string; yes: string; no: string }
  overviewTitle: string
  contactTitle: string
  workContact: string
  privateContact: string
  noContact: string
  currentAddress: string
  noAddress: string
  primaryBank: string
  noBankAccount: string
  emergencyContacts: string
  noEmergencyContact: string
  employmentCount: string
  personalTitle: string
  editPersonal: string
  save: string
  saving: string
  saved: string
  cancel: string
  genericError: string
  employeeNumber: string
  firstName: string
  birthNamePrefix: string
  birthName: string
  nameUsage: string
  nameUsageBirth: string
  nameUsagePartner: string
  nameUsagePartnerBirth: string
  nameUsageBirthPartner: string
  gender: string
  genderMale: string
  genderFemale: string
  genderOther: string
  genderUndisclosed: string
  birthDate: string
  birthPlace: string
  birthCountry: string
  nationality: string
  countrySearch: string
  countryNoResults: string
  preferredLanguage: string
  languageSearch: string
  languageNoResults: string
  privateEmail: string
  privatePhone: string
  privateMobile: string
  workEmail: string
  workPhone: string
  workPhoneExtension: string
  workMobile: string
  bsnTitle: string
  bsnProtected: string
  revealBsn: string
  revealingBsn: string
  bsnNotRecorded: string
  bsnAuditHelp: string
  addressesTitle: string
  addressesEmpty: string
  primaryAddress: string
    secondaryAddress: string
    secondaryAddressDescription: string
    secondaryAddressHelp: string
    noSecondaryAddress: string
    relocateAddress: string
    addAddress: string
  editResource: string
  deleteResource: string
  confirmDelete: string
  cannotDeleteLastAddress: string
  directReminderTitle: string
  directReminderHelp: string
  reminderHrAdmin: string
  reminderManager: string
  reminderEmployee: string
  country: string
  addressSearch: string
  addressSearchPlaceholder: string
  manualEntry: string
  searchNoResults: string
  searchUnavailable: string
  searchLoading: string
  lookupByPostalCode: string
  lookup: string
  lookupHint: string
  lookupUnavailable: string
  addressLine1: string
  addressLine2: string
  region: string
  current: string
  validFrom: string
  validUntil: string
  clearValidUntil: string
  street: string
  streetHasNumberNote: string
  houseNumber: string
  addition: string
  postalCode: string
  city: string
  province: string
  countryCode: string
  saveAddress: string
  banksTitle: string
  banksEmpty: string
  addBank: string
  primary: string
  iban: string
  bic: string
  accountHolder: string
  description: string
  makePrimary: string
  saveBank: string
  relationsTitle: string
  relationsEmpty: string
  addRelation: string
  relationType: string
  relationPartner: string
  relationChild: string
  relationParent: string
  relationSibling: string
  relationDoctor: string
  relationDentist: string
  relationOther: string
  emergencyContact: string
  lastName: string
  mobile: string
  email: string
  notes: string
  saveRelation: string
  notRecorded: string
  rolesTitle: string
  rolesEmpty: string
  roleDepartment: string
  roleTenantWide: string
  roleValidFrom: string
  roleValidUntil: string
}

interface EmployeePersonCardProps {
  detail: EmployeeDetailViewModel
  initialEdit?: boolean
  locale: string
  dateFormat: DateFormat
  labels: EmployeePersonCardLabels
  roleAssignments?: EmployeeRoleAssignment[]
  customFields?: EmployeeCustomField[]
  defaultCountryCode: string
}

function value(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
}

function nullable(input: string): string | null {
  return input || null
}

async function runJsonMutation(
  setState: (state: MutationState) => void,
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<boolean> {
  setState('saving')
  let outcome: MutationState = 'failed'
  try {
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (response.ok) outcome = 'saved'
    return response.ok
  } catch {
    return false
  } finally {
    setState(outcome)
  }
}

export function EmployeePersonCard({ detail, initialEdit = false, locale, dateFormat, labels, roleAssignments = [], customFields = [], defaultCountryCode }: EmployeePersonCardProps) {
  const [tab, setTab] = useState<Tab>('personal')
  const capabilities = detail.capabilities ?? NO_EMPLOYEE_CAPABILITIES
  const addresses = detail.addresses ?? []
  const bankAccounts = detail.bankAccounts ?? []
  const relations = detail.relations ?? []
  const tabs: Tab[] = ['personal', 'addresses', 'bankAccounts', 'relations', 'additionalInformation']

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    const nextTab = tabs[nextIndex]
    setTab(nextTab)
    requestAnimationFrame(() => document.getElementById(`employee-tab-${nextTab}`)?.focus())
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border bg-surface shadow-sm">
      <nav className="overflow-x-auto border-b bg-surface-raised px-2 sm:px-4" aria-label={labels.personalTitle}>
        <div role="tablist" className="flex min-w-max gap-1">
          {tabs.map((item, index) => (
            <button
              key={item}
              id={`employee-tab-${item}`}
              type="button"
              role="tab"
              aria-selected={tab === item}
              aria-controls={`employee-panel-${item}`}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`rounded-t-lg border-b-2 px-3 py-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${tab === item ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              {labels.tabs[item]}
            </button>
          ))}
        </div>
      </nav>
      <div id={`employee-panel-${tab}`} role="tabpanel" aria-labelledby={`employee-tab-${tab}`} className="p-4 sm:p-6">
        {tab === 'personal' && <PersonalPanel employee={detail.employee} initialEdit={initialEdit} capabilities={capabilities} labels={labels} roleAssignments={roleAssignments} locale={locale} dateFormat={dateFormat} defaultCountryCode={defaultCountryCode} />}
        {tab === 'addresses' && <AddressesPanelV2 employeeId={detail.employee.id} addresses={addresses} canManage={capabilities.canManageAddresses} locale={locale} dateFormat={dateFormat} labels={labels} />}
        {tab === 'bankAccounts' && <BankAccountsPanel employeeId={detail.employee.id} accounts={bankAccounts} canManage={capabilities.canManageBankAccounts} labels={labels} />}
        {tab === 'relations' && <RelationsPanel employeeId={detail.employee.id} relations={relations} relationTypes={detail.relationTypes ?? []} locale={locale} canManage={capabilities.canManageRelations} labels={labels} />}
        {tab === 'additionalInformation' && <section><SectionHeader icon={<UserRound className="h-5 w-5" />} title={labels.additionalInformationTitle} /><div className="mt-6"><EmployeeCustomFields embedded employeeId={detail.employee.id} fields={customFields} labels={labels.customFields} /></div></section>}
      </div>
    </section>
  )
}

function PersonalPanel({ employee, initialEdit, capabilities, labels, roleAssignments, locale, dateFormat, defaultCountryCode }: { employee: EmployeeDetailViewModel['employee']; initialEdit: boolean; capabilities: NonNullable<EmployeeDetailViewModel['capabilities']>; labels: EmployeePersonCardLabels; roleAssignments: EmployeeRoleAssignment[]; locale: string; dateFormat: DateFormat; defaultCountryCode: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(initialEdit && capabilities.canEditEmployee && Boolean(employee.updatedAt))
  const [state, setState] = useState<MutationState>('idle')

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!employee.updatedAt) return
    const form = new FormData(event.currentTarget)
    const succeeded = await runJsonMutation(setState, `/api/employees/${employee.id}`, 'PATCH', {
        updatedAt: employee.updatedAt, employeeNumber: value(form, 'employeeNumber'), firstName: value(form, 'firstName'),
        birthNamePrefix: nullable(value(form, 'birthNamePrefix')), birthName: value(form, 'birthName'),
        nameUsage: value(form, 'nameUsage'), gender: value(form, 'gender'), birthDate: nullable(value(form, 'birthDate')),
        birthPlace: nullable(value(form, 'birthPlace')), birthCountry: nullable(value(form, 'birthCountry').toUpperCase()),
        nationality: nullable(value(form, 'nationality').toUpperCase()), preferredLanguage: value(form, 'preferredLanguage'),
        privateEmail: nullable(value(form, 'privateEmail')), privatePhone: nullable(value(form, 'privatePhone')),
        privateMobile: nullable(value(form, 'privateMobile')), workEmail: nullable(value(form, 'workEmail')),
        workPhone: nullable(value(form, 'workPhone')), workPhoneExt: nullable(value(form, 'workPhoneExt')),
        workMobile: nullable(value(form, 'workMobile')),
    })
    if (!succeeded) return
    setEditing(false); router.refresh()
  }

  if (editing) {
    return (
      <form onSubmit={save}>
        <SectionHeader icon={<Pencil className="h-5 w-5" />} title={labels.personalTitle} />
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <FormSection icon={<UserRound className="h-4 w-4" />} title={labels.personalTitle}>
            <Field label={labels.employeeNumber}><input name="employeeNumber" defaultValue={employee.employeeNumber} required className="form-field" /></Field>
            <Field label={labels.firstName}><input name="firstName" defaultValue={employee.firstName} required className="form-field" /></Field>
            <Field label={labels.birthNamePrefix}><input name="birthNamePrefix" defaultValue={employee.birthNamePrefix ?? ''} className="form-field" /></Field>
            <Field label={labels.birthName}><input name="birthName" defaultValue={employee.birthName} required className="form-field" /></Field>
            <Field label={labels.nameUsage}><select name="nameUsage" defaultValue={employee.nameUsage ?? 'BIRTH_NAME'} className="form-field"><option value="BIRTH_NAME">{labels.nameUsageBirth}</option><option value="PARTNER_NAME">{labels.nameUsagePartner}</option><option value="PARTNER_BEFORE_BIRTH_NAME">{labels.nameUsagePartnerBirth}</option><option value="BIRTH_NAME_BEFORE_PARTNER_NAME">{labels.nameUsageBirthPartner}</option></select></Field>
            <Field label={labels.gender}><select name="gender" defaultValue={employee.gender ?? 'PREFER_NOT_TO_SAY'} className="form-field"><option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option><option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option></select></Field>
          </FormSection>
          <FormSection icon={<MapPin className="h-4 w-4" />} title={labels.birthDate}>
            <Field label={labels.birthDate}><input name="birthDate" type="date" defaultValue={employee.birthDate ?? ''} className="form-field" /></Field>
            <Field label={labels.birthPlace}><input name="birthPlace" defaultValue={employee.birthPlace ?? ''} className="form-field" /></Field>
            <CountrySelect name="birthCountry" label={labels.birthCountry} initialValue={employee.birthCountry ?? defaultCountryCode} defaultCountryCode={defaultCountryCode} locale={locale} labels={labels} />
            <CountrySelect name="nationality" label={labels.nationality} initialValue={employee.nationality ?? defaultCountryCode} defaultCountryCode={defaultCountryCode} locale={locale} labels={labels} />
            <LanguageSelect name="preferredLanguage" label={labels.preferredLanguage} initialValue={employee.preferredLanguage ?? 'nl-NL'} locale={locale} labels={labels} />
          </FormSection>
          <FormSection icon={<Phone className="h-4 w-4" />} title={labels.privateContact}>
            <Field label={labels.privateEmail}><input name="privateEmail" type="email" defaultValue={employee.privateEmail ?? ''} className="form-field" /></Field>
            <Field label={labels.privatePhone}><input name="privatePhone" type="tel" defaultValue={employee.privatePhone ?? ''} className="form-field" /></Field>
            <Field label={labels.privateMobile}><input name="privateMobile" type="tel" defaultValue={employee.privateMobile ?? ''} className="form-field" /></Field>
          </FormSection>
          <FormSection icon={<Mail className="h-4 w-4" />} title={labels.workContact}>
            <Field label={labels.workEmail}><input name="workEmail" type="email" defaultValue={employee.workEmail ?? ''} className="form-field" /></Field>
            <Field label={labels.workPhone}><input name="workPhone" type="tel" defaultValue={employee.workPhone ?? ''} className="form-field" /></Field>
            <Field label={labels.workPhoneExtension}><input name="workPhoneExt" defaultValue={employee.workPhoneExt ?? ''} className="form-field" /></Field>
            <Field label={labels.workMobile}><input name="workMobile" type="tel" defaultValue={employee.workMobile ?? ''} className="form-field" /></Field>
          </FormSection>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
          <button type="submit" disabled={state === 'saving'} className="button-primary gap-2">{state === 'saving' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{state === 'saving' ? labels.saving : labels.save}</button>
          <button type="button" onClick={() => setEditing(false)} className="button-secondary">{labels.cancel}</button>
          {state === 'failed' && <InlineState kind="failed">{labels.genericError}</InlineState>}
        </div>
      </form>
    )
  }

  return (
    <div>
      <details className="mb-6 rounded-xl border bg-background p-4" open={roleAssignments.length > 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><ShieldCheck aria-hidden="true" className="size-5 text-primary" />{labels.rolesTitle}</summary>
        {roleAssignments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{labels.rolesEmpty}</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{roleAssignments.map((assignment) => <div className="rounded-lg border bg-surface p-3" key={assignment.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{assignment.roleName}</p><p className="text-xs text-muted-foreground">{assignment.roleCode}</p></div><span className="status-chip bg-accent text-accent-foreground">{assignment.departmentName ?? labels.roleTenantWide}</span></div><p className="mt-2 text-xs text-muted-foreground">{labels.roleDepartment}: {assignment.departmentName ?? labels.roleTenantWide}</p><p className="mt-1 text-xs text-muted-foreground">{labels.roleValidFrom}: {formatDate(assignment.effectiveFrom, { locale, dateFormat })}{assignment.effectiveTo ? ` · ${labels.roleValidUntil}: ${formatDate(assignment.effectiveTo, { locale, dateFormat })}` : ''}</p></div>)}</div>}
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3"><SectionHeader icon={<UserRound className="h-5 w-5" />} title={labels.personalTitle} />{capabilities.canEditEmployee && employee.updatedAt && <button type="button" onClick={() => setEditing(true)} className="button-secondary gap-2"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editPersonal}</button>}</div>
      <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <DataItem label={labels.employeeNumber} value={employee.employeeNumber} />
        <DataItem label={labels.birthDate} value={employee.birthDate} fallback={labels.notRecorded} />
        <DataItem label={labels.birthPlace} value={employee.birthPlace} fallback={labels.notRecorded} />
        <DataItem label={labels.nationality} value={employee.nationality} fallback={labels.notRecorded} />
        <DataItem label={labels.privateEmail} value={employee.privateEmail} fallback={labels.notRecorded} isEmail />
        <DataItem label={labels.privateMobile} value={employee.privateMobile} fallback={labels.notRecorded} />
        <DataItem label={labels.workEmail} value={employee.workEmail} fallback={labels.notRecorded} isEmail />
        <DataItem label={labels.workMobile} value={employee.workMobile} fallback={labels.notRecorded} />
      </dl>
      {capabilities.canReadBsn && <BsnReveal employeeId={employee.id} labels={labels} />}
    </div>
  )
}

function BsnReveal({ employeeId, labels }: { employeeId: string; labels: EmployeePersonCardLabels }) {
  const [state, setState] = useState<'hidden' | 'loading' | 'visible' | 'failed'>('hidden')
  const [bsn, setBsn] = useState<string | null>(null)
  async function reveal(): Promise<void> {
    setState('loading')
    try {
      const response = await fetch(`/api/employees/${employeeId}/bsn`, { method: 'POST' })
      if (!response.ok) { setState('failed'); return }
      const payload: { data: { bsn: string | null } } = await response.json()
      setBsn(payload.data.bsn); setState('visible')
    } catch {
      setState('failed')
    }
  }
  return (
    <section className="mt-8 rounded-xl border bg-surface-raised p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><span className="rounded-lg bg-accent p-2 text-accent-foreground"><ShieldCheck aria-hidden="true" className="h-4 w-4" /></span><div><h3 className="font-semibold">{labels.bsnTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.bsnAuditHelp}</p></div></div>
        {state === 'visible' ? <output className="rounded-lg bg-background px-4 py-2 font-semibold tabular-nums">{bsn ?? labels.bsnNotRecorded}</output> : <button type="button" onClick={reveal} disabled={state === 'loading'} className="button-secondary shrink-0 gap-2">{state === 'loading' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Eye aria-hidden="true" className="h-4 w-4" />}{state === 'loading' ? labels.revealingBsn : labels.revealBsn}</button>}
      </div>
      {state === 'failed' && <InlineState kind="failed">{labels.genericError}</InlineState>}
    </section>
  )
}

type ReminderRole = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE'

function LegacyAddressesPanel({ employeeId, addresses, canManage, locale, dateFormat, labels }: { employeeId: string; addresses: NonNullable<EmployeeDetailViewModel['addresses']>; canManage: boolean; locale: string; dateFormat: DateFormat; labels: EmployeePersonCardLabels }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const formatAddressDate = (date: string) => formatDate(date, { locale, dateFormat })
  return <section>
    <SectionHeader icon={<Home className="h-5 w-5" />} title={labels.addressesTitle} />
    {addresses.length === 0 ? <EmptyState icon={<Home className="h-5 w-5" />} text={labels.addressesEmpty} /> : <ol className="mt-6 space-y-3">{addresses.map((address) => <li key={address.id} className="rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{address.addressLine1}</p>{!address.validUntil && <span className="status-chip bg-success-surface text-success">{labels.current}</span>}</div>{address.addressLine2 && <p className="mt-1 text-sm">{address.addressLine2}</p>}<p className="mt-1 text-sm text-muted-foreground">{[address.postalCode, address.city, address.region, address.countryCode].filter(Boolean).join(' · ')}</p><p className="mt-2 text-xs tabular-nums text-muted-foreground">{formatAddressDate(address.validFrom)} — {address.validUntil ? formatAddressDate(address.validUntil) : labels.current}</p></div>
        {canManage && <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => setEditingId(editingId === address.id ? null : address.id)} className="button-secondary gap-2"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editResource}</button><DeleteResourceButton url={`/api/employees/${employeeId}/addresses/${address.id}`} label={labels.deleteResource} confirmation={labels.confirmDelete} disabled={addresses.length === 1} disabledTitle={labels.cannotDeleteLastAddress} onDeleted={() => setEditingId(null)} /></div>}
      </div>
      {editingId === address.id && <div className="mt-5 border-t pt-5"><AddressForm employeeId={employeeId} locale={locale} labels={labels} address={address} onCancel={() => setEditingId(null)} onSaved={() => setEditingId(null)} /></div>}
    </li>)}</ol>}
    {canManage && <div className="mt-6"><ResourceDetails title={labels.addAddress}><AddressForm employeeId={employeeId} locale={locale} labels={labels} /></ResourceDetails></div>}
  </section>
}

function AddressForm({ employeeId, locale, labels, address, onCancel, onSaved }: { employeeId: string; locale: string; labels: EmployeePersonCardLabels; address?: NonNullable<EmployeeDetailViewModel['addresses']>[number]; onCancel?: () => void; onSaved?: () => void }) {
  const router = useRouter(); const [state, setState] = useState<MutationState>('idle')
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'empty' | 'failed'>('idle')
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [query, setQuery] = useState(address?.addressLine1 ?? '')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [reminderRoles, setReminderRoles] = useState<ReminderRole[]>([])
  const [values, setValues] = useState({ countryCode: address?.countryCode ?? 'NL', addressLine1: address?.addressLine1 ?? '', addressLine2: address?.addressLine2 ?? '', street: address?.street ?? '', houseNumber: address?.houseNumber ?? '', addition: address?.houseNumberAddition ?? '', postalCode: address?.postalCode ?? '', city: address?.city ?? '', region: address?.region ?? '', validFrom: address?.validFrom ?? new Date().toISOString().slice(0, 10), validUntil: address?.validUntil ?? '', source: (address?.source === 'pdok' || address?.source === 'geoapify' ? address.source : 'manual') as 'manual' | 'pdok' | 'geoapify', sourceReference: address?.sourceReference ?? '' })
  const isNew = !address
  const isDutch = values.countryCode === 'NL'
  const countryOptions = getCountryOptions(locale)

  useEffect(() => {
    if (query.trim().length < 3 || !isNew) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearchState('loading')
      try {
        const response = await fetch(`/api/address-suggestions?country=${values.countryCode}&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        if (!response.ok) throw new Error('ADDRESS_SEARCH_UNAVAILABLE')
        const payload: { data?: AddressSuggestion[] } = await response.json()
        const result = payload.data ?? []
        setSuggestions(result); setSearchState(result.length > 0 ? 'idle' : 'empty')
      } catch {
        if (!controller.signal.aborted) { setSuggestions([]); setSearchState('failed') }
      }
    }, 300)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [isNew, query, values.countryCode])

  function updateValue(name: keyof typeof values, value: string): void { setValues((current) => ({ ...current, [name]: value, source: 'manual', sourceReference: '' })) }
  function updateQuery(value: string): void { setQuery(value); if (value.trim().length < 3) { setSuggestions([]); setSearchState('idle') } }
  function applySuggestion(suggestion: AddressSuggestion): void { setValues((current) => ({ ...current, countryCode: suggestion.countryCode, addressLine1: suggestion.addressLine1, addressLine2: suggestion.addressLine2 ?? '', street: suggestion.street ?? '', houseNumber: suggestion.houseNumber ?? '', addition: suggestion.houseNumberAddition ?? '', postalCode: suggestion.postalCode ?? '', city: suggestion.city ?? '', region: suggestion.region ?? '', source: suggestion.source, sourceReference: suggestion.sourceReference ?? '' })); setQuery(suggestion.label); setSuggestions([]); setSearchState('idle') }
  function toggleReminderRole(role: ReminderRole): void { setReminderRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]) }

  async function lookupByPostalCode(): Promise<void> {
    setLookupState('loading')
    try { const response = await fetch(`/api/address-lookup?country=NL&postcode=${encodeURIComponent(values.postalCode)}&houseNumber=${encodeURIComponent(values.houseNumber)}`); if (!response.ok) throw new Error('ADDRESS_LOOKUP_UNAVAILABLE'); const payload: { data?: AddressSuggestion[] } = await response.json(); if (payload.data?.[0]) applySuggestion(payload.data[0]) } catch { setLookupState('failed') } finally { setLookupState('idle') }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const payload = { ...values, addressLine1: nullable(values.addressLine1), addressLine2: nullable(values.addressLine2), street: nullable(values.street), houseNumber: nullable(values.houseNumber), addition: nullable(values.addition), postalCode: nullable(values.postalCode), city: values.city, region: nullable(values.region), validUntil: nullable(values.validUntil), sourceReference: nullable(values.sourceReference), province: null, directReminderRecipients: isNew ? reminderRoles : [] }
    const succeeded = await runJsonMutation(setState, address ? `/api/employees/${employeeId}/addresses/${address.id}` : `/api/employees/${employeeId}/addresses`, address ? 'PATCH' : 'POST', payload)
    if (!succeeded) return
    if (onSaved) onSaved()
    if (isNew) { setReminderRoles([]); setValues((current) => ({ ...current, addressLine1: '', addressLine2: '', street: '', houseNumber: '', addition: '', postalCode: '', city: '', region: '', validUntil: '', source: 'manual', sourceReference: '' })); setQuery('') }
    router.refresh()
  }

  return <form onSubmit={submit} className="grid gap-4">
    <div className="grid gap-3 sm:grid-cols-[minmax(11rem,0.75fr)_minmax(0,2fr)] sm:items-start">
      <Field label={labels.country} className="self-start"><select name="countryCode" value={values.countryCode} onChange={(event) => updateValue('countryCode', event.target.value)} className="form-field">{countryOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></Field>
      <Field label={labels.addressSearch} className="min-w-0"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder={isDutch ? labels.addressSearchPlaceholder : `${labels.addressSearchPlaceholder} ${countryOptions.find((option) => option.code === values.countryCode)?.label ?? values.countryCode}`} className="form-field pl-10" autoComplete="off" autoFocus={isNew} role="combobox" aria-autocomplete="list" aria-controls="address-suggestions" aria-expanded={suggestions.length > 0} /></div><div className="mt-1.5 min-h-4 text-xs text-muted-foreground">{searchState === 'loading' && <span className="inline-flex items-center gap-1.5"><LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />{labels.searchLoading}</span>}{searchState === 'failed' && <span role="alert" className="text-destructive">{labels.searchUnavailable}</span>}{searchState === 'empty' && <span>{labels.searchNoResults}</span>}</div>{suggestions.length > 0 && <ul id="address-suggestions" role="listbox" className="mt-1 max-h-60 overflow-y-auto rounded-lg border bg-background shadow-sm">{suggestions.map((suggestion) => <li key={`${suggestion.source}-${suggestion.sourceReference ?? suggestion.label}`} role="presentation"><button type="button" role="option" aria-selected={false} className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent" onClick={() => applySuggestion(suggestion)}><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{suggestion.label}</span></button></li>)}</ul>}</Field>
    </div>
    <div className="grid gap-3 sm:grid-cols-6"><div className="sm:col-span-full"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.manualEntry}</p></div>{isDutch ? <><Field label={labels.street} className="sm:col-span-4"><input value={values.street} onChange={(event) => updateValue('street', event.target.value)} className="form-field" /></Field><Field label={labels.houseNumber}><input value={values.houseNumber} onChange={(event) => updateValue('houseNumber', event.target.value)} className="form-field" /></Field><Field label={labels.addition}><input value={values.addition} onChange={(event) => updateValue('addition', event.target.value)} className="form-field" /></Field></> : <><Field label={labels.addressLine1} className="sm:col-span-4"><input value={values.addressLine1} onChange={(event) => updateValue('addressLine1', event.target.value)} className="form-field" /></Field><Field label={labels.addressLine2} className="sm:col-span-2"><input value={values.addressLine2} onChange={(event) => updateValue('addressLine2', event.target.value)} className="form-field" /></Field></>}<Field label={labels.postalCode} className="sm:col-span-2"><input value={values.postalCode} onChange={(event) => updateValue('postalCode', event.target.value)} className="form-field uppercase" /></Field>{isDutch && values.postalCode.trim() && values.houseNumber.trim() && !values.city.trim() && <div className="sm:col-span-2 sm:self-end"><button type="button" onClick={lookupByPostalCode} disabled={lookupState === 'loading'} aria-label={`${labels.lookup}: ${labels.lookupByPostalCode}`} className="button-secondary inline-flex w-full justify-center gap-2">{lookupState === 'loading' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{lookupState === 'loading' ? labels.searchLoading : labels.lookup}</button><p className="mt-1.5 text-xs text-muted-foreground">{labels.lookupHint}</p></div>}<Field label={labels.city} className="sm:col-span-4"><input value={values.city} onChange={(event) => updateValue('city', event.target.value)} required className="form-field" /></Field><Field label={labels.region} className="sm:col-span-2"><input value={values.region} onChange={(event) => updateValue('region', event.target.value)} className="form-field" /></Field><Field label={labels.validFrom} className="sm:col-span-2"><input value={values.validFrom} onChange={(event) => updateValue('validFrom', event.target.value)} type="date" required className="form-field" /></Field><Field label={labels.validUntil} className="sm:col-span-2"><div className="flex items-center gap-2"><input value={values.validUntil} onChange={(event) => updateValue('validUntil', event.target.value)} type="date" className="form-field min-w-0 flex-1" /><button type="button" aria-label={labels.clearValidUntil} className="button-secondary shrink-0 px-3" onClick={() => updateValue('validUntil', '')}>{labels.clearValidUntil}</button></div></Field>{lookupState === 'failed' && <span role="alert" className="text-xs text-destructive sm:col-span-full">{labels.lookupUnavailable}</span>}</div>
    {isNew && <fieldset className="rounded-xl border bg-surface-raised p-4"><legend className="px-1 text-sm font-semibold">{labels.directReminderTitle}</legend><p className="mt-1 text-xs text-muted-foreground">{labels.directReminderHelp}</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{([['HR_ADMIN', labels.reminderHrAdmin], ['MANAGER', labels.reminderManager], ['EMPLOYEE', labels.reminderEmployee]] as const).map(([role, label]) => <label key={role} className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={reminderRoles.includes(role)} onChange={() => toggleReminderRole(role)} className="h-4 w-4 accent-primary" />{label}</label>)}</div></fieldset>}
    <FormFooter state={state} submit={labels.saveAddress} saving={labels.saving} saved={labels.saved} failed={labels.genericError} cancel={onCancel ? labels.cancel : undefined} onCancel={onCancel} />
  </form>
}

type AddressKind = 'PRIMARY' | 'SECONDARY'

function AddressesPanelV2({ employeeId, addresses, canManage, locale, dateFormat, labels }: { employeeId: string; addresses: NonNullable<EmployeeDetailViewModel['addresses']>; canManage: boolean; locale: string; dateFormat: DateFormat; labels: EmployeePersonCardLabels }) {
  const [openPanel, setOpenPanel] = useState<AddressKind>('PRIMARY')
  const [editingId, setEditingId] = useState<string | null>(null)
  const primaryAddresses = addresses.filter((address) => address.addressType === 'PRIMARY')
  const secondaryAddresses = addresses.filter((address) => address.addressType === 'SECONDARY')
  const formatAddressDate = (date: string) => formatDate(date, { locale, dateFormat })

  if (!Array.isArray(addresses)) {
    return <LegacyAddressesPanel employeeId={employeeId} addresses={addresses} canManage={canManage} locale={locale} dateFormat={dateFormat} labels={labels} />
  }

  function renderAddress(address: NonNullable<EmployeeDetailViewModel['addresses']>[number], kind: AddressKind): ReactNode {
    const isSecondary = kind === 'SECONDARY'
    const isEditing = editingId === address.id
    return <article key={address.id} className="rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{address.addressLine1}</p>{!isSecondary && <span className="status-chip bg-success-surface text-success">{labels.current}</span>}</div>
          {isSecondary && address.description && <p className="mt-1 text-sm font-medium text-primary">{address.description}</p>}
          {address.addressLine2 && <p className="mt-1 text-sm">{address.addressLine2}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{[address.postalCode, address.city, address.region, address.countryCode].filter(Boolean).join(' · ')}</p>
          <p className="mt-2 text-xs tabular-nums text-muted-foreground">{labels.validFrom}: {formatAddressDate(address.validFrom)}{isSecondary && address.validUntil ? ` · ${labels.validUntil}: ${formatAddressDate(address.validUntil)}` : ''}</p>
        </div>
        {canManage && <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => setEditingId(isEditing ? null : address.id)} className="button-secondary gap-2"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editResource}</button><DeleteResourceButton url={`/api/employees/${employeeId}/addresses/${address.id}`} label={labels.deleteResource} confirmation={labels.confirmDelete} disabled={kind === 'PRIMARY' && primaryAddresses.length === 1} disabledTitle={kind === 'PRIMARY' ? labels.cannotDeleteLastAddress : undefined} onDeleted={() => setEditingId(null)} /></div>}
      </div>
      {isEditing && <div className="mt-5 border-t pt-5"><AddressFormV2 employeeId={employeeId} locale={locale} labels={labels} address={address} addressType={kind} onCancel={() => setEditingId(null)} onSaved={() => setEditingId(null)} /></div>}
    </article>
  }

  function renderPanel(kind: AddressKind): ReactNode {
    const isPrimary = kind === 'PRIMARY'
    const items = isPrimary ? primaryAddresses : secondaryAddresses
    const title = isPrimary ? labels.primaryAddress : labels.secondaryAddress
    const isOpen = openPanel === kind
    return <section className="overflow-hidden rounded-2xl border bg-surface-raised" key={kind}>
      <button type="button" aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-semibold" onClick={() => { setOpenPanel(kind); setEditingId(null) }}><span className="flex items-center gap-2"><Home aria-hidden="true" className="h-5 w-5 text-primary" />{title}</span><ChevronDown aria-hidden="true" className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>
      {isOpen && <div className="border-t px-5 pb-5 pt-4">
        {!isPrimary && <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{labels.secondaryAddressHelp}</p>}
        {items.length === 0 ? <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">{isPrimary ? labels.addressesEmpty : labels.noSecondaryAddress}</p> : <div className="space-y-3">{items.map((address) => renderAddress(address, kind))}</div>}
        {canManage && <div className="mt-4"><ResourceDetails title={isPrimary ? labels.relocateAddress : labels.secondaryAddress}><AddressFormV2 employeeId={employeeId} locale={locale} labels={labels} addressType={kind} /></ResourceDetails></div>}
      </div>}
    </section>
  }

  return <section>
    <SectionHeader icon={<Home className="h-5 w-5" />} title={labels.addressesTitle} />
    {addresses.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{labels.addressesEmpty}</p>}
    <div className="mt-6 space-y-3">{(['PRIMARY', 'SECONDARY'] as const).map(renderPanel)}</div>
  </section>
}

function AddressFormV2({ employeeId, locale, labels, address, addressType, onCancel, onSaved }: { employeeId: string; locale: string; labels: EmployeePersonCardLabels; addressType: AddressKind; address?: NonNullable<EmployeeDetailViewModel['addresses']>[number]; onCancel?: () => void; onSaved?: () => void }) {
  const router = useRouter()
  const [state, setState] = useState<MutationState>('idle')
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'empty' | 'failed'>('idle')
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [query, setQuery] = useState(address?.addressLine1 ?? '')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [reminderRoles, setReminderRoles] = useState<ReminderRole[]>([])
  const [values, setValues] = useState({ countryCode: address?.countryCode ?? 'NL', addressLine1: address?.addressLine1 ?? '', addressLine2: address?.addressLine2 ?? '', street: address?.street ?? '', houseNumber: address?.houseNumber ?? '', addition: address?.houseNumberAddition ?? '', postalCode: address?.postalCode ?? '', city: address?.city ?? '', region: address?.region ?? '', validFrom: address?.validFrom ?? new Date().toISOString().slice(0, 10), validUntil: address?.validUntil ?? '', description: address?.description ?? '', source: (address?.source === 'pdok' || address?.source === 'geoapify' ? address.source : 'manual') as 'manual' | 'pdok' | 'geoapify', sourceReference: address?.sourceReference ?? '' })
  const isNew = !address
  const isSecondary = addressType === 'SECONDARY'
  const isDutch = values.countryCode === 'NL'
  const countryOptions = getCountryOptions(locale)

  useEffect(() => {
    if (query.trim().length < 3 || !isNew) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearchState('loading')
      try {
        const response = await fetch(`/api/address-suggestions?country=${values.countryCode}&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        if (!response.ok) throw new Error('ADDRESS_SEARCH_UNAVAILABLE')
        const payload: { data?: AddressSuggestion[] } = await response.json()
        const result = payload.data ?? []
        setSuggestions(result); setSearchState(result.length > 0 ? 'idle' : 'empty')
      } catch {
        if (!controller.signal.aborted) { setSuggestions([]); setSearchState('failed') }
      }
    }, 300)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [isNew, query, values.countryCode])

  function updateValue(name: keyof typeof values, value: string): void { setValues((current) => ({ ...current, [name]: value, source: 'manual', sourceReference: '' })) }
  function updateQuery(value: string): void { setQuery(value); if (value.trim().length < 3) { setSuggestions([]); setSearchState('idle') } }
  function applySuggestion(suggestion: AddressSuggestion): void { setValues((current) => ({ ...current, countryCode: suggestion.countryCode, addressLine1: suggestion.addressLine1, addressLine2: suggestion.addressLine2 ?? '', street: suggestion.street ?? '', houseNumber: suggestion.houseNumber ?? '', addition: suggestion.houseNumberAddition ?? '', postalCode: suggestion.postalCode ?? '', city: suggestion.city ?? '', region: suggestion.region ?? '', source: suggestion.source, sourceReference: suggestion.sourceReference ?? '' })); setQuery(suggestion.label); setSuggestions([]); setSearchState('idle') }
  function toggleReminderRole(role: ReminderRole): void { setReminderRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]) }

  async function lookupByPostalCode(): Promise<void> {
    setLookupState('loading')
    try { const response = await fetch(`/api/address-lookup?country=NL&postcode=${encodeURIComponent(values.postalCode)}&houseNumber=${encodeURIComponent(values.houseNumber)}`); if (!response.ok) throw new Error('ADDRESS_LOOKUP_UNAVAILABLE'); const payload: { data?: AddressSuggestion[] } = await response.json(); if (payload.data?.[0]) applySuggestion(payload.data[0]) } catch { setLookupState('failed') } finally { setLookupState('idle') }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const payload = { addressType, description: isSecondary ? nullable(values.description.trim()) : null, countryCode: values.countryCode, addressLine1: nullable(values.addressLine1), addressLine2: nullable(values.addressLine2), street: nullable(values.street), houseNumber: nullable(values.houseNumber), addition: nullable(values.addition), postalCode: nullable(values.postalCode), city: values.city, region: nullable(values.region), validFrom: values.validFrom, validUntil: isSecondary ? nullable(values.validUntil) : null, source: values.source, sourceReference: nullable(values.sourceReference), province: null, directReminderRecipients: isNew ? reminderRoles : [] }
    const succeeded = await runJsonMutation(setState, address ? `/api/employees/${employeeId}/addresses/${address.id}` : `/api/employees/${employeeId}/addresses`, address ? 'PATCH' : 'POST', payload)
    if (!succeeded) return
    onSaved?.()
    if (isNew) { setReminderRoles([]); setValues((current) => ({ ...current, addressLine1: '', addressLine2: '', street: '', houseNumber: '', addition: '', postalCode: '', city: '', region: '', validUntil: '', description: '', source: 'manual', sourceReference: '' })); setQuery('') }
    router.refresh()
  }

  return <form onSubmit={submit} className="grid gap-4">
    {isSecondary && <Field label={labels.secondaryAddressDescription}><input value={values.description} onChange={(event) => updateValue('description', event.target.value)} required maxLength={240} className="form-field" /><span className="text-xs font-normal text-muted-foreground">{labels.secondaryAddressHelp}</span></Field>}
    <div className="grid gap-3 sm:grid-cols-[minmax(11rem,0.75fr)_minmax(0,2fr)] sm:items-start">
      <Field label={labels.country} className="self-start"><select name="countryCode" value={values.countryCode} onChange={(event) => updateValue('countryCode', event.target.value)} className="form-field">{countryOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></Field>
      <Field label={labels.addressSearch} className="min-w-0"><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder={isDutch ? labels.addressSearchPlaceholder : `${labels.addressSearchPlaceholder} ${countryOptions.find((option) => option.code === values.countryCode)?.label ?? values.countryCode}`} className="form-field pl-10" autoComplete="off" autoFocus={isNew} role="combobox" aria-autocomplete="list" aria-controls="address-suggestions" aria-expanded={suggestions.length > 0} /></div><div className="mt-1.5 min-h-4 text-xs text-muted-foreground">{searchState === 'loading' && <span className="inline-flex items-center gap-1.5"><LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />{labels.searchLoading}</span>}{searchState === 'failed' && <span role="alert" className="text-destructive">{labels.searchUnavailable}</span>}{searchState === 'empty' && <span>{labels.searchNoResults}</span>}</div>{suggestions.length > 0 && <ul id="address-suggestions" role="listbox" className="mt-1 max-h-60 overflow-y-auto rounded-lg border bg-background shadow-sm">{suggestions.map((suggestion) => <li key={`${suggestion.source}-${suggestion.sourceReference ?? suggestion.label}`} role="presentation"><button type="button" role="option" aria-selected={false} className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent" onClick={() => applySuggestion(suggestion)}><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{suggestion.label}</span></button></li>)}</ul>}</Field>
    </div>
    <div className="grid gap-3 sm:grid-cols-6"><div className="sm:col-span-full"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.manualEntry}</p></div>{isDutch ? <><Field label={labels.street} className="sm:col-span-4"><input value={values.street} onChange={(event) => updateValue('street', event.target.value)} className="form-field" />{/\d/.test(values.street) && <span className="text-xs text-muted-foreground">{labels.streetHasNumberNote}</span>}</Field><Field label={labels.houseNumber}><input value={values.houseNumber} onChange={(event) => updateValue('houseNumber', event.target.value)} className="form-field" /></Field><Field label={labels.addition}><input value={values.addition} onChange={(event) => updateValue('addition', event.target.value)} className="form-field" /></Field></> : <><Field label={labels.addressLine1} className="sm:col-span-4"><input value={values.addressLine1} onChange={(event) => updateValue('addressLine1', event.target.value)} className="form-field" /></Field><Field label={labels.addressLine2} className="sm:col-span-2"><input value={values.addressLine2} onChange={(event) => updateValue('addressLine2', event.target.value)} className="form-field" /></Field></>}<Field label={labels.postalCode} className="sm:col-span-2"><input value={values.postalCode} onChange={(event) => updateValue('postalCode', event.target.value)} className="form-field uppercase" /></Field>{isDutch && values.postalCode.trim() && values.houseNumber.trim() && !values.city.trim() && <div className="sm:col-span-2 sm:self-end"><button type="button" onClick={lookupByPostalCode} disabled={lookupState === 'loading'} aria-label={`${labels.lookup}: ${labels.lookupByPostalCode}`} className="button-secondary inline-flex w-full justify-center gap-2">{lookupState === 'loading' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{lookupState === 'loading' ? labels.searchLoading : labels.lookup}</button><p className="mt-1.5 text-xs text-muted-foreground">{labels.lookupHint}</p></div>}<Field label={labels.city} className="sm:col-span-4"><input value={values.city} onChange={(event) => updateValue('city', event.target.value)} required className="form-field" /></Field><Field label={labels.region} className="sm:col-span-2"><input value={values.region} onChange={(event) => updateValue('region', event.target.value)} className="form-field" /></Field><Field label={labels.validFrom} className="sm:col-span-2"><input value={values.validFrom} onChange={(event) => updateValue('validFrom', event.target.value)} type="date" required className="form-field" /></Field>{isSecondary && <Field label={labels.validUntil} className="sm:col-span-2"><input value={values.validUntil} onChange={(event) => updateValue('validUntil', event.target.value)} type="date" required className="form-field" /></Field>}{lookupState === 'failed' && <span role="alert" className="text-xs text-destructive sm:col-span-full">{labels.lookupUnavailable}</span>}</div>
    {isNew && <fieldset className="rounded-xl border bg-surface-raised p-4"><legend className="px-1 text-sm font-semibold">{labels.directReminderTitle}</legend><p className="mt-1 text-xs text-muted-foreground">{labels.directReminderHelp}</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{([['HR_ADMIN', labels.reminderHrAdmin], ['MANAGER', labels.reminderManager], ['EMPLOYEE', labels.reminderEmployee]] as const).map(([role, label]) => <label key={role} className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={reminderRoles.includes(role)} onChange={() => toggleReminderRole(role)} className="h-4 w-4 accent-primary" />{label}</label>)}</div></fieldset>}
    <FormFooter state={state} submit={labels.saveAddress} saving={labels.saving} saved={labels.saved} failed={labels.genericError} cancel={onCancel ? labels.cancel : undefined} onCancel={onCancel} />
  </form>
}

function CountrySelect({ name, label, initialValue, defaultCountryCode, locale, labels }: { name: string; label: string; initialValue: string; defaultCountryCode: string; locale: string; labels: Pick<EmployeePersonCardLabels, 'countrySearch' | 'countryNoResults'> }) {
  const [selected, setSelected] = useState(initialValue || defaultCountryCode)
  const countries = useMemo(() => getCountryOptions(locale), [locale])
  return <Field label={label}><DropdownSelect aria-label={label} emptyLabel={labels.countryNoResults} name={name} onChange={(event) => setSelected(event.target.value)} searchPlaceholder={labels.countrySearch} searchable value={selected}>{countries.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}</DropdownSelect></Field>
}

const LANGUAGE_CODES = ['nl-NL', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'it-IT', 'pt-PT', 'pl-PL', 'tr-TR', 'ar-SA', 'zh-CN', 'ja-JP', 'ko-KR', 'ru-RU', 'uk-UA', 'sv-SE', 'da-DK', 'nb-NO', 'fi-FI', 'cs-CZ', 'el-GR', 'ro-RO', 'hu-HU', 'bg-BG', 'hr-HR', 'sk-SK', 'sl-SI', 'he-IL', 'hi-IN', 'id-ID']

function LanguageSelect({ name, label, initialValue, locale, labels }: { name: string; label: string; initialValue: string; locale: string; labels: Pick<EmployeePersonCardLabels, 'languageSearch' | 'languageNoResults'> }) {
  const [selected, setSelected] = useState(initialValue)
  const languages = useMemo(() => {
    const displayNames = new Intl.DisplayNames([locale], { type: 'language' })
    const options = LANGUAGE_CODES.map((code) => ({ code, label: displayNames.of(code) ?? code }))
    return options.some((option) => option.code === initialValue) || !initialValue ? options : [{ code: initialValue, label: initialValue }, ...options]
  }, [initialValue, locale])
  return <Field label={label}><DropdownSelect aria-label={label} emptyLabel={labels.languageNoResults} name={name} onChange={(event) => setSelected(event.target.value)} searchPlaceholder={labels.languageSearch} searchable value={selected}>{languages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}</DropdownSelect></Field>
}

function getCountryOptions(locale: string): Array<{ code: string; label: string }> {
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
  return [...new Set(['NL', ...codes])].map((code) => ({ code, label: displayNames.of(code) ?? code })).sort((left, right) => left.code === 'NL' ? -1 : right.code === 'NL' ? 1 : left.label.localeCompare(right.label))
}

function BankAccountsPanel({ employeeId, accounts, canManage, labels }: { employeeId: string; accounts: NonNullable<EmployeeDetailViewModel['bankAccounts']>; canManage: boolean; labels: EmployeePersonCardLabels }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  return <section>
    <SectionHeader icon={<CreditCard className="h-5 w-5" />} title={labels.banksTitle} />
    {accounts.length === 0 ? <EmptyState icon={<CreditCard className="h-5 w-5" />} text={labels.banksEmpty} /> : <ul className="mt-6 space-y-3">{accounts.map((account) => <li key={account.id} className="rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold tabular-nums">{account.maskedIban}</p>{account.isPrimary && <span className="status-chip bg-success-surface text-success">{labels.primary}</span>}</div><p className="mt-1 text-sm text-muted-foreground">{account.accountHolder}{account.description ? ` · ${account.description}` : ''}</p></div>
        {canManage && <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => setEditingId(editingId === account.id ? null : account.id)} className="button-secondary gap-2"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editResource}</button><DeleteResourceButton url={`/api/employees/${employeeId}/bank-accounts/${account.id}`} label={labels.deleteResource} confirmation={labels.confirmDelete} onDeleted={() => setEditingId(null)} /></div>}
      </div>
      {editingId === account.id && <div className="mt-5 border-t pt-5"><BankAccountForm employeeId={employeeId} account={account} labels={labels} onCancel={() => setEditingId(null)} onSaved={() => setEditingId(null)} /></div>}
    </li>)}</ul>}
    {canManage && <div className="mt-6"><ResourceDetails title={labels.addBank}><BankAccountForm employeeId={employeeId} labels={labels} /></ResourceDetails></div>}
  </section>
}

function BankAccountForm({ employeeId, account, labels, onCancel, onSaved }: { employeeId: string; account?: EmployeeBankAccount; labels: EmployeePersonCardLabels; onCancel?: () => void; onSaved?: () => void }) {
  const router = useRouter(); const [state, setState] = useState<MutationState>('idle')
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement)
    const payload = { iban: value(form, 'iban'), bic: nullable(value(form, 'bic')), accountHolder: value(form, 'accountHolder'), description: nullable(value(form, 'description')), isPrimary: form.get('isPrimary') === 'on' }
    const succeeded = await runJsonMutation(setState, account ? `/api/employees/${employeeId}/bank-accounts/${account.id}` : `/api/employees/${employeeId}/bank-accounts`, account ? 'PATCH' : 'POST', payload)
    if (!succeeded) return
    onSaved?.(); formElement.reset(); router.refresh()
  }
  return <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><Field label={labels.iban}><input name="iban" required autoComplete="off" placeholder={account?.maskedIban} className="form-field uppercase" /></Field><Field label={labels.bic}><input name="bic" maxLength={11} defaultValue={account?.bic ?? ''} className="form-field uppercase" /></Field><Field label={labels.accountHolder}><input name="accountHolder" required defaultValue={account?.accountHolder ?? ''} className="form-field" /></Field><Field label={labels.description}><input name="description" defaultValue={account?.description ?? ''} className="form-field" /></Field><label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input name="isPrimary" type="checkbox" defaultChecked={account?.isPrimary} className="h-4 w-4 accent-primary" />{labels.makePrimary}</label><FormFooter state={state} submit={account ? labels.editResource : labels.saveBank} saving={labels.saving} saved={labels.saved} failed={labels.genericError} cancel={onCancel ? labels.cancel : undefined} onCancel={onCancel} /></form>
}

function RelationsPanel({ employeeId, relations, relationTypes, locale, canManage, labels }: { employeeId: string; relations: NonNullable<EmployeeDetailViewModel['relations']>; relationTypes: EmployeeRelationTypeOption[]; locale: string; canManage: boolean; labels: EmployeePersonCardLabels }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const typeLabels: Record<EmployeeRelation['relationType'], string> = Object.fromEntries(relationTypes.map((item) => [item.code, locale.startsWith('en') ? item.nameEn : item.nameNl])) as Record<EmployeeRelation['relationType'], string>
  return <section>
    <SectionHeader icon={<HeartHandshake className="h-5 w-5" />} title={labels.relationsTitle} />
    {relations.length === 0 ? <EmptyState icon={<HeartHandshake className="h-5 w-5" />} text={labels.relationsEmpty} /> : <ul className="mt-6 grid gap-3 lg:grid-cols-2">{relations.map((relation) => <li key={relation.id} className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{[relation.firstName, relation.prefix, relation.lastName].filter(Boolean).join(' ')}</p>{relation.isEmergencyContact && <span className="status-chip bg-warning-surface text-warning">{labels.emergencyContact}</span>}</div><p className="mt-1 text-sm text-muted-foreground">{typeLabels[relation.relationType] ?? relation.relationType}</p></div>{canManage && <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => setEditingId(editingId === relation.id ? null : relation.id)} className="button-secondary gap-2"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editResource}</button><DeleteResourceButton url={`/api/employees/${employeeId}/relations/${relation.id}`} label={labels.deleteResource} confirmation={labels.confirmDelete} onDeleted={() => setEditingId(null)} /></div>}</div>
      {(relation.mobile || relation.phone || relation.email) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{(relation.mobile || relation.phone) && <span className="flex items-center gap-1.5"><Phone aria-hidden="true" className="h-3.5 w-3.5" />{relation.mobile ?? relation.phone}</span>}{relation.email && <span className="flex items-center gap-1.5"><Mail aria-hidden="true" className="h-3.5 w-3.5" /><EmailLink email={relation.email} /></span>}</div>}
      {editingId === relation.id && <div className="mt-5 border-t pt-5"><RelationForm employeeId={employeeId} relation={relation} relationTypes={relationTypes} locale={locale} labels={labels} onCancel={() => setEditingId(null)} onSaved={() => setEditingId(null)} /></div>}
    </li>)}</ul>}
    {canManage && <div className="mt-6"><ResourceDetails title={labels.addRelation}><RelationForm employeeId={employeeId} relationTypes={relationTypes} locale={locale} labels={labels} /></ResourceDetails></div>}
  </section>
}

function RelationForm({ employeeId, relation, relationTypes, locale, labels, onCancel, onSaved }: { employeeId: string; relation?: EmployeeRelation; relationTypes: EmployeeRelationTypeOption[]; locale: string; labels: EmployeePersonCardLabels; onCancel?: () => void; onSaved?: () => void }) {
  const router = useRouter(); const [state, setState] = useState<MutationState>('idle')
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const payload = { relationType: value(form, 'relationType'), isEmergencyContact: form.get('isEmergencyContact') === 'on', firstName: nullable(value(form, 'firstName')), initials: relation?.initials ?? nullable(value(form, 'initials')), prefix: nullable(value(form, 'prefix')), lastName: value(form, 'lastName'), gender: relation?.gender ?? nullable(value(form, 'gender')), birthDate: relation?.birthDate ?? nullable(value(form, 'birthDate')), phone: nullable(value(form, 'phone')), mobile: nullable(value(form, 'mobile')), email: nullable(value(form, 'email')), notes: nullable(value(form, 'notes')) }; const succeeded = await runJsonMutation(setState, relation ? `/api/employees/${employeeId}/relations/${relation.id}` : `/api/employees/${employeeId}/relations`, relation ? 'PATCH' : 'POST', payload); if (!succeeded) return; onSaved?.(); formElement.reset(); router.refresh() }
  return <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label={labels.relationType}><select name="relationType" defaultValue={relation?.relationType ?? relationTypes[0]?.code} className="form-field">{relationTypes.map((item) => <option key={item.code} value={item.code}>{locale.startsWith('en') ? item.nameEn : item.nameNl}</option>)}</select></Field><label className="flex items-center gap-2 self-end pb-3 text-sm font-medium"><input name="isEmergencyContact" type="checkbox" defaultChecked={relation?.isEmergencyContact} className="h-4 w-4 accent-primary" />{labels.emergencyContact}</label><Field label={labels.firstName}><input name="firstName" defaultValue={relation?.firstName ?? ''} className="form-field" /></Field><Field label={labels.birthNamePrefix}><input name="prefix" defaultValue={relation?.prefix ?? ''} className="form-field" /></Field><Field label={labels.lastName}><input name="lastName" required defaultValue={relation?.lastName ?? ''} className="form-field" /></Field><Field label={labels.mobile}><input name="mobile" type="tel" defaultValue={relation?.mobile ?? ''} className="form-field" /></Field><Field label={labels.privatePhone}><input name="phone" type="tel" defaultValue={relation?.phone ?? ''} className="form-field" /></Field><Field label={labels.email}><input name="email" type="email" defaultValue={relation?.email ?? ''} className="form-field" /></Field><Field label={labels.notes} className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={relation?.notes ?? ''} className="form-field min-h-24" /></Field><FormFooter state={state} submit={relation ? labels.editResource : labels.saveRelation} saving={labels.saving} saved={labels.saved} failed={labels.genericError} cancel={onCancel ? labels.cancel : undefined} onCancel={onCancel} /></form>
}

function FormSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="rounded-2xl border bg-surface-raised p-4 sm:p-5"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">{icon}</span><h3 className="font-semibold">{title}</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div></section>
}

function DeleteResourceButton({ url, label, confirmation, disabled = false, disabledTitle, onDeleted }: { url: string; label: string; confirmation: string; disabled?: boolean; disabledTitle?: string; onDeleted: () => void }) {
  const [state, setState] = useState<MutationState>('idle')
  async function remove(): Promise<void> {
    if (disabled || !window.confirm(confirmation)) return
    const succeeded = await runJsonMutation(setState, url, 'DELETE')
    if (succeeded) onDeleted()
  }
  return <button type="button" onClick={remove} disabled={disabled || state === 'saving'} title={disabled ? disabledTitle : undefined} className="button-secondary gap-2 text-destructive"><Trash2 aria-hidden="true" className="h-4 w-4" />{state === 'saving' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : label}</button>
}

function ResourceDetails({ title, children }: { title: string; children: ReactNode }) { return <details className="group w-full rounded-xl border bg-surface-raised p-4 sm:w-auto sm:min-w-[28rem]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-primary">{title}<ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>{children}</details> }
function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) { return <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">{icon}</span><h2 className="text-lg font-semibold">{title}</h2></div> }
function EmptyState({ icon, text }: { icon: ReactNode; text: string }) { return <div className="mt-6 rounded-xl border border-dashed bg-surface-raised px-5 py-10 text-center text-muted-foreground"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted">{icon}</span><p className="mt-3 text-sm">{text}</p></div> }
function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) { return <label className={`grid gap-1.5 text-sm font-medium ${className}`}>{label}{children}</label> }
function DataItem({ label, value, fallback = '', isEmail = false }: { label: string; value: string | null | undefined; fallback?: string; isEmail?: boolean }) { return <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value ? (isEmail ? <EmailLink email={value} /> : value) : fallback}</dd></div> }
function InlineState({ kind, children }: { kind: 'saved' | 'failed'; children: ReactNode }) { return <span role={kind === 'failed' ? 'alert' : 'status'} className={`inline-flex items-center gap-1.5 text-sm ${kind === 'saved' ? 'text-success' : 'text-destructive'}`}>{kind === 'saved' ? <Check aria-hidden="true" className="h-4 w-4" /> : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}{children}</span> }
function FormFooter({ state, submit, saving, saved, failed, cancel, onCancel }: { state: MutationState; submit: string; saving: string; saved: string; failed: string; cancel?: string; onCancel?: () => void }) { return <div className="flex flex-wrap items-center gap-3 border-t pt-4 sm:col-span-full"><button type="submit" disabled={state === 'saving'} className="button-primary gap-2">{state === 'saving' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{state === 'saving' ? saving : submit}</button>{cancel && onCancel && <button type="button" onClick={onCancel} disabled={state === 'saving'} className="button-secondary">{cancel}</button>}{state === 'saved' && <InlineState kind="saved">{saved}</InlineState>}{state === 'failed' && <InlineState kind="failed">{failed}</InlineState>}</div> }
