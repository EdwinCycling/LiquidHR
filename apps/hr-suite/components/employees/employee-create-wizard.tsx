'use client'

import { AlertTriangle, ArrowDown, Check, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, MapPin, Save, Search, ShieldCheck, UserRoundPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ChangeEventHandler, type FocusEvent, type FocusEventHandler, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmploymentCreateForm, type EmploymentCreateFormProps } from '@/components/employment/employment-create-form'
import { EmploymentContractCreateForm, type EmploymentContractWizardDraft, type EmploymentContractWizardOptions } from '@/components/employment/employment-contract-create-form'
import type { EmploymentCreationOptions } from '@/lib/employment/employment-service'
import type { AddressSuggestion } from '@/lib/address/address-suggestions'
import type { CustomFieldDefinition } from '@/lib/custom-fields/service'
import { isNewEmployeeBirthDateValid } from '@/lib/employees/age-validation'

interface Candidate {
  id: string
  employeeNumber: string
  firstName: string
  birthName: string
  birthDate: string | null
  isArchived: boolean
  employment: {
    status: 'ACTIVE' | 'LAST' | 'NONE'
    employmentType: 'EMPLOYEE' | 'INTERN' | 'APPRENTICE' | 'CONTRACTOR' | 'TEMPORARY_AGENCY' | 'FREELANCER' | 'VOLUNTEER' | 'NO_PAYROLL' | null
    startsOn: string | null
    endsOn: string | null
    administrationNumber: string | null
    administrationName: string | null
  }
  canRehire: boolean
  canUseExisting: boolean
  matchKind: 'BSN_EXACT' | 'FUZZY'
}

interface RehireEmployeeDetail {
  employee: {
    employeeNumber: string
    firstName: string
    birthName: string
    birthNamePrefix: string | null
    partnerNamePrefix: string | null
    partnerName: string | null
    nameUsage: CoreDraft['nameUsage']
    gender: CoreDraft['gender']
    birthDate: string | null
    preferredLanguage: string
    title: string | null
    initials: string | null
    pronouns: string | null
    birthPlace: string | null
    birthCountry: string | null
    nationality: string | null
    maritalStatus: Exclude<AdditionalDraft['maritalStatus'], ''> | null
    maritalStatusDate: string | null
    educationLevel: Exclude<AdditionalDraft['educationLevel'], ''> | null
    privateEmail: string | null
    privatePhone: string | null
    privateMobile: string | null
    workEmail: string | null
    workPhone: string | null
    workPhoneExt: string | null
    workMobile: string | null
    originalHireDate: string | null
    updatedAt: string
  }
  addresses: Array<{
    id: string
    addressType: 'PRIMARY' | 'SECONDARY'
    addressLine2: string | null
    street: string | null
    houseNumber: string | null
    houseNumberAddition: string | null
    postalCode: string | null
    city: string
    countryCode: string
    validFrom: string
  }>
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
  partnerNamePrefix: string
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
  ageRangeInvalid: string
  birthName: string
  privateEmail: string
  checkIdentity: string
  skipIdentityCheck: string
  identityCheckTitle: string
  identityCheckStepSignals: string
  identityCheckStepSearch: string
  identityCheckStepSecure: string
  identityCheckPleaseWait: string
  employmentCreateTitle: string
  employmentCreateStepEmployee: string
  employmentCreateStepEmployment: string
  employmentCreateStepSave: string
  employmentCreatePleaseWait: string
  cancelNewEmployee: string
  continueAfterIdentityCheck: string
  notYetSaved: string
  saved: string
  saveDraft: string
  savingDraft: string
  namePreview: string
  namePreviewHelp: string
  namePreviewCallName: string
  namePreviewSurname: string
  namePreviewPartnerName: string
  namePreviewResult: string
  checking: string
  possibleMatches: string
  noMatches: string
  exactMatch: string
  possibleMatch: string
  chooseExisting: string
  rehireAction: string
  useExistingAction: string
  rehireLoading: string
  rehireSelected: string
  rehireSelectedHelp: string
  existingEmployeeSelected: string
  existingEmployeeSelectedHelp: string
  rehireCopyTitle: string
  rehireCopyHelp: string
  rehireCopyYes: string
  rehireCopyNo: string
  rehireCopyItems: string
  rehireCopyEmployment: string
  rehireCopyContract: string
  rehireCopySchedule: string
  rehireCopySalary: string
  rehireCopyOrganization: string
  rehireCopyCostAllocation: string
  moreInfo: string
  archiveStatus: string
  archivedYes: string
  archivedNo: string
  activeEmployment: string
  lastEmployment: string
  noEmployment: string
  employmentType: string
  administration: string
  period: string
  noAdministration: string
  workerEmployee: string
  workerStudentIntern: string
  workerTemporaryAgency: string
  workerContractor: string
  workerFreelancer: string
  workerVolunteer: string
  workerNoPayroll: string
  exactBlocked: string
  exactActiveBlocked: string
  exactClosedContinue: string
  exactNoEmploymentContinue: string
  identitySignalsRequired: string
  coreTitle: string
  coreHelp: string
  employeeNumber: string
  employeeNumberHelp: string
  firstName: string
  birthNamePrefix: string
  partnerNamePrefix: string
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
  moreDataAvailable: string
  optionalExtraDetails: string
  freeFields: string
  freeFieldsHelp: string
  freeFieldsEmpty: string
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
  streetHasNumberNote: string
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
  updateExistingEmployee: string
  updateExistingEmployeeShort: string
  createAndEmployment: string
  createAndEmploymentShort: string
  rehireActionShort: string
  creating: string
  genericError: string
  numberConflict: string
  identityConflict: string
  addressSaveFailed: string
  addressIncomplete: string
  validationFieldsMissing: string
  validationCorrectFields: string
  openEmployee: string
  creationComplete: string
  creationCompleteHelp: string
  required: string
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
  initialEmploymentEmployeeId?: string
  initialEmploymentOptions?: EmploymentCreationOptions
  initialContractEmployeeId?: string
  initialContractEmploymentId?: string
  initialContractOptions?: EmploymentContractWizardOptions
  initialContractEmploymentStartsOn?: string
  initialContractIsFirst?: boolean
  initialContractDraft?: EmploymentContractWizardDraft
  initialContractSubmitLabel?: string
}

