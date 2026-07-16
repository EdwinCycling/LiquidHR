'use client'

import { AlertTriangle, Check, ChevronDown, CreditCard, Eye, HeartHandshake, Home, LoaderCircle, Mail, Pencil, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, type KeyboardEvent, type ReactNode, useState } from 'react'
import { NO_EMPLOYEE_CAPABILITIES, type EmployeeDetailViewModel, type EmployeeRelation } from './types'

type Tab = 'overview' | 'personal' | 'addresses' | 'bankAccounts' | 'relations'
type MutationState = 'idle' | 'saving' | 'saved' | 'failed'

export interface EmployeePersonCardLabels {
  tabs: Record<Tab, string>
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
  preferredLanguage: string
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
  addAddress: string
  current: string
  validFrom: string
  validUntil: string
  street: string
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
}

interface EmployeePersonCardProps {
  detail: EmployeeDetailViewModel
  locale: string
  labels: EmployeePersonCardLabels
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
  method: 'POST' | 'PATCH',
  body: unknown,
): Promise<boolean> {
  setState('saving')
  let outcome: MutationState = 'failed'
  try {
    const response = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (response.ok) outcome = 'saved'
    return response.ok
  } catch {
    return false
  } finally {
    setState(outcome)
  }
}

export function EmployeePersonCard({ detail, locale, labels }: EmployeePersonCardProps) {
  const [tab, setTab] = useState<Tab>('overview')
  const capabilities = detail.capabilities ?? NO_EMPLOYEE_CAPABILITIES
  const addresses = detail.addresses ?? []
  const bankAccounts = detail.bankAccounts ?? []
  const relations = detail.relations ?? []
  const tabs: Tab[] = ['overview', 'personal', 'addresses', 'bankAccounts', 'relations']

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
      <nav className="overflow-x-auto border-b bg-surface-raised px-2 sm:px-4" aria-label={labels.overviewTitle}>
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
              className={`border-b-2 px-3 py-4 text-sm font-semibold transition-colors focus-visible:outline-none ${tab === item ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {labels.tabs[item]}
            </button>
          ))}
        </div>
      </nav>
      <div id={`employee-panel-${tab}`} role="tabpanel" aria-labelledby={`employee-tab-${tab}`} className="p-4 sm:p-6">
        {tab === 'overview' && <OverviewPanel detail={detail} labels={labels} />}
        {tab === 'personal' && <PersonalPanel employee={detail.employee} capabilities={capabilities} labels={labels} />}
        {tab === 'addresses' && <AddressesPanel employeeId={detail.employee.id} addresses={addresses} canManage={capabilities.canManageAddresses} locale={locale} labels={labels} />}
        {tab === 'bankAccounts' && <BankAccountsPanel employeeId={detail.employee.id} accounts={bankAccounts} canManage={capabilities.canManageBankAccounts} labels={labels} />}
        {tab === 'relations' && <RelationsPanel employeeId={detail.employee.id} relations={relations} canManage={capabilities.canManageRelations} labels={labels} />}
      </div>
    </section>
  )
}

function OverviewPanel({ detail, labels }: { detail: EmployeeDetailViewModel; labels: EmployeePersonCardLabels }) {
  const currentAddress = (detail.addresses ?? []).find((address) => !address.validUntil) ?? detail.addresses?.[0]
  const primaryBank = (detail.bankAccounts ?? []).find((account) => account.isPrimary) ?? detail.bankAccounts?.[0]
  const emergencyContacts = (detail.relations ?? []).filter((relation) => relation.isEmergencyContact)
  const employee = detail.employee
  return (
    <div>
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><UserRound aria-hidden="true" className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-semibold">{labels.overviewTitle}</h2><p className="text-sm text-muted-foreground">{labels.employmentCount.replace('{count}', String(detail.employments.length))}</p></div>
      </header>
      <div className="mt-6 grid gap-0 overflow-hidden rounded-xl border md:grid-cols-2 xl:grid-cols-4">
        <StoryCell icon={<Mail className="h-4 w-4" />} title={labels.contactTitle}>
          <p>{employee.workEmail ?? employee.privateEmail ?? labels.noContact}</p>
          <p>{employee.workMobile ?? employee.privateMobile ?? employee.workPhone ?? employee.privatePhone ?? ''}</p>
        </StoryCell>
        <StoryCell icon={<Home className="h-4 w-4" />} title={labels.currentAddress}>
          {currentAddress ? <><p>{currentAddress.street} {currentAddress.houseNumber}{currentAddress.addition ? ` ${currentAddress.addition}` : ''}</p><p>{currentAddress.postalCode} {currentAddress.city}</p></> : <p>{labels.noAddress}</p>}
        </StoryCell>
        <StoryCell icon={<CreditCard className="h-4 w-4" />} title={labels.primaryBank}>
          <p>{primaryBank?.maskedIban ?? labels.noBankAccount}</p>{primaryBank?.accountHolder && <p>{primaryBank.accountHolder}</p>}
        </StoryCell>
        <StoryCell icon={<HeartHandshake className="h-4 w-4" />} title={labels.emergencyContacts}>
          {emergencyContacts.length ? emergencyContacts.slice(0, 2).map((relation) => <p key={relation.id}>{relation.firstName} {relation.lastName}</p>) : <p>{labels.noEmergencyContact}</p>}
        </StoryCell>
      </div>
    </div>
  )
}

function StoryCell({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className="min-h-36 border-b p-4 last:border-b-0 md:border-r md:[&:nth-child(2n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:last:border-r-0">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{icon}{title}</div>
      <div className="mt-4 space-y-1 text-sm font-medium leading-6 [&>p+p]:font-normal [&>p+p]:text-muted-foreground">{children}</div>
    </article>
  )
}

function PersonalPanel({ employee, capabilities, labels }: { employee: EmployeeDetailViewModel['employee']; capabilities: NonNullable<EmployeeDetailViewModel['capabilities']>; labels: EmployeePersonCardLabels }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={labels.employeeNumber}><input name="employeeNumber" defaultValue={employee.employeeNumber} required className="form-field" /></Field>
          <Field label={labels.firstName}><input name="firstName" defaultValue={employee.firstName} required className="form-field" /></Field>
          <Field label={labels.birthNamePrefix}><input name="birthNamePrefix" defaultValue={employee.birthNamePrefix ?? ''} className="form-field" /></Field>
          <Field label={labels.birthName}><input name="birthName" defaultValue={employee.birthName} required className="form-field" /></Field>
          <Field label={labels.nameUsage}><select name="nameUsage" defaultValue={employee.nameUsage ?? 'BIRTH_NAME'} className="form-field"><option value="BIRTH_NAME">{labels.nameUsageBirth}</option><option value="PARTNER_NAME">{labels.nameUsagePartner}</option><option value="PARTNER_BEFORE_BIRTH_NAME">{labels.nameUsagePartnerBirth}</option><option value="BIRTH_NAME_BEFORE_PARTNER_NAME">{labels.nameUsageBirthPartner}</option></select></Field>
          <Field label={labels.gender}><select name="gender" defaultValue={employee.gender ?? 'PREFER_NOT_TO_SAY'} className="form-field"><option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option><option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option></select></Field>
          <Field label={labels.birthDate}><input name="birthDate" type="date" defaultValue={employee.birthDate ?? ''} className="form-field" /></Field>
          <Field label={labels.birthPlace}><input name="birthPlace" defaultValue={employee.birthPlace ?? ''} className="form-field" /></Field>
          <Field label={labels.birthCountry}><input name="birthCountry" minLength={2} maxLength={2} defaultValue={employee.birthCountry ?? ''} className="form-field uppercase" /></Field>
          <Field label={labels.nationality}><input name="nationality" minLength={2} maxLength={2} defaultValue={employee.nationality ?? ''} className="form-field uppercase" /></Field>
          <Field label={labels.preferredLanguage}><input name="preferredLanguage" defaultValue={employee.preferredLanguage ?? 'nl-NL'} className="form-field" /></Field>
          <Field label={labels.privateEmail}><input name="privateEmail" type="email" defaultValue={employee.privateEmail ?? ''} className="form-field" /></Field>
          <Field label={labels.privatePhone}><input name="privatePhone" type="tel" defaultValue={employee.privatePhone ?? ''} className="form-field" /></Field>
          <Field label={labels.privateMobile}><input name="privateMobile" type="tel" defaultValue={employee.privateMobile ?? ''} className="form-field" /></Field>
          <Field label={labels.workEmail}><input name="workEmail" type="email" defaultValue={employee.workEmail ?? ''} className="form-field" /></Field>
          <Field label={labels.workPhone}><input name="workPhone" type="tel" defaultValue={employee.workPhone ?? ''} className="form-field" /></Field>
          <Field label={labels.workPhoneExtension}><input name="workPhoneExt" defaultValue={employee.workPhoneExt ?? ''} className="form-field" /></Field>
          <Field label={labels.workMobile}><input name="workMobile" type="tel" defaultValue={employee.workMobile ?? ''} className="form-field" /></Field>
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
      <div className="flex flex-wrap items-center justify-between gap-3"><SectionHeader icon={<UserRound className="h-5 w-5" />} title={labels.personalTitle} />{capabilities.canEditEmployee && employee.updatedAt && <button type="button" onClick={() => setEditing(true)} className="button-secondary gap-2"><Pencil aria-hidden="true" className="h-4 w-4" />{labels.editPersonal}</button>}</div>
      <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <DataItem label={labels.employeeNumber} value={employee.employeeNumber} />
        <DataItem label={labels.birthDate} value={employee.birthDate} fallback={labels.notRecorded} />
        <DataItem label={labels.birthPlace} value={employee.birthPlace} fallback={labels.notRecorded} />
        <DataItem label={labels.nationality} value={employee.nationality} fallback={labels.notRecorded} />
        <DataItem label={labels.privateEmail} value={employee.privateEmail} fallback={labels.notRecorded} />
        <DataItem label={labels.privateMobile} value={employee.privateMobile} fallback={labels.notRecorded} />
        <DataItem label={labels.workEmail} value={employee.workEmail} fallback={labels.notRecorded} />
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

function AddressesPanel({ employeeId, addresses, canManage, locale, labels }: { employeeId: string; addresses: NonNullable<EmployeeDetailViewModel['addresses']>; canManage: boolean; locale: string; labels: EmployeePersonCardLabels }) {
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${date}T00:00:00Z`))
  return (
    <div><div className="flex flex-wrap items-center justify-between gap-3"><SectionHeader icon={<Home className="h-5 w-5" />} title={labels.addressesTitle} />{canManage && <ResourceDetails title={labels.addAddress}><AddressForm employeeId={employeeId} labels={labels} /></ResourceDetails>}</div>
      {addresses.length === 0 ? <EmptyState icon={<Home className="h-5 w-5" />} text={labels.addressesEmpty} /> : <ol className="mt-6 space-y-3">{addresses.map((address) => <li key={address.id} className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{address.street} {address.houseNumber}{address.addition ? ` ${address.addition}` : ''}</p>{!address.validUntil && <span className="status-chip bg-success-surface text-success">{labels.current}</span>}</div><p className="mt-1 text-sm text-muted-foreground">{address.postalCode} {address.city} · {address.countryCode}</p></div><p className="text-xs tabular-nums text-muted-foreground">{formatDate(address.validFrom)} — {address.validUntil ? formatDate(address.validUntil) : labels.current}</p></li>)}</ol>}
    </div>
  )
}

