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

interface EmploymentOverviewActionLabels extends EmploymentContractChangeLabels {
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

export function EmploymentOverviewActions({ labels, employmentId, today, locale, data, dayLabels }: { labels: EmploymentOverviewActionLabels; employmentId: string; today: string; locale: string; data: EmploymentOverviewChangeData; dayLabels: string[] }) {
  const [activeAction, setActiveAction] = useState<ActionDefinition | null>(null)

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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              className={`${buttonClasses({ variant: action.destructive ? 'danger' : 'secondary', className: 'min-h-20 w-full justify-start whitespace-normal px-4 py-3 text-left' })} ${action.destructive ? 'border-destructive/30' : ''}`}
              key={action.key}
              onClick={() => setActiveAction(action)}
              type="button"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] ${action.destructive ? 'bg-destructive-surface text-destructive' : 'bg-accent text-accent-foreground'}`}>
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="font-semibold leading-5 group-hover:text-primary">{action.title}</span>
            </button>
          )
        })}
      </div>

      {activeAction ? <EmploymentContractChangeDialog actionKey={activeAction.key} actionTitle={activeAction.title} employmentId={employmentId} today={today} locale={locale} data={data} labels={labels} dayLabels={dayLabels} onClose={() => setActiveAction(null)} /> : null}
    </section>
  )
}