const EMPTY_IDENTITY: IdentityDraft = { bsn: '', birthDate: '', birthName: '', privateEmail: '' }
const EMPTY_CORE: CoreDraft = {
  employeeNumber: '', firstName: '', birthNamePrefix: '', birthName: '', partnerNamePrefix: '', partnerName: '', nameUsage: 'BIRTH_NAME',
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

export function EmployeeCreateWizard({ labels, locale, initialEmploymentEmployeeId, initialEmploymentOptions, initialContractEmployeeId, initialContractEmploymentId, initialContractOptions, initialContractEmploymentStartsOn, initialContractIsFirst, initialContractDraft, initialContractSubmitLabel }: EmployeeCreateWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [identity, setIdentity] = useState<IdentityDraft>(EMPTY_IDENTITY)
  const [core, setCore] = useState<CoreDraft>(EMPTY_CORE)
  const [namePreview, setNamePreview] = useState<Pick<CoreDraft, 'firstName' | 'birthNamePrefix' | 'birthName' | 'partnerNamePrefix' | 'partnerName' | 'nameUsage'>>({ firstName: '', birthNamePrefix: '', birthName: '', partnerNamePrefix: '', partnerName: '', nameUsage: EMPTY_CORE.nameUsage })
  const [additional, setAdditional] = useState<AdditionalDraft>(EMPTY_ADDITIONAL)
  const [contact, setContact] = useState<ContactDraft>(EMPTY_CONTACT)
  const [nameUsage, setNameUsage] = useState<CoreDraft['nameUsage']>(EMPTY_CORE.nameUsage)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [state, setState] = useState<'idle' | 'checking' | 'loading-number' | 'loading-rehire' | 'checking-number' | 'saving-draft' | 'creating'>('idle')
  const [identityCheckProgress, setIdentityCheckProgress] = useState(0)
  const [employmentCreateProgress, setEmploymentCreateProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<WizardFieldErrors>({})
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(initialContractEmployeeId ?? initialEmploymentEmployeeId ?? null)
  const [rehireEmployeeId, setRehireEmployeeId] = useState<string | null>(null)
  const [existingEmployeeMode, setExistingEmployeeMode] = useState<'rehire' | 'existing' | null>(null)
  const [rehireEmployeeUpdatedAt, setRehireEmployeeUpdatedAt] = useState<string | null>(null)
  const [rehirePrimaryAddressId, setRehirePrimaryAddressId] = useState<string | null>(null)
  const [rehirePrimaryAddressValidFrom, setRehirePrimaryAddressValidFrom] = useState(ADDRESS_DEFAULT_VALID_FROM)
  const [rehireOriginalContact, setRehireOriginalContact] = useState<ContactDraft | null>(null)
  const [draftEmployeeId, setDraftEmployeeId] = useState<string | null>(null)
  const [draftEmployeeUpdatedAt, setDraftEmployeeUpdatedAt] = useState<string | null>(null)
  const [addressSaveFailed, setAddressSaveFailed] = useState(false)
  const [createDestination, setCreateDestination] = useState<'employee' | 'employment' | 'contract' | null>(initialContractEmploymentId ? 'contract' : initialEmploymentEmployeeId ? 'employment' : null)
  const [employmentOptions, setEmploymentOptions] = useState<EmploymentCreationOptions | null>(initialEmploymentOptions ?? null)
  const [employmentLoading, setEmploymentLoading] = useState(Boolean(initialEmploymentEmployeeId && !initialEmploymentOptions))
  const [employmentStep, setEmploymentStep] = useState(0)
  const [contractStep, setContractStep] = useState(0)
  const [employmentPayrollDetails, setEmploymentPayrollDetails] = useState(false)
  const [employmentSaving, setEmploymentSaving] = useState(false)
  const [createdEmploymentId, setCreatedEmploymentId] = useState<string | null>(null)
  const [rehireCopyChoice, setRehireCopyChoice] = useState<'pending' | 'yes' | 'no'>('no')
  const [numberUsage, setNumberUsage] = useState<EmployeeNumberUsage | null>(null)
  const [showNumberUsage, setShowNumberUsage] = useState(false)
  const [numberInput, setNumberInput] = useState('')
  const [numberCheck, setNumberCheck] = useState<'idle' | 'checking' | 'available' | 'in-use'>('idle')
  const [customFieldDefinitions, setCustomFieldDefinitions] = useState<CustomFieldDefinition[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string | number | boolean | string[] | null>>({})
  const wizardScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollDown, setCanScrollDown] = useState(false)

  useEffect(() => {
    if (state !== 'checking') {
      return
    }
    const timer = setInterval(() => setIdentityCheckProgress((current) => Math.min(current + 1, 3)), 650)
    return () => clearInterval(timer)
  }, [state])

  useEffect(() => {
    if (state !== 'creating' && !employmentSaving) return
    const timer = setInterval(() => setEmploymentCreateProgress((current) => Math.min(current + 1, 3)), 700)
    return () => clearInterval(timer)
  }, [employmentSaving, state])
  const [addressQuery, setAddressQuery] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [addressSearchState, setAddressSearchState] = useState<'idle' | 'loading' | 'empty' | 'failed'>('idle')
  const [addressLookupState, setAddressLookupState] = useState<'idle' | 'loading' | 'failed'>('idle')
  const [streetHasNumberWarning, setStreetHasNumberWarning] = useState(false)
  const errorAttributes = (field: WizardField) => ({
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? `${field}-error` : undefined,
  })

  function clearFieldErrors(fields: WizardField[]): void {
    setFieldErrors((current) => {
      const next = { ...current }
      fields.forEach((field) => { delete next[field] })
      if (Object.keys(next).length === 0) setError(null)
      return next
    })
  }

  async function validateFieldOnBlur(field: WizardField, event: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>): Promise<void> {
    const form = event.currentTarget.form
    if (!form) return
    const formData = new FormData(form)
    const fieldValue = value(formData, field)
    if (field === 'bsn') {
      if (fieldValue && isValidBsn(fieldValue)) clearFieldErrors(['bsn', 'birthDate', 'birthName'])
      return
    }
    if (field === 'birthDate' || field === 'birthName') {
      if (isValidBsn(value(formData, 'bsn')) || (value(formData, 'birthDate') && value(formData, 'birthName'))) clearFieldErrors(['birthDate', 'birthName'])
      return
    }
    if (field === 'privateEmail' || field === 'workEmail') {
      if (isValidEmail(fieldValue)) clearFieldErrors([field])
      return
    }
    if (field === 'birthCountry' || field === 'nationality') {
      if (!fieldValue || /^[A-Z]{2}$/.test(fieldValue.toUpperCase())) clearFieldErrors([field])
      return
    }
    if (field === 'street' || field === 'houseNumber' || field === 'postalCode' || field === 'city' || field === 'countryCode') {
      const hasAddressValue = ['street', 'houseNumber', 'postalCode', 'city'].some((name) => value(formData, name))
      const addressComplete = !hasAddressValue || (value(formData, 'street') && value(formData, 'houseNumber') && value(formData, 'postalCode') && value(formData, 'city') && /^[A-Z]{2}$/.test(value(formData, 'countryCode').toUpperCase()))
      if (addressComplete) clearFieldErrors(['street', 'houseNumber', 'postalCode', 'city', 'countryCode'])
      return
    }
    if (field === 'employeeNumber') {
      if (!fieldValue) return
      try {
        const response = await fetch(`/api/employees/number-availability?employeeNumber=${encodeURIComponent(fieldValue)}`)
        const payload: { data?: { available: boolean } } = await response.json()
        if (response.ok && payload.data?.available) clearFieldErrors(['employeeNumber'])
      } catch {
        // The debounced availability check remains the fallback.
      }
      return
    }
    if (fieldValue) clearFieldErrors([field])
  }

  function employmentTypeLabel(type: Candidate['employment']['employmentType']): string {
    if (type === 'EMPLOYEE') return labels.workerEmployee
    if (type === 'INTERN' || type === 'APPRENTICE') return labels.workerStudentIntern
    if (type === 'CONTRACTOR' || type === 'TEMPORARY_AGENCY') return labels.workerTemporaryAgency
    if (type === 'FREELANCER') return labels.workerFreelancer
    if (type === 'VOLUNTEER') return labels.workerVolunteer
    if (type === 'NO_PAYROLL') return labels.workerNoPayroll
    return labels.noEmployment
  }

  useEffect(() => {
    if (step !== 2) return
    void fetch('/api/custom-fields')
      .then(async (response) => response.ok ? (await response.json() as { data?: CustomFieldDefinition[] }).data ?? [] : [])
      .then((definitions) => setCustomFieldDefinitions(definitions.filter((definition) => definition.isActive && definition.hrAccess === 'WRITE' && definition.fieldType !== 'AUTO_INCREMENT')))
      .catch(() => setCustomFieldDefinitions([]))
  }, [step])

  useEffect(() => {
    const element = wizardScrollRef.current
    if (!element) return
    const updateScrollHint = () => setCanScrollDown(element.scrollHeight - element.scrollTop - element.clientHeight > 8)
    updateScrollHint()
    element.addEventListener('scroll', updateScrollHint, { passive: true })
    window.addEventListener('resize', updateScrollHint)
    const resizeObserver = new ResizeObserver(updateScrollHint)
    resizeObserver.observe(element)
    return () => { element.removeEventListener('scroll', updateScrollHint); window.removeEventListener('resize', updateScrollHint); resizeObserver.disconnect() }
  }, [step, employmentStep, employmentPayrollDetails, customFieldDefinitions.length, candidates?.length])

  useEffect(() => {
    if (step !== 4) return
    const element = wizardScrollRef.current
    if (element) element.scrollTop = 0
  }, [step, createdEmployeeId, createDestination])

  useEffect(() => {
    const query = addressQuery.trim()
    if (query.length < 3) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setAddressSearchState('loading')
      void fetch(`/api/address-suggestions?country=${encodeURIComponent(contact.countryCode)}&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('ADDRESS_SEARCH_FAILED')
          const payload: { data?: AddressSuggestion[] } = await response.json()
          const suggestions = payload.data ?? []
          setAddressSuggestions(suggestions)
          setAddressSearchState(suggestions.length > 0 ? 'idle' : 'empty')
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setAddressSuggestions([])
          setAddressSearchState('failed')
        })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [addressQuery, contact.countryCode])

  function applyAddressSuggestion(suggestion: AddressSuggestion): void {
    setContact((current) => ({ ...current, countryCode: suggestion.countryCode, street: suggestion.street ?? '', houseNumber: suggestion.houseNumber ?? '', addition: suggestion.houseNumberAddition ?? '', postalCode: suggestion.postalCode ?? '', city: suggestion.city ?? '' }))
    setStreetHasNumberWarning(Boolean(suggestion.street && /\d/.test(suggestion.street)))
    setAddressQuery('')
    setAddressSuggestions([])
    setAddressSearchState('idle')
  }

  async function lookupAddressByPostalCode(): Promise<void> {
    if (contact.countryCode !== 'NL' || !contact.postalCode.trim() || !contact.houseNumber.trim()) return
    setAddressLookupState('loading')
    try {
      const response = await fetch(`/api/address-lookup?country=NL&postcode=${encodeURIComponent(contact.postalCode)}&houseNumber=${encodeURIComponent(contact.houseNumber)}`)
      if (!response.ok) throw new Error('ADDRESS_LOOKUP_FAILED')
      const payload: { data?: AddressSuggestion[] } = await response.json()
      if (!payload.data?.[0]) throw new Error('ADDRESS_LOOKUP_EMPTY')
      applyAddressSuggestion(payload.data[0])
      setAddressLookupState('idle')
    } catch {
      setAddressLookupState('failed')
    }
  }

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
    if (draft.birthDate && !isNewEmployeeBirthDateValid(draft.birthDate)) validationErrors.birthDate = labels.ageRangeInvalid
    if (!draft.bsn && (!draft.birthDate || !draft.birthName)) {
      if (!draft.birthDate) validationErrors.birthDate = labels.identitySignalsRequired
      if (!draft.birthName) validationErrors.birthName = labels.identitySignalsRequired
    }
    if (!isValidEmail(draft.privateEmail)) validationErrors.privateEmail = labels.validationEmail
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }
    setState('checking')
    setIdentityCheckProgress(0)
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

  async function continueWithNewEmployee(identityDraft: IdentityDraft = identity): Promise<void> {
    setError(null)
    setFieldErrors({})
    setExistingEmployeeMode(null)
    setRehireEmployeeId(null)
    setRehireEmployeeUpdatedAt(null)
    setRehirePrimaryAddressId(null)
    setRehireOriginalContact(null)
    setState('loading-number')
    try {
      const response = await fetch('/api/employees/next-number', { method: 'POST' })
      if (!response.ok) throw new Error('EMPLOYEE_NUMBER_FAILED')
      const payload: { data: { employeeNumber: string } } = await response.json()
      const nextEmployeeNumber = payload.data.employeeNumber
    setCore((current) => ({
      ...current,
        employeeNumber: current.employeeNumber || nextEmployeeNumber,
        birthName: identityDraft.birthName,
        birthDate: identityDraft.birthDate,
      }))
      setNumberInput((current) => current || nextEmployeeNumber)
      void loadNumberUsage()
      setContact((current) => ({ ...current, privateEmail: identityDraft.privateEmail }))
      setStep(1)
    } catch {
      setError(labels.genericError)
    } finally {
      setState('idle')
    }
  }

  async function skipIdentityCheck(): Promise<void> {
    setError(null)
    setFieldErrors({})
    setCandidates(null)
    setIdentity(EMPTY_IDENTITY)
    await continueWithNewEmployee(EMPTY_IDENTITY)
  }

  async function startRehire(candidate: Candidate): Promise<void> {
    setError(null)
    setFieldErrors({})
    setState('loading-rehire')
    try {
      const [detailResponse, customFieldsResponse] = await Promise.all([
        fetch(`/api/employees/${candidate.id}`),
        fetch(`/api/employees/${candidate.id}/custom-fields`),
      ])
      const detailPayload: { data?: RehireEmployeeDetail } = await detailResponse.json()
      if (!detailResponse.ok || !detailPayload.data) throw new Error('REHIRE_EMPLOYEE_READ_FAILED')
      const customFieldsPayload: { data?: Record<string, string | number | boolean | string[] | null> } = customFieldsResponse.ok
        ? await customFieldsResponse.json()
        : {}
      const detail = detailPayload.data
      const primaryAddress = detail.addresses.find((address) => address.addressType === 'PRIMARY')
      const nextContact: ContactDraft = {
        privateEmail: detail.employee.privateEmail ?? '',
        privateMobile: detail.employee.privateMobile ?? '',
        workEmail: detail.employee.workEmail ?? '',
        workMobile: detail.employee.workMobile ?? '',
        street: primaryAddress?.street ?? '',
        houseNumber: primaryAddress?.houseNumber ?? '',
        addition: primaryAddress?.houseNumberAddition ?? '',
        postalCode: primaryAddress?.postalCode ?? '',
        city: primaryAddress?.city ?? '',
        countryCode: primaryAddress?.countryCode ?? 'NL',
      }
      const nextCore: CoreDraft = {
        employeeNumber: detail.employee.employeeNumber,
        firstName: detail.employee.firstName,
        birthNamePrefix: detail.employee.birthNamePrefix ?? '',
        birthName: detail.employee.birthName,
        partnerNamePrefix: detail.employee.partnerNamePrefix ?? '',
        partnerName: detail.employee.partnerName ?? '',
        nameUsage: detail.employee.nameUsage,
        gender: detail.employee.gender,
        birthDate: detail.employee.birthDate ?? '',
        preferredLanguage: detail.employee.preferredLanguage,
      }
      const nextAdditional: AdditionalDraft = {
        title: detail.employee.title ?? '',
        initials: detail.employee.initials ?? '',
        pronouns: detail.employee.pronouns ?? '',
        birthPlace: detail.employee.birthPlace ?? '',
        birthCountry: detail.employee.birthCountry ?? '',
        nationality: detail.employee.nationality ?? '',
        maritalStatus: detail.employee.maritalStatus ?? '',
        maritalStatusDate: detail.employee.maritalStatusDate ?? '',
        educationLevel: detail.employee.educationLevel ?? '',
        privatePhone: detail.employee.privatePhone ?? '',
        workPhone: detail.employee.workPhone ?? '',
        workPhoneExt: detail.employee.workPhoneExt ?? '',
        originalHireDate: detail.employee.originalHireDate ?? '',
      }
      setIdentity({ bsn: identity.bsn, birthDate: nextCore.birthDate, birthName: nextCore.birthName, privateEmail: nextContact.privateEmail })
      setCore(nextCore)
      setNameUsage(nextCore.nameUsage)
      setNamePreview({ firstName: nextCore.firstName, birthNamePrefix: nextCore.birthNamePrefix, birthName: nextCore.birthName, partnerNamePrefix: nextCore.partnerNamePrefix, partnerName: nextCore.partnerName, nameUsage: nextCore.nameUsage })
      setAdditional(nextAdditional)
      setContact(nextContact)
      setCustomFieldValues(customFieldsPayload.data ?? {})
      setNumberInput(nextCore.employeeNumber)
      setNumberCheck('idle')
      setDraftEmployeeId(candidate.id)
      setDraftEmployeeUpdatedAt(detail.employee.updatedAt)
      setRehireEmployeeId(candidate.id)
      setExistingEmployeeMode(candidate.canRehire ? 'rehire' : 'existing')
      setRehireEmployeeUpdatedAt(detail.employee.updatedAt)
      setRehirePrimaryAddressId(primaryAddress?.id ?? null)
      setRehirePrimaryAddressValidFrom(primaryAddress?.validFrom ?? ADDRESS_DEFAULT_VALID_FROM)
      setRehireOriginalContact(nextContact)
      setRehireCopyChoice('no')
      setCandidates(null)
      setStep(1)
    } catch {
      setError(labels.genericError)
    } finally {
      setState('idle')
    }
  }

  function cancelNewEmployee(): void {
    router.push('/employees')
  }

  function employeePayload(): Record<string, unknown> {
    return {
      employeeNumber: core.employeeNumber, firstName: core.firstName,
      birthNamePrefix: nullable(core.birthNamePrefix), birthName: core.birthName,
      partnerNamePrefix: nullable(core.partnerNamePrefix), partnerName: nullable(core.partnerName), nameUsage: core.nameUsage, gender: core.gender,
      birthDate: nullable(core.birthDate), title: nullable(additional.title), initials: nullable(additional.initials),
      pronouns: nullable(additional.pronouns), birthPlace: nullable(additional.birthPlace),
      birthCountry: nullable(additional.birthCountry), nationality: nullable(additional.nationality),
      maritalStatus: additional.maritalStatus || null, maritalStatusDate: nullable(additional.maritalStatusDate),
      educationLevel: additional.educationLevel || null, preferredLanguage: core.preferredLanguage,
      privateEmail: nullable(contact.privateEmail), privatePhone: nullable(additional.privatePhone),
      privateMobile: nullable(contact.privateMobile), workEmail: nullable(contact.workEmail),
      workPhone: nullable(additional.workPhone), workPhoneExt: nullable(additional.workPhoneExt),
      workMobile: nullable(contact.workMobile), originalHireDate: nullable(additional.originalHireDate),
    }
  }

  async function saveDraft(): Promise<void> {
    if (step < 2 || !core.firstName || !core.birthName) return
    setError(null)
    setState('saving-draft')
    try {
      const existingDraft = draftEmployeeId && draftEmployeeUpdatedAt
      const response = await fetch(existingDraft ? `/api/employees/${draftEmployeeId}` : '/api/employees', {
        method: existingDraft ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(existingDraft ? { ...employeePayload(), updatedAt: draftEmployeeUpdatedAt } : { ...employeePayload(), bsn: identity.bsn || undefined }),
      })
      const payload: { data?: { id: string; updatedAt: string }; error?: string } = await response.json()
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'EMPLOYEE_DRAFT_SAVE_FAILED')
      setDraftEmployeeId(payload.data.id)
      setDraftEmployeeUpdatedAt(payload.data.updatedAt)
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
      partnerNamePrefix: value(form, 'partnerNamePrefix'), partnerName: value(form, 'partnerName'),
      nameUsage: value(form, 'nameUsage') as CoreDraft['nameUsage'],
      gender: value(form, 'gender') as CoreDraft['gender'], birthDate: value(form, 'birthDate'),
      preferredLanguage: value(form, 'preferredLanguage'),
    }
    const validationErrors: WizardFieldErrors = {}
    if (!draft.employeeNumber) validationErrors.employeeNumber = labels.validationRequired
    if (!draft.firstName) validationErrors.firstName = labels.validationRequired
    if (!draft.birthName) validationErrors.birthName = labels.validationRequired
    if (draft.birthDate && !isNewEmployeeBirthDateValid(draft.birthDate)) validationErrors.birthDate = labels.ageRangeInvalid
    if (draft.nameUsage !== 'BIRTH_NAME' && !draft.partnerName) validationErrors.partnerName = labels.validationRequired
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setError(labels.validationFieldsMissing)
      return
    }
    if (!rehireEmployeeId) {
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
    }
    setCore(draft)
    setNamePreview({ firstName: draft.firstName, birthNamePrefix: draft.birthNamePrefix, birthName: draft.birthName, partnerNamePrefix: draft.partnerNamePrefix, partnerName: draft.partnerName, nameUsage: draft.nameUsage })
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
    const nextCustomFieldValues = Object.fromEntries(customFieldDefinitions.map((definition) => [definition.key, readCustomFieldValue(definition, form)]))
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
      setError(labels.validationCorrectFields)
      return
    }
    setAdditional(draft)
    setCustomFieldValues(nextCustomFieldValues)
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
          : labels.validationCorrectFields,
      )
      return
    }
    setContact(draft)
    setFieldErrors({})
    setError(null)
    setStep(4)
  }

  async function saveRehireEmployee(): Promise<void> {
    if (!rehireEmployeeId || !rehireEmployeeUpdatedAt) return
    const employeeResponse = await fetch(`/api/employees/${rehireEmployeeId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...employeePayload(), updatedAt: rehireEmployeeUpdatedAt }),
    })
    const employeePayloadResult: { data?: { updatedAt: string }; error?: string } = await employeeResponse.json()
    if (!employeeResponse.ok || !employeePayloadResult.data) throw new Error(employeePayloadResult.error ?? 'REHIRE_EMPLOYEE_SAVE_FAILED')
    setRehireEmployeeUpdatedAt(employeePayloadResult.data.updatedAt)
    setDraftEmployeeUpdatedAt(employeePayloadResult.data.updatedAt)

    if (Object.keys(customFieldValues).length > 0) {
      const customFieldsResponse = await fetch(`/api/employees/${rehireEmployeeId}/custom-fields`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(customFieldValues),
      })
      if (!customFieldsResponse.ok) throw new Error('CUSTOM_FIELDS_SAVE_FAILED')
    }

    const addressChanged = rehireOriginalContact && [
      'street', 'houseNumber', 'addition', 'postalCode', 'city', 'countryCode',
    ].some((field) => rehireOriginalContact[field as keyof ContactDraft] !== contact[field as keyof ContactDraft])
    const hasAddress = contact.street || contact.houseNumber || contact.postalCode || contact.city
    if (!addressChanged || !hasAddress) return
    const addressPayload = {
      addressType: 'PRIMARY', description: null, addressLine1: null, addressLine2: null,
      street: contact.street, houseNumber: contact.houseNumber, addition: nullable(contact.addition),
      houseNumberAddition: nullable(contact.addition), postalCode: contact.postalCode, city: contact.city,
      province: null, region: null, countryCode: contact.countryCode, source: 'manual', sourceReference: null,
      validFrom: rehirePrimaryAddressValidFrom, validUntil: null, directReminderRecipients: [],
    }
    const addressResponse = await fetch(
      rehirePrimaryAddressId ? `/api/employees/${rehireEmployeeId}/addresses/${rehirePrimaryAddressId}` : `/api/employees/${rehireEmployeeId}/addresses`,
      { method: rehirePrimaryAddressId ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(addressPayload) },
    )
    if (!addressResponse.ok) throw new Error('ADDRESS_CREATE_FAILED')
  }

  async function createEmployee(destination: 'employee' | 'employment'): Promise<void> {
    setError(null)
    setEmploymentCreateProgress(0)
    setState('creating')
    try {
      if (rehireEmployeeId) {
        await saveRehireEmployee()
        setCreatedEmployeeId(rehireEmployeeId)
        setCreateDestination(destination)
        if (destination === 'employee') {
          router.push(`/employees/${rehireEmployeeId}`)
          router.refresh()
          return
        }
        setEmploymentLoading(true)
        setEmploymentOptions(null)
        setEmploymentStep(0)
        setEmploymentPayrollDetails(false)
        setEmploymentSaving(false)
        setCreatedEmploymentId(null)
        setRehireCopyChoice('no')
        const optionsResponse = await fetch(`/api/employees/${rehireEmployeeId}/employment-options`, { cache: 'no-store' })
        const optionsPayload: { data?: EmploymentCreationOptions } = await optionsResponse.json()
        if (!optionsResponse.ok || !optionsPayload.data) {
          setEmploymentLoading(false)
          setError(labels.genericError)
          return
        }
        setEmploymentOptions(optionsPayload.data)
        setRehireCopyChoice(optionsPayload.data.rehireDefaults ? 'pending' : 'no')
        setEmploymentLoading(false)
        return
      }
      const existingDraft = draftEmployeeId && draftEmployeeUpdatedAt
      const response = await fetch(existingDraft ? `/api/employees/${draftEmployeeId}` : '/api/employees', {
        method: existingDraft ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(existingDraft ? { ...employeePayload(), updatedAt: draftEmployeeUpdatedAt } : { ...employeePayload(), bsn: identity.bsn || undefined }),
      })
      const payload: { data?: { id: string; updatedAt: string }; error?: string; details?: ApiError['details'] } = await response.json()
      if (!response.ok || !payload.data) {
        if (response.status === 409 && payload.error === 'EMPLOYEE_NUMBER_CONFLICT') {
          if (payload.details?.suggestedEmployeeNumber) {
            setCore((current) => ({ ...current, employeeNumber: payload.details?.suggestedEmployeeNumber ?? current.employeeNumber }))
          }
          setFieldErrors({ employeeNumber: labels.numberConflict })
          setError(labels.numberConflict)
          setStep(1)
          return
        }
        if (response.status === 409 && payload.error === 'EMPLOYEE_IDENTITY_CONFLICT') {
          setError(labels.identityConflict)
          setStep(0)
          return
        }
        throw new Error(payload.error ?? 'EMPLOYEE_CREATE_FAILED')
      }

      const employeeId = payload.data.id
      setDraftEmployeeId(employeeId)
      setDraftEmployeeUpdatedAt(payload.data.updatedAt)
      if (Object.keys(customFieldValues).length > 0) {
        const customFieldsResponse = await fetch(`/api/employees/${employeeId}/custom-fields`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(customFieldValues),
        })
        if (!customFieldsResponse.ok) throw new Error('CUSTOM_FIELDS_SAVE_FAILED')
      }
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
        const optionsResponse = await fetch(`/api/employees/${employeeId}/employment-options`, { cache: 'no-store' })
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

  const exactCandidate = candidates?.find((candidate) => candidate.matchKind === 'BSN_EXACT')
  const hasExactMatch = Boolean(exactCandidate)
  const contractOnlyFlow = Boolean(initialContractEmployeeId && initialContractEmploymentId && initialContractOptions && initialContractDraft)
  const employmentOnlyFlow = Boolean(initialEmploymentEmployeeId)
  const employmentFlow = createDestination === 'employment' && Boolean(createdEmployeeId)
  const employmentStepLabels = employmentPayrollDetails
    ? [labels.employment.stepAdministration, labels.employment.stepEmployment, labels.employment.stepPayrollChoice, labels.employment.stepContract, labels.employment.stepSchedule, labels.employment.stepSalary, labels.employment.stepOther, labels.employment.stepReview]
    : [labels.employment.stepAdministration, labels.employment.stepEmployment, labels.employment.stepPayrollChoice, labels.employment.stepReview]
  const visibleSteps = contractOnlyFlow ? [labels.employment.stepContract, labels.employment.stepReview] : employmentOnlyFlow ? employmentStepLabels : employmentFlow ? [...labels.steps, ...employmentStepLabels] : labels.steps
  const activeStep = contractOnlyFlow ? contractStep : employmentOnlyFlow ? employmentStep : employmentFlow ? labels.steps.length + employmentStep : step
  const displayedNumberCheck = step === 1 && numberInput.trim() ? numberCheck : 'idle'
  const previewParts = getNamePreviewParts(namePreview)
  const additionalReviewLines = [additional.title, additional.initials, additional.birthPlace, additional.birthCountry, additional.nationality, additional.maritalStatus, additional.educationLevel, additional.privatePhone, additional.workPhone, additional.originalHireDate]

  return (
    <div className="grid min-w-0 max-w-full gap-7 overflow-x-hidden xl:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label={visibleSteps.join(', ')} className="min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
          {visibleSteps.map((label, index) => (
            <li key={label} className="min-w-0">
              <div
                aria-current={index === activeStep ? 'step' : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  index === activeStep ? 'border-primary bg-primary text-primary-foreground' : index < activeStep ? 'bg-success-surface text-success' : 'bg-surface text-muted-foreground'
                }`}
              >
                <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/25 text-xs tabular-nums xl:flex">
                  {index < activeStep ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
              </div>
            </li>
          ))}
        </ol>
        {!createdEmployeeId && step >= 2 && (
          <div className="mt-4 rounded-xl border border-border/70 bg-surface p-3 text-sm">
            <p className={`flex items-center gap-2 text-xs font-medium ${draftEmployeeId ? 'text-success' : 'text-muted-foreground'}`}>
              {draftEmployeeId && <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}
              {draftEmployeeId ? labels.saved : labels.notYetSaved}
            </p>
            <button type="button" onClick={() => void saveDraft()} disabled={state !== 'idle'} className="button-secondary mt-2 w-full justify-center gap-2 text-xs">
              {state === 'saving-draft' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
              {state === 'saving-draft' ? labels.savingDraft : labels.saveDraft}
            </button>
          </div>
        )}
      </nav>

      <section className="relative flex h-[clamp(30rem,calc(100dvh-15rem),52rem)] min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden rounded-2xl border bg-surface p-5 shadow-sm sm:p-7">
        <div ref={wizardScrollRef} className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto pr-1">
        {createdEmployeeId && createDestination === 'employment' && (
          <div className="flex min-h-full flex-col gap-5">
            {employmentSaving && <EmploymentCreateProgress labels={labels} progress={employmentCreateProgress} />}
            {addressSaveFailed && <p role="alert" className="rounded-xl bg-warning-surface p-4 text-sm text-warning">{labels.addressSaveFailed}</p>}
            {employmentLoading && <div className="flex items-center gap-3 rounded-2xl border bg-background p-6 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />{labels.employmentLoading}</div>}
            {!employmentLoading && employmentOptions && !createdEmploymentId && rehireEmployeeId && rehireCopyChoice === 'pending' && <RehireCopyDialog labels={labels} onChoice={setRehireCopyChoice} />}
            {!employmentLoading && employmentOptions && !createdEmploymentId && rehireCopyChoice !== 'pending' && <EmploymentCreateForm
              employeeId={createdEmployeeId}
              options={employmentOptions}
              labels={labels.employment}
              canScrollDown={canScrollDown}
              moreDataAvailable={labels.moreDataAvailable}
              showNavigation={false}
              showPayrollChoice
              copyPreviousData={rehireCopyChoice === 'yes'}
              onStepChange={setEmploymentStep}
              onPayrollChoiceChange={setEmploymentPayrollDetails}
              onCancel={() => router.push(`/employees/${createdEmployeeId}?tab=employments`)}
              onSaving={() => { setEmploymentSaving(true); setEmploymentCreateProgress(0) }}
              onSaveFailed={() => setEmploymentSaving(false)}
              onSaved={(employmentId) => { setEmploymentSaving(false); setCreatedEmploymentId(employmentId) }}
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

        {contractOnlyFlow && initialContractEmploymentId && initialContractOptions && initialContractDraft && (
          <div className="flex min-h-full flex-col gap-5">
            <EmploymentContractCreateForm
              employmentId={initialContractEmploymentId}
              options={initialContractOptions}
              employmentStartsOn={initialContractEmploymentStartsOn ?? initialContractDraft.startsOn}
              isFirstContract={initialContractIsFirst ?? false}
              initialDraft={initialContractDraft}
              labels={labels.employment}
              submitLabel={initialContractSubmitLabel ?? labels.employment.submit}
              onStepChange={setContractStep}
              onSaved={() => router.push(`/employees/${initialContractEmployeeId}/employments/${initialContractEmploymentId}?tab=overview`)}
            />
          </div>
        )}

        {createdEmployeeId && createDestination === 'employee' && (
          <div className="rounded-2xl border border-success/30 bg-success-surface p-6">
            <p className="eyebrow text-success">{labels.creationComplete}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.creationComplete}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{addressSaveFailed ? labels.addressSaveFailed : labels.creationCompleteHelp}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/employees/${createdEmployeeId}`} className="button-primary">{labels.openEmployee}</Link>
              <Link href={`/employees/${createdEmployeeId}/employments/new`} className="button-secondary">{labels.createAndEmployment}</Link>
            </div>
          </div>
        )}

        {!createdEmployeeId && <>
        {step === 0 && (
          <div className="relative flex min-h-full flex-col" aria-busy={state === 'checking'}>
            {state === 'checking' && <IdentityCheckProgress labels={labels} progress={identityCheckProgress} />}
            <header>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.identityTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.identityHelp}</p>
              </header>
            <form id="identity-check-form" onSubmit={checkIdentity} noValidate className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <FieldLabel labels={labels} required={false}>{labels.bsn}</FieldLabel>
                <input name="bsn" defaultValue={identity.bsn} inputMode="numeric" autoComplete="off" className="form-field" onBlur={(event) => void validateFieldOnBlur('bsn', event)} {...errorAttributes('bsn')} />
                <FieldError field="bsn" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={!identity.bsn}>{labels.birthDate}</FieldLabel>
                <input name="birthDate" defaultValue={identity.birthDate} type="date" className="form-field" onBlur={(event) => void validateFieldOnBlur('birthDate', event)} {...errorAttributes('birthDate')} />
                <FieldError field="birthDate" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={!identity.bsn}>{labels.birthName}</FieldLabel>
                <input name="birthName" defaultValue={identity.birthName} className="form-field" onBlur={(event) => void validateFieldOnBlur('birthName', event)} {...errorAttributes('birthName')} />
                <FieldError field="birthName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <FieldLabel labels={labels} required={false}>{labels.privateEmail}</FieldLabel>
                <input name="privateEmail" defaultValue={identity.privateEmail} type="email" className="form-field" onBlur={(event) => void validateFieldOnBlur('privateEmail', event)} {...errorAttributes('privateEmail')} />
                <FieldError field="privateEmail" errors={fieldErrors} />
              </label>
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
                          <details className="mt-3 text-sm">
                            <summary className="cursor-pointer font-semibold text-primary">{labels.moreInfo}</summary>
                            <dl className="mt-3 grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-2">
                              <div><dt className="text-xs text-muted-foreground">{labels.archiveStatus}</dt><dd>{candidate.isArchived ? labels.archivedYes : labels.archivedNo}</dd></div>
                              <div><dt className="text-xs text-muted-foreground">{labels.employmentType}</dt><dd>{employmentTypeLabel(candidate.employment.employmentType)}</dd></div>
                              <div><dt className="text-xs text-muted-foreground">{candidate.employment.status === 'ACTIVE' ? labels.activeEmployment : candidate.employment.status === 'LAST' ? labels.lastEmployment : labels.noEmployment}</dt><dd>{candidate.employment.startsOn ? `${candidate.employment.startsOn}${candidate.employment.endsOn ? ` – ${candidate.employment.endsOn}` : ''}` : labels.noEmployment}</dd></div>
                              <div><dt className="text-xs text-muted-foreground">{labels.administration}</dt><dd>{candidate.employment.administrationNumber && candidate.employment.administrationName ? `${candidate.employment.administrationNumber} — ${candidate.employment.administrationName}` : labels.noAdministration}</dd></div>
                            </dl>
                          </details>
                        </div>
                        {candidate.canRehire || candidate.canUseExisting ? <button type="button" onClick={() => void startRehire(candidate)} disabled={state === 'loading-rehire'} className="button-primary shrink-0 gap-2">
                          {state === 'loading-rehire' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
                          {state === 'loading-rehire' ? labels.rehireLoading : candidate.canRehire ? labels.rehireAction : labels.useExistingAction}
                        </button> : <Link href={`/employees/${candidate.id}`} className="button-secondary shrink-0">{labels.chooseExisting}</Link>}
                      </li>
                    ))}
                  </ul>
                )}
                {exactCandidate ? (
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-destructive-surface p-4 text-sm text-destructive">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    {exactCandidate.employment.status === 'ACTIVE' ? labels.exactActiveBlocked : exactCandidate.employment.status === 'LAST' ? labels.exactClosedContinue : labels.exactNoEmploymentContinue}
                  </p>
                ) : null}
              </div>
            )}
            <div className="sticky bottom-0 z-10 mt-auto flex items-center justify-between gap-2 border-t border-border/70 bg-surface/95 py-2.5 backdrop-blur-sm">
              {candidates ? <button type="button" onClick={cancelNewEmployee} className="button-secondary shrink-0">{labels.cancelNewEmployee}</button> : <button type="button" onClick={() => void skipIdentityCheck()} disabled={state !== 'idle'} className="button-secondary shrink-0 gap-2">
                {state === 'loading-number' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
                {labels.skipIdentityCheck}<ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>}
              <ScrollHint labels={labels} visible={canScrollDown} />
              {candidates && !hasExactMatch ? <button type="button" onClick={() => void continueWithNewEmployee()} disabled={state === 'loading-number'} className="button-primary shrink-0 gap-2">
                {state === 'loading-number' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
                {labels.continueAfterIdentityCheck}<ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button> : candidates ? <span className="min-w-0 flex-1" aria-hidden="true" /> : <button type="submit" form="identity-check-form" disabled={state === 'checking'} className="button-primary shrink-0 gap-2">
                {state === 'checking' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
                {state === 'checking' ? labels.checking : labels.checkIdentity}
              </button>}
            </div>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={saveCore} noValidate className="flex min-h-full min-w-0 flex-col">
            {rehireEmployeeId && <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="font-semibold text-primary">{existingEmployeeMode === 'existing' ? labels.existingEmployeeSelected : labels.rehireSelected}: {core.firstName} {core.birthName}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{existingEmployeeMode === 'existing' ? labels.existingEmployeeSelectedHelp : labels.rehireSelectedHelp}</p>
            </div>}
            <header>
              <p className="eyebrow">{labels.steps[1]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.coreTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.coreHelp}</p>
            </header>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 sm:max-w-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
                  <FieldLabel labels={labels} required>{labels.employeeNumber}</FieldLabel>
                  {numberUsage?.highestNumericEmployeeNumber && <span className="whitespace-nowrap text-xs font-normal text-muted-foreground">{labels.employeeNumberHighest}: {numberUsage.highestNumericEmployeeNumber}</span>}
                </div>
                <input
                  name="employeeNumber"
                  value={core.employeeNumber}
                  onChange={(event) => { setCore((current) => ({ ...current, employeeNumber: event.target.value })); setNumberInput(event.target.value) }}
                  readOnly={Boolean(rehireEmployeeId)}
                  maxLength={40}
                  className="form-field font-semibold tabular-nums"
                  aria-invalid={fieldErrors.employeeNumber ? true : undefined}
                  onBlur={(event) => void validateFieldOnBlur('employeeNumber', event)}
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
                <input name="firstName" defaultValue={core.firstName} maxLength={120} className="form-field" onChange={(event) => setNamePreview((current) => ({ ...current, firstName: event.target.value }))} onBlur={(event) => void validateFieldOnBlur('firstName', event)} {...errorAttributes('firstName')} />
                <FieldError field="firstName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <FieldLabel labels={labels} required={false}>{labels.birthNamePrefix}</FieldLabel>
                <input name="birthNamePrefix" defaultValue={core.birthNamePrefix} maxLength={40} className="form-field" onChange={(event) => setNamePreview((current) => ({ ...current, birthNamePrefix: event.target.value }))} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <FieldLabel labels={labels} required>{labels.birthName}</FieldLabel>
                <input name="birthName" defaultValue={core.birthName} maxLength={120} className="form-field" onChange={(event) => setNamePreview((current) => ({ ...current, birthName: event.target.value }))} onBlur={(event) => void validateFieldOnBlur('birthName', event)} {...errorAttributes('birthName')} />
                <FieldError field="birthName" errors={fieldErrors} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <FieldLabel labels={labels} required>{labels.nameUsage}</FieldLabel>
                <select name="nameUsage" value={nameUsage} onChange={(event) => { const nextNameUsage = event.target.value as CoreDraft['nameUsage']; setNameUsage(nextNameUsage); setNamePreview((current) => ({ ...current, nameUsage: nextNameUsage })) }} className="form-field">
                  <option value="BIRTH_NAME">{labels.nameUsageBirth}</option>
                  <option value="PARTNER_NAME">{labels.nameUsagePartner}</option>
                  <option value="PARTNER_BEFORE_BIRTH_NAME">{labels.nameUsagePartnerBirth}</option>
                  <option value="BIRTH_NAME_BEFORE_PARTNER_NAME">{labels.nameUsageBirthPartner}</option>
                </select>
              </label>
              {nameUsage !== 'BIRTH_NAME' && <>
                <label className="grid gap-1.5 text-sm font-medium">
                  <FieldLabel labels={labels} required={false}>{labels.partnerNamePrefix}</FieldLabel>
                  <input name="partnerNamePrefix" defaultValue={core.partnerNamePrefix} maxLength={40} className="form-field" onChange={(event) => setNamePreview((current) => ({ ...current, partnerNamePrefix: event.target.value }))} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <FieldLabel labels={labels} required>{labels.partnerName}</FieldLabel>
                  <input name="partnerName" defaultValue={core.partnerName} maxLength={120} className="form-field" onChange={(event) => setNamePreview((current) => ({ ...current, partnerName: event.target.value }))} onBlur={(event) => void validateFieldOnBlur('partnerName', event)} {...errorAttributes('partnerName')} />
                  <FieldError field="partnerName" errors={fieldErrors} />
                </label>
              </>}
              <div className="sm:col-span-2 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <UserRoundPlus aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <h3 className="font-semibold">{labels.namePreview}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{labels.namePreviewHelp}</p>
                    <div className="mt-4 rounded-xl border border-primary/15 bg-background px-4 py-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{labels.namePreviewResult}</p>
                      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{previewParts.displayName || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
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
            <WizardActions labels={labels} canScrollDown={canScrollDown} onBack={() => { setFieldErrors({}); setError(null); setStep(0) }} />
          </form>
        )}

        {step === 2 && (
          <form onSubmit={saveAdditional} noValidate className="flex min-h-full min-w-0 flex-col">
            <header>
              <p className="eyebrow">{labels.steps[2]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.additionalTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.additionalHelp}</p>
            </header>
            <div className="mt-6 grid gap-4">
              <details className="group rounded-2xl border bg-background">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-semibold [&::-webkit-details-marker]:hidden"><span>{labels.optionalExtraDetails}</span><ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
                <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
              <TextField name="title" defaultValue={additional.title} label={labels.employeeTitle} labels={labels} />
              <TextField name="initials" defaultValue={additional.initials} label={labels.employeeInitials} labels={labels} />
              <TextField name="pronouns" defaultValue={additional.pronouns} label={labels.pronouns} labels={labels} />
              <TextField name="birthPlace" defaultValue={additional.birthPlace} label={labels.birthPlace} labels={labels} />
              <CountryField name="birthCountry" defaultValue={additional.birthCountry} label={labels.birthCountry} labels={labels} locale={locale} error={fieldErrors.birthCountry} onBlur={(event) => void validateFieldOnBlur('birthCountry', event)} />
              <CountryField name="nationality" defaultValue={additional.nationality} label={labels.nationality} labels={labels} locale={locale} error={fieldErrors.nationality} onBlur={(event) => void validateFieldOnBlur('nationality', event)} />
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
              </details>
              {customFieldDefinitions.length > 0 && <details className="group rounded-2xl border bg-background">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-semibold [&::-webkit-details-marker]:hidden"><span>{labels.freeFields}</span><ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
                <div className="border-t p-4">
                  <p className="text-sm text-muted-foreground">{labels.freeFieldsHelp}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">{customFieldDefinitions.map((definition) => <CustomFieldInput key={definition.id} definition={definition} locale={locale} defaultValue={customFieldValues[definition.key]} />)}</div>
                </div>
              </details>}
            </div>
            <WizardActions labels={labels} canScrollDown={canScrollDown} onBack={() => { setFieldErrors({}); setError(null); setStep(1) }} />
          </form>
        )}

        {step === 3 && (
          <form onSubmit={saveContact} noValidate className="flex min-h-full min-w-0 flex-col">
            <header>
              <p className="eyebrow">{labels.steps[3]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.contactTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.contactHelp}</p>
            </header>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <TextField name="privateEmail" defaultValue={contact.privateEmail} label={labels.privateEmail} labels={labels} type="email" error={fieldErrors.privateEmail} onBlur={(event) => void validateFieldOnBlur('privateEmail', event)} />
              <TextField name="privateMobile" defaultValue={contact.privateMobile} label={labels.privateMobile} labels={labels} type="tel" />
              <TextField name="workEmail" defaultValue={contact.workEmail} label={labels.workEmail} labels={labels} type="email" error={fieldErrors.workEmail} onBlur={(event) => void validateFieldOnBlur('workEmail', event)} />
              <TextField name="workMobile" defaultValue={contact.workMobile} label={labels.workMobile} labels={labels} type="tel" />
            </div>
            <div className="mt-7 border-t pt-6">
              <div><h3 className="font-semibold">{labels.addressTitle}</h3></div>
              <label className="mt-4 grid gap-1.5 text-sm font-medium"><span>{labels.addressSearch}</span><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={addressQuery} onChange={(event) => { const query = event.target.value; setAddressQuery(query); if (query.trim().length < 3) { setAddressSuggestions([]); setAddressSearchState('idle') } }} placeholder={labels.addressSearchPlaceholder} autoComplete="off" className="form-field pl-10" role="combobox" aria-autocomplete="list" aria-controls="employee-address-suggestions" aria-expanded={addressSuggestions.length > 0} /></div><div className="min-h-4 text-xs text-muted-foreground">{addressSearchState === 'loading' && <span className="inline-flex items-center gap-1.5"><LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />{labels.searchLoading}</span>}{addressSearchState === 'failed' && <span role="alert" className="text-destructive">{labels.searchUnavailable}</span>}{addressSearchState === 'empty' && <span>{labels.searchNoResults}</span>}</div>{addressSuggestions.length > 0 && <ul id="employee-address-suggestions" role="listbox" className="mt-1 max-h-60 overflow-y-auto rounded-lg border bg-background shadow-sm">{addressSuggestions.map((suggestion) => <li key={`${suggestion.source}-${suggestion.sourceReference ?? suggestion.label}`} role="presentation"><button type="button" role="option" aria-selected={false} className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent" onClick={() => applyAddressSuggestion(suggestion)}><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{suggestion.label}</span></button></li>)}</ul>}</label>
              <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{labels.manualEntry}</p></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-6">
                <div className="grid min-w-0 gap-4 sm:col-span-full sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
                  <div className="min-w-0">
                    <TextField name="street" defaultValue={contact.street} value={contact.street} label={labels.street} labels={labels} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} error={fieldErrors.street} onChange={(event) => { setContact((current) => ({ ...current, street: event.target.value })); setStreetHasNumberWarning(/\d/.test(event.target.value)) }} onBlur={(event) => void validateFieldOnBlur('street', event)} />
                    {streetHasNumberWarning && <p className="mt-1.5 text-xs text-muted-foreground">{labels.streetHasNumberNote}</p>}
                  </div>
                  <TextField name="houseNumber" defaultValue={contact.houseNumber} value={contact.houseNumber} label={labels.houseNumber} labels={labels} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} error={fieldErrors.houseNumber} onChange={(event) => setContact((current) => ({ ...current, houseNumber: event.target.value }))} onBlur={(event) => void validateFieldOnBlur('houseNumber', event)} />
                  <TextField name="addition" defaultValue={contact.addition} value={contact.addition} label={labels.addition} labels={labels} onChange={(event) => setContact((current) => ({ ...current, addition: event.target.value }))} />
                </div>
                <TextField name="postalCode" defaultValue={contact.postalCode} value={contact.postalCode} label={labels.postalCode} labels={labels} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} className="sm:col-span-2" error={fieldErrors.postalCode} onChange={(event) => setContact((current) => ({ ...current, postalCode: event.target.value }))} onBlur={(event) => void validateFieldOnBlur('postalCode', event)} />
                {contact.countryCode === 'NL' && contact.postalCode.trim() && contact.houseNumber.trim() && !contact.city.trim() && <div className="self-end sm:col-span-2"><button type="button" onClick={() => void lookupAddressByPostalCode()} disabled={addressLookupState === 'loading'} aria-label={`${labels.lookup}: ${labels.lookupByPostalCode}`} className="button-secondary inline-flex w-full justify-center gap-2">{addressLookupState === 'loading' && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}{addressLookupState === 'loading' ? labels.searchLoading : labels.lookup}</button><p className="mt-1.5 text-xs text-muted-foreground">{labels.lookupHint}</p></div>}
                <TextField name="city" defaultValue={contact.city} value={contact.city} label={labels.city} labels={labels} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} className="sm:col-span-4" error={fieldErrors.city} onChange={(event) => setContact((current) => ({ ...current, city: event.target.value }))} onBlur={(event) => void validateFieldOnBlur('city', event)} />
                <CountryField name="countryCode" defaultValue={contact.countryCode} value={contact.countryCode} label={labels.countryCode} labels={labels} locale={locale} required={Boolean(contact.street || contact.houseNumber || contact.postalCode || contact.city)} className="sm:col-span-2" error={fieldErrors.countryCode} onBlur={(event) => void validateFieldOnBlur('countryCode', event)} />
                {addressLookupState === 'failed' && <p role="alert" className="text-xs text-destructive sm:col-span-full">{labels.lookupUnavailable}</p>}
              </div>
            </div>
            <WizardActions labels={labels} canScrollDown={canScrollDown} onBack={() => { setFieldErrors({}); setError(null); setStep(2) }} />
          </form>
        )}

        {step === 4 && (
          <div className="min-w-0 pb-24">
            <header>
              <p className="eyebrow">{labels.steps[4]}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">{labels.reviewTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.reviewHelp}</p>
            </header>
            <div className="mt-6 divide-y rounded-xl border bg-background">
              <ReviewSection title={labels.identitySection} lines={[
                reviewLine(labels.namePreviewResult, previewParts.displayName),
                reviewLine(labels.firstName, core.firstName),
                reviewLine(labels.birthName, [core.birthNamePrefix, core.birthName].filter(Boolean).join(' ')),
                reviewLine(labels.partnerName, [core.partnerNamePrefix, core.partnerName].filter(Boolean).join(' ')),
                reviewLine(labels.nameUsage, nameUsageLabel(nameUsage, labels)),
                reviewLine(labels.employeeNumber, core.employeeNumber),
                reviewLine(labels.gender, genderLabel(core.gender, labels)),
                reviewLine(labels.birthDate, core.birthDate),
                reviewLine(labels.preferredLanguage, languageLabel(core.preferredLanguage, labels)),
              ]} />
              {additionalReviewLines.some(Boolean) && <ReviewSection title={labels.additionalSection} lines={additionalReviewLines} />}
              <ReviewSection title={labels.contactSection} lines={[contact.privateEmail, contact.privateMobile, contact.workEmail, contact.workMobile]} />
              <ReviewSection title={labels.addressSection} lines={contact.street ? [`${contact.street} ${contact.houseNumber}${contact.addition ? ` ${contact.addition}` : ''}`, `${contact.postalCode} ${contact.city}`, contact.countryCode] : [labels.noAddress]} />
            </div>
            <div className="mt-5 rounded-xl bg-accent p-4">
              <p className="font-semibold text-accent-foreground">{labels.employmentOptional}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.employmentOptionalHelp}</p>
            </div>
            <div className="absolute inset-x-5 bottom-5 z-10 flex min-w-0 items-center gap-2 border-t border-border/70 bg-surface/95 py-2.5 backdrop-blur-sm sm:inset-x-7 sm:bottom-7">
              <button type="button" onClick={() => { setFieldErrors({}); setError(null); setStep(3) }} disabled={state === 'creating'} className="button-secondary inline-flex shrink-0 gap-1 whitespace-nowrap text-xs sm:text-sm"><ChevronLeft aria-hidden="true" className="h-4 w-4" />{labels.previous}</button>
              <ScrollHint labels={labels} visible={canScrollDown} />
              <div className="flex min-w-0 shrink-0 justify-end gap-2">
                {rehireEmployeeId ? <>
                  <button type="button" onClick={() => void createEmployee('employee')} disabled={state === 'creating'} className="button-secondary shrink-0 gap-1 whitespace-nowrap px-3 text-xs sm:text-sm">
                    {state === 'creating' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
                    {state === 'creating' ? labels.creating : labels.updateExistingEmployeeShort}
                  </button>
                  <button type="button" onClick={() => void createEmployee('employment')} disabled={state === 'creating'} className="button-primary shrink-0 gap-1 whitespace-nowrap px-3 text-xs sm:text-sm">
                    {state === 'creating' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
                    {state === 'creating' ? labels.creating : labels.createAndEmploymentShort}
                  </button>
                </> : <>
                  <button type="button" onClick={() => void createEmployee('employee')} disabled={state === 'creating'} className="button-secondary shrink-0 gap-1 whitespace-nowrap px-3 text-xs sm:text-sm">
                    {state === 'creating' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
                    {state === 'creating' ? labels.creating : labels.create}
                  </button>
                  <button type="button" onClick={() => void createEmployee('employment')} disabled={state === 'creating'} className="button-primary shrink-0 gap-1 whitespace-nowrap px-3 text-xs sm:text-sm">
                    {state === 'creating' ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserRoundPlus aria-hidden="true" className="h-4 w-4" />}
                    {state === 'creating' ? labels.creating : labels.createAndEmploymentShort}
                  </button>
                </>}
              </div>
            </div>
          </div>
        )}

        </>}
        {error && !createdEmployeeId && <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-destructive-surface p-4 text-sm text-destructive"><AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        </div>
        {state === 'creating' && !(createdEmployeeId && createDestination === 'employment') && <EmploymentCreateProgress labels={labels} progress={employmentCreateProgress} />}
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

function readCustomFieldValue(definition: CustomFieldDefinition, formData: FormData): string | number | boolean | string[] | null {
  if (definition.fieldType === 'BOOLEAN') return formData.get(definition.key) === 'on'
  if (definition.fieldType === 'NUMBER') {
    const value = String(formData.get(definition.key) ?? '').trim()
    return value ? Number(value) : null
  }
  if (definition.fieldType === 'MULTI_SELECT') return formData.getAll(definition.key).map(String)
  const value = String(formData.get(definition.key) ?? '').trim()
  return value || null
}

function CustomFieldInput({ definition, locale, defaultValue }: { definition: CustomFieldDefinition; locale: string; defaultValue?: string | number | boolean | string[] | null }) {
  const label = locale === 'en' ? definition.labelEn : definition.labelNl
  const className = 'form-field'
  if (definition.fieldType === 'BOOLEAN') return <label className="flex items-center gap-2 self-end text-sm font-medium"><input name={definition.key} type="checkbox" defaultChecked={defaultValue === true} />{label}{definition.isRequired ? ' *' : ''}</label>
  if (definition.fieldType === 'TEXTAREA') return <label className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>{label}{definition.isRequired ? ' *' : ''}</span><textarea name={definition.key} defaultValue={typeof defaultValue === 'string' ? defaultValue : ''} className={`${className} min-h-24`} required={definition.isRequired} /></label>
  if (definition.fieldType === 'SELECT' || definition.fieldType === 'MULTI_SELECT') {
    const selected = Array.isArray(defaultValue) ? defaultValue.map(String) : typeof defaultValue === 'string' ? [defaultValue] : []
    return <label className="grid gap-1.5 text-sm font-medium"><span>{label}{definition.isRequired ? ' *' : ''}</span><select name={definition.key} className={className} defaultValue={definition.fieldType === 'MULTI_SELECT' ? selected : selected[0] ?? ''} multiple={definition.fieldType === 'MULTI_SELECT'} required={definition.isRequired}><option value="">—</option>{definition.options.filter((option) => option.isActive).map((option) => <option key={option.id} value={option.value}>{locale === 'en' ? option.labelEn : option.labelNl}</option>)}</select></label>
  }
  const type = definition.fieldType === 'NUMBER' ? 'number' : definition.fieldType === 'DATE' ? 'date' : 'text'
  return <label className="grid gap-1.5 text-sm font-medium"><span>{label}{definition.isRequired ? ' *' : ''}</span><input name={definition.key} type={type} className={className} defaultValue={typeof defaultValue === 'string' || typeof defaultValue === 'number' ? String(defaultValue) : ''} required={definition.isRequired} /></label>
}

function getNamePreviewParts(input: Pick<CoreDraft, 'firstName' | 'birthNamePrefix' | 'birthName' | 'partnerNamePrefix' | 'partnerName' | 'nameUsage'>): { displayName: string } {
  const callName = input.firstName.trim()
  const birthName = [input.birthNamePrefix, input.birthName].filter(Boolean).join(' ').trim()
  const partnerName = [input.partnerNamePrefix, input.partnerName].filter(Boolean).join(' ').trim()
  const orderedSurname = input.nameUsage === 'PARTNER_NAME' ? partnerName : input.nameUsage === 'PARTNER_BEFORE_BIRTH_NAME' ? [partnerName, birthName].filter(Boolean).join(' ') : input.nameUsage === 'BIRTH_NAME_BEFORE_PARTNER_NAME' ? [birthName, partnerName].filter(Boolean).join(' ') : birthName
  return { displayName: [callName, orderedSurname].filter(Boolean).join(' ') }
}

function reviewLine(label: string, value: string): string {
  return value ? `${label}: ${value}` : ''
}

function nameUsageLabel(value: CoreDraft['nameUsage'], labels: Pick<EmployeeCreateWizardLabels, 'nameUsageBirth' | 'nameUsagePartner' | 'nameUsagePartnerBirth' | 'nameUsageBirthPartner'>): string {
  return value === 'PARTNER_NAME' ? labels.nameUsagePartner : value === 'PARTNER_BEFORE_BIRTH_NAME' ? labels.nameUsagePartnerBirth : value === 'BIRTH_NAME_BEFORE_PARTNER_NAME' ? labels.nameUsageBirthPartner : labels.nameUsageBirth
}

function genderLabel(value: CoreDraft['gender'], labels: Pick<EmployeeCreateWizardLabels, 'genderMale' | 'genderFemale' | 'genderOther' | 'genderUndisclosed'>): string {
  return value === 'MALE' ? labels.genderMale : value === 'FEMALE' ? labels.genderFemale : value === 'OTHER' ? labels.genderOther : labels.genderUndisclosed
}

function languageLabel(value: string, labels: Pick<EmployeeCreateWizardLabels, 'languageDutch' | 'languageEnglish'>): string {
  return value === 'en-GB' ? labels.languageEnglish : labels.languageDutch
}

function FieldLabel({ children, labels, required }: { children: ReactNode; labels: Pick<EmployeeCreateWizardLabels, 'required'>; required: boolean }) {
  return <span className="flex flex-wrap items-center gap-2"><span>{children}</span>{required && <span className="text-primary" aria-label={labels.required}>*</span>}</span>
}

function TextField({ name, defaultValue, value, label, labels, type = 'text', className, error, required = false, onChange, onBlur }: { name: string; defaultValue: string; value?: string; label: string; labels: EmployeeCreateWizardLabels; type?: string; className?: string; error?: string; required?: boolean; onChange?: ChangeEventHandler<HTMLInputElement>; onBlur?: FocusEventHandler<HTMLInputElement> }) {
  return <label className={`grid min-w-0 gap-1.5 text-sm font-medium ${className ?? ''}`}>
    <FieldLabel labels={labels} required={required}>{label}</FieldLabel>
    <input name={name} defaultValue={value === undefined ? defaultValue : undefined} value={value} type={type} className="form-field" onChange={onChange} onBlur={onBlur} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : undefined} aria-required={required} />
    {error && <span id={`${name}-error`} className="text-xs font-medium text-destructive">{error}</span>}
  </label>
}

function CountryField({ name, defaultValue, value, label, labels, locale, error, required = false, className, onBlur }: { name: 'birthCountry' | 'nationality' | 'countryCode'; defaultValue: string; value?: string; label: string; labels: EmployeeCreateWizardLabels; locale: string; error?: string; required?: boolean; className?: string; onBlur?: FocusEventHandler<HTMLButtonElement> }) {
  const countries = useMemo(() => getCountryOptions(locale), [locale])
  return <label className={`grid min-w-0 gap-1.5 text-sm font-medium ${className ?? ''}`}>
    <FieldLabel labels={labels} required={required}>{label}</FieldLabel>
    <DropdownSelect name={name} defaultValue={value === undefined ? defaultValue : undefined} value={value} searchable searchPlaceholder={labels.countrySearch} emptyLabel={labels.countryNoResults} aria-label={label} aria-invalid={error ? true : undefined} aria-required={required} required={required} onTriggerBlur={onBlur}>
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

function IdentityCheckProgress({ labels, progress }: { labels: Pick<EmployeeCreateWizardLabels, 'identityCheckTitle' | 'identityCheckStepSignals' | 'identityCheckStepSearch' | 'identityCheckStepSecure' | 'identityCheckPleaseWait'>; progress: number }) {
  const steps = [labels.identityCheckStepSignals, labels.identityCheckStepSearch, labels.identityCheckStepSecure]
  const percentage = Math.min(94, 18 + progress * 25)
  return <div className="absolute inset-0 z-20 grid place-items-center bg-surface/95 p-5 backdrop-blur-sm" role="status" aria-live="polite">
    <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-background p-5 shadow-lg sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck aria-hidden="true" className="h-6 w-6" /></span>
        <div><h3 className="font-semibold">{labels.identityCheckTitle}</h3></div>
      </div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${percentage}%` }} /></div>
      <ol className="mt-5 grid gap-3">
        {steps.map((label, index) => <li className={`flex items-center gap-3 text-sm ${index <= progress ? 'font-semibold text-foreground' : 'text-muted-foreground'}`} key={label}>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${index < progress ? 'border-success bg-success-surface text-success' : index === progress ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/40'}`}>
            {index < progress ? <Check aria-hidden="true" className="h-4 w-4" /> : index === progress ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          {label}
        </li>)}
      </ol>
      <p className="mt-5 text-xs font-medium text-muted-foreground">{labels.identityCheckPleaseWait}</p>
    </div>
  </div>
}

function EmploymentCreateProgress({ labels, progress }: { labels: Pick<EmployeeCreateWizardLabels, 'employmentCreateTitle' | 'employmentCreateStepEmployee' | 'employmentCreateStepEmployment' | 'employmentCreateStepSave' | 'employmentCreatePleaseWait'>; progress: number }) {
  const steps = [labels.employmentCreateStepEmployee, labels.employmentCreateStepEmployment, labels.employmentCreateStepSave]
  const percentage = Math.min(94, 18 + progress * 25)
  return <div className="absolute inset-0 z-30 grid place-items-center bg-surface/95 p-5 backdrop-blur-sm" role="status" aria-live="polite">
    <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-background p-5 shadow-lg sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck aria-hidden="true" className="h-6 w-6" /></span>
        <div><h3 className="font-semibold">{labels.employmentCreateTitle}</h3></div>
      </div>
      <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${percentage}%` }} /></div>
      <ol className="mt-5 grid gap-3">
        {steps.map((label, index) => <li className={`flex items-center gap-3 text-sm ${index <= progress ? 'font-semibold text-foreground' : 'text-muted-foreground'}`} key={label}>
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${index < progress ? 'border-success bg-success-surface text-success' : index === progress ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/40'}`}>
            {index < progress ? <Check aria-hidden="true" className="h-4 w-4" /> : index === progress ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          {label}
        </li>)}
      </ol>
      <p className="mt-5 text-xs font-medium text-muted-foreground">{labels.employmentCreatePleaseWait}</p>
    </div>
  </div>
}