function AddressForm({ employeeId, labels }: { employeeId: string; labels: EmployeePersonCardLabels }) {
  const router = useRouter(); const [state, setState] = useState<MutationState>('idle')
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const succeeded = await runJsonMutation(setState, `/api/employees/${employeeId}/addresses`, 'POST', { street: value(form, 'street'), houseNumber: value(form, 'houseNumber'), addition: nullable(value(form, 'addition')), postalCode: value(form, 'postalCode'), city: value(form, 'city'), province: nullable(value(form, 'province')), countryCode: value(form, 'countryCode').toUpperCase(), validFrom: value(form, 'validFrom'), validUntil: nullable(value(form, 'validUntil')) }); if (!succeeded) return; formElement.reset(); router.refresh() }
  return <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-6"><Field label={labels.street} className="sm:col-span-4"><input name="street" required className="form-field" /></Field><Field label={labels.houseNumber}><input name="houseNumber" required className="form-field" /></Field><Field label={labels.addition}><input name="addition" className="form-field" /></Field><Field label={labels.postalCode} className="sm:col-span-2"><input name="postalCode" required className="form-field uppercase" /></Field><Field label={labels.city} className="sm:col-span-4"><input name="city" required className="form-field" /></Field><Field label={labels.province} className="sm:col-span-2"><input name="province" className="form-field" /></Field><Field label={labels.countryCode}><input name="countryCode" defaultValue="NL" required minLength={2} maxLength={2} className="form-field uppercase" /></Field><Field label={labels.validFrom} className="sm:col-span-2"><input name="validFrom" type="date" required className="form-field" /></Field><Field label={labels.validUntil} className="sm:col-span-2"><input name="validUntil" type="date" className="form-field" /></Field><FormFooter state={state} submit={labels.saveAddress} saving={labels.saving} saved={labels.saved} failed={labels.genericError} /></form>
}

