import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { EmployeeCreateWizard } from '@/components/employees/employee-create-wizard'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'

export default async function NewEmployeePage() {
  await requireEmployeeCreation()
  const [tEmployees, tErrors, tValidation] = await Promise.all([
    getTranslator('employees'),
    getTranslator('errors'),
    getTranslator('validation'),
  ])
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <Link href="/employees" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />{tEmployees('title')}
      </Link>
      <p className="eyebrow mt-6">{tEmployees('wizardStepIdentity')}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tEmployees('new')}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{tEmployees('identityCheckHelp')}</p>
      <div className="mt-7">
        <EmployeeCreateWizard labels={{
          steps: [tEmployees('wizardStepIdentity'), tEmployees('wizardStepCore'), tEmployees('wizardStepContact'), tEmployees('wizardStepReview')],
          identityTitle: tEmployees('wizardIdentityTitle'), identityHelp: tEmployees('wizardIdentityHelp'),
          bsn: tEmployees('bsn'), birthDate: tEmployees('birthDate'), birthName: tEmployees('birthName'),
          privateEmail: tEmployees('privateEmail'), checkIdentity: tEmployees('checkIdentity'), checking: tEmployees('checking'),
          possibleMatches: tEmployees('possibleMatches'), noMatches: tEmployees('noMatches'), exactMatch: tEmployees('exactMatch'),
          possibleMatch: tEmployees('possibleMatch'), chooseExisting: tEmployees('chooseExisting'), notExisting: tEmployees('notExisting'),
          exactBlocked: tEmployees('exactBlocked'), identitySignalsRequired: tEmployees('identitySignalsRequired'), coreTitle: tEmployees('wizardCoreTitle'), coreHelp: tEmployees('wizardCoreHelp'),
          employeeNumber: tEmployees('employeeNumber'), employeeNumberHelp: tEmployees('employeeNumberHelp'), firstName: tEmployees('firstName'),
          birthNamePrefix: tEmployees('birthNamePrefix'), nameUsage: tEmployees('nameUsage'), nameUsageBirth: tEmployees('nameUsageBirth'),
          nameUsagePartner: tEmployees('nameUsagePartner'), nameUsagePartnerBirth: tEmployees('nameUsagePartnerBirth'),
          nameUsageBirthPartner: tEmployees('nameUsageBirthPartner'), gender: tEmployees('gender'), genderMale: tEmployees('genderMale'),
          genderFemale: tEmployees('genderFemale'), genderOther: tEmployees('genderOther'), genderUndisclosed: tEmployees('genderUndisclosed'),
          preferredLanguage: tEmployees('preferredLanguage'), languageDutch: tEmployees('languageDutch'), languageEnglish: tEmployees('languageEnglish'),
          contactTitle: tEmployees('wizardContactTitle'), contactHelp: tEmployees('wizardContactHelp'), privateMobile: tEmployees('privateMobile'),
          workEmail: tEmployees('workEmail'), workMobile: tEmployees('workMobile'), addressTitle: tEmployees('addressTitle'),
          addressOptional: tEmployees('optional'), street: tEmployees('street'), houseNumber: tEmployees('houseNumber'), addition: tEmployees('addition'),
          postalCode: tEmployees('postalCode'), city: tEmployees('city'), countryCode: tEmployees('countryCode'), validFrom: tEmployees('validFrom'),
          reviewTitle: tEmployees('wizardReviewTitle'), reviewHelp: tEmployees('wizardReviewHelp'), identitySection: tEmployees('identitySection'),
          contactSection: tEmployees('contactSection'), addressSection: tEmployees('addressSection'), noAddress: tEmployees('noAddress'),
          employmentOptional: tEmployees('employmentOptional'), employmentOptionalHelp: tEmployees('employmentOptionalHelp'),
          previous: tEmployees('previous'), continue: tEmployees('continue'), create: tEmployees('createEmployee'), creating: tEmployees('creatingEmployee'),
          genericError: tErrors('generic'), numberConflict: tEmployees('numberConflict'), addressSaveFailed: tEmployees('addressSaveFailed'),
          addressIncomplete: tEmployees('addressIncomplete'), openEmployee: tEmployees('openEmployee'),
          validationRequired: tValidation('required'), validationEmail: tValidation('email'),
          invalidBsn: tEmployees('invalidBsn'), invalidCountryCode: tEmployees('invalidCountryCode'),
        }} />
      </div>
    </main>
  )
}

async function requireEmployeeCreation(): Promise<void> {
  try {
    await requirePermission('employee:write')
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/employees')
    throw error
  }
}
