import Link from 'next/link'
import { ArrowLeft, BriefcaseBusiness, Mail } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EmployeePersonCard } from '@/components/employees/employee-person-card'
import { EmployeeArchiveToggle } from '@/components/employees/employee-archive-toggle'
import { EmployeeAvatarManager } from '@/components/employees/employee-avatar-manager'
import { EmployeeCustomFields } from '@/components/custom-fields/employee-custom-fields'
import { EmploymentCreateForm } from '@/components/employment/employment-create-form'
import { EmploymentTimeline } from '@/components/employment/employment-timeline'
import { EmployeeDocumentDossier } from '@/components/documents/employee-document-dossier'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import {
  EmploymentServiceError,
  getEmployeeEmploymentDetail,
  getEmploymentCreationOptions,
  getTerminationOptions,
} from '@/lib/employment/employment-service'
import { getLocale, getTranslator } from '@/lib/i18n/server'
import { getEmployeeCustomFields } from '@/lib/custom-fields/service'
import { getDocumentOptions, listEmployeeDocuments } from '@/lib/documents/document-service'

interface EmployeeDetailPageProps {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ tab?: string }>
}

async function loadPageData(employeeId: string) {
  try {
    const [detail, customFields, canManageEmployments, locale, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments] = await Promise.all([
      getEmployeeEmploymentDetail(employeeId),
      getEmployeeCustomFields(employeeId),
      permissionAllowed('contract:write', employeeId),
      getLocale(),
      getTranslator('employees'),
      getTranslator('employment'),
      getTranslator('errors'),
      getTranslator('customFields'),
      getTranslator('documents'),
    ])
    const [canReadDocuments, canWriteDocuments, canDeleteDocuments] = await Promise.all([
      permissionAllowed('document:read', employeeId), permissionAllowed('document:write', employeeId), permissionAllowed('document:delete', employeeId),
    ])
    const [terminationOptions, creationOptions] = canManageEmployments
      ? await Promise.all([getTerminationOptions(), getEmploymentCreationOptions(employeeId)])
      : [
          { internalReasons: [], statutoryReasons: [] },
          { departments: [], costCenters: [], salaryScaleSteps: [], nextIkvNumber: 1, canWriteSalary: false },
        ]
    const [documents, documentOptions] = await Promise.all([
      canReadDocuments ? listEmployeeDocuments(employeeId) : Promise.resolve([]),
      canWriteDocuments ? getDocumentOptions(employeeId) : Promise.resolve(null),
    ])
    return [detail, customFields, terminationOptions, creationOptions, canManageEmployments, locale, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, documents, documentOptions, canReadDocuments, canWriteDocuments, canDeleteDocuments] as const
  } catch (error) {
    if (error instanceof EmploymentServiceError && error.status === 404) notFound()
    throw error
  }
}

