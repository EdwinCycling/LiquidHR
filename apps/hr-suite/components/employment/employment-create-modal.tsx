'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { EmploymentCreateForm, type EmploymentCreateFormProps } from './employment-create-form'

interface EmploymentCreateModalProps {
  employeeId: string
  options: EmploymentCreateFormProps['options']
  initialOpen: boolean
  labels: EmploymentCreateFormProps['labels'] & {
    modalTitle: string
    cancel: string
  }
}

export function EmploymentCreateModal({ employeeId, options, initialOpen, labels }: EmploymentCreateModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)

  function close(): void {
    setOpen(false)
    router.replace(`/employees/${employeeId}?tab=employments`)
  }

  return (
    <>
      {!open && <button type="button" className="button-primary cursor-pointer" onClick={() => setOpen(true)}>{labels.title}</button>}
      {open && <div className="fixed inset-0 z-50 grid place-items-center bg-sidebar/70 p-4" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="employment-create-title" className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-3xl border bg-surface p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4 border-b pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{labels.title}</p>
              <h2 id="employment-create-title" className="mt-1 text-2xl font-semibold">{labels.modalTitle}</h2>
            </div>
            <button type="button" className="button-secondary cursor-pointer" onClick={close}>{labels.cancel}</button>
          </div>
          <EmploymentCreateForm employeeId={employeeId} options={options} labels={labels} />
        </div>
      </div>}
    </>
  )
}
