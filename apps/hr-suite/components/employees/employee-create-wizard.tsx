'use client'

import { AlertTriangle, Check, ChevronLeft, ChevronRight, LoaderCircle, Search, UserRoundPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

interface Candidate {
  id: string
  employeeNumber: string
  firstName: string
  birthName: string
  birthDate: string | null
  matchKind: 'BSN_EXACT' | 'FUZZY'
}

interface IdentityDraft {
  bsn: string
  birthDate: string
  birthName: string
  privateEmail: string
}

interface CoreDraft {
  employeeNumber: string
  firstName: string
  birthNamePrefix: string
  birthName: string
  nameUsage: 'BIRTH_NAME' | 'PARTNER_NAME' | 'PARTNER_BEFORE_BIRTH_NAME' | 'BIRTH_NAME_BEFORE_PARTNER_NAME'
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
  birthDate: string
  preferredLanguage: string
}

interface ContactDraft {
  privateEmail: string
  privateMobile: string
  workEmail: string
  workMobile: string
  street: string
  houseNumber: string
  addition: string
  postalCode: string
  city: string
  countryCode: string
  validFrom: string
}

interface ApiError {
  error?: string
  details?: { suggestedEmployeeNumber?: string }
}

type WizardField = 'bsn' | 'birthDate' | 'birthName' | 'privateEmail' | 'employeeNumber' | 'firstName'
  | 'workEmail' | 'street' | 'houseNumber' | 'postalCode' | 'city' | 'countryCode' | 'validFrom'
type WizardFieldErrors = Partial<Record<WizardField, string>>

export interface EmployeeCreateWizardLabels {
  steps: [string, string, string, string]
  identityTitle: string
  identityHelp: string
  bsn: string
  birthDate: string
  birthName: string
  privateEmail: string
  checkIdentity: string
  checking: string
  possibleMatches: string
  noMatches: string
  exactMatch: string
  possibleMatch: string
  chooseExisting: string
  notExisting: string
  exactBlocked: string
  identitySignalsRequired: string
  coreTitle: string
  coreHelp: string
  employeeNumber: string
  employeeNumberHelp: string
  firstName: string
  birthNamePrefix: string
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
  preferredLanguage: string
  languageDutch: string
  languageEnglish: string
  contactTitle: string
  contactHelp: string
  privateMobile: string
  workEmail: string
  workMobile: string
  addressTitle: string
  addressOptional: string
  street: string
  houseNumber: string
  addition: string
  postalCode: string
  city: string
  countryCode: string
  validFrom: string
  reviewTitle: string
  reviewHelp: string
  identitySection: string
  contactSection: string
  addressSection: string
  noAddress: string
  employmentOptional: string
  employmentOptionalHelp: string
  previous: string
  continue: string
  create: string
  creating: string
  genericError: string
  numberConflict: string
  addressSaveFailed: string
  addressIncomplete: string
  openEmployee: string
  validationRequired: string
  validationEmail: string
  invalidBsn: string
  invalidCountryCode: string
}

interface EmployeeCreateWizardProps {
  labels: EmployeeCreateWizardLabels
}

const EMPTY_IDENTITY: IdentityDraft = { bsn: '', birthDate: '', birthName: '', privateEmail: '' }
const EMPTY_CORE: CoreDraft = {
  employeeNumber: '', firstName: '', birthNamePrefix: '', birthName: '', nameUsage: 'BIRTH_NAME',
  gender: 'PREFER_NOT_TO_SAY', birthDate: '', preferredLanguage: 'nl-NL',
}
const EMPTY_CONTACT: ContactDraft = {
  privateEmail: '', privateMobile: '', workEmail: '', workMobile: '', street: '', houseNumber: '',
  addition: '', postalCode: '', city: '', countryCode: 'NL', validFrom: new Date().toISOString().slice(0, 10),
}

function value(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
}

function nullable(input: string): string | null {
  return input || null
}

function isValidEmail(input: string): boolean {
  return !input || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
}

function isValidBsn(input: string): boolean {
  const normalized = input.replace(/[\s-]/g, '')
  if (!/^\d{9}$/.test(normalized)) return false
  const digits = [...normalized].map(Number)
  const checksum = digits.slice(0, 8).reduce((sum, digit, index) => sum + digit * (9 - index), 0)
  return (checksum - digits[8]) % 11 === 0
}

export function EmployeeCreateWizard({ labels }: EmployeeCreateWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [identity, setIdentity] = useState<IdentityDraft>(EMPTY_IDENTITY)
  const [core, setCore] = useState<CoreDraft>(EMPTY_CORE)
  const [contact, setContact] = useState<ContactDraft>(EMPTY_CONTACT)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [state, setState] = useState<'idle' | 'checking' | 'loading-number' | 'creating'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<WizardFieldErrors>({})
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(null)
  const errorAttributes = (field: WizardField) => ({
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
  })

  async function checkIdentity(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setFieldErrors({})
    const form = new FormData(event.currentTarget)
    const draft: IdentityDraft = {
      bsn: value(form, 'bsn'), birthDate: value(form, 'birthDate'),
      birthName: value(form, 'birthName'), privateEmail: value(form, 'privateEmail'),
    }
    setIdentity(draft)
    const validationErrors: WizardFieldErrors = {}
    if (draft.bsn && !isValidBsn(draft.bsn)) validationErrors.bsn = labels.invalidBsn
    if (!draft.bsn && (!draft.birthDate || !draft.birthName)) {
      if (!draft.birthDate) validationErrors.birthDate = labels.identitySignalsRequired
      if (!draft.birthName) validationErrors.birthName = labels.identitySignalsRequired
    }
    if (!isValidEmail(draft.privateEmail)) validationErrors.privateEmail = labels.validationEmail
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError(labels.genericError)
      return
    }
    setState('checking')
    try {
      const response = await fetch('/api/employees/matches', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bsn: draft.bsn || undefined, birthDate: draft.birthDate || undefined,
          birthName: draft.birthName || undefined, privateEmail: draft.privateEmail || undefined,
        }),
      })
      if (!response.ok) throw new Error('IDENTITY_CHECK_FAILED')
      const payload: { data: Candidate[] } = await response.json()
      setCandidates(payload.data)
    } catch {
      setError(labels.genericError)
    } finally {
      setState('idle')
    }
  }

  async function continueWithNewEmployee(): Promise<void> {
    setError(null)
    setFieldErrors({})
    setState('loading-number')
    try {
      const response = await fetch('/api/employees/next-number', { method: 'POST' })
      if (!response.ok) throw new Error('EMPLOYEE_NUMBER_FAILED')
      const payload: { data: { employeeNumber: string } } = await response.json()
      setCore((current) => ({
        ...current,
        employeeNumber: current.employeeNumber || payload.data.employeeNumber,
        birthName: identity.birthName,
        birthDate: identity.birthDate,
      }))
      setContact((current) => ({ ...current, privateEmail: identity.privateEmail }))
      setStep(1)
    } catch {
      setError(labels.genericError)
    } finally {
      setState('idle')
    }
  }

  function saveCore(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const draft: CoreDraft = {
      employeeNumber: value(form, 'employeeNumber'), firstName: value(form, 'firstName'),
      birthNamePrefix: value(form, 'birthNamePrefix'), birthName: value(form, 'birthName'),
      nameUsage: value(form, 'nameUsage') as CoreDraft['nameUsage'],
      gender: value(form, 'gender') as CoreDraft['gender'], birthDate: value(form, 'birthDate'),
      preferredLanguage: value(form, 'preferredLanguage'),
    }
    const validationErrors: WizardFieldErrors = {}
    if (!draft.employeeNumber) validationErrors.employeeNumber = labels.validationRequired
    if (!draft.firstName) validationErrors.firstName = labels.validationRequired
    if (!draft.birthName) validationErrors.birthName = labels.validationRequired
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError(labels.genericError)
      return
    }
    setCore(draft)
    setFieldErrors({})
    setError(null)
    setStep(2)
  }

  function saveContact(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const draft: ContactDraft = {
      privateEmail: value(form, 'privateEmail'), privateMobile: value(form, 'privateMobile'),
      workEmail: value(form, 'workEmail'), workMobile: value(form, 'workMobile'), street: value(form, 'street'),
      houseNumber: value(form, 'houseNumber'), addition: value(form, 'addition'), postalCode: value(form, 'postalCode'),
      city: value(form, 'city'), countryCode: value(form, 'countryCode').toUpperCase(), validFrom: value(form, 'validFrom'),
    }
    const hasAddressValue = draft.street || draft.houseNumber || draft.postalCode || draft.city
    const validationErrors: WizardFieldErrors = {}
    if (!isValidEmail(draft.privateEmail)) validationErrors.privateEmail = labels.validationEmail
    if (!isValidEmail(draft.workEmail)) validationErrors.workEmail = labels.validationEmail
    if (hasAddressValue) {
      if (!draft.street) validationErrors.street = labels.validationRequired
      if (!draft.houseNumber) validationErrors.houseNumber = labels.validationRequired
      if (!draft.postalCode) validationErrors.postalCode = labels.validationRequired
      if (!draft.city) validationErrors.city = labels.validationRequired
      if (!draft.validFrom) validationErrors.validFrom = labels.validationRequired
      if (!/^[A-Z]{2}$/.test(draft.countryCode)) validationErrors.countryCode = labels.invalidCountryCode
    }
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError(
        validationErrors.street || validationErrors.houseNumber || validationErrors.postalCode
          || validationErrors.city || validationErrors.countryCode || validationErrors.validFrom
          ? labels.addressIncomplete
          : labels.genericError,
      )
      return
    }
    setContact(draft)
    setFieldErrors({})
    setError(null)
    setStep(3)
  }

  async function createEmployee(): Promise<void> {
    setError(null)
    setState('creating')
    try {
      const response = await fetch('/api/employees', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeNumber: core.employeeNumber, firstName: core.firstName,
          birthNamePrefix: nullable(core.birthNamePrefix), birthName: core.birthName,
          nameUsage: core.nameUsage, gender: core.gender, birthDate: nullable(core.birthDate),
          preferredLanguage: core.preferredLanguage, privateEmail: nullable(contact.privateEmail),
          privateMobile: nullable(contact.privateMobile), workEmail: nullable(contact.workEmail),
          workMobile: nullable(contact.workMobile), bsn: identity.bsn || undefined,
        }),
      })
      const payload: { data?: { id: string }; error?: string; details?: ApiError['details'] } = await response.json()
      if (!response.ok || !payload.data) {
        if (response.status === 409 && payload.details?.suggestedEmployeeNumber) {
          setCore((current) => ({ ...current, employeeNumber: payload.details?.suggestedEmployeeNumber ?? current.employeeNumber }))
          setFieldErrors({ employeeNumber: labels.numberConflict })
          setError(labels.numberConflict)
          setStep(1)
          return
        }
        throw new Error(payload.error ?? 'EMPLOYEE_CREATE_FAILED')
      }

      const employeeId = payload.data.id
      const hasAddress = contact.street || contact.houseNumber || contact.postalCode || contact.city
      if (hasAddress) {
        try {
          const addressResponse = await fetch(`/api/employees/${employeeId}/addresses`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              street: contact.street, houseNumber: contact.houseNumber, addition: nullable(contact.addition),
              postalCode: contact.postalCode, city: contact.city, province: null,
              countryCode: contact.countryCode, validFrom: contact.validFrom, validUntil: null,
            }),
          })
          if (!addressResponse.ok) throw new Error('ADDRESS_CREATE_FAILED')
        } catch {
          setCreatedEmployeeId(employeeId)
          setError(labels.addressSaveFailed)
          return
        }
      }
      router.push(`/employees/${employeeId}`)
      router.refresh()
    } catch {
      setError(labels.genericError)
    } finally {
      setState('idle')
    }
  }

  const hasExactMatch = candidates?.some((candidate) => candidate.matchKind === 'BSN_EXACT') ?? false

  return (
    <div className="grid gap-7 xl:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label={labels.steps.join(', ')}>
        <ol className="grid grid-cols-4 gap-2 xl:sticky xl:top-6 xl:grid-cols-1">
          {labels.steps.map((label, index) => (
            <li key={label} className="min-w-0">
              <div
                aria-current={index === step ? 'step' : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  index === step ? 'border-primary bg-primary text-primary-foreground' : index < step ? 'bg-success-surface text-success' : 'bg-surface text-muted-foreground'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/25 text-xs tabular-nums">
                  {index < step ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="hidden truncate xl:inline">{label}</span>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      <section className="min-w-0 rounded-2xl border bg-surface p-5 shadow-sm sm:p-7">
        {step === 0 && (
          <div>
            <header>
              <p className="eyebrow">{labels.steps[0]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.identityTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.identityHelp}</p>
            </header>
            <form onSubmit={checkIdentity} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                {labels.bsn}
                <input name="bsn" defaultValue={identity.bsn} inputMode="numeric" autoComplete="off" className="form-field" {...errorAttributes('bsn')} />
                <FieldError field="bsn" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {labels.birthDate}
                <input name="birthDate" defaultValue={identity.birthDate} type="date" className="form-field" {...errorAttributes('birthDate')} />
                <FieldError field="birthDate" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {labels.birthName}
                <input name="birthName" defaultValue={identity.birthName} className="form-field" {...errorAttributes('birthName')} />
                <FieldError field="birthName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                {labels.privateEmail}
                <input name="privateEmail" defaultValue={identity.privateEmail} type="email" className="form-field" {...errorAttributes('privateEmail')} />
                <FieldError field="privateEmail" errors={fieldErrors} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={state === 'checking'} className="button-primary gap-2">
                  {state === 'checking' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
                  {state === 'checking' ? labels.checking : labels.checkIdentity}
                </button>
              </div>
            </form>

            {candidates && (
              <div className="mt-7 border-t pt-6" aria-live="polite">
                <h3 className="font-semibold">{labels.possibleMatches}</h3>
                {candidates.length === 0 ? (
                  <div className="mt-3 rounded-xl bg-success-surface p-4 text-sm text-success">{labels.noMatches}</div>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {candidates.map((candidate) => (
                      <li key={candidate.id} className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className={candidate.matchKind === 'BSN_EXACT' ? 'status-chip bg-destructive-surface text-destructive' : 'status-chip bg-warning-surface text-warning'}>
                            {candidate.matchKind === 'BSN_EXACT' ? labels.exactMatch : labels.possibleMatch}
                          </span>
                          <p className="mt-2 font-semibold">{candidate.firstName} {candidate.birthName}</p>
                          <p className="text-sm text-muted-foreground">{candidate.employeeNumber}</p>
                        </div>
                        <Link href={`/employees/${candidate.id}`} className="button-secondary shrink-0">{labels.chooseExisting}</Link>
                      </li>
                    ))}
                  </ul>
                )}
                {hasExactMatch ? (
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-destructive-surface p-4 text-sm text-destructive">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{labels.exactBlocked}
                  </p>
                ) : (
                  <button type="button" onClick={continueWithNewEmployee} disabled={state === 'loading-number'} className="button-primary mt-4 gap-2">
                    {state === 'loading-number' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
                    {labels.notExisting}<ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={saveCore} noValidate>
            <header>
              <p className="eyebrow">{labels.steps[1]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.coreTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.coreHelp}</p>
            </header>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                {labels.employeeNumber}
                <input
                  name="employeeNumber"
                  defaultValue={core.employeeNumber}
                  maxLength={40}
                  className="form-field font-semibold tabular-nums"
                  aria-invalid={fieldErrors.employeeNumber ? true : undefined}
                  aria-describedby={fieldErrors.employeeNumber ? 'employee-number-help employeeNumber-error' : 'employee-number-help'}
                />
                <span id="employee-number-help" className="text-xs font-normal text-muted-foreground">{labels.employeeNumberHelp}</span>
                <FieldError field="employeeNumber" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {labels.firstName}
                <input name="firstName" defaultValue={core.firstName} maxLength={120} className="form-field" {...errorAttributes('firstName')} />
                <FieldError field="firstName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {labels.birthNamePrefix}
                <input name="birthNamePrefix" defaultValue={core.birthNamePrefix} maxLength={40} className="form-field" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                {labels.birthName}
                <input name="birthName" defaultValue={core.birthName} maxLength={120} className="form-field" {...errorAttributes('birthName')} />
                <FieldError field="birthName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {labels.nameUsage}
                <select name="nameUsage" defaultValue={core.nameUsage} className="form-field">
                  <option value="BIRTH_NAME">{labels.nameUsageBirth}</option>
                  <option value="PARTNER_NAME">{labels.nameUsagePartner}</option>
                  <option value="PARTNER_BEFORE_BIRTH_NAME">{labels.nameUsagePartnerBirth}</option>
                  <option value="BIRTH_NAME_BEFORE_PARTNER_NAME">{labels.nameUsageBirthPartner}</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {labels.gender}
                <select name="gender" defaultValue={core.gender} className="form-field">
                  <option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option>
                  <option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {labels.birthDate}
                <input name="birthDate" defaultValue={core.birthDate} type="date" className="form-field" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {labels.preferredLanguage}
                <select name="preferredLanguage" defaultValue={core.preferredLanguage} className="form-field">
                  <option value="nl-NL">{labels.languageDutch}</option><option value="en-GB">{labels.languageEnglish}</option>
                </select>
              </label>
            </div>
            <WizardActions labels={labels} onBack={() => { setFieldErrors({}); setError(null); setStep(0) }} />
          </form>
        )}

        {step === 2 && (
          <form onSubmit={saveContact} noValidate>
            <header>
              <p className="eyebrow">{labels.steps[2]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.contactTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.contactHelp}</p>
            </header>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">{labels.privateEmail}<input name="privateEmail" defaultValue={contact.privateEmail} type="email" className="form-field" {...errorAttributes('privateEmail')} /><FieldError field="privateEmail" errors={fieldErrors} /></label>
              <label className="grid gap-1.5 text-sm font-medium">{labels.privateMobile}<input name="privateMobile" defaultValue={contact.privateMobile} type="tel" className="form-field" /></label>
              <label className="grid gap-1.5 text-sm font-medium">{labels.workEmail}<input name="workEmail" defaultValue={contact.workEmail} type="email" className="form-field" {...errorAttributes('workEmail')} /><FieldError field="workEmail" errors={fieldErrors} /></label>
              <label className="grid gap-1.5 text-sm font-medium">{labels.workMobile}<input name="workMobile" defaultValue={contact.workMobile} type="tel" className="form-field" /></label>
            </div>
            <div className="mt-7 border-t pt-6">
              <div className="flex flex-wrap items-baseline gap-2"><h3 className="font-semibold">{labels.addressTitle}</h3><span className="text-xs text-muted-foreground">{labels.addressOptional}</span></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-6">
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-4">{labels.street}<input name="street" defaultValue={contact.street} className="form-field" {...errorAttributes('street')} /><FieldError field="street" errors={fieldErrors} /></label>
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-1">{labels.houseNumber}<input name="houseNumber" defaultValue={contact.houseNumber} className="form-field" {...errorAttributes('houseNumber')} /><FieldError field="houseNumber" errors={fieldErrors} /></label>
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-1">{labels.addition}<input name="addition" defaultValue={contact.addition} className="form-field" /></label>
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">{labels.postalCode}<input name="postalCode" defaultValue={contact.postalCode} className="form-field uppercase" {...errorAttributes('postalCode')} /><FieldError field="postalCode" errors={fieldErrors} /></label>
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-4">{labels.city}<input name="city" defaultValue={contact.city} className="form-field" {...errorAttributes('city')} /><FieldError field="city" errors={fieldErrors} /></label>
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">{labels.countryCode}<input name="countryCode" defaultValue={contact.countryCode} minLength={2} maxLength={2} className="form-field uppercase" {...errorAttributes('countryCode')} /><FieldError field="countryCode" errors={fieldErrors} /></label>
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-4">{labels.validFrom}<input name="validFrom" defaultValue={contact.validFrom} type="date" className="form-field" {...errorAttributes('validFrom')} /><FieldError field="validFrom" errors={fieldErrors} /></label>
              </div>
            </div>
            <WizardActions labels={labels} onBack={() => { setFieldErrors({}); setError(null); setStep(1) }} />
          </form>
        )}

        {step === 3 && (
          <div>
            <header>
              <p className="eyebrow">{labels.steps[3]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.reviewTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.reviewHelp}</p>
            </header>
            <div className="mt-6 divide-y rounded-xl border bg-background">
              <ReviewSection title={labels.identitySection} lines={[`${core.firstName} ${core.birthNamePrefix} ${core.birthName}`.replace(/\s+/g, ' ').trim(), core.employeeNumber, core.birthDate]} />
              <ReviewSection title={labels.contactSection} lines={[contact.privateEmail, contact.privateMobile, contact.workEmail, contact.workMobile]} />
              <ReviewSection title={labels.addressSection} lines={contact.street ? [`${contact.street} ${contact.houseNumber}${contact.addition ? ` ${contact.addition}` : ''}`, `${contact.postalCode} ${contact.city}`, contact.countryCode] : [labels.noAddress]} />
            </div>
            <div className="mt-5 rounded-xl bg-accent p-4">
              <p className="font-semibold text-accent-foreground">{labels.employmentOptional}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.employmentOptionalHelp}</p>
            </div>
            {createdEmployeeId && (
              <Link href={`/employees/${createdEmployeeId}`} className="button-secondary mt-4">{labels.openEmployee}</Link>
            )}
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              <button type="button" onClick={() => { setFieldErrors({}); setError(null); setStep(2) }} disabled={state === 'creating' || Boolean(createdEmployeeId)} className="button-secondary gap-2"><ChevronLeft aria-hidden="true" className="h-4 w-4" />{labels.previous}</button>
              <button type="button" onClick={createEmployee} disabled={state === 'creating' || Boolean(createdEmployeeId)} className="button-primary gap-2">
                {state === 'creating' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
                {state === 'creating' ? labels.creating : labels.create}
              </button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-destructive-surface p-4 text-sm text-destructive"><AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      </section>
    </div>
  )
}

function WizardActions({ labels, onBack }: { labels: EmployeeCreateWizardLabels; onBack: () => void }) {
  return (
    <div className="mt-7 flex items-center justify-between gap-3 border-t pt-5">
      <button type="button" onClick={onBack} className="button-secondary gap-2"><ChevronLeft aria-hidden="true" className="h-4 w-4" />{labels.previous}</button>
      <button type="submit" className="button-primary gap-2">{labels.continue}<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
    </div>
  )
}

function ReviewSection({ title, lines }: { title: string; lines: string[] }) {
  const visible = lines.filter(Boolean)
  return (
    <section className="grid gap-2 p-4 sm:grid-cols-[10rem_1fr] sm:p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-1 text-sm text-muted-foreground">{visible.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>
    </section>
  )
}

function FieldError({ field, errors }: { field: WizardField; errors: WizardFieldErrors }) {
  const message = errors[field]
  if (!message) return null
  return <span id={`${field}-error`} className="text-xs font-medium text-destructive">{message}</span>
}