async function permissionAllowed(permissionCode: string, employeeId: string): Promise<boolean> {
  try {
    await requirePermission(permissionCode, employeeId)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

export default async function EmployeeDetailPage({ params, searchParams }: EmployeeDetailPageProps) {
  const { employeeId } = await params
  const { tab: requestedTab } = await searchParams
  const tab = requestedTab === 'employments' || requestedTab === 'documents' ? requestedTab : 'personal'
  const [detail, customFields, options, creationOptions, canManageEmployments, locale, tEmployees, tEmployment, tErrors, tCustomFields, tDocuments, documents, documentOptions, canReadDocuments, canWriteDocuments, canDeleteDocuments] = await loadPageData(employeeId)
  const statusLabel = {
    ACTIVE_EMPLOYEE: tEmployment('active'), FUTURE_EMPLOYEE: tEmployment('future'),
    FORMER_EMPLOYEE: tEmployees('former'), NEVER_EMPLOYED: tEmployees('external'),
  }[detail.status]

  return (
      <main className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <Link href="/employees" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />{tEmployees('title')}
        </Link>
        <div className="relative mt-5 overflow-hidden rounded-2xl border bg-surface p-5 shadow-sm sm:p-7">
          <div aria-hidden="true" className="absolute -right-14 -top-16 h-44 w-44 rounded-full bg-accent opacity-70" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <EmployeeAvatarManager employeeId={employeeId} avatarUrl={detail.employee.avatarUrl} name={`${detail.employee.firstName} ${detail.employee.birthName}`} canManage={detail.capabilities.canEditEmployee} labels={{ upload: tEmployees('photoUpload'), replace: tEmployees('photoReplace'), remove: tEmployees('photoRemove'), failed: tEmployees('archiveFailed') }} />
              <div className="min-w-0">
                <p className="eyebrow">{detail.employee.employeeNumber}</p>
                <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{detail.employee.firstName} {detail.employee.birthName}</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              {detail.employee.isArchived && <span className="status-chip bg-warning-surface text-warning">{tEmployees('archived')}</span>}
              <span className="status-chip bg-accent text-accent-foreground">{statusLabel}</span>
              <EmployeeArchiveToggle employeeId={employeeId} archived={detail.employee.isArchived} labels={{ archive: tEmployees('archiveEmployee'), unarchive: tEmployees('unarchiveEmployee'), archiveTitle: tEmployees('archiveConfirmTitle'), unarchiveTitle: tEmployees('unarchiveConfirmTitle'), archiveBody: tEmployees('archiveConfirmBody'), archiveAction: tEmployees('archiveConfirmAction'), cancel: tEmployees('archiveCancel'), saved: tEmployees('archiveSaved'), failed: tEmployees('archiveFailed') }} />
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Mail aria-hidden="true" className="h-4 w-4" />{detail.employee.workEmail ?? detail.employee.privateEmail ?? tEmployees('noEmail')}</span>
            <span className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />{tEmployees('employmentCount', { count: detail.employments.length })}</span>
          </div>
        </div>

        <nav className="mt-6 flex gap-2 overflow-x-auto border-b" aria-label={tEmployees('tabsLabel')}>
          {(['personal', 'employments', 'documents'] as const).map((item) => {
            const active = tab === item
            const label = item === 'personal' ? tEmployees('tabPersonal') : item === 'employments' ? tEmployees('tabEmployments') : tEmployees('tabDocuments')
            return <Link key={item} href={`/employees/${employeeId}?tab=${item}`} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}`}>{label}</Link>
          })}
        </nav>

        {tab === 'personal' && <>
        <EmployeePersonCard
          detail={detail}
          locale={locale}
          labels={{
            tabs: { overview: tEmployees('tabOverview'), personal: tEmployees('tabPersonal'), addresses: tEmployees('tabAddresses'), bankAccounts: tEmployees('tabBankAccounts'), relations: tEmployees('tabRelations') },
            overviewTitle: tEmployees('overviewTitle'), contactTitle: tEmployees('contactTitle'), workContact: tEmployees('workContact'), privateContact: tEmployees('privateContact'),
            noContact: tEmployees('noContact'), currentAddress: tEmployees('currentAddress'), noAddress: tEmployees('noAddress'), primaryBank: tEmployees('primaryBank'),
            noBankAccount: tEmployees('noBankAccount'), emergencyContacts: tEmployees('emergencyContacts'), noEmergencyContact: tEmployees('noEmergencyContact'),
            employmentCount: tEmployees('employmentCount'), personalTitle: tEmployees('personalTitle'), editPersonal: tEmployees('editPersonal'),
            save: tEmployees('save'), saving: tEmployees('saving'), saved: tEmployees('saved'), cancel: tEmployees('cancel'), genericError: tErrors('generic'),
            employeeNumber: tEmployees('employeeNumber'), firstName: tEmployees('firstName'), birthNamePrefix: tEmployees('birthNamePrefix'), birthName: tEmployees('birthName'),
            nameUsage: tEmployees('nameUsage'), nameUsageBirth: tEmployees('nameUsageBirth'), nameUsagePartner: tEmployees('nameUsagePartner'),
            nameUsagePartnerBirth: tEmployees('nameUsagePartnerBirth'), nameUsageBirthPartner: tEmployees('nameUsageBirthPartner'), gender: tEmployees('gender'),
            genderMale: tEmployees('genderMale'), genderFemale: tEmployees('genderFemale'), genderOther: tEmployees('genderOther'), genderUndisclosed: tEmployees('genderUndisclosed'),
            birthDate: tEmployees('birthDate'), birthPlace: tEmployees('birthPlace'), birthCountry: tEmployees('birthCountry'), nationality: tEmployees('nationality'),
            preferredLanguage: tEmployees('preferredLanguage'), privateEmail: tEmployees('privateEmail'), privatePhone: tEmployees('privatePhone'),
            privateMobile: tEmployees('privateMobile'), workEmail: tEmployees('workEmail'), workPhone: tEmployees('workPhone'),
            workPhoneExtension: tEmployees('workPhoneExtension'), workMobile: tEmployees('workMobile'), bsnTitle: tEmployees('bsnTitle'),
            bsnProtected: tEmployees('bsnProtected'), revealBsn: tEmployees('revealBsn'), revealingBsn: tEmployees('revealingBsn'),
            bsnNotRecorded: tEmployees('bsnNotRecorded'), bsnAuditHelp: tEmployees('bsnAuditHelp'), addressesTitle: tEmployees('addressesTitle'),
            addressesEmpty: tEmployees('addressesEmpty'), addAddress: tEmployees('addAddress'), current: tEmployees('current'), validFrom: tEmployees('validFrom'),
            validUntil: tEmployees('validUntil'), street: tEmployees('street'), houseNumber: tEmployees('houseNumber'), addition: tEmployees('addition'),
            postalCode: tEmployees('postalCode'), city: tEmployees('city'), province: tEmployees('province'), countryCode: tEmployees('countryCode'),
            saveAddress: tEmployees('saveAddress'), banksTitle: tEmployees('banksTitle'), banksEmpty: tEmployees('banksEmpty'), addBank: tEmployees('addBank'),
            primary: tEmployees('primary'), iban: tEmployees('iban'), bic: tEmployees('bic'), accountHolder: tEmployees('accountHolder'),
            description: tEmployees('description'), makePrimary: tEmployees('makePrimary'), saveBank: tEmployees('saveBank'), relationsTitle: tEmployees('relationsTitle'),
            relationsEmpty: tEmployees('relationsEmpty'), addRelation: tEmployees('addRelation'), relationType: tEmployees('relationType'),
            relationPartner: tEmployees('relationPartner'), relationChild: tEmployees('relationChild'), relationParent: tEmployees('relationParent'),
            relationSibling: tEmployees('relationSibling'), relationDoctor: tEmployees('relationDoctor'), relationDentist: tEmployees('relationDentist'),
            relationOther: tEmployees('relationOther'), emergencyContact: tEmployees('emergencyContact'), lastName: tEmployees('lastName'),
            mobile: tEmployees('mobile'), email: tEmployees('email'), notes: tEmployees('notes'), saveRelation: tEmployees('saveRelation'), notRecorded: tEmployees('notRecorded'),
          }}
        />

        <EmployeeCustomFields employeeId={employeeId} fields={customFields} labels={{ title: tCustomFields('employeeTitle'), subtitle: tCustomFields('employeeSubtitle'), save: tCustomFields('save'), saving: tCustomFields('saving'), saved: tCustomFields('saved'), failed: tCustomFields('failed'), readOnly: tCustomFields('readOnly'), yes: tCustomFields('yes'), no: tCustomFields('no') }} />
        </>}

        {tab === 'documents' && canReadDocuments && <EmployeeDocumentDossier employeeId={employeeId} documents={documents} options={documentOptions} canWrite={canWriteDocuments} canDelete={canDeleteDocuments} labels={{ title: tDocuments('title'), subtitle: tDocuments('subtitle'), upload: tDocuments('upload'), file: tDocuments('file'), documentTitle: tDocuments('documentTitle'), description: tDocuments('description'), tags: tDocuments('tags'), category: tDocuments('category'), visibleToEmployee: tDocuments('visibleToEmployee'), visibleToRole: tDocuments('visibleToRole'), visibleToDepartment: tDocuments('visibleToDepartment'), noSelection: tDocuments('noSelection'), expiresOn: tDocuments('expiresOn'), reminderAt: tDocuments('reminderAt'), reminderForEmployee: tDocuments('reminderForEmployee'), reminderForRole: tDocuments('reminderForRole'), reminderForDepartment: tDocuments('reminderForDepartment'), save: tDocuments('save'), saving: tDocuments('saving'), failed: tDocuments('failed'), empty: tDocuments('empty'), download: tDocuments('download'), delete: tDocuments('delete'), restore: tDocuments('restore'), deleteReason: tDocuments('deleteReason'), deleted: tDocuments('deleted'), expires: tDocuments('expires'), reminderActive: tDocuments('reminderActive'), addedOn: tDocuments('addedOn') }} />}

        {tab === 'employments' && <div className={`mt-8 grid gap-8 ${canManageEmployments ? 'xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]' : ''}`}>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{tEmployment('title')}</h2>
              <span className="status-chip">{detail.employments.length}</span>
            </div>
            <EmploymentTimeline
              employments={detail.employments}
              locale={locale}
              options={options}
              canManage={canManageEmployments}
              labels={{
                empty: tEmployment('empty'),
                active: tEmployment('active'),
                ended: tEmployment('ended'),
                future: tEmployment('future'),
                primary: tEmployment('primary'),
                employmentNumber: tEmployment('employmentNumber'),
                openDetail: tEmployment('openDetail'),
                indefinite: tEmployment('indefinite'),
                definite: tEmployment('definite'),
                terminate: {
                  title: tEmployment('terminate'),
                  lastDay: tEmployment('lastWorkingDay'),
                  internalReason: tEmployment('internalReason'),
                  statutoryReason: tEmployment('statutoryReason'),
                  submit: tEmployment('confirmTermination'),
                  saved: tEmployment('terminationSaved'),
                  failed: tErrors('generic'),
                },
              }}
            />
          </section>
          {canManageEmployments && <aside>
            <EmploymentCreateForm
              employeeId={employeeId}
              options={creationOptions}
              labels={{
                title: tEmployment('new'),
                number: tEmployment('employmentNumber'),
                contractType: tEmployment('contractType'),
                indefinite: tEmployment('indefinite'),
                definite: tEmployment('definite'),
                startDate: tEmployment('startDate'),
                seniorityDate: tEmployment('seniorityDate'),
                endDate: tEmployment('endsOn'),
                submit: tEmployment('create'),
                saved: tEmployment('created'),
                failed: tErrors('generic'),
                chainAdvice: tEmployment('chainAdvice'), chainChecking: tEmployment('chainChecking'),
                chainClear: tEmployment('chainClear'), chainAttention: tEmployment('chainAttention'),
                chainIndefinite: tEmployment('chainIndefinite'), chainInsufficient: tEmployment('chainInsufficient'),
                chainOverrideReason: tEmployment('chainOverrideReason'), historyComplete: tEmployment('historyComplete'),
                knownContracts: tEmployment('knownContracts'), review: tEmployment('continue'),
                previous: tEmployment('previous'), next: tEmployment('next'), stepContract: tEmployment('stepContract'),
                stepIkvOrganization: tEmployment('stepIkvOrganization'), stepConditions: tEmployment('stepConditions'),
                stepSalaryCosts: tEmployment('stepSalaryCosts'), stepReview: tEmployment('stepReview'),
                payrollTaxSubnumber: tEmployment('payrollTaxSubnumber'), ikvNumber: tEmployment('incomeRelationshipNumber'),
                department: tEmployment('department'), jobTitle: tEmployment('jobTitle'), conditionGroup: tEmployment('conditionGroup'),
                averageDays: tEmployment('averageDays'), averageHours: tEmployment('averageHours'), partTimeFactor: tEmployment('partTimeFactor'),
                salary: tEmployment('tabsSalary'), includeSalary: tEmployment('includeSalary'), salaryScaleStep: tEmployment('salaryScaleStep'),
                manualSalary: tEmployment('manualSalary'), fulltimeAmount: tEmployment('fulltimeAmount'), costCenter: tEmployment('costCenter'),
                completeSummary: tEmployment('completeSummary'), requiredFields: tEmployment('requiredFields'),
              }}
            />
          </aside>}
        </div>}
      </main>
  )
}
