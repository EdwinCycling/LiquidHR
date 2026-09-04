'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'

interface NewEmploymentButtonLabels {
  new: string
  confirmationTitle: string
  confirmationDescription: string
  confirmationConfirm: string
  confirmationCancel: string
}

export function NewEmploymentButton({ href, hasActiveEmployment, labels }: { href: string; hasActiveEmployment: boolean; labels: NewEmploymentButtonLabels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return <>
    <Button onClick={() => hasActiveEmployment ? setOpen(true) : router.push(href)} type="button">{labels.new}</Button>
    <ConfirmDialog
      cancelLabel={labels.confirmationCancel}
      confirmLabel={labels.confirmationConfirm}
      description={labels.confirmationDescription}
      onConfirm={() => { setOpen(false); router.push(href) }}
      onOpenChange={setOpen}
      open={open}
      title={labels.confirmationTitle}
    />
  </>
}
