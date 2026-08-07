import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { EmployeeCreateWizard } from '@/components/employees/employee-create-wizard'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getLocale, getTranslator } from '@/lib/i18n/server'

export default async function NewEmployeePage() {
  await requireEmployeeCreation()
  const [tEmployees, tErrors, tValidation, tEmployment, locale] = await Promise.all([
    getTranslator('employees'),
    getTranslator('errors'),
    getTranslator('validation'),
    getTranslator('employment'),
    getLocale(),
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
        <EmployeeCreateWizard locale={locale} labels={{
          steps: [tEmployees('wizardStepIdentity'), tEmployees('wizardStepCore'), tEmployees('wizardStepAdditional'), tEmployees('wizardStepContact'), tEmployees('wizardStepReview')],
          identityTitle: tEmployees('wizardIdentityTitle'), identityHelp: tEmployees('wizardIdentityHelp'),
          bsn: tEmployees('bsn'), birthDate: tEmployees('birthDate'), birthName: tEmployees('birthName'),
          privateEmail: tEmployees('privateEmail'), checkIdentity: tEmployees('checkIdentity'), checking: tEmployees('checking'),
          possibleMatches: tEmployees('possibleMatches'), noMatches: tEmployees('noMatches'), exactMatch: tEmployees('exactMatch'),
          possibleMatch: tEmployees('possibleMatch'), chooseExisting: tEmployees('chooseExisting'), notExisting: tEmployees('notExisting'),
          exactBlocked: tEmployees('exactBlocked'), identitySignalsRequired: tEmployees('identitySignalsRequired'), coreTitle: tEmployees('wizardCoreTitle'), coreHelp: tEmployees('wizardCoreHelp'),
          employeeNumber: tEmployees('employeeNumber'), employeeNumberHelp: tEmployees('employeeNumberHelp'), firstName: tEmployees('firstName'),
          birthNamePrefix: tEmployees('birthNamePrefix'), partnerName: tEmployees('partnerName'), nameUsage: tEmployees('nameUsage'), nameUsageBirth: tEmployees('nameUsageBirth'),
          nameUsagePartner: tEmployees('nameUsagePartner'), nameUsagePartnerBirth: tEmployees('nameUsagePartnerBirth'),
          nameUsageBirthPartner: tEmployees('nameUsageBirthPartner'), gender: tEmployees('gender'), genderMale: tEmployees('genderMale'),
          genderFemale: tEmployees('genderFemale'), genderOther: tEmployees('genderOther'), genderUndisclosed: tEmployees('genderUndisclosed'),
          preferredLanguage: tEmployees('preferredLanguage'), languageDutch: tEmployees('languageDutch'), languageEnglish: tEmployees('languageEnglish'),
          additionalTitle: tEmployees('wizardAdditionalTitle'), additionalHelp: tEmployees('wizardAdditionalHelp'),
          employeeTitle: tEmployees('employeeTitle'), employeeInitials: tEmployees('employeeInitials'), pronouns: tEmployees('pronouns'), birthPlace: tEmployees('birthPlace'),
          birthCountry: tEmployees('birthCountry'), nationality: tEmployees('nationality'), maritalStatus: tEmployees('maritalStatus'),
          maritalStatusSingle: tEmployees('maritalStatusSingle'), maritalStatusMarried: tEmployees('maritalStatusMarried'),
          maritalStatusRegisteredPartnership: tEmployees('maritalStatusRegisteredPartnership'), maritalStatusDivorced: tEmployees('maritalStatusDivorced'),
          maritalStatusWidowed: tEmployees('maritalStatusWidowed'), maritalStatusDate: tEmployees('maritalStatusDate'), educationLevel: tEmployees('educationLevel'),
          educationMbo: tEmployees('educationMbo'), educationHbo: tEmployees('educationHbo'), educationWo: tEmployees('educationWo'),
          educationHighschool: tEmployees('educationHighschool'), educationOther: tEmployees('educationOther'), educationUnknown: tEmployees('educationUnknown'),
          privatePhone: tEmployees('privatePhone'), workPhone: tEmployees('workPhone'), workPhoneExtension: tEmployees('workPhoneExtension'),
          originalHireDate: tEmployees('originalHireDate'), countrySearch: tEmployees('countrySearch'), countryNoResults: tEmployees('countryNoResults'),
          contactTitle: tEmployees('wizardContactTitle'), contactHelp: tEmployees('wizardContactHelp'), privateMobile: tEmployees('privateMobile'),
          workEmail: tEmployees('workEmail'), workMobile: tEmployees('workMobile'), addressTitle: tEmployees('addressTitle'),
          addressOptional: tEmployees('optional'), street: tEmployees('street'), houseNumber: tEmployees('houseNumber'), addition: tEmployees('addition'),
          postalCode: tEmployees('postalCode'), city: tEmployees('city'), countryCode: tEmployees('countryCode'),
          reviewTitle: tEmployees('wizardReviewTitle'), reviewHelp: tEmployees('wizardReviewHelp'), identitySection: tEmployees('identitySection'),
          additionalSection: tEmployees('additionalSection'), contactSection: tEmployees('contactSection'), addressSection: tEmployees('addressSection'), noAddress: tEmployees('noAddress'),
          employmentOptional: tEmployees('employmentOptional'), employmentOptionalHelp: tEmployees('employmentOptionalHelp'),
          previous: tEmployees('previous'), continue: tEmployees('continue'), create: tEmployees('createEmployee'), createAndEmployment: tEmployees('createEmployeeAndEmployment'), creating: tEmployees('creatingEmployee'),
          genericError: tErrors('generic'), numberConflict: tEmployees('numberConflict'), addressSaveFailed: tEmployees('addressSaveFailed'),
          addressIncomplete: tEmployees('addressIncomplete'), openEmployee: tEmployees('openEmployee'), creationComplete: tEmployees('creationComplete'), creationCompleteHelp: tEmployees('creationCompleteHelp'),
          required: tEmployees('required'), optional: tEmployees('optional'),
          validationRequired: tValidation('required'), validationEmail: tValidation('email'),
          invalidBsn: tEmployees('invalidBsn'), invalidCountryCode: tEmployees('invalidCountryCode'),
          employeeNumberHighest: tEmployees('employeeNumberHighest'), employeeNumberUsage: tEmployees('employeeNumberUsage'),
          employeeNumberUsageTitle: tEmployees('employeeNumberUsageTitle'), employeeNumberUsageHelp: tEmployees('employeeNumberUsageHelp'),
          employeeNumberUsageTruncated: tEmployees('employeeNumberUsageTruncated'), employeeNumberUsageClose: tEmployees('employeeNumberUsageClose'),
          employeeNumberChecking: tEmployees('employeeNumberChecking'), employeeNumberAvailable: tEmployees('employeeNumberAvailable'),
          employeeNumberInUse: tEmployees('employeeNumberInUse'), employmentLoading: tEmployees('employmentLoading'),
          employmentComplete: tEmployees('employmentComplete'), employmentCompleteHelp: tEmployees('employmentCompleteHelp'), openEmployment: tEmployees('openEmployment'),
          employment: {
            title: tEmployment('new'), submit: tEmployment('create'), saved: tEmployment('created'), failed: tErrors('generic'),
            previous: tEmployment('previous'), next: tEmployment('next'), requiredFields: tEmployment('requiredFields'),
            employmentNumber: tEmployment('employmentNumber'), primaryEmployment: tEmployment('primaryEmployment'), yes: tEmployment('yes'), no: tEmployment('no'), required: tEmployment('required'), optional: tEmployment('optional'),
            administration: tEmployment('administration'), administrationSearch: tEmployment('administrationSearch'), administrationDetails: tEmployment('administrationDetails'), administrationNumber: tEmployment('administrationNumber'), cocNumber: tEmployment('cocNumber'), vatNumber: tEmployment('vatNumber'),
            startDate: tEmployment('startDate'), seniorityDate: tEmployment('seniorityDate'), country: tEmployment('country'), ikvNumber: tEmployment('incomeRelationshipNumber'),
            prerequisitesTitle: tEmployment('prerequisitesTitle'), nationality: tEmployment('nationality'), bsn: tEmployment('bsn'), birthDate: tEmployment('birthDate'), gender: tEmployment('gender'),
            savePrerequisites: tEmployment('savePrerequisites'), prerequisiteSaved: tEmployment('prerequisiteSaved'), bsnOptionalHelp: tEmployment('bsnOptionalHelp'),
            countrySearch: tEmployment('countrySearch'), countryNoResults: tEmployment('countryNoResults'), genderMale: tEmployment('genderMale'), genderFemale: tEmployment('genderFemale'),
            genderOther: tEmployment('genderOther'), genderUndisclosed: tEmployment('genderUndisclosed'), stepAdministration: tEmployment('stepAdministration'), stepEmployment: tEmployment('stepEmployment'), stepPayrollChoice: tEmployment('stepPayrollChoice'), stepContract: tEmployment('stepContract'),
            stepSchedule: tEmployment('stepSchedule'), stepSalary: tEmployment('stepSalary'), stepOther: tEmployment('stepOther'), stepReview: tEmployment('stepReview'),
            payrollChoiceTitle: tEmployment('payrollChoiceTitle'), payrollChoiceHelp: tEmployment('payrollChoiceHelp'), addPayrollDetails: tEmployment('addPayrollDetails'), skipPayrollDetails: tEmployment('skipPayrollDetails'),
            workerType: tEmployment('workerType'), workerEmployee: tEmployment('workerEmployee'), workerStudentIntern: tEmployment('workerStudentIntern'),
            workerTemporaryAgency: tEmployment('workerTemporaryAgency'), workerFreelancer: tEmployment('workerFreelancer'), workerVolunteer: tEmployment('workerVolunteer'), workerNoPayroll: tEmployment('workerNoPayroll'), flexPhase: tEmployment('flexPhase'), laborConditions: tEmployment('laborConditions'),
            duration: tEmployment('duration'), indefinite: tEmployment('indefinite'), definite: tEmployment('definite'), endDate: tEmployment('endsOn'), probation: tEmployment('probation'), probationEnd: tEmployment('probationEnd'),
            addFourWeeks: tEmployment('addFourWeeks'), addOneMonth: tEmployment('addOneMonth'), addTwoMonths: tEmployment('addTwoMonths'), onCallEmployee: tEmployment('onCallEmployee'), onCallObligation: tEmployment('onCallObligation'),
            employmentScope: tEmployment('employmentScope'), fullTime: tEmployment('fullTime'), partTime: tEmployment('partTime'), weeklyHours: tEmployment('weeklyHours'), fulltimeReference: tEmployment('fulltimeReference'), partTimeFactor: tEmployment('partTimeFactor'),
            roster: tEmployment('roster'), rosterMismatch: tEmployment('rosterMismatch'), monday: tEmployment('monday'), tuesday: tEmployment('tuesday'), wednesday: tEmployment('wednesday'), thursday: tEmployment('thursday'), friday: tEmployment('friday'), saturday: tEmployment('saturday'), sunday: tEmployment('sunday'),
            salaryCalculation: tEmployment('salaryCalculation'), salaryManual: tEmployment('salaryManual'), salaryMinimum: tEmployment('salaryMinimum'), salaryTable: tEmployment('salaryTable'), frequency: tEmployment('frequency'), frequencySingleHelp: tEmployment('frequencySingleHelp'), frequencyNone: tEmployment('frequencyNone'), fulltimeSalary: tEmployment('fulltimeSalary'), parttimeSalary: tEmployment('parttimeSalary'), salaryScale: tEmployment('salaryScale'), salaryScaleStep: tEmployment('salaryScaleStep'), salaryScaleAmount: tEmployment('salaryScaleAmount'), minimumHourlyRate: tEmployment('minimumHourlyRate'),
            jobGroup: tEmployment('jobGroup'), department: tEmployment('department'), job: tEmployment('job'), manager: tEmployment('manager'), noManager: tEmployment('noManager'), costCenter: tEmployment('costCenter'), costCarrier: tEmployment('costCarrier'), splitCostCenter: tEmployment('splitCostCenter'), addAllocation: tEmployment('addAllocation'), removeAllocation: tEmployment('removeAllocation'), allocationPercentage: tEmployment('allocationPercentage'), allocationTotal: tEmployment('allocationTotal'), allocationMismatch: tEmployment('allocationMismatch'), completeSummary: tEmployment('completeSummary'), createHint: tEmployment('createHint'), optionsLoading: tEmployment('optionsLoading'),
          },
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
