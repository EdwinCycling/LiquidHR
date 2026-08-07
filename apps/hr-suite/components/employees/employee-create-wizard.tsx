'use client'

import { AlertTriangle, Check, ChevronLeft, ChevronRight, LoaderCircle, Search, UserRoundPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmploymentCreateForm, type EmploymentCreateFormProps } from '@/components/employment/employment-create-form'
import type { EmploymentCreationOptions } from '@/lib/employment/employment-service'

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
  partnerName: string
  nameUsage: 'BIRTH_NAME' | 'PARTNER_NAME' | 'PARTNER_BEFORE_BIRTH_NAME' | 'BIRTH_NAME_BEFORE_PARTNER_NAME'
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
  birthDate: string
  preferredLanguage: string
}

interface AdditionalDraft {
  title: string
  initials: string
  pronouns: string
  birthPlace: string
  birthCountry: string
  nationality: string
  maritalStatus: '' | 'SINGLE' | 'MARRIED' | 'REGISTERED_PARTNERSHIP' | 'DIVORCED' | 'WIDOWED'
  maritalStatusDate: string
  educationLevel: '' | 'MBO' | 'HBO' | 'WO' | 'HIGHSCHOOL' | 'OTHER' | 'UNKNOWN'
  privatePhone: string
  workPhone: string
  workPhoneExt: string
  originalHireDate: string
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
}

interface ApiError {
  error?: string
  details?: { suggestedEmployeeNumber?: string }
}

interface EmployeeNumberUsage {
  highestNumericEmployeeNumber: string | null
  usedEmployeeNumbers: string[]
  truncated: boolean
}

type WizardField = 'bsn' | 'birthDate' | 'birthName' | 'privateEmail' | 'employeeNumber' | 'firstName'
  | 'partnerName' | 'birthCountry' | 'nationality' | 'workEmail' | 'street' | 'houseNumber' | 'postalCode' | 'city' | 'countryCode'
type WizardFieldErrors = Partial<Record<WizardField, string>>

export interface EmployeeCreateWizardLabels {
  steps: [string, string, string, string, string]
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
  partnerName: string
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
  additionalTitle: string
  additionalHelp: string
  employeeTitle: string
  employeeInitials: string
  pronouns: string
  birthPlace: string
  birthCountry: string
  nationality: string
  maritalStatus: string
  maritalStatusSingle: string
  maritalStatusMarried: string
  maritalStatusRegisteredPartnership: string
  maritalStatusDivorced: string
  maritalStatusWidowed: string
  maritalStatusDate: string
  educationLevel: string
  educationMbo: string
  educationHbo: string
  educationWo: string
  educationHighschool: string
  educationOther: string
  educationUnknown: string
  privatePhone: string
  workPhone: string
  workPhoneExtension: string
  originalHireDate: string
  countrySearch: string
  countryNoResults: string
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
  reviewTitle: string
  reviewHelp: string
  identitySection: string
  additionalSection: string
  contactSection: string
  addressSection: string
  noAddress: string
  employmentOptional: string
  employmentOptionalHelp: string
  previous: string
  continue: string
  create: string
  createAndEmployment: string
  creating: string
  genericError: string
  numberConflict: string
  addressSaveFailed: string
  addressIncomplete: string
  openEmployee: string
  creationComplete: string
  creationCompleteHelp: string
  required: string
  optional: string
  validationRequired: string
  validationEmail: string
  invalidBsn: string
  invalidCountryCode: string
  employeeNumberHighest: string
  employeeNumberUsage: string
  employeeNumberUsageTitle: string
  employeeNumberUsageHelp: string
  employeeNumberUsageTruncated: string
  employeeNumberUsageClose: string
  employeeNumberChecking: string
  employeeNumberAvailable: string
  employeeNumberInUse: string
  employmentLoading: string
  employmentComplete: string
  employmentCompleteHelp: string
  openEmployment: string
  employment: EmploymentCreateFormProps['labels']
}

interface EmployeeCreateWizardProps {
  labels: EmployeeCreateWizardLabels
  locale: string
}

