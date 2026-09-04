'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Building2,
  Clock3,
  FilePenLine,
  Scale,
  Trash2,
} from 'lucide-react'
import {
  EmploymentContractChangeDialog,
  type EmploymentContractChangeLabels,
  type EmploymentOverviewActionKey,
  type EmploymentOverviewChangeData,
} from './employment-contract-change-dialog'
import { buttonClasses } from '@/components/ui/button'

export interface EmploymentOverviewActionLabels extends EmploymentContractChangeLabels {
  sectionTitle: string
  hoursSchedule: string
  hoursScheduleSalary: string
  functionDepartmentCostCenter: string
  salary: string
  laborConditions: string
  contractTypeStartDate: string
  deleteContract: string
  modalTitle: string
  cancel: string
}

type ActionKey = EmploymentOverviewActionKey

interface ActionDefinition {
  key: ActionKey
  title: string
  icon: LucideIcon
  destructive?: boolean
}

const actionIcons: Record<EmploymentOverviewActionKey, LucideIcon> = {
  hoursSchedule: Clock3,
  hoursScheduleSalary: Banknote,
  functionDepartmentCostCenter: Building2,
  salary: Banknote,
  laborConditions: Scale,
  contractTypeStartDate: FilePenLine,
  deleteContract: Trash2,
}

export function EmploymentChangeButton({ actionKey, actionTitle, buttonLabel, labels, employmentId, today, locale, data, dayLabels }: {
  actionKey: EmploymentOverviewActionKey
  actionTitle: string
  buttonLabel: string
  labels: EmploymentOverviewActionLabels
  employmentId: string
  today: string
  locale: string
  data: EmploymentOverviewChangeData
  dayLabels: string[]
}) {
  const [active, setActive] = useState(false)
  const Icon = actionIcons[actionKey]
  return <>
    <button className={buttonClasses({ variant: 'secondary', size: 'sm' })} onClick={() => setActive(true)} type="button">
      <Icon aria-hidden="true" />{buttonLabel}
    </button>
    {active ? <EmploymentContractChangeDialog actionKey={actionKey} actionTitle={actionTitle} employmentId={employmentId} today={today} locale={locale} data={data} labels={labels} dayLabels={dayLabels} onClose={() => setActive(false)} /> : null}
  </>
}

export function EmploymentOverviewActions({ labels, employmentId, today, locale, data, dayLabels }: { labels: EmploymentOverviewActionLabels; employmentId: string; today: string; locale: string; data: EmploymentOverviewChangeData; dayLabels: string[] }) {
  const actions: ActionDefinition[] = [
    { key: 'hoursSchedule', title: labels.hoursSchedule, icon: Clock3 },
    { key: 'hoursScheduleSalary', title: labels.hoursScheduleSalary, icon: Banknote },
    { key: 'functionDepartmentCostCenter', title: labels.functionDepartmentCostCenter, icon: Building2 },
    { key: 'salary', title: labels.salary, icon: Banknote },
    { key: 'laborConditions', title: labels.laborConditions, icon: Scale },
    { key: 'contractTypeStartDate', title: labels.contractTypeStartDate, icon: FilePenLine },
    { key: 'deleteContract', title: labels.deleteContract, icon: Trash2, destructive: true },
  ]

  return (
    <section aria-labelledby="employment-change-actions-title" className="space-y-3">
      <div>
        <p className="eyebrow" id="employment-change-actions-title">{labels.sectionTitle}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {actions.map((action) => <EmploymentChangeButton key={action.key} actionKey={action.key} actionTitle={action.title} buttonLabel={action.title} labels={labels} employmentId={employmentId} today={today} locale={locale} data={data} dayLabels={dayLabels} />)}
      </div>
    </section>
  )
}
