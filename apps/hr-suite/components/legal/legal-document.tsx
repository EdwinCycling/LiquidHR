import Image from 'next/image'
import Link from 'next/link'
import legalMessages from '@/messages/en/legal.json'

export type LegalDocumentSection = {
  title: string
  paragraphs: readonly string[]
  bullets?: readonly string[]
  closing?: string
}

export type LegalDocumentContent = {
  title: string
  description: string
  lastUpdated: string
  lead: string
  sections: readonly LegalDocumentSection[]
}

type LegalDocumentProps = {
  document: LegalDocumentContent
  otherHref: '/privacy' | '/terms'
  otherLabel: string
}

const shared = legalMessages.shared

export function LegalDocument({ document, otherHref, otherLabel }: LegalDocumentProps) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-5">
          <Link className="inline-flex items-center gap-3 rounded-[var(--radius-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/login">
            <Image alt="" className="size-10 rounded-[var(--radius-control)]" height={40} priority src="/icon.svg" width={40} />
            <span>
              <span className="block text-sm font-semibold tracking-tight text-foreground">{shared.brand}</span>
              <span className="block text-xs text-muted-foreground">{shared.company}</span>
            </span>
          </Link>
          <nav aria-label="Legal navigation" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link className="text-primary underline-offset-4 hover:underline" href={otherHref}>{otherLabel}</Link>
            <Link className="text-primary underline-offset-4 hover:underline" href="/login">{shared.backToLogin}</Link>
          </nav>
        </header>

        <article className="pt-10 sm:pt-14">
          <header className="border-b border-border-subtle pb-8">
            <p className="eyebrow">{shared.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{document.title}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{document.lead}</p>
            <p className="mt-5 text-sm font-medium text-muted-foreground"><time dateTime="2026-09-03">{document.lastUpdated}</time></p>
          </header>

          <div className="divide-y divide-border-subtle">
            {document.sections.map((section) => (
              <section className="py-8 first:pt-9 last:pb-0" key={section.title}>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-foreground/85">
                  {section.paragraphs.map((paragraph) => <p className="whitespace-pre-line" key={paragraph}>{paragraph}</p>)}
                  {section.bullets ? <ul className="list-disc space-y-2 pl-5 marker:text-primary">{section.bullets.map((bullet) => <li className="pl-1" key={bullet}>{bullet}</li>)}</ul> : null}
                  {section.closing ? <p>{section.closing}</p> : null}
                </div>
              </section>
            ))}
          </div>
        </article>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5 text-xs text-muted-foreground">
          <span>{shared.company} · {shared.country}</span>
          <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${shared.contactEmail}`}>{shared.contactEmail}</a>
        </footer>
      </div>
    </main>
  )
}
