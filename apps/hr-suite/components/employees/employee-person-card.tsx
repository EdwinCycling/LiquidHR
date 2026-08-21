'use client'

import { AlertTriangle, Check, ChevronDown, CreditCard, Eye, HeartHandshake, Home, LoaderCircle, Mail, MapPin, Pencil, Phone, Plus, Search, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AddressSuggestion } from '@/lib/address/address-suggestions'
import { EmployeeCustomFields } from '@/components/custom-fields/employee-custom-fields'
import type { EmployeeCustomField } from '@/lib/custom-fields/service'
import { NO_EMPLOYEE_CAPABILITIES, type EmployeeBankAccount, type EmployeeDetailViewModel, type EmployeeRelation, type EmployeeRelationTypeOption, type EmployeeRoleAssignment } from './types'
import { EmailLink } from '@/components/shared/email-link'
import { formatDate } from '@/lib/preferences/formatters'
import type { DateFormat } from '@/lib/preferences/user-preferences'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { CountryPicker } from '@/components/ui/country-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { InfoList } from '@/components/patterns/info-list'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormActions } from '@/components/patterns/form-actions'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { RowActions } from '@/components/patterns/row-actions'
import { SectionHeader } from '@/components/patterns/section-header'
import { ScrollableTabs, tabLinkClasses } from '@/components/patterns/scrollable-tabs'

type Tab = 'personal' | 'addresses' | 'bankAccounts' | 'relations' | 'additionalInformation'
type MutationState = 'idle' | 'saving' | 'saved' | 'failed'
const SELECT_CLASS = 'min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus/50'
export const EMPLOYEE_PERSONAL_TABS: Tab[] = ['personal', 'addresses', 'bankAccounts', 'relations', 'additionalInformation']

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
  previous: string
  next: string
  editPersonal: string
  save: string
  saving: string
  saved: string
  cancel: string
  genericError: string
  close: string
  moreActions: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
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
  onStateChange?: (state: MutationState) => void,
): Promise<boolean> {
  const updateState = (nextState: MutationState) => { setState(nextState); onStateChange?.(nextState) }
  updateState('saving')
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
    updateState(outcome)
  }
}

export function EmployeePersonCard({ detail, initialEdit = false, locale, dateFormat, labels, roleAssignments = [], customFields = [], defaultCountryCode }: EmployeePersonCardProps) {
  const [tab, setTab] = useState<Tab>('personal')
  const capabilities = detail.capabilities ?? NO_EMPLOYEE_CAPABILITIES
  const addresses = detail.addresses ?? []
  const bankAccounts = detail.bankAccounts ?? []
  const relations = detail.relations ?? []
  const tabs = EMPLOYEE_PERSONAL_TABS

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
    <Surface className="mt-6">
      <nav className="border-b border-subtle px-2 sm:px-4" aria-label={labels.personalTitle}>
        <ScrollableTabs ariaLabel={labels.personalTitle} leftLabel={labels.previous} rightLabel={labels.next} contentClassName="gap-4 sm:gap-6" contentProps={{ role: 'tablist' }}>
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
              className={tabLinkClasses({ active: tab === item, className: 'px-1' })}
            >
              {labels.tabs[item]}
            </button>
          ))}
        </ScrollableTabs>
      </nav>
      <div id={`employee-panel-${tab}`} role="tabpanel" aria-labelledby={`employee-tab-${tab}`} className="p-4 sm:p-6 lg:p-8">
        {tab === 'personal' && <PersonalPanel employee={detail.employee} initialEdit={initialEdit} capabilities={capabilities} labels={labels} roleAssignments={roleAssignments} locale={locale} dateFormat={dateFormat} defaultCountryCode={defaultCountryCode} />}
        {tab === 'addresses' && <AddressesPanelV2 employeeId={detail.employee.id} addresses={addresses} canManage={capabilities.canManageAddresses} locale={locale} dateFormat={dateFormat} labels={labels} />}
        {tab === 'bankAccounts' && <BankAccountsPanel employeeId={detail.employee.id} accounts={bankAccounts} canManage={capabilities.canManageBankAccounts} labels={labels} />}
        {tab === 'relations' && <RelationsPanel employeeId={detail.employee.id} relations={relations} relationTypes={detail.relationTypes ?? []} locale={locale} canManage={capabilities.canManageRelations} labels={labels} />}
        {tab === 'additionalInformation' && <section><SectionHeader title={labels.additionalInformationTitle} /><div className="mt-6"><EmployeeCustomFields embedded employeeId={detail.employee.id} fields={customFields} labels={labels.customFields} /></div></section>}
      </div>
    </Surface>
  )
}

