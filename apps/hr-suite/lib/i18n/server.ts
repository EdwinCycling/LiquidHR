import 'server-only'

import authEn from '@/messages/en/auth.json'
import commonEn from '@/messages/en/common.json'
import departmentsEn from '@/messages/en/departments.json'
import employeesEn from '@/messages/en/employees.json'
import employmentEn from '@/messages/en/employment.json'
import errorsEn from '@/messages/en/errors.json'
import navigationEn from '@/messages/en/navigation.json'
import settingsEn from '@/messages/en/settings.json'
import validationEn from '@/messages/en/validation.json'
import organizationEn from '@/messages/en/organization.json'
import customFieldsEn from '@/messages/en/customFields.json'
import remindersEn from '@/messages/en/reminders.json'
import heraEn from '@/messages/en/hera.json'
import dashboardEn from '@/messages/en/dashboard.json'
import masterDataEn from '@/messages/en/masterData.json'
import documentsEn from '@/messages/en/documents.json'
import hrCalendarEn from '@/messages/en/hrCalendar.json'
import starPerformersEn from '@/messages/en/starPerformers.json'
import leaveEn from '@/messages/en/leave.json'
import authNl from '@/messages/nl/auth.json'
import commonNl from '@/messages/nl/common.json'
import departmentsNl from '@/messages/nl/departments.json'
import employeesNl from '@/messages/nl/employees.json'
import employmentNl from '@/messages/nl/employment.json'
import errorsNl from '@/messages/nl/errors.json'
import navigationNl from '@/messages/nl/navigation.json'
import settingsNl from '@/messages/nl/settings.json'
import validationNl from '@/messages/nl/validation.json'
import organizationNl from '@/messages/nl/organization.json'
import customFieldsNl from '@/messages/nl/customFields.json'
import remindersNl from '@/messages/nl/reminders.json'
import heraNl from '@/messages/nl/hera.json'
import dashboardNl from '@/messages/nl/dashboard.json'
import masterDataNl from '@/messages/nl/masterData.json'
import documentsNl from '@/messages/nl/documents.json'
import hrCalendarNl from '@/messages/nl/hrCalendar.json'
import starPerformersNl from '@/messages/nl/starPerformers.json'
import leaveNl from '@/messages/nl/leave.json'
import { getUserPreferences } from '@/lib/preferences/server'
import {
  type Locale,
  type MessageNamespace,
} from './config'
import { createTranslator, type MessageTree, type Translator } from './translator'

const MESSAGES: Record<Locale, Record<MessageNamespace, MessageTree>> = {
  nl: {
    auth: authNl,
    common: commonNl,
    departments: departmentsNl,
    employees: employeesNl,
    employment: employmentNl,
    errors: errorsNl,
    navigation: navigationNl,
    settings: settingsNl,
    validation: validationNl,
    organization: organizationNl,
    customFields: customFieldsNl,
    reminders: remindersNl,
    hera: heraNl,
    dashboard: dashboardNl,
    masterData: masterDataNl,
    documents: documentsNl,
    hrCalendar: hrCalendarNl,
    starPerformers: starPerformersNl,
    leave: leaveNl,
  },
  en: {
    auth: authEn,
    common: commonEn,
    departments: departmentsEn,
    employees: employeesEn,
    employment: employmentEn,
    errors: errorsEn,
    navigation: navigationEn,
    settings: settingsEn,
    validation: validationEn,
    organization: organizationEn,
    customFields: customFieldsEn,
    reminders: remindersEn,
    hera: heraEn,
    dashboard: dashboardEn,
    masterData: masterDataEn,
    documents: documentsEn,
    hrCalendar: hrCalendarEn,
    starPerformers: starPerformersEn,
    leave: leaveEn,
  },
}

export async function getLocale(): Promise<Locale> {
  return (await getUserPreferences()).locale
}

export async function getTranslator(
  namespace: MessageNamespace,
  locale?: Locale,
): Promise<Translator> {
  const resolvedLocale = locale ?? (await getLocale())
  return createTranslator(MESSAGES[resolvedLocale][namespace])
}