function RehireCopyDialog({ labels, onChoice }: { labels: EmployeeCreateWizardLabels; onChoice: (choice: 'yes' | 'no') => void }) {
  const items = [labels.rehireCopyEmployment, labels.rehireCopyContract, labels.rehireCopySchedule, labels.rehireCopySalary, labels.rehireCopyOrganization, labels.rehireCopyCostAllocation]
  return <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/70 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="rehire-copy-title" className="w-full max-w-lg rounded-2xl border bg-surface p-6 shadow-xl">
      <h2 id="rehire-copy-title" className="text-xl font-semibold">{labels.rehireCopyTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.rehireCopyHelp}</p>
      <div className="mt-5 rounded-xl border bg-muted/20 p-4">
        <p className="text-sm font-semibold">{labels.rehireCopyItems}</p>
        <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">{items.map((item) => <li key={item}>• {item}</li>)}</ul>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className="button-secondary" onClick={() => onChoice('no')}>{labels.rehireCopyNo}</button>
        <button type="button" className="button-primary" onClick={() => onChoice('yes')}>{labels.rehireCopyYes}</button>
      </div>
    </div>
  </div>
}

function ScrollHint({ labels, visible }: { labels: Pick<EmployeeCreateWizardLabels, 'moreDataAvailable'>; visible: boolean }) {
  if (!visible) return <span className="min-w-0 flex-1" aria-hidden="true" />
  return <span className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 px-1 text-center text-xs font-semibold text-success" role="status" aria-live="polite"><ArrowDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-bounce" />{labels.moreDataAvailable}</span>
}

function WizardActions({ labels, canScrollDown, onBack }: { labels: EmployeeCreateWizardLabels; canScrollDown: boolean; onBack: () => void }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto flex items-center justify-between gap-2 border-t border-border/70 bg-surface/95 py-2.5 backdrop-blur-sm">
      <button type="button" onClick={onBack} className="button-secondary shrink-0 gap-2"><ChevronLeft aria-hidden="true" className="h-4 w-4" />{labels.previous}</button>
      <ScrollHint labels={labels} visible={canScrollDown} />
      <button type="submit" className="button-primary shrink-0 gap-2">{labels.continue}<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
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