const EMPTY_IDENTITY: IdentityDraft = { bsn: '', birthDate: '', birthName: '', privateEmail: '' }
const EMPTY_CORE: CoreDraft = {
  employeeNumber: '', firstName: '', birthNamePrefix: '', birthName: '', partnerName: '', nameUsage: 'BIRTH_NAME',
  gender: 'PREFER_NOT_TO_SAY', birthDate: '', preferredLanguage: 'nl-NL',
}
const EMPTY_ADDITIONAL: AdditionalDraft = {
  title: '', initials: '', pronouns: '', birthPlace: '', birthCountry: '', nationality: '', maritalStatus: '',
  maritalStatusDate: '', educationLevel: '', privatePhone: '', workPhone: '', workPhoneExt: '', originalHireDate: '',
}
const EMPTY_CONTACT: ContactDraft = {
  privateEmail: '', privateMobile: '', workEmail: '', workMobile: '', street: '', houseNumber: '',
  addition: '', postalCode: '', city: '', countryCode: 'NL',
}

const ADDRESS_DEFAULT_VALID_FROM = '1900-01-01'

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

export function EmployeeCreateWizard({ labels, locale }: EmployeeCreateWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [identity, setIdentity] = useState<IdentityDraft>(EMPTY_IDENTITY)
  const [core, setCore] = useState<CoreDraft>(EMPTY_CORE)
  const [additional, setAdditional] = useState<AdditionalDraft>(EMPTY_ADDITIONAL)
  const [contact, setContact] = useState<ContactDraft>(EMPTY_CONTACT)
  const [nameUsage, setNameUsage] = useState<CoreDraft['nameUsage']>(EMPTY_CORE.nameUsage)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [state, setState] = useState<'idle' | 'checking' | 'loading-number' | 'checking-number' | 'creating'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<WizardFieldErrors>({})
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(null)
  const [addressSaveFailed, setAddressSaveFailed] = useState(false)
  const [createDestination, setCreateDestination] = useState<'employee' | 'employment' | null>(null)
  const [employmentOptions, setEmploymentOptions] = useState<EmploymentCreationOptions | null>(null)
  const [employmentLoading, setEmploymentLoading] = useState(false)
  const [employmentStep, setEmploymentStep] = useState(0)
  const [employmentPayrollDetails, setEmploymentPayrollDetails] = useState(false)
  const [createdEmploymentId, setCreatedEmploymentId] = useState<string | null>(null)
  const [numberUsage, setNumberUsage] = useState<EmployeeNumberUsage | null>(null)
  const [showNumberUsage, setShowNumberUsage] = useState(false)
  const [numberInput, setNumberInput] = useState('')
  const [numberCheck, setNumberCheck] = useState<'idle' | 'checking' | 'available' | 'in-use'>('idle')
  const errorAttributes = (field: WizardField) => ({
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
  })

  useEffect(() => {
    if (step !== 1 || !numberInput.trim()) return
    const timer = setTimeout(() => {
      setNumberCheck('checking')
      void fetch(`/api/employees/number-availability?employeeNumber=${encodeURIComponent(numberInput.trim())}`)
        .then(async (response) => {
          const payload: { data?: { available: boolean } } = await response.json()
          if (!response.ok || payload.data === undefined) throw new Error('EMPLOYEE_NUMBER_AVAILABILITY_FAILED')
          setNumberCheck(payload.data.available ? 'available' : 'in-use')
        })
        .catch(() => setNumberCheck('idle'))
    }, 350)
    return () => clearTimeout(timer)
  }, [numberInput, step])

  async function loadNumberUsage(): Promise<void> {
    try {
      const response = await fetch('/api/employees/number-usage')
      if (!response.ok) return
      const payload: { data?: EmployeeNumberUsage } = await response.json()
      if (payload.data) setNumberUsage(payload.data)
    } catch {
      // The usage popup is informative and must not block employee creation.
    }
  }

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
      const nextEmployeeNumber = payload.data.employeeNumber
      setCore((current) => ({
        ...current,
        employeeNumber: current.employeeNumber || nextEmployeeNumber,
        birthName: identity.birthName,
        birthDate: identity.birthDate,
      }))
      setNumberInput((current) => current || nextEmployeeNumber)
      void loadNumberUsage()
      setContact((current) => ({ ...current, privateEmail: identity.privateEmail }))
      setStep(1)
    } catch {
      setError(labels.genericError)
    } finally {
      setState('idle')
    }
  }

  async function saveCore(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const draft: CoreDraft = {
      employeeNumber: value(form, 'employeeNumber'), firstName: value(form, 'firstName'),
      birthNamePrefix: value(form, 'birthNamePrefix'), birthName: value(form, 'birthName'),
      partnerName: value(form, 'partnerName'),
      nameUsage: value(form, 'nameUsage') as CoreDraft['nameUsage'],
      gender: value(form, 'gender') as CoreDraft['gender'], birthDate: value(form, 'birthDate'),
      preferredLanguage: value(form, 'preferredLanguage'),
    }
    const validationErrors: WizardFieldErrors = {}
    if (!draft.employeeNumber) validationErrors.employeeNumber = labels.validationRequired
    if (!draft.firstName) validationErrors.firstName = labels.validationRequired
    if (!draft.birthName) validationErrors.birthName = labels.validationRequired
    if (draft.nameUsage !== 'BIRTH_NAME' && !draft.partnerName) validationErrors.partnerName = labels.validationRequired
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError(labels.genericError)
      return
    }
    setState('checking-number')
    try {
      const availabilityResponse = await fetch(`/api/employees/number-availability?employeeNumber=${encodeURIComponent(draft.employeeNumber)}`)
      const availabilityPayload: { data?: { available: boolean } } = await availabilityResponse.json()
      if (!availabilityResponse.ok || availabilityPayload.data?.available !== true) {
        setFieldErrors({ employeeNumber: labels.employeeNumberInUse })
        setError(labels.employeeNumberInUse)
        setNumberCheck('in-use')
        setState('idle')
        return
      }
    } catch {
      setError(labels.genericError)
      setState('idle')
      return
    }
    setCore(draft)
    setNumberInput(draft.employeeNumber)
    setNumberCheck('available')
    setNameUsage(draft.nameUsage)
    setFieldErrors({})
    setError(null)
    setStep(2)
  }

  function saveAdditional(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const draft: AdditionalDraft = {
      title: value(form, 'title'), initials: value(form, 'initials'), pronouns: value(form, 'pronouns'),
      birthPlace: value(form, 'birthPlace'), birthCountry: value(form, 'birthCountry').toUpperCase(),
      nationality: value(form, 'nationality').toUpperCase(),
      maritalStatus: value(form, 'maritalStatus') as AdditionalDraft['maritalStatus'],
      maritalStatusDate: value(form, 'maritalStatusDate'),
      educationLevel: value(form, 'educationLevel') as AdditionalDraft['educationLevel'],
      privatePhone: value(form, 'privatePhone'), workPhone: value(form, 'workPhone'),
      workPhoneExt: value(form, 'workPhoneExt'), originalHireDate: value(form, 'originalHireDate'),
    }
    const validationErrors: WizardFieldErrors = {}
    if (draft.birthCountry && !/^[A-Z]{2}$/.test(draft.birthCountry)) validationErrors.birthCountry = labels.invalidCountryCode
    if (draft.nationality && !/^[A-Z]{2}$/.test(draft.nationality)) validationErrors.nationality = labels.invalidCountryCode
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError(labels.genericError)
      return
    }
    setAdditional(draft)
    setFieldErrors({})
    setError(null)
    setStep(3)
  }

  function saveContact(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const draft: ContactDraft = {
      privateEmail: value(form, 'privateEmail'), privateMobile: value(form, 'privateMobile'),
      workEmail: value(form, 'workEmail'), workMobile: value(form, 'workMobile'), street: value(form, 'street'),
      houseNumber: value(form, 'houseNumber'), addition: value(form, 'addition'), postalCode: value(form, 'postalCode'),
      city: value(form, 'city'), countryCode: value(form, 'countryCode').toUpperCase(),
    }
    const hasAddressValue = draft.street || draft.houseNumber || draft.postalCode || draft.city
    setContact(draft)
    const validationErrors: WizardFieldErrors = {}
    if (!isValidEmail(draft.privateEmail)) validationErrors.privateEmail = labels.validationEmail
    if (!isValidEmail(draft.workEmail)) validationErrors.workEmail = labels.validationEmail
    if (hasAddressValue) {
      if (!draft.street) validationErrors.street = labels.validationRequired
      if (!draft.houseNumber) validationErrors.houseNumber = labels.validationRequired
      if (!draft.postalCode) validationErrors.postalCode = labels.validationRequired
      if (!draft.city) validationErrors.city = labels.validationRequired
      if (!/^[A-Z]{2}$/.test(draft.countryCode)) validationErrors.countryCode = labels.invalidCountryCode
    }
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError(
        validationErrors.street || validationErrors.houseNumber || validationErrors.postalCode
          || validationErrors.city || validationErrors.countryCode
          ? labels.addressIncomplete
          : labels.genericError,
      )
      return
    }
    setContact(draft)
    setFieldErrors({})
    setError(null)
    setStep(4)
  }

  async function createEmployee(destination: 'employee' | 'employment'): Promise<void> {
    setError(null)
    setState('creating')
    try {
      const response = await fetch('/api/employees', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeNumber: core.employeeNumber, firstName: core.firstName,
          birthNamePrefix: nullable(core.birthNamePrefix), birthName: core.birthName,
          partnerName: nullable(core.partnerName),
          nameUsage: core.nameUsage, gender: core.gender, birthDate: nullable(core.birthDate),
          title: nullable(additional.title), initials: nullable(additional.initials), pronouns: nullable(additional.pronouns),
          birthPlace: nullable(additional.birthPlace), birthCountry: nullable(additional.birthCountry),
          nationality: nullable(additional.nationality), maritalStatus: additional.maritalStatus || null,
          maritalStatusDate: nullable(additional.maritalStatusDate), educationLevel: additional.educationLevel || null,
          preferredLanguage: core.preferredLanguage, privateEmail: nullable(contact.privateEmail),
          privatePhone: nullable(additional.privatePhone), privateMobile: nullable(contact.privateMobile),
          workEmail: nullable(contact.workEmail), workPhone: nullable(additional.workPhone),
          workPhoneExt: nullable(additional.workPhoneExt),
          workMobile: nullable(contact.workMobile), bsn: identity.bsn || undefined,
          originalHireDate: nullable(additional.originalHireDate),
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
      let addressFailed = false
      if (hasAddress) {
        try {
          const addressResponse = await fetch(`/api/employees/${employeeId}/addresses`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              street: contact.street, houseNumber: contact.houseNumber, addition: nullable(contact.addition),
              postalCode: contact.postalCode, city: contact.city, province: null,
              countryCode: contact.countryCode, validFrom: ADDRESS_DEFAULT_VALID_FROM, validUntil: null,
            }),
          })
          if (!addressResponse.ok) throw new Error('ADDRESS_CREATE_FAILED')
        } catch {
          addressFailed = true
          setAddressSaveFailed(true)
          setError(labels.addressSaveFailed)
          if (destination === 'employee') {
            setCreatedEmployeeId(employeeId)
            setCreateDestination(destination)
            return
          }
        }
      }
      setCreatedEmployeeId(employeeId)
      setCreateDestination(destination)
      if (destination === 'employment') {
        setEmploymentLoading(true)
        setEmploymentOptions(null)
        setEmploymentStep(0)
        setEmploymentPayrollDetails(false)
        setCreatedEmploymentId(null)
        const optionsResponse = await fetch(`/api/employees/${employeeId}/employment-options`)
        const optionsPayload: { data?: EmploymentCreationOptions } = await optionsResponse.json()
        if (!optionsResponse.ok || !optionsPayload.data) {
          setEmploymentLoading(false)
          setError(labels.genericError)
          return
        }
        setEmploymentOptions(optionsPayload.data)
        setEmploymentLoading(false)
      } else if (!addressFailed) {
        router.push(`/employees/${employeeId}`)
        router.refresh()
      }
    } catch {
      setError(labels.genericError)
    } finally {
      setState('idle')
    }
  }

  const hasExactMatch = candidates?.some((candidate) => candidate.matchKind === 'BSN_EXACT') ?? false
  const employmentFlow = createDestination === 'employment' && Boolean(createdEmployeeId)
  const employmentStepLabels = employmentPayrollDetails
    ? [labels.employment.stepAdministration, labels.employment.stepEmployment, labels.employment.stepPayrollChoice, labels.employment.stepContract, labels.employment.stepSchedule, labels.employment.stepSalary, labels.employment.stepOther, labels.employment.stepReview]
    : [labels.employment.stepAdministration, labels.employment.stepEmployment, labels.employment.stepPayrollChoice, labels.employment.stepReview]
  const visibleSteps = employmentFlow ? [...labels.steps, ...employmentStepLabels] : labels.steps
  const activeStep = employmentFlow ? labels.steps.length + employmentStep : step
  const displayedNumberCheck = step === 1 && numberInput.trim() ? numberCheck : 'idle'

  return (
    <div className="grid gap-7 xl:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label={visibleSteps.join(', ')}>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:sticky xl:top-6 xl:grid-cols-1">
          {visibleSteps.map((label, index) => (
            <li key={label} className="min-w-0">
              <div
                aria-current={index === activeStep ? 'step' : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  index === activeStep ? 'border-primary bg-primary text-primary-foreground' : index < activeStep ? 'bg-success-surface text-success' : 'bg-surface text-muted-foreground'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/25 text-xs tabular-nums">
                  {index < activeStep ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="hidden truncate xl:inline">{label}</span>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      <section className="min-w-0 rounded-2xl border bg-surface p-5 shadow-sm sm:p-7">
        {createdEmployeeId && createDestination === 'employment' && (
          <div className="space-y-5">
            {addressSaveFailed && <p role="alert" className="rounded-xl bg-warning-surface p-4 text-sm text-warning">{labels.addressSaveFailed}</p>}
            {employmentLoading && <div className="flex items-center gap-3 rounded-2xl border bg-background p-6 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />{labels.employmentLoading}</div>}
            {!employmentLoading && employmentOptions && !createdEmploymentId && <EmploymentCreateForm
              employeeId={createdEmployeeId}
              options={employmentOptions}
              labels={labels.employment}
              showNavigation={false}
              showPayrollChoice
              onStepChange={setEmploymentStep}
              onPayrollChoiceChange={setEmploymentPayrollDetails}
              onSaved={setCreatedEmploymentId}
            />}
            {!employmentLoading && createdEmploymentId && <div className="rounded-2xl border border-success/30 bg-success-surface p-6">
              <p className="eyebrow text-success">{labels.employmentComplete}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.employmentComplete}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.employmentCompleteHelp}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/employees/${createdEmployeeId}`} className="button-secondary">{labels.openEmployee}</Link>
                <Link href={`/employees/${createdEmployeeId}/employments/${createdEmploymentId}`} className="button-primary">{labels.openEmployment}</Link>
              </div>
            </div>}
            {!employmentLoading && !employmentOptions && !createdEmploymentId && <div className="rounded-2xl border border-destructive/30 bg-destructive-surface p-6">
              <p role="alert" className="text-sm text-destructive">{error ?? labels.genericError}</p>
              <Link href={`/employees/${createdEmployeeId}`} className="button-secondary mt-5">{labels.openEmployee}</Link>
            </div>}
          </div>
        )}

        {createdEmployeeId && createDestination !== 'employment' && (
          <div className="rounded-2xl border border-success/30 bg-success-surface p-6">
            <p className="eyebrow text-success">{labels.creationComplete}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.creationComplete}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{addressSaveFailed ? labels.addressSaveFailed : labels.creationCompleteHelp}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/employees/${createdEmployeeId}`} className="button-primary">{labels.openEmployee}</Link>
              <Link href={`/employees/${createdEmployeeId}?tab=employments&create=1`} className="button-secondary">{labels.createAndEmployment}</Link>
            </div>
          </div>
        )}

        {!createdEmployeeId && <>
        {step === 0 && (
          <div>
            <header>
              <p className="eyebrow">{labels.steps[0]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.identityTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.identityHelp}</p>
              </header>
            <form onSubmit={checkIdentity} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <FieldLabel labels={labels} required={false}>{labels.bsn}</FieldLabel>
                <input name="bsn" defaultValue={identity.bsn} inputMode="numeric" autoComplete="off" className="form-field" {...errorAttributes('bsn')} />
                <FieldError field="bsn" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={!identity.bsn}>{labels.birthDate}</FieldLabel>
                <input name="birthDate" defaultValue={identity.birthDate} type="date" className="form-field" {...errorAttributes('birthDate')} />
                <FieldError field="birthDate" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={!identity.bsn}>{labels.birthName}</FieldLabel>
                <input name="birthName" defaultValue={identity.birthName} className="form-field" {...errorAttributes('birthName')} />
                <FieldError field="birthName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <FieldLabel labels={labels} required={false}>{labels.privateEmail}</FieldLabel>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <FieldLabel labels={labels} required>{labels.employeeNumber}</FieldLabel>
                  {numberUsage?.highestNumericEmployeeNumber && <span className="text-xs font-normal text-muted-foreground">{labels.employeeNumberHighest}: {numberUsage.highestNumericEmployeeNumber}</span>}
                </div>
                <input
                  name="employeeNumber"
                  value={core.employeeNumber}
                  onChange={(event) => { setCore((current) => ({ ...current, employeeNumber: event.target.value })); setNumberInput(event.target.value) }}
                  maxLength={40}
                  className="form-field font-semibold tabular-nums"
                  aria-invalid={fieldErrors.employeeNumber ? true : undefined}
                  aria-describedby={fieldErrors.employeeNumber ? 'employee-number-help employeeNumber-error' : 'employee-number-help'}
                />
                <span id="employee-number-help" className="text-xs font-normal text-muted-foreground">{labels.employeeNumberHelp}</span>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-normal">
                   <span className={displayedNumberCheck === 'in-use' ? 'text-destructive' : displayedNumberCheck === 'available' ? 'text-success' : 'text-muted-foreground'}>
                     {displayedNumberCheck === 'checking' ? labels.employeeNumberChecking : displayedNumberCheck === 'available' ? labels.employeeNumberAvailable : displayedNumberCheck === 'in-use' ? labels.employeeNumberInUse : ''}
                  </span>
                  {numberUsage && <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setShowNumberUsage(true)}>{labels.employeeNumberUsage}</button>}
                </div>
                <FieldError field="employeeNumber" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required>{labels.firstName}</FieldLabel>
                <input name="firstName" defaultValue={core.firstName} maxLength={120} className="form-field" {...errorAttributes('firstName')} />
                <FieldError field="firstName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={false}>{labels.birthNamePrefix}</FieldLabel>
                <input name="birthNamePrefix" defaultValue={core.birthNamePrefix} maxLength={40} className="form-field" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <FieldLabel labels={labels} required>{labels.birthName}</FieldLabel>
                <input name="birthName" defaultValue={core.birthName} maxLength={120} className="form-field" {...errorAttributes('birthName')} />
                <FieldError field="birthName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required>{labels.nameUsage}</FieldLabel>
                <select name="nameUsage" value={nameUsage} onChange={(event) => setNameUsage(event.target.value as CoreDraft['nameUsage'])} className="form-field">
                  <option value="BIRTH_NAME">{labels.nameUsageBirth}</option>
                  <option value="PARTNER_NAME">{labels.nameUsagePartner}</option>
                  <option value="PARTNER_BEFORE_BIRTH_NAME">{labels.nameUsagePartnerBirth}</option>
                  <option value="BIRTH_NAME_BEFORE_PARTNER_NAME">{labels.nameUsageBirthPartner}</option>
                </select>
              </label>
              {nameUsage !== 'BIRTH_NAME' && <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <FieldLabel labels={labels} required>{labels.partnerName}</FieldLabel>
                <input name="partnerName" defaultValue={core.partnerName} maxLength={120} className="form-field" {...errorAttributes('partnerName')} />
                <FieldError field="partnerName" errors={fieldErrors} />
              </label>}
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required>{labels.gender}</FieldLabel>
                <select name="gender" defaultValue={core.gender} className="form-field">
                  <option value="MALE">{labels.genderMale}</option><option value="FEMALE">{labels.genderFemale}</option>
                  <option value="OTHER">{labels.genderOther}</option><option value="PREFER_NOT_TO_SAY">{labels.genderUndisclosed}</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={false}>{labels.birthDate}</FieldLabel>
                <input name="birthDate" defaultValue={core.birthDate} type="date" className="form-field" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required>{labels.preferredLanguage}</FieldLabel>
                <select name="preferredLanguage" defaultValue={core.preferredLanguage} className="form-field">
                  <option value="nl-NL">{labels.languageDutch}</option><option value="en-GB">{labels.languageEnglish}</option>
                </select>
              </label>
            </div>
            <WizardActions labels={labels} onBack={() => { setFieldErrors({}); setError(null); setStep(0) }} />
          </form>
        )}

        {step === 2 && (
          <form onSubmit={saveAdditional} noValidate>
            <header>
              <p className="eyebrow">{labels.steps[2]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.additionalTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.additionalHelp}</p>
            </header>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <TextField name="title" defaultValue={additional.title} label={labels.employeeTitle} labels={labels} />
              <TextField name="initials" defaultValue={additional.initials} label={labels.employeeInitials} labels={labels} />
              <TextField name="pronouns" defaultValue={additional.pronouns} label={labels.pronouns} labels={labels} />
              <TextField name="birthPlace" defaultValue={additional.birthPlace} label={labels.birthPlace} labels={labels} />
              <CountryField name="birthCountry" defaultValue={additional.birthCountry} label={labels.birthCountry} labels={labels} locale={locale} error={fieldErrors.birthCountry} />
              <CountryField name="nationality" defaultValue={additional.nationality} label={labels.nationality} labels={labels} locale={locale} error={fieldErrors.nationality} />
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={false}>{labels.maritalStatus}</FieldLabel>
                <select name="maritalStatus" defaultValue={additional.maritalStatus} className="form-field">
                  <option value="">—</option><option value="SINGLE">{labels.maritalStatusSingle}</option><option value="MARRIED">{labels.maritalStatusMarried}</option>
                  <option value="REGISTERED_PARTNERSHIP">{labels.maritalStatusRegisteredPartnership}</option><option value="DIVORCED">{labels.maritalStatusDivorced}</option><option value="WIDOWED">{labels.maritalStatusWidowed}</option>
                </select>
              </label>
              <TextField name="maritalStatusDate" defaultValue={additional.maritalStatusDate} label={labels.maritalStatusDate} labels={labels} type="date" />
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={false}>{labels.educationLevel}</FieldLabel>
                <select name="educationLevel" defaultValue={additional.educationLevel} className="form-field">
                  <option value="">—</option><option value="MBO">{labels.educationMbo}</option><option value="HBO">{labels.educationHbo}</option><option value="WO">{labels.educationWo}</option>
                  <option value="HIGHSCHOOL">{labels.educationHighschool}</option><option value="OTHER">{labels.educationOther}</option><option value="UNKNOWN">{labels.educationUnknown}</option>
                </select>
              </label>
              <TextField name="privatePhone" defaultValue={additional.privatePhone} label={labels.privatePhone} labels={labels} type="tel" />
              <TextField name="workPhone" defaultValue={additional.workPhone} label={labels.workPhone} labels={labels} type="tel" />
              <TextField name="workPhoneExt" defaultValue={additional.workPhoneExt} label={labels.workPhoneExtension} labels={labels} />
              <TextField name="originalHireDate" defaultValue={additional.originalHireDate} label={labels.originalHireDate} labels={labels} type="date" />
            </div>
            <WizardActions labels={labels} onBack={() => { setFieldErrors({}); setError(null); setStep(1) }} />
          </form>
        )}

        {step === 3 && (
          <form onSubmit={saveContact} noValidate>
            <header>
              <p className="eyebrow">{labels.steps[3]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.contactTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.contactHelp}</p>
            </header>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <TextField name="privateEmail" defaultValue={contact.privateEmail} label={labels.privateEmail} labels={labels} type="email" error={fieldErrors.privateEmail} />
              <TextField name="privateMobile" defaultValue={contact.privateMobile} label={labels.privateMobile} labels={labels} type="tel" />
              <TextField name="workEmail" defaultValue={contact.workEmail} label={labels.workEmail} labels={labels} type="email" error={fieldErrors.workEmail} />
              <TextField name="workMobile" defaultValue={contact.workMobile} label={labels.workMobile} labels={labels} type="tel" />
            </div>
            <div className="mt-7 border-t pt-6">
              <div className="flex flex-wrap items-baseline gap-2"><h3 className="font-semibold">{labels.addressTitle}</h3><span className="text-xs text-muted-foreground">{labels.addressOptional}</span></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-6">
                <TextField name="street" defaultValue={contact.street} label={labels.street} labels={labels} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} className="sm:col-span-4" error={fieldErrors.street} />
                <TextField name="houseNumber" defaultValue={contact.houseNumber} label={labels.houseNumber} labels={labels} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} className="sm:col-span-1" error={fieldErrors.houseNumber} />
                <TextField name="addition" defaultValue={contact.addition} label={labels.addition} labels={labels} className="sm:col-span-1" />
                <TextField name="postalCode" defaultValue={contact.postalCode} label={labels.postalCode} labels={labels} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} className="sm:col-span-2" error={fieldErrors.postalCode} />
                <TextField name="city" defaultValue={contact.city} label={labels.city} labels={labels} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} className="sm:col-span-4" error={fieldErrors.city} />
                <CountryField name="countryCode" defaultValue={contact.countryCode} label={labels.countryCode} labels={labels} locale={locale} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} className="sm:col-span-2" error={fieldErrors.countryCode} />
              </div>
            </div>
            <WizardActions labels={labels} onBack={() => { setFieldErrors({}); setError(null); setStep(2) }} />
          </form>
        )}

        {step === 4 && (
          <div>
            <header>
              <p className="eyebrow">{labels.steps[4]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.reviewTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.reviewHelp}</p>
            </header>
            <div className="mt-6 divide-y rounded-xl border bg-background">
              <ReviewSection title={labels.identitySection} lines={[`${core.firstName} ${core.birthNamePrefix} ${core.birthName}`.replace(/\s+/g, ' ').trim(), core.employeeNumber, core.birthDate]} />
              <ReviewSection title={labels.additionalSection} lines={[additional.title, additional.initials, core.partnerName, additional.birthPlace, additional.birthCountry, additional.nationality, additional.maritalStatus, additional.educationLevel, additional.privatePhone, additional.workPhone, additional.originalHireDate]} />
              <ReviewSection title={labels.contactSection} lines={[contact.privateEmail, contact.privateMobile, contact.workEmail, contact.workMobile]} />
              <ReviewSection title={labels.addressSection} lines={contact.street ? [`${contact.street} ${contact.houseNumber}${contact.addition ? ` ${contact.addition}` : ''}`, `${contact.postalCode} ${contact.city}`, contact.countryCode] : [labels.noAddress]} />
            </div>
            <div className="mt-5 rounded-xl bg-accent p-4">
              <p className="font-semibold text-accent-foreground">{labels.employmentOptional}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.employmentOptionalHelp}</p>
            </div>
            <div className="mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => { setFieldErrors({}); setError(null); setStep(3) }} disabled={state === 'creating'} className="button-secondary inline-flex w-fit gap-2"><ChevronLeft aria-hidden="true" className="h-4 w-4" />{labels.previous}</button>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void createEmployee('employee')} disabled={state === 'creating'} className="button-secondary gap-2">
                  {state === 'creating' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
                  {state === 'creating' ? labels.creating : labels.create}
                </button>
                <button type="button" onClick={() => void createEmployee('employment')} disabled={state === 'creating'} className="button-primary gap-2">
                  {state === 'creating' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
                  {state === 'creating' ? labels.creating : labels.createAndEmployment}
                </button>
              </div>
            </div>
          </div>
        )}

        </>}
        {error && !createdEmployeeId && <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-destructive-surface p-4 text-sm text-destructive"><AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

        {showNumberUsage && numberUsage && <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/70 p-4" role="presentation" onMouseDown={() => setShowNumberUsage(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="employee-number-usage-title" className="w-full max-w-2xl rounded-2xl border bg-surface p-6 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="employee-number-usage-title" className="text-xl font-semibold">{labels.employeeNumberUsageTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{labels.employeeNumberUsageHelp}</p>
              </div>
              <button type="button" className="button-secondary shrink-0" onClick={() => setShowNumberUsage(false)}>{labels.employeeNumberUsageClose}</button>
            </div>
            <div className="mt-5 max-h-72 overflow-y-auto rounded-xl border bg-background p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {numberUsage.usedEmployeeNumbers.map((number) => <span key={number} className="rounded-lg border px-3 py-2 text-sm tabular-nums">{number}</span>)}
              </div>
              {numberUsage.truncated && <p className="mt-3 text-xs text-muted-foreground">{labels.employeeNumberUsageTruncated}</p>}
            </div>
          </div>
        </div>}
      </section>
    </div>
  )
}