function PersonalPanel({ employee, initialEdit, capabilities, labels, roleAssignments, locale, dateFormat, defaultCountryCode }: { employee: EmployeeDetailViewModel['employee']; initialEdit: boolean; capabilities: NonNullable<EmployeeDetailViewModel['capabilities']>; labels: EmployeePersonCardLabels; roleAssignments: EmployeeRoleAssignment[]; locale: string; dateFormat: DateFormat; defaultCountryCode: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(initialEdit && capabilities.canEditEmployee && Boolean(employee.updatedAt))
  const [state, setState] = useState<MutationState>('idle')
  const [dirty, setDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (state === 'saving') return
    if (!employee.updatedAt) return
    const form = new FormData(event.currentTarget)
    const succeeded = await runJsonMutation(setState, `/api/employees/${employee.id}`, 'PATCH', {
      updatedAt: employee.updatedAt, employeeNumber: value(form, 'employeeNumber'),
      firstName: value(form, 'firstName'), birthNamePrefix: nullable(value(form, 'birthNamePrefix')), birthName: value(form, 'birthName'),
      nameUsage: value(form, 'nameUsage'), gender: value(form, 'gender'), birthDate: nullable(value(form, 'birthDate')), birthPlace: nullable(value(form, 'birthPlace')),
      birthCountry: nullable(value(form, 'birthCountry').toUpperCase()), nationality: nullable(value(form, 'nationality').toUpperCase()),
      preferredLanguage: value(form, 'preferredLanguage'), privateEmail: nullable(value(form, 'privateEmail')), privatePhone: nullable(value(form, 'privatePhone')),
      privateMobile: nullable(value(form, 'privateMobile')), workEmail: nullable(value(form, 'workEmail')), workPhone: nullable(value(form, 'workPhone')),
      workPhoneExt: nullable(value(form, 'workPhoneExt')), workMobile: nullable(value(form, 'workMobile')),
    })
    if (!succeeded) return
    setDirty(false); setEditing(false); router.refresh()
  }

  function requestCancel(): void {
    if (state === 'saving') return
    if (dirty) { setDiscardOpen(true); return }
    setEditing(false)
  }

  function discardChanges(): void {
    setDiscardOpen(false)
    setDirty(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <>
      <form onInput={() => setDirty(true)} onSubmit={(event) => void save(event)}>
        <SectionHeader title={labels.personalTitle} />
        <div className="mt-6 divide-y divide-border-subtle">
          <FormSection title={labels.personalTitle}>
            <Field label={labels.employeeNumber}><TextInput name="employeeNumber" defaultValue={employee.employeeNumber} required /></Field>
            <Field label={labels.firstName}><TextInput name="firstName" defaultValue={employee.firstName} required /></Field>
            <Field label={labels.birthNamePrefix}><TextInput name="birthNamePrefix" defaultValue={employee.birthNamePrefix ?? ''} /></Field>
            <Field label={labels.birthName}><TextInput name="birthName" defaultValue={employee.birthName} required /></Field>
            <Field label={labels.nameUsage}><select name="nameUsage" defaultValue={employee.nameUsage ?? 'BIRTH_NAME'} className={SELECT_CLASS}><option value="BIRTH_NAME">{labels.nameUsageBirth}</option><option value="PARTNER_NAME">{labels.nameUsagePartner}</option><option value="PARTNER_BEFORE_BIRTH_NAME">{labels.nameUsagePartnerBirth}</option><option value="BIRTH_NAME_BEFORE_PARTNER_NAME">{labels.nameUsageBirthPartner}</option></select></Field>
            <Field label={labels.gender}><select name="gender" defaultValue={employee.gender ?? 'PREFER_NOT_TO_SAY'} className={SELECT_CLASS}><option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option><option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option></select></Field>
          </FormSection>
          <FormSection title={labels.birthDate}>
            <Field label={labels.birthDate}><TextInput name="birthDate" type="date" defaultValue={employee.birthDate ?? ''} /></Field>
            <Field label={labels.birthPlace}><TextInput name="birthPlace" defaultValue={employee.birthPlace ?? ''} /></Field>
            <CountrySelect name="birthCountry" label={labels.birthCountry} initialValue={employee.birthCountry ?? defaultCountryCode} defaultCountryCode={defaultCountryCode} locale={locale} labels={labels} />
            <CountrySelect name="nationality" label={labels.nationality} initialValue={employee.nationality ?? defaultCountryCode} defaultCountryCode={defaultCountryCode} locale={locale} labels={labels} />
            <LanguageSelect name="preferredLanguage" label={labels.preferredLanguage} initialValue={employee.preferredLanguage ?? 'nl-NL'} locale={locale} labels={labels} />
          </FormSection>
          <FormSection title={labels.privateContact}>
            <Field label={labels.privateEmail}><TextInput name="privateEmail" type="email" defaultValue={employee.privateEmail ?? ''} /></Field>
            <Field label={labels.privatePhone}><TextInput name="privatePhone" type="tel" defaultValue={employee.privatePhone ?? ''} /></Field>
            <Field label={labels.privateMobile}><TextInput name="privateMobile" type="tel" defaultValue={employee.privateMobile ?? ''} /></Field>
          </FormSection>
          <FormSection title={labels.workContact}>
            <Field label={labels.workEmail}><TextInput name="workEmail" type="email" defaultValue={employee.workEmail ?? ''} /></Field>
            <Field label={labels.workPhone}><TextInput name="workPhone" type="tel" defaultValue={employee.workPhone ?? ''} /></Field>
            <Field label={labels.workPhoneExtension}><TextInput name="workPhoneExt" defaultValue={employee.workPhoneExt ?? ''} /></Field>
            <Field label={labels.workMobile}><TextInput name="workMobile" type="tel" defaultValue={employee.workMobile ?? ''} /></Field>
          </FormSection>
        </div>
        {state === 'failed' && <div className="mt-6"><InlineState kind="failed">{labels.genericError}</InlineState></div>}
        <FormActions cancelLabel={labels.cancel} leading={state === 'saved' ? <InlineState kind="saved">{labels.saved}</InlineState> : undefined} onCancel={requestCancel} saveLabel={labels.save} saving={state === 'saving'} sticky />
      </form>
      <ConfirmDialog cancelLabel={labels.discardCancel} confirmLabel={labels.discardConfirm} description={labels.discardDescription} destructive onConfirm={discardChanges} onOpenChange={setDiscardOpen} open={discardOpen} title={labels.discardTitle} />
      </>
    )
  }

  return (
    <div>
      {roleAssignments.length > 0 && <section className="mb-8 border-b border-border-subtle pb-6"><SectionHeader title={labels.rolesTitle} /><div className="mt-4 grid gap-x-6 gap-y-1 md:grid-cols-2">{roleAssignments.map((assignment) => <div className="border-b border-border-subtle py-3" key={assignment.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{assignment.roleName}</p><p className="text-xs text-muted-foreground">{assignment.roleCode}</p></div><Badge tone="info">{assignment.departmentName ?? labels.roleTenantWide}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{labels.roleDepartment}: {assignment.departmentName ?? labels.roleTenantWide}</p><p className="mt-1 text-xs text-muted-foreground">{labels.roleValidFrom}: {formatDate(assignment.effectiveFrom, { locale, dateFormat })}{assignment.effectiveTo ? ` · ${labels.roleValidUntil}: ${formatDate(assignment.effectiveTo, { locale, dateFormat })}` : ''}</p></div>)}</div></section>}
      <SectionHeader title={labels.personalTitle} actions={capabilities.canEditEmployee && employee.updatedAt ? <Button type="button" variant="secondary" onClick={() => { setState('idle'); setDirty(false); setEditing(true) }}><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editPersonal}</Button> : undefined} />
      <div className="mt-6 space-y-8">
        <PersonalInfoSection title={labels.overviewTitle} items={[{ label: labels.employeeNumber, value: employee.employeeNumber }, { label: labels.firstName, value: employee.firstName }, { label: labels.birthNamePrefix, value: employee.birthNamePrefix }, { label: labels.birthName, value: employee.birthName }, { label: labels.nameUsage, value: employee.nameUsage ? nameUsageLabel(employee.nameUsage, labels) : null }, { label: labels.gender, value: employee.gender ? genderLabel(employee.gender, labels) : null }]} />
        <PersonalInfoSection title={labels.birthDate} items={[{ label: labels.birthDate, value: employee.birthDate }, { label: labels.birthPlace, value: employee.birthPlace }, { label: labels.birthCountry, value: employee.birthCountry }, { label: labels.nationality, value: employee.nationality }, { label: labels.preferredLanguage, value: employee.preferredLanguage }]} />
        <PersonalInfoSection title={labels.privateContact} items={[{ label: labels.privateEmail, value: employee.privateEmail, isEmail: true }, { label: labels.privatePhone, value: employee.privatePhone }, { label: labels.privateMobile, value: employee.privateMobile }]} />
        <PersonalInfoSection title={labels.workContact} items={[{ label: labels.workEmail, value: employee.workEmail, isEmail: true }, { label: labels.workPhone, value: employee.workPhone }, { label: labels.workPhoneExtension, value: employee.workPhoneExt }, { label: labels.workMobile, value: employee.workMobile }]} />
      </div>
      {capabilities.canReadBsn && <BsnReveal employeeId={employee.id} labels={labels} />}
    </div>
  )
}

type PersonalInfoItem = { label: string; value: string | null | undefined; isEmail?: boolean }

function PersonalInfoSection({ title, items }: { title: string; items: PersonalInfoItem[] }) {
  return <section className="border-t border-border-subtle pt-6"><h3 className="text-sm font-semibold text-foreground">{title}</h3><InfoList className="mt-4" columns={2} items={items.map((item) => ({ label: item.label, value: item.value ? item.isEmail ? <EmailLink email={item.value} /> : item.value : <span className="text-muted-foreground">—</span> }))} /></section>
}

function nameUsageLabel(value: NonNullable<EmployeeDetailViewModel['employee']['nameUsage']>, labels: EmployeePersonCardLabels): string {
  return value === 'BIRTH_NAME' ? labels.nameUsageBirth : value === 'PARTNER_NAME' ? labels.nameUsagePartner : value === 'PARTNER_BEFORE_BIRTH_NAME' ? labels.nameUsagePartnerBirth : labels.nameUsageBirthPartner
}

function genderLabel(value: NonNullable<EmployeeDetailViewModel['employee']['gender']>, labels: EmployeePersonCardLabels): string {
  return value === 'MALE' ? labels.genderMale : value === 'FEMALE' ? labels.genderFemale : value === 'OTHER' ? labels.genderOther : labels.genderUndisclosed
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
    <section className="mt-8 border-t border-border-subtle pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h3 className="font-semibold">{labels.bsnTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{labels.bsnAuditHelp}</p></div></div>
        {state === 'visible' ? <output className="rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 font-semibold tabular-nums">{bsn ?? labels.bsnNotRecorded}</output> : <Button type="button" onClick={reveal} loading={state === 'loading'} variant="secondary" className="shrink-0"><Eye aria-hidden="true" className="h-4 w-4" />{state === 'loading' ? labels.revealingBsn : labels.revealBsn}</Button>}
      </div>
      {state === 'failed' && <InlineState kind="failed">{labels.genericError}</InlineState>}
    </section>
  )
}

