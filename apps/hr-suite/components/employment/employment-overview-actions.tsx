'use client'

import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  Clock3,
  FilePenLine,
  Scale,
  Trash2,
} from 'lucide-react'

interface EmploymentOverviewActionLabels {
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

type ActionKey =
  | 'hoursSchedule'
  | 'hoursScheduleSalary'
  | 'functionDepartmentCostCenter'
  | 'salary'
  | 'laborConditions'
  | 'contractTypeStartDate'
  | 'deleteContract'

interface ActionDefinition {
  key: ActionKey
  title: string
  icon: LucideIcon
  destructive?: boolean
}

export function EmploymentOverviewActions({ labels }: { labels: EmploymentOverviewActionLabels }) {
  const [activeAction, setActiveAction] = useState<ActionDefinition | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const actions: ActionDefinition[] = [
    { key: 'hoursSchedule', title: labels.hoursSchedule, icon: Clock3 },
    { key: 'hoursScheduleSalary', title: labels.hoursScheduleSalary, icon: Banknote },
    { key: 'functionDepartmentCostCenter', title: labels.functionDepartmentCostCenter, icon: Building2 },
    { key: 'salary', title: labels.salary, icon: Banknote },
    { key: 'laborConditions', title: labels.laborConditions, icon: Scale },
    { key: 'contractTypeStartDate', title: labels.contractTypeStartDate, icon: FilePenLine },
    { key: 'deleteContract', title: labels.deleteContract, icon: Trash2, destructive: true },
  ]

  useEffect(() => {
    if (!activeAction) return
    cancelRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveAction(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [activeAction])

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
              className={`group flex min-h-20 items-center gap-3 rounded-2xl border bg-surface px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${action.destructive ? 'border-destructive/30' : ''}`}
              key={action.key}
              onClick={() => setActiveAction(action)}
              type="button"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${action.destructive ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground'}`}>
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="font-semibold leading-5 group-hover:text-primary">{action.title}</span>
            </button>
          )
        })}
      </div>

      {activeAction ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4"
          onMouseDown={() => setActiveAction(null)}
          role="presentation"
        >
          <section
            aria-labelledby="employment-change-modal-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border bg-surface p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <BriefcaseBusiness aria-hidden="true" className="size-5" />
              </span>
              <h2 className="pt-2 text-xl font-semibold" id="employment-change-modal-title">
                {labels.modalTitle} — {activeAction.title}
              </h2>
            </div>
            <div className="min-h-16" />
            <div className="border-t pt-5">
              <button ref={cancelRef} className="button-secondary" onClick={() => setActiveAction(null)} type="button">
                {labels.cancel}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