function FieldLabel({ children, labels, required }: { children: ReactNode; labels: Pick<EmployeeCreateWizardLabels, 'required' | 'optional'>; required: boolean }) {
  return <span className="flex flex-wrap items-center gap-2"><span>{children}</span><span className={`text-xs font-normal ${required ? 'text-primary' : 'text-muted-foreground'}`}>{required ? `* ${labels.required}` : labels.optional}</span></span>
}

function TextField({ name, defaultValue, label, labels, type = 'text', className, error, required = false }: { name: string; defaultValue: string; label: string; labels: EmployeeCreateWizardLabels; type?: string; className?: string; error?: string; required?: boolean }) {
  return <label className={`grid gap-1.5 text-sm font-medium ${className ?? ''}`}>
    <FieldLabel labels={labels} required={required}>{label}</FieldLabel>
    <input name={name} defaultValue={defaultValue} type={type} className="form-field" aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined} aria-required={required} />
    {error && <span id={`${name}-error`} className="text-xs font-medium text-destructive">{error}</span>}
  </label>
}

function CountryField({ name, defaultValue, label, labels, locale, error, required = false, className }: { name: 'birthCountry' | 'nationality' | 'countryCode'; defaultValue: string; label: string; labels: EmployeeCreateWizardLabels; locale: string; error?: string; required?: boolean; className?: string }) {
  const countries = useMemo(() => getCountryOptions(locale), [locale])
  return <label className={`grid gap-1.5 text-sm font-medium ${className ?? ''}`}>
    <FieldLabel labels={labels} required={required}>{label}</FieldLabel>
    <DropdownSelect name={name} defaultValue={defaultValue} searchable searchPlaceholder={labels.countrySearch} emptyLabel={labels.countryNoResults} aria-label={label} aria-invalid={error ? true : undefined} aria-required={required} required={required}>
      <option value="">—</option>
      {countries.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
    </DropdownSelect>
    {error && <span id={`${name}-error`} className="text-xs font-medium text-destructive">{error}</span>}
  </label>
}

function getCountryOptions(locale: string): Array<{ code: string; label: string }> {
  const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
  return [...new Set(['NL', ...codes])]
    .map((code) => ({ code, label: displayNames.of(code) ?? code }))
    .sort((left, right) => left.code === 'NL' ? -1 : right.code === 'NL' ? 1 : left.label.localeCompare(right.label))
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