function BankAccountsPanel({ employeeId, accounts, canManage, labels }: { employeeId: string; accounts: NonNullable<EmployeeDetailViewModel['bankAccounts']>; canManage: boolean; labels: EmployeePersonCardLabels }) {
  return <div><div className="flex flex-wrap items-center justify-between gap-3"><SectionHeader icon={<CreditCard className="h-5 w-5" />} title={labels.banksTitle} />{canManage && <ResourceDetails title={labels.addBank}><BankAccountForm employeeId={employeeId} labels={labels} /></ResourceDetails>}</div>{accounts.length === 0 ? <EmptyState icon={<CreditCard className="h-5 w-5" />} text={labels.banksEmpty} /> : <ul className="mt-6 space-y-3">{accounts.map((account) => <li key={account.id} className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold tabular-nums">{account.maskedIban}</p>{account.isPrimary && <span className="status-chip bg-success-surface text-success">{labels.primary}</span>}</div><p className="mt-1 text-sm text-muted-foreground">{account.accountHolder}{account.description ? ` · ${account.description}` : ''}</p></div>{account.bic && <span className="text-xs font-medium text-muted-foreground">{account.bic}</span>}</li>)}</ul>}</div>
}

function BankAccountForm({ employeeId, labels }: { employeeId: string; labels: EmployeePersonCardLabels }) {
  const router = useRouter(); const [state, setState] = useState<MutationState>('idle')
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const succeeded = await runJsonMutation(setState, `/api/employees/${employeeId}/bank-accounts`, 'POST', { iban: value(form, 'iban'), bic: nullable(value(form, 'bic')), accountHolder: value(form, 'accountHolder'), description: nullable(value(form, 'description')), isPrimary: form.get('isPrimary') === 'on' }); if (!succeeded) return; formElement.reset(); router.refresh() }
  return <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label={labels.iban}><input name="iban" required autoComplete="off" className="form-field uppercase" /></Field><Field label={labels.bic}><input name="bic" maxLength={11} className="form-field uppercase" /></Field><Field label={labels.accountHolder}><input name="accountHolder" required className="form-field" /></Field><Field label={labels.description}><input name="description" className="form-field" /></Field><label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input name="isPrimary" type="checkbox" className="h-4 w-4 accent-primary" />{labels.makePrimary}</label><FormFooter state={state} submit={labels.saveBank} saving={labels.saving} saved={labels.saved} failed={labels.genericError} /></form>
}

function RelationsPanel({ employeeId, relations, canManage, labels }: { employeeId: string; relations: NonNullable<EmployeeDetailViewModel['relations']>; canManage: boolean; labels: EmployeePersonCardLabels }) {
  const typeLabels: Record<EmployeeRelation['relationType'], string> = { PARTNER: labels.relationPartner, CHILD: labels.relationChild, PARENT: labels.relationParent, SIBLING: labels.relationSibling, DOCTOR: labels.relationDoctor, DENTIST: labels.relationDentist, OTHER: labels.relationOther }
  return <div><div className="flex flex-wrap items-center justify-between gap-3"><SectionHeader icon={<HeartHandshake className="h-5 w-5" />} title={labels.relationsTitle} />{canManage && <ResourceDetails title={labels.addRelation}><RelationForm employeeId={employeeId} labels={labels} /></ResourceDetails>}</div>{relations.length === 0 ? <EmptyState icon={<HeartHandshake className="h-5 w-5" />} text={labels.relationsEmpty} /> : <ul className="mt-6 grid gap-3 lg:grid-cols-2">{relations.map((relation) => <li key={relation.id} className="rounded-xl border bg-background p-4"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{relation.firstName} {relation.prefix} {relation.lastName}</p>{relation.isEmergencyContact && <span className="status-chip bg-warning-surface text-warning">{labels.emergencyContact}</span>}</div><p className="mt-1 text-sm text-muted-foreground">{typeLabels[relation.relationType]}</p>{(relation.mobile || relation.phone || relation.email) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{(relation.mobile || relation.phone) && <span className="flex items-center gap-1.5"><Phone aria-hidden="true" className="h-3.5 w-3.5" />{relation.mobile ?? relation.phone}</span>}{relation.email && <span className="flex items-center gap-1.5"><Mail aria-hidden="true" className="h-3.5 w-3.5" />{relation.email}</span>}</div>}</li>)}</ul>}</div>
}

function RelationForm({ employeeId, labels }: { employeeId: string; labels: EmployeePersonCardLabels }) {
  const router = useRouter(); const [state, setState] = useState<MutationState>('idle')
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const succeeded = await runJsonMutation(setState, `/api/employees/${employeeId}/relations`, 'POST', { relationType: value(form, 'relationType'), isEmergencyContact: form.get('isEmergencyContact') === 'on', firstName: nullable(value(form, 'firstName')), initials: null, prefix: nullable(value(form, 'prefix')), lastName: value(form, 'lastName'), gender: null, birthDate: null, phone: nullable(value(form, 'phone')), mobile: nullable(value(form, 'mobile')), email: nullable(value(form, 'email')), notes: nullable(value(form, 'notes')) }); if (!succeeded) return; formElement.reset(); router.refresh() }
  return <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2"><Field label={labels.relationType}><select name="relationType" className="form-field"><option value="PARTNER">{labels.relationPartner}</option><option value="CHILD">{labels.relationChild}</option><option value="PARENT">{labels.relationParent}</option><option value="SIBLING">{labels.relationSibling}</option><option value="DOCTOR">{labels.relationDoctor}</option><option value="DENTIST">{labels.relationDentist}</option><option value="OTHER">{labels.relationOther}</option></select></Field><label className="flex items-center gap-2 self-end pb-3 text-sm font-medium"><input name="isEmergencyContact" type="checkbox" className="h-4 w-4 accent-primary" />{labels.emergencyContact}</label><Field label={labels.firstName}><input name="firstName" className="form-field" /></Field><Field label={labels.birthNamePrefix}><input name="prefix" className="form-field" /></Field><Field label={labels.lastName}><input name="lastName" required className="form-field" /></Field><Field label={labels.mobile}><input name="mobile" type="tel" className="form-field" /></Field><Field label={labels.privatePhone}><input name="phone" type="tel" className="form-field" /></Field><Field label={labels.email}><input name="email" type="email" className="form-field" /></Field><Field label={labels.notes} className="sm:col-span-2"><textarea name="notes" rows={3} className="form-field min-h-24" /></Field><FormFooter state={state} submit={labels.saveRelation} saving={labels.saving} saved={labels.saved} failed={labels.genericError} /></form>
}

function ResourceDetails({ title, children }: { title: string; children: ReactNode }) { return <details className="group w-full rounded-xl border bg-surface-raised p-4 sm:w-auto sm:min-w-[28rem]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-primary">{title}<ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>{children}</details> }
function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) { return <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">{icon}</span><h2 className="text-lg font-semibold">{title}</h2></div> }
function EmptyState({ icon, text }: { icon: ReactNode; text: string }) { return <div className="mt-6 rounded-xl border border-dashed bg-surface-raised px-5 py-10 text-center text-muted-foreground"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted">{icon}</span><p className="mt-3 text-sm">{text}</p></div> }
function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) { return <label className={`grid gap-1.5 text-sm font-medium ${className}`}>{label}{children}</label> }
function DataItem({ label, value, fallback = '' }: { label: string; value: string | null | undefined; fallback?: string }) { return <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value || fallback}</dd></div> }
function InlineState({ kind, children }: { kind: 'saved' | 'failed'; children: ReactNode }) { return <span role={kind === 'failed' ? 'alert' : 'status'} className={`inline-flex items-center gap-1.5 text-sm ${kind === 'saved' ? 'text-success' : 'text-destructive'}`}>{kind === 'saved' ? <Check aria-hidden="true" className="h-4 w-4" /> : <AlertTriangle aria-hidden="true" className="h-4 w-4" />}{children}</span> }
function FormFooter({ state, submit, saving, saved, failed }: { state: MutationState; submit: string; saving: string; saved: string; failed: string }) { return <div className="flex flex-wrap items-center gap-3 border-t pt-4 sm:col-span-full"><button type="submit" disabled={state === 'saving'} className="button-primary gap-2">{state === 'saving' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{state === 'saving' ? saving : submit}</button>{state === 'saved' && <InlineState kind="saved">{saved}</InlineState>}{state === 'failed' && <InlineState kind="failed">{failed}</InlineState>}</div> }