type ReminderRole = 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE'

type AddressKind = 'PRIMARY' | 'SECONDARY'
type ResourceFormSubmit = (event: FormEvent<HTMLFormElement>) => void | Promise<void>

function AddressesPanelV2({ employeeId, addresses, canManage, locale, dateFormat, labels }: { employeeId: string; addresses: NonNullable<EmployeeDetailViewModel['addresses']>; canManage: boolean; locale: string; dateFormat: DateFormat; labels: EmployeePersonCardLabels }) {
  const router = useRouter()
  const [openPanel, setOpenPanel] = useState<AddressKind>('PRIMARY')
  const [drawerAddress, setDrawerAddress] = useState<{ addressType: AddressKind; address?: NonNullable<EmployeeDetailViewModel['addresses']>[number] } | null>(null)
  const [addressSubmit, setAddressSubmit] = useState<ResourceFormSubmit | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const registerAddressSubmit = useCallback((handler: ResourceFormSubmit) => setAddressSubmit(() => handler), [])
  const primaryAddresses = addresses.filter((address) => address.addressType === 'PRIMARY')
  const secondaryAddresses = addresses.filter((address) => address.addressType === 'SECONDARY')
  const formatAddressDate = (date: string) => formatDate(date, { locale, dateFormat })

  function openCreate(addressType: AddressKind): void { setDirty(false); setAddressSubmit(null); setDrawerAddress({ addressType }) }
  function openEdit(addressType: AddressKind, address: NonNullable<EmployeeDetailViewModel['addresses']>[number]): void { setDirty(false); setAddressSubmit(null); setDrawerAddress({ addressType, address }) }
  function closeDrawer(): void { if (saving) return; setDrawerAddress(null); setAddressSubmit(null); setDirty(false) }
  async function remove(): Promise<void> {
    if (!deleteCandidate || deleting) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/employees/${employeeId}/addresses/${deleteCandidate}`, { method: 'DELETE' })
      if (response.ok) router.refresh()
    } finally {
      setDeleting(false)
      setDeleteCandidate(null)
    }
  }

  function renderAddress(address: NonNullable<EmployeeDetailViewModel['addresses']>[number], kind: AddressKind): ReactNode {
    const isSecondary = kind === 'SECONDARY'
    return <article key={address.id} className="border-b border-border-subtle py-4 first:border-t">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{address.addressLine1}</p>{!isSecondary && <Badge tone="success">{labels.current}</Badge>}</div>
          {isSecondary && address.description && <p className="mt-1 text-sm font-medium text-primary">{address.description}</p>}
          {address.addressLine2 && <p className="mt-1 text-sm">{address.addressLine2}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{[address.postalCode, address.city, address.region, address.countryCode].filter(Boolean).join(' · ')}</p>
          <p className="mt-2 text-xs tabular-nums text-muted-foreground">{labels.validFrom}: {formatAddressDate(address.validFrom)}{isSecondary && address.validUntil ? ` · ${labels.validUntil}: ${formatAddressDate(address.validUntil)}` : ''}</p>
        </div>
        {canManage && <RowActions menuLabel={labels.moreActions} menuItems={[{ destructive: true, disabled: kind === 'PRIMARY' && primaryAddresses.length === 1, id: 'delete', label: labels.deleteResource, onSelect: () => setDeleteCandidate(address.id) }]} primaryAction={<Button onClick={() => openEdit(kind, address)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editResource}</Button>} />}
      </div>
    </article>
  }

  function renderPanel(kind: AddressKind): ReactNode {
    const isPrimary = kind === 'PRIMARY'
    const items = isPrimary ? primaryAddresses : secondaryAddresses
    const title = isPrimary ? labels.primaryAddress : labels.secondaryAddress
    const isOpen = openPanel === kind
    return <section className="border-t border-border-subtle" key={kind}>
      <button type="button" aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-semibold" onClick={() => setOpenPanel(kind)}><span className="flex items-center gap-2"><Home aria-hidden="true" className="h-5 w-5 text-primary" />{title}</span><ChevronDown aria-hidden="true" className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>
      {isOpen && <div className="border-b border-border-subtle pb-5 pt-4">
        {!isPrimary && <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{labels.secondaryAddressHelp}</p>}
        {items.length === 0 ? <EmptyState className="mt-2" icon={<Home className="h-5 w-5" />} title={isPrimary ? labels.addressesEmpty : labels.noSecondaryAddress} /> : <div className="space-y-3">{items.map((address) => renderAddress(address, kind))}</div>}
        {canManage && <div className="mt-4"><Button onClick={() => openCreate(kind)} type="button" variant="secondary"><Plus aria-hidden="true" />{isPrimary ? labels.relocateAddress : labels.addAddress}</Button></div>}
      </div>}
    </section>
  }

  return <>
  <section>
    <SectionHeader title={labels.addressesTitle} />
    {addresses.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{labels.addressesEmpty}</p>}
    <div className="mt-6 space-y-3">{(['PRIMARY', 'SECONDARY'] as const).map(renderPanel)}</div>
  </section>
  <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={drawerAddress?.address ? labels.editResource : labels.addAddress} dirty={dirty} dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }} onDiscard={closeDrawer} onOpenChange={(open) => { if (!open) closeDrawer() }} onSubmit={(event) => { event.preventDefault(); void addressSubmit?.(event) }} open={drawerAddress !== null} saveLabel={labels.saveAddress} saving={saving} title={drawerAddress?.address ? labels.editResource : labels.addAddress}>
    {drawerAddress ? <div className="grid gap-4" onInput={() => setDirty(true)}><AddressFormV2 address={drawerAddress.address} addressType={drawerAddress.addressType} employeeId={employeeId} labels={labels} locale={locale} onSaved={closeDrawer} onStateChange={setSaving} onSubmitReady={registerAddressSubmit} /></div> : null}
  </FormDrawer>
  <ConfirmDialog cancelLabel={labels.discardCancel} confirmLabel={labels.deleteResource} description={labels.confirmDelete} destructive onConfirm={remove} onOpenChange={(open) => { if (!open && !deleting) setDeleteCandidate(null) }} open={deleteCandidate !== null} pending={deleting} title={labels.deleteResource} />
  </>

}

function AddressFormV2({ employeeId, locale, labels, address, addressType, onSaved, onStateChange, onSubmitReady }: { employeeId: string; locale: string; labels: EmployeePersonCardLabels; addressType: AddressKind; address?: NonNullable<EmployeeDetailViewModel['addresses']>[number]; onSaved?: () => void; onStateChange?: (saving: boolean) => void; onSubmitReady?: (handler: ResourceFormSubmit) => void }) {
  const router = useRouter()
  const [, setState] = useState<MutationState>('idle')
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'empty' | 'failed'>('idle')
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [query, setQuery] = useState(address?.addressLine1 ?? '')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [reminderRoles, setReminderRoles] = useState<ReminderRole[]>([])
  const [values, setValues] = useState({ countryCode: address?.countryCode ?? 'NL', addressLine1: address?.addressLine1 ?? '', addressLine2: address?.addressLine2 ?? '', street: address?.street ?? '', houseNumber: address?.houseNumber ?? '', addition: address?.houseNumberAddition ?? '', postalCode: address?.postalCode ?? '', city: address?.city ?? '', region: address?.region ?? '', validFrom: address?.validFrom ?? new Date().toISOString().slice(0, 10), validUntil: address?.validUntil ?? '', description: address?.description ?? '', source: (address?.source === 'pdok' || address?.source === 'geoapify' ? address.source : 'manual') as 'manual' | 'pdok' | 'geoapify', sourceReference: address?.sourceReference ?? '' })
  const submitRef = useRef<(() => Promise<void>) | null>(null)
  const isNew = !address
  const isSecondary = addressType === 'SECONDARY'
  const isDutch = values.countryCode === 'NL'

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

  async function submit(): Promise<void> {
    const payload = { addressType, description: isSecondary ? nullable(values.description.trim()) : null, countryCode: values.countryCode, addressLine1: nullable(values.addressLine1), addressLine2: nullable(values.addressLine2), street: nullable(values.street), houseNumber: nullable(values.houseNumber), addition: nullable(values.addition), postalCode: nullable(values.postalCode), city: values.city, region: nullable(values.region), validFrom: values.validFrom, validUntil: isSecondary ? nullable(values.validUntil) : null, source: values.source, sourceReference: nullable(values.sourceReference), province: null, directReminderRecipients: isNew ? reminderRoles : [] }
    const succeeded = await runJsonMutation(setState, address ? `/api/employees/${employeeId}/addresses/${address.id}` : `/api/employees/${employeeId}/addresses`, address ? 'PATCH' : 'POST', payload, (nextState) => onStateChange?.(nextState === 'saving'))
    if (!succeeded) return
    onSaved?.()
    if (isNew) { setReminderRoles([]); setValues((current) => ({ ...current, addressLine1: '', addressLine2: '', street: '', houseNumber: '', addition: '', postalCode: '', city: '', region: '', validUntil: '', description: '', source: 'manual', sourceReference: '' })); setQuery('') }
    router.refresh()
  }

  useEffect(() => { submitRef.current = submit }, [submit])
  useEffect(() => { onSubmitReady?.(() => { if (submitRef.current) return submitRef.current(); return Promise.resolve() }) }, [onSubmitReady])

  return (
    <div className="grid gap-4">
      {isSecondary && <Field label={labels.secondaryAddressDescription}><TextInput value={values.description} onChange={(event) => updateValue('description', event.target.value)} required maxLength={240} /><span className="text-xs font-normal text-muted-foreground">{labels.secondaryAddressHelp}</span></Field>}
      <div className="grid gap-3 sm:grid-cols-[minmax(11rem,0.75fr)_minmax(0,2fr)] sm:items-start">
        <Field label={labels.country} className="self-start"><CountryPicker name="countryCode" value={values.countryCode} onChange={(value) => updateValue('countryCode', value)} locale={locale} searchLabel={labels.countrySearch} emptyLabel={labels.countryNoResults} /></Field>
        <Field label={labels.addressSearch} className="min-w-0">
          <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><TextInput value={query} onChange={(event) => updateQuery(event.target.value)} placeholder={isDutch ? labels.addressSearchPlaceholder : `${labels.addressSearchPlaceholder} ${values.countryCode}`} className="pl-10" autoComplete="off" autoFocus={isNew} role="combobox" aria-autocomplete="list" aria-controls="address-suggestions" aria-expanded={suggestions.length > 0} /></div>
          <div className="mt-1.5 min-h-4 text-xs text-muted-foreground">{searchState === 'loading' && <span className="inline-flex items-center gap-1.5"><LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />{labels.searchLoading}</span>}{searchState === 'failed' && <span role="alert" className="text-destructive">{labels.searchUnavailable}</span>}{searchState === 'empty' && <span>{labels.searchNoResults}</span>}</div>
          {suggestions.length > 0 && <ul id="address-suggestions" role="listbox" className="mt-1 max-h-60 overflow-y-auto rounded-[var(--radius-overlay)] border border-border bg-surface-overlay shadow-sm">{suggestions.map((suggestion) => <li key={`${suggestion.source}-${suggestion.sourceReference ?? suggestion.label}`} role="presentation"><button type="button" role="option" aria-selected={false} className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent" onClick={() => applySuggestion(suggestion)}><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{suggestion.label}</span></button></li>)}</ul>}
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-full"><h3 className="text-sm font-semibold text-foreground">{labels.manualEntry}</h3></div>
        {isDutch ? <><Field label={labels.street} className="sm:col-span-4"><TextInput value={values.street} onChange={(event) => updateValue('street', event.target.value)} />{/\d/.test(values.street) && <span className="text-xs text-muted-foreground">{labels.streetHasNumberNote}</span>}</Field><Field label={labels.houseNumber}><TextInput value={values.houseNumber} onChange={(event) => updateValue('houseNumber', event.target.value)} /></Field><Field label={labels.addition}><TextInput value={values.addition} onChange={(event) => updateValue('addition', event.target.value)} /></Field></> : <><Field label={labels.addressLine1} className="sm:col-span-4"><TextInput value={values.addressLine1} onChange={(event) => updateValue('addressLine1', event.target.value)} /></Field><Field label={labels.addressLine2} className="sm:col-span-2"><TextInput value={values.addressLine2} onChange={(event) => updateValue('addressLine2', event.target.value)} /></Field></>}
        <Field label={labels.postalCode} className="sm:col-span-2"><TextInput value={values.postalCode} onChange={(event) => updateValue('postalCode', event.target.value)} className="uppercase" /></Field>
        {isDutch && values.postalCode.trim() && values.houseNumber.trim() && !values.city.trim() && <div className="sm:col-span-2 sm:self-end"><Button type="button" onClick={lookupByPostalCode} disabled={lookupState === 'loading'} loading={lookupState === 'loading'} aria-label={`${labels.lookup}: ${labels.lookupByPostalCode}`} variant="secondary" className="w-full">{lookupState === 'loading' ? labels.searchLoading : labels.lookup}</Button><p className="mt-1.5 text-xs text-muted-foreground">{labels.lookupHint}</p></div>}
        <Field label={labels.city} className="sm:col-span-4"><TextInput value={values.city} onChange={(event) => updateValue('city', event.target.value)} required /></Field><Field label={labels.region} className="sm:col-span-2"><TextInput value={values.region} onChange={(event) => updateValue('region', event.target.value)} /></Field><Field label={labels.validFrom} className="sm:col-span-2"><TextInput value={values.validFrom} onChange={(event) => updateValue('validFrom', event.target.value)} type="date" required /></Field>{isSecondary && <Field label={labels.validUntil} className="sm:col-span-2"><div className="flex items-center gap-2"><TextInput value={values.validUntil} onChange={(event) => updateValue('validUntil', event.target.value)} type="date" className="min-w-0 flex-1" /><Button type="button" aria-label={labels.clearValidUntil} variant="secondary" size="sm" onClick={() => updateValue('validUntil', '')}>{labels.clearValidUntil}</Button></div></Field>}
        {lookupState === 'failed' && <span role="alert" className="text-xs text-destructive sm:col-span-full">{labels.lookupUnavailable}</span>}
      </div>
      {isNew && <fieldset className="border-t border-border-subtle pt-5"><legend className="px-1 text-sm font-semibold">{labels.directReminderTitle}</legend><p className="mt-1 text-xs text-muted-foreground">{labels.directReminderHelp}</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{([['HR_ADMIN', labels.reminderHrAdmin], ['MANAGER', labels.reminderManager], ['EMPLOYEE', labels.reminderEmployee]] as const).map(([role, label]) => <label key={role} className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={reminderRoles.includes(role)} onChange={() => toggleReminderRole(role)} className="h-4 w-4 accent-primary" />{label}</label>)}</div></fieldset>}
    </div>
  )
}

function CountrySelect({ name, label, initialValue, defaultCountryCode, locale, labels }: { name: string; label: string; initialValue: string; defaultCountryCode: string; locale: string; labels: Pick<EmployeePersonCardLabels, 'countrySearch' | 'countryNoResults'> }) {
  const [selected, setSelected] = useState(initialValue || defaultCountryCode)
  return <Field label={label}><CountryPicker emptyLabel={labels.countryNoResults} name={name} onChange={setSelected} locale={locale} searchLabel={labels.countrySearch} value={selected} /></Field>
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

function BankAccountsPanel({ employeeId, accounts, canManage, labels }: { employeeId: string; accounts: NonNullable<EmployeeDetailViewModel['bankAccounts']>; canManage: boolean; labels: EmployeePersonCardLabels }) {
  const router = useRouter()
  const [drawerAccount, setDrawerAccount] = useState<EmployeeBankAccount | null | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [accountSubmit, setAccountSubmit] = useState<ResourceFormSubmit | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const registerAccountSubmit = useCallback((handler: ResourceFormSubmit) => setAccountSubmit(() => handler), [])
  function openCreate(): void { setDrawerAccount(null); setDirty(false); setAccountSubmit(null); setDrawerOpen(true) }
  function openEdit(account: EmployeeBankAccount): void { setDrawerAccount(account); setDirty(false); setAccountSubmit(null); setDrawerOpen(true) }
  function closeDrawer(): void { if (saving) return; setDrawerOpen(false); setDrawerAccount(undefined); setAccountSubmit(null); setDirty(false) }
  async function remove(): Promise<void> {
    if (!deleteCandidate || deleting) return
    setDeleting(true)
    try { const response = await fetch(`/api/employees/${employeeId}/bank-accounts/${deleteCandidate}`, { method: 'DELETE' }); if (response.ok) router.refresh() } finally { setDeleting(false); setDeleteCandidate(null) }
  }
  return <>
  <section>
    <SectionHeader title={labels.banksTitle} />
    {accounts.length === 0 ? <EmptyState icon={<CreditCard className="h-5 w-5" />} title={labels.banksEmpty} /> : <ul className="mt-6 divide-y divide-border-subtle">{accounts.map((account) => <li key={account.id} className="py-4 first:border-t first:border-border-subtle">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-all font-semibold tabular-nums">{account.maskedIban}</p>{account.isPrimary && <Badge tone="success">{labels.primary}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{account.accountHolder}{account.description ? ` · ${account.description}` : ''}</p>{account.bic && <p className="mt-1 text-xs text-muted-foreground">{labels.bic}: {account.bic}</p>}</div>
        {canManage && <RowActions menuLabel={labels.moreActions} menuItems={[{ destructive: true, id: 'delete', label: labels.deleteResource, onSelect: () => setDeleteCandidate(account.id) }]} primaryAction={<Button onClick={() => openEdit(account)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editResource}</Button>} />}
      </div>
    </li>)}</ul>}
    {canManage && <div className="mt-6"><Button onClick={openCreate} type="button" variant="secondary"><Plus aria-hidden="true" />{labels.addBank}</Button></div>}
  </section>
  <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={drawerAccount ? labels.editResource : labels.addBank} dirty={dirty} dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }} onDiscard={closeDrawer} onOpenChange={(open) => { if (!open) closeDrawer() }} onSubmit={(event) => { event.preventDefault(); void accountSubmit?.(event) }} open={drawerOpen} saveLabel={drawerAccount ? labels.editResource : labels.saveBank} saving={saving} title={drawerAccount ? labels.editResource : labels.addBank}>
    <div className="grid gap-4" onInput={() => setDirty(true)}><BankAccountForm account={drawerAccount ?? undefined} employeeId={employeeId} labels={labels} onSaved={closeDrawer} onStateChange={setSaving} onSubmitReady={registerAccountSubmit} /></div>
  </FormDrawer>
  <ConfirmDialog cancelLabel={labels.discardCancel} confirmLabel={labels.deleteResource} description={labels.confirmDelete} destructive onConfirm={remove} onOpenChange={(open) => { if (!open && !deleting) setDeleteCandidate(null) }} open={deleteCandidate !== null} pending={deleting} title={labels.deleteResource} />
  </>
}

function BankAccountForm({ employeeId, account, labels, onSaved, onStateChange, onSubmitReady }: { employeeId: string; account?: EmployeeBankAccount; labels: EmployeePersonCardLabels; onSaved?: () => void; onStateChange?: (saving: boolean) => void; onSubmitReady?: (handler: ResourceFormSubmit) => void }) {
  const router = useRouter(); const [, setState] = useState<MutationState>('idle'); const submitRef = useRef<ResourceFormSubmit | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement)
    const payload = { iban: value(form, 'iban'), bic: nullable(value(form, 'bic')), accountHolder: value(form, 'accountHolder'), description: nullable(value(form, 'description')), isPrimary: form.get('isPrimary') === 'on' }
    const succeeded = await runJsonMutation(setState, account ? `/api/employees/${employeeId}/bank-accounts/${account.id}` : `/api/employees/${employeeId}/bank-accounts`, account ? 'PATCH' : 'POST', payload, (nextState) => onStateChange?.(nextState === 'saving'))
    if (!succeeded) return
    onSaved?.(); formElement.reset(); router.refresh()
  }
  useEffect(() => { submitRef.current = submit }, [submit])
  useEffect(() => { onSubmitReady?.((event) => submitRef.current?.(event) ?? Promise.resolve()) }, [onSubmitReady])
  return <div className="grid gap-3 sm:grid-cols-2"><Field label={labels.iban}><TextInput name="iban" required autoComplete="off" placeholder={account?.maskedIban} className="uppercase" /></Field><Field label={labels.bic}><TextInput name="bic" maxLength={11} defaultValue={account?.bic ?? ''} className="uppercase" /></Field><Field label={labels.accountHolder}><TextInput name="accountHolder" required defaultValue={account?.accountHolder ?? ''} /></Field><Field label={labels.description}><TextInput name="description" defaultValue={account?.description ?? ''} /></Field><label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input name="isPrimary" type="checkbox" defaultChecked={account?.isPrimary} className="h-4 w-4 accent-primary" />{labels.makePrimary}</label></div>
}

function RelationsPanel({ employeeId, relations, relationTypes, locale, canManage, labels }: { employeeId: string; relations: NonNullable<EmployeeDetailViewModel['relations']>; relationTypes: EmployeeRelationTypeOption[]; locale: string; canManage: boolean; labels: EmployeePersonCardLabels }) {
  const router = useRouter()
  const [drawerRelation, setDrawerRelation] = useState<EmployeeRelation | null | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [relationSubmit, setRelationSubmit] = useState<ResourceFormSubmit | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const registerRelationSubmit = useCallback((handler: ResourceFormSubmit) => setRelationSubmit(() => handler), [])
  const typeLabels: Record<EmployeeRelation['relationType'], string> = Object.fromEntries(relationTypes.map((item) => [item.code, locale.startsWith('en') ? item.nameEn : item.nameNl])) as Record<EmployeeRelation['relationType'], string>
  function openCreate(): void { setDrawerRelation(null); setDirty(false); setRelationSubmit(null); setDrawerOpen(true) }
  function openEdit(relation: EmployeeRelation): void { setDrawerRelation(relation); setDirty(false); setRelationSubmit(null); setDrawerOpen(true) }
  function closeDrawer(): void { if (saving) return; setDrawerOpen(false); setDrawerRelation(undefined); setRelationSubmit(null); setDirty(false) }
  async function remove(): Promise<void> {
    if (!deleteCandidate || deleting) return
    setDeleting(true)
    try { const response = await fetch(`/api/employees/${employeeId}/relations/${deleteCandidate}`, { method: 'DELETE' }); if (response.ok) router.refresh() } finally { setDeleting(false); setDeleteCandidate(null) }
  }
  return <>
  <section>
    <SectionHeader title={labels.relationsTitle} />
    {relations.length === 0 ? <EmptyState icon={<HeartHandshake className="h-5 w-5" />} title={labels.relationsEmpty} /> : <ul className="mt-6 grid gap-x-8 divide-y divide-border-subtle lg:grid-cols-2 lg:divide-y-0">{relations.map((relation) => <li key={relation.id} className="border-b border-border-subtle py-4 lg:first:border-t lg:nth-[2n+1]:border-t">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-semibold">{[relation.firstName, relation.prefix, relation.lastName].filter(Boolean).join(' ')}</p>{relation.isEmergencyContact && <Badge tone="warning">{labels.emergencyContact}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{typeLabels[relation.relationType] ?? relation.relationType}</p></div>{canManage && <RowActions menuLabel={labels.moreActions} menuItems={[{ destructive: true, id: 'delete', label: labels.deleteResource, onSelect: () => setDeleteCandidate(relation.id) }]} primaryAction={<Button onClick={() => openEdit(relation)} size="sm" type="button" variant="secondary"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editResource}</Button>} />}</div>
      {(relation.mobile || relation.phone || relation.email) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{(relation.mobile || relation.phone) && <span className="flex items-center gap-1.5"><Phone aria-hidden="true" className="h-3.5 w-3.5" />{relation.mobile ?? relation.phone}</span>}{relation.email && <span className="flex items-center gap-1.5"><Mail aria-hidden="true" className="h-3.5 w-3.5" /><EmailLink email={relation.email} /></span>}</div>}
    </li>)}</ul>}
    {canManage && <div className="mt-6"><Button onClick={openCreate} type="button" variant="secondary"><Plus aria-hidden="true" />{labels.addRelation}</Button></div>}
  </section>
  <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={drawerRelation ? labels.editResource : labels.addRelation} dirty={dirty} dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }} onDiscard={closeDrawer} onOpenChange={(open) => { if (!open) closeDrawer() }} onSubmit={(event) => { event.preventDefault(); void relationSubmit?.(event) }} open={drawerOpen} saveLabel={drawerRelation ? labels.editResource : labels.saveRelation} saving={saving} title={drawerRelation ? labels.editResource : labels.addRelation}>
    <div className="grid gap-4" onInput={() => setDirty(true)}><RelationForm employeeId={employeeId} labels={labels} locale={locale} onSaved={closeDrawer} onStateChange={setSaving} onSubmitReady={registerRelationSubmit} relation={drawerRelation ?? undefined} relationTypes={relationTypes} /></div>
  </FormDrawer>
  <ConfirmDialog cancelLabel={labels.discardCancel} confirmLabel={labels.deleteResource} description={labels.confirmDelete} destructive onConfirm={remove} onOpenChange={(open) => { if (!open && !deleting) setDeleteCandidate(null) }} open={deleteCandidate !== null} pending={deleting} title={labels.deleteResource} />
  </>
}

function RelationForm({ employeeId, relation, relationTypes, locale, labels, onSaved, onStateChange, onSubmitReady }: { employeeId: string; relation?: EmployeeRelation; relationTypes: EmployeeRelationTypeOption[]; locale: string; labels: EmployeePersonCardLabels; onSaved?: () => void; onStateChange?: (saving: boolean) => void; onSubmitReady?: (handler: ResourceFormSubmit) => void }) {
  const router = useRouter(); const [, setState] = useState<MutationState>('idle'); const submitRef = useRef<ResourceFormSubmit | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const payload = { relationType: value(form, 'relationType'), isEmergencyContact: form.get('isEmergencyContact') === 'on', firstName: nullable(value(form, 'firstName')), initials: relation?.initials ?? nullable(value(form, 'initials')), prefix: nullable(value(form, 'prefix')), lastName: value(form, 'lastName'), gender: relation?.gender ?? nullable(value(form, 'gender')), birthDate: relation?.birthDate ?? nullable(value(form, 'birthDate')), phone: nullable(value(form, 'phone')), mobile: nullable(value(form, 'mobile')), email: nullable(value(form, 'email')), notes: nullable(value(form, 'notes')) }; const succeeded = await runJsonMutation(setState, relation ? `/api/employees/${employeeId}/relations/${relation.id}` : `/api/employees/${employeeId}/relations`, relation ? 'PATCH' : 'POST', payload, (nextState) => onStateChange?.(nextState === 'saving')); if (!succeeded) return; onSaved?.(); formElement.reset(); router.refresh() }
  useEffect(() => { submitRef.current = submit }, [submit])
  useEffect(() => { onSubmitReady?.((event) => submitRef.current?.(event) ?? Promise.resolve()) }, [onSubmitReady])
  return <div className="grid gap-3 sm:grid-cols-2"><Field label={labels.relationType}><select name="relationType" defaultValue={relation?.relationType ?? relationTypes[0]?.code} className={SELECT_CLASS}>{relationTypes.map((item) => <option key={item.code} value={item.code}>{locale.startsWith('en') ? item.nameEn : item.nameNl}</option>)}</select></Field><label className="flex items-center gap-2 self-end pb-3 text-sm font-medium"><input name="isEmergencyContact" type="checkbox" defaultChecked={relation?.isEmergencyContact} className="h-4 w-4 accent-primary" />{labels.emergencyContact}</label><Field label={labels.firstName}><TextInput name="firstName" defaultValue={relation?.firstName ?? ''} /></Field><Field label={labels.birthNamePrefix}><TextInput name="prefix" defaultValue={relation?.prefix ?? ''} /></Field><Field label={labels.lastName}><TextInput name="lastName" required defaultValue={relation?.lastName ?? ''} /></Field><Field label={labels.mobile}><TextInput name="mobile" type="tel" defaultValue={relation?.mobile ?? ''} /></Field><Field label={labels.privatePhone}><TextInput name="phone" type="tel" defaultValue={relation?.phone ?? ''} /></Field><Field label={labels.email}><TextInput name="email" type="email" defaultValue={relation?.email ?? ''} /></Field><Field label={labels.notes} className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={relation?.notes ?? ''} className="min-h-24 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm" /></Field></div>
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="py-6 first:pt-0"><h3 className="text-sm font-semibold text-foreground">{title}</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div></section>
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) { return <label className={`grid gap-1.5 text-sm font-medium ${className}`}>{label}{children}</label> }
function DataItem({ label, value, fallback = '', isEmail = false }: { label: string; value: string | null | undefined; fallback?: string; isEmail?: boolean }) { return <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value ? (isEmail ? <EmailLink email={value} /> : value) : fallback}</dd></div> }
function InlineState({ kind, children }: { kind: 'saved' | 'failed'; children: ReactNode }) { return <span role={kind === 'failed' ? 'alert' : 'status'} className={`inline-flex items-center gap-1.5 text-sm ${kind === 'saved' ? 'text-success' : 'text-destructive'}`}>{kind === 'saved' ? <Check aria-hidden="true" className="h-4 w-4" /> : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}{children}</span> }
