'use client'

import { ArrowUpRight, Users, X } from 'lucide-react'
import { useRef } from 'react'

export function EmployeeSettingsPlaceholderDialog({ labels }: { labels: { tileTitle: string; tileDescription: string; title: string; description: string; comingSoon: string; close: string } }) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = () => ref.current?.close()
  return <>
    <button className="group flex min-h-36 w-full items-start gap-4 rounded-2xl border bg-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" onClick={() => ref.current?.showModal()} type="button"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Users aria-hidden="true" size={21} /></span><span className="min-w-0"><span className="flex items-center gap-2 font-semibold">{labels.tileTitle}<ArrowUpRight aria-hidden="true" className="opacity-0 transition group-hover:opacity-100" size={15} /></span><span className="mt-2 block text-sm leading-6 text-muted-foreground">{labels.tileDescription}</span></span></button>
    <dialog aria-labelledby="employee-settings-title" className="settings-dialog m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border bg-surface p-0 text-foreground shadow-2xl" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === event.currentTarget) close() }} ref={ref}><div className="p-6 sm:p-7"><div className="flex items-start justify-between gap-5"><span className="grid size-12 place-items-center rounded-xl bg-accent text-primary"><Users aria-hidden="true" size={23} /></span><button aria-label={labels.close} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted" onClick={close} type="button"><X aria-hidden="true" size={19} /></button></div><h2 className="mt-6 text-2xl font-semibold tracking-tight" id="employee-settings-title">{labels.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{labels.description}</p><p className="mt-5 inline-flex rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">{labels.comingSoon}</p><div className="mt-7 flex justify-end"><button className="button-primary min-h-10" onClick={close} type="button">{labels.close}</button></div></div></dialog>
  </>
}
