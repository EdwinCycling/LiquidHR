import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { InfoList } from '@/components/patterns/info-list'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'
import type { ComponentCatalogEntry, ComponentCatalogReference } from '@/lib/payroll/component-catalog'
import type { PayrollExpression } from '@liquid-hr/payroll-engine'

type Translator = (key: string) => string

const COMPONENT_NAME_KEYS: Readonly<Record<string, string>> = {
  NL_REGULAR_WAGE: 'payrollComponentsName_NL_REGULAR_WAGE',
  NL_TAXABLE_WAGE: 'payrollComponentsName_NL_TAXABLE_WAGE',
  NL_WAGE_TAX: 'payrollComponentsName_NL_WAGE_TAX',
  NL_NET_PAY: 'payrollComponentsName_NL_NET_PAY',
  NL_CLASS_FISCAL_YEAR: 'payrollComponentsName_NL_CLASS_FISCAL_YEAR',
  NL_CLASS_TAX_TABLE: 'payrollComponentsName_NL_CLASS_TAX_TABLE',
  NL_CLASS_RESIDENCE: 'payrollComponentsName_NL_CLASS_RESIDENCE',
  NL_CLASS_AGE_CATEGORY: 'payrollComponentsName_NL_CLASS_AGE_CATEGORY',
  NL_CLASS_HERLEIDING: 'payrollComponentsName_NL_CLASS_HERLEIDING',
  NL_CLASS_TIME_PERIOD: 'payrollComponentsName_NL_CLASS_TIME_PERIOD',
  NL_CLASS_PAYROLL_TAX_CREDIT: 'payrollComponentsName_NL_CLASS_PAYROLL_TAX_CREDIT',
  NL_CLASS_REGULAR_WAGE: 'payrollComponentsName_NL_CLASS_REGULAR_WAGE',
  NL_CLASS_FULL_PERIOD: 'payrollComponentsName_NL_CLASS_FULL_PERIOD',
  NL_CLASS_SPECIAL_SITUATION: 'payrollComponentsName_NL_CLASS_SPECIAL_SITUATION',
  NL_CLASS_IKV_COUNT: 'payrollComponentsName_NL_CLASS_IKV_COUNT',
  gross_salary: 'payrollComponentsName_gross_salary',
  employee_pension: 'payrollComponentsName_employee_pension',
  wage_tax: 'payrollComponentsName_wage_tax',
  employer_pension: 'payrollComponentsName_employer_pension',
  employer_insurance: 'payrollComponentsName_employer_insurance',
  employer_zvw: 'payrollComponentsName_employer_zvw',
  net_salary: 'payrollComponentsName_net_salary',
  holiday_allowance_accrual: 'payrollComponentsName_holiday_allowance_accrual',
  total_employer_cost: 'payrollComponentsName_total_employer_cost',
}

export function payrollComponentName(entry: ComponentCatalogEntry, t: Translator): string {
  const fork = entry.definition.ownership.kind === 'CUSTOMER_FORK' ? entry.definition.ownership : null
  const sourceCode = fork?.origin.code ?? entry.definition.code
  const key = COMPONENT_NAME_KEYS[sourceCode]
  const name = entry.displayName?.trim() || (key ? t(key) : sourceCode)
  return fork ? `${name} (${t('payrollComponentsCustomerCopySuffix')})` : name
}

export function payrollComponentCategory(entry: ComponentCatalogEntry, t: Translator): string {
  if (entry.category?.trim()) return entry.category.trim()
  return t(`payrollComponentsMethod_${entry.definition.method.kind}`)
}

export function payrollComponentStatus(entry: ComponentCatalogEntry): 'PACKAGED' | 'DRAFT' | 'UNSPECIFIED' {
  if (entry.status === 'DRAFT') return 'DRAFT'
  return entry.ownership === 'SYSTEM' ? 'PACKAGED' : 'UNSPECIFIED'
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Amsterdam',
  }).format(date)
}

function expressionText(expression: PayrollExpression): string {
  switch (expression.kind) {
    case 'literal': return expression.value
    case 'boolean': return String(expression.value)
    case 'string': return JSON.stringify(expression.value)
    case 'input': return `input.${expression.name}`
    case 'output': return `${expression.componentCode}.${expression.outputName}`
    case 'parameter': return `parameter.${expression.name}`
    case 'unary': return `${expression.operator}(${expressionText(expression.operand)})`
    case 'binary': return `(${expressionText(expression.left)} ${expression.operator} ${expressionText(expression.right)})`
    case 'ratio': return `RATIO(${expressionText(expression.numerator)} / ${expressionText(expression.denominator)}, roundingDefinitionId=${expression.roundingDefinitionId})`
    case 'if': return `IF(${expressionText(expression.condition)}, ${expressionText(expression.then)}, ${expressionText(expression.else)})`
    case 'call': return `${expression.operator}(${expression.arguments.map(expressionText).join(', ')})`
  }
}

function methodDetails(entry: ComponentCatalogEntry, t: Translator) {
  const method = entry.definition.method
  switch (method.kind) {
    case 'source':
      return <code className="break-all font-mono text-xs">{method.path.join('.')}</code>
    case 'passThrough':
      return <ul className="space-y-1">{Object.entries(method.outputs).map(([output, input]) => <li className="break-all font-mono text-xs" key={output}>{output} ← {input}</li>)}</ul>
    case 'expression':
      return <ul className="space-y-2">{Object.entries(method.outputs).map(([output, expression]) => <li className="min-w-0" key={output}><span className="break-all whitespace-pre-wrap font-mono text-xs">{output} = {expressionText(expression)}</span></li>)}</ul>
    case 'aggregate':
      return <p className="font-mono text-xs">{method.operation}({method.inputNames.join(', ')})</p>
    case 'registeredRule':
      return <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div><dt className="text-muted-foreground">{t('payrollComponentsRuleKey')}</dt><dd className="break-all font-mono">{method.ruleKey}</dd></div>
        <div><dt className="text-muted-foreground">{t('payrollComponentsVersion')}</dt><dd className="font-mono">{method.ruleVersion}</dd></div>
        <div><dt className="text-muted-foreground">{t('payrollComponentsImplementationHash')}</dt><dd className="break-all font-mono">{method.implementationHash}</dd></div>
        <div><dt className="text-muted-foreground">{t('payrollComponentsParameterSetHash')}</dt><dd className="break-all font-mono">{method.parameterSetHash}</dd></div>
      </dl>
  }
}

function referenceLabel(reference: ComponentCatalogReference, components: readonly ComponentCatalogEntry[], t: Translator): string {
  const matching = components.find((entry) => entry.key === reference.key)
  const name = matching ? payrollComponentName(matching, t) : reference.componentCode
  return `${name} · ${reference.componentCode} v${reference.componentVersion}`
}

function ReferenceList({
  references,
  components,
  t,
  emptyLabel,
}: {
  references: readonly ComponentCatalogReference[]
  components: readonly ComponentCatalogEntry[]
  t: Translator
  emptyLabel: string
}) {
  if (!references.length) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  return <ul className="space-y-2">{references.map((reference) => {
    const linked = components.some((entry) => entry.key === reference.key)
    const detail = [reference.inputName ? `${t('payrollComponentsInput')} ${reference.inputName}` : null, reference.outputName ? `${t('payrollComponentsOutput')} ${reference.outputName}` : null]
      .filter((value): value is string => Boolean(value))
      .join(' · ')
    return <li className="min-w-0" key={`${reference.key}:${reference.inputName ?? ''}:${reference.outputName ?? ''}`}>
      {linked
        ? <Link className="break-all text-sm font-medium text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={`/payroll-components?component=${encodeURIComponent(reference.key)}`}>{referenceLabel(reference, components, t)}</Link>
        : <span className="break-all text-sm font-medium">{referenceLabel(reference, components, t)}</span>}
      {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
    </li>
  })}</ul>
}

function MetadataValue({ name, value }: { name: string; value: string }) {
  const isUrl = /^https?:\/\//i.test(value)
  return <div className="min-w-0">
    <dt className="break-words text-xs font-medium text-muted-foreground">{name}</dt>
    <dd className="mt-1 break-all text-sm text-foreground">
      {isUrl ? <a className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus" href={value} rel="noreferrer" target="_blank">{value}</a> : value}
    </dd>
  </div>
}

export function ComponentLibraryEntryDetail({
  entry,
  components,
  locale,
  t,
}: {
  entry: ComponentCatalogEntry
  components: readonly ComponentCatalogEntry[]
  locale: string
  t: Translator
}) {
  const definition = entry.definition
  const ownership = definition.ownership
  const versions = components
    .filter((candidate) => candidate.definition.code === definition.code)
    .sort((left, right) => left.definition.version.localeCompare(right.definition.version))
  const methodKind = definition.method.kind

  return <Surface className="space-y-6 p-4 sm:p-6">
    {entry.status === 'DRAFT' ? <p className="rounded-[var(--radius-surface)] border border-info/30 bg-info-surface p-3 text-sm text-foreground" role="status">{t('payrollComponentsDraftInactive')}</p> : null}
    <section aria-labelledby="payroll-component-overview">
      <SectionHeader title={<span id="payroll-component-overview">{t('payrollComponentsOverview')}</span>} />
      <InfoList className="mt-4" columns={2} items={[
        { label: t('payrollComponentsCode'), value: <code className="break-all font-mono text-xs">{definition.code}</code> },
        { label: t('payrollComponentsType'), value: t(`payrollComponentsMethod_${methodKind}`) },
        { label: t('payrollComponentsOwnership'), value: t(`payrollComponentsOwnership_${entry.ownership}`) },
        { label: t('payrollComponentsStatus'), value: t(`payrollComponentsStatus_${payrollComponentStatus(entry)}`) },
        { label: t('payrollComponentsVersion'), value: <span className="font-mono">{definition.version}</span> },
        { label: t('payrollComponentsCategory'), value: payrollComponentCategory(entry, t) },
        { label: t('payrollComponentsEffectiveFrom'), value: formatDate(definition.effectiveFrom, locale) },
        { label: t('payrollComponentsEffectiveTo'), value: formatDate(definition.effectiveTo, locale) },
        { label: t('payrollComponentsExecutionScope'), value: t(`payrollComponentsScope_${definition.processingScope}`) },
      ]} />
      <p className="mt-4 text-sm text-muted-foreground">{t('payrollComponentsDescriptionUnavailable')}</p>
    </section>

    <section aria-labelledby="payroll-component-inputs" className="border-t border-border-subtle pt-5">
      <SectionHeader title={<span id="payroll-component-inputs">{t('payrollComponentsInputs')}</span>} />
      {definition.inputs.length ? <dl className="mt-4 divide-y divide-border-subtle">
        {definition.inputs.map((input) => {
          const source = entry.dependencies.find((dependency) => dependency.inputName === input.name)
          return <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4" key={input.name}>
            <dt className="min-w-0"><span className="break-all font-mono text-sm">{input.name}</span><span className="ml-2 text-xs text-muted-foreground">{input.required ? t('payrollComponentsRequired') : t('payrollComponentsOptional')}</span></dt>
            <dd className="min-w-0 text-sm text-muted-foreground"><span>{t(`payrollComponentsValueType_${input.valueType}`)}</span>{source ? <span className="ml-2 break-all font-mono text-xs">← {source.componentCode}.{source.outputName}</span> : null}</dd>
          </div>
        })}
      </dl> : <p className="mt-3 text-sm text-muted-foreground">{t('payrollComponentsNoInputs')}</p>}
    </section>

    <section aria-labelledby="payroll-component-outputs" className="border-t border-border-subtle pt-5">
      <SectionHeader title={<span id="payroll-component-outputs">{t('payrollComponentsOutputs')}</span>} />
      {definition.outputs.length ? <dl className="mt-4 divide-y divide-border-subtle">
        {definition.outputs.map((output) => <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4" key={output.name}>
          <dt className="break-all font-mono text-sm">{output.name}</dt>
          <dd className="text-sm text-muted-foreground">{t(`payrollComponentsValueType_${output.valueType}`)}{output.rounding ? <span className="ml-2">· {t('payrollComponentsRounding')}: {t(`payrollComponentsRoundingMode_${output.rounding.mode}`)}, {output.rounding.scale}</span> : null}</dd>
        </div>)}
      </dl> : <p className="mt-3 text-sm text-muted-foreground">{t('payrollComponentsNoOutputs')}</p>}
    </section>

    <section aria-labelledby="payroll-component-calculation" className="border-t border-border-subtle pt-5">
      <SectionHeader title={<span id="payroll-component-calculation">{t('payrollComponentsCalculation')}</span>} />
      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">{t('payrollComponentsMethod')}</p>
        <div className="mt-2 break-words text-sm text-foreground">{methodDetails(entry, t)}</div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">{t('payrollComponentsParameters')}</p>
        {Object.keys(entry.parameters).length || Object.keys(entry.parameterMetadata ?? {}).length ? <div className="mt-2 grid gap-3 sm:grid-cols-2">{[...new Set([...Object.keys(entry.parameters), ...Object.keys(entry.parameterMetadata ?? {})])].sort().map((name) => {
          const parameter = entry.parameters[name]
          const metadata = entry.parameterMetadata?.[name]
          return <div className="min-w-0 rounded-[var(--radius-surface)] border border-border-subtle p-3" key={name}>
            <p className="break-all font-mono text-xs">{name}</p>
            {parameter ? <p className="mt-0.5 break-all text-sm">{t(`payrollComponentsValueType_${parameter.valueType}`)} · <code>{String(parameter.value)}</code></p> : null}
            {metadata ? <dl className="mt-2 grid gap-2 border-t border-border-subtle pt-2 text-xs">
                <div><dt className="text-muted-foreground">{t('payrollComponentsOfficialSymbol')}</dt><dd className="mt-0.5 break-all font-mono">{metadata.officialSymbol}</dd></div>
                <div><dt className="text-muted-foreground">{t('payrollComponentsValueType')}</dt><dd className="mt-0.5">{t(`payrollComponentsValueType_${metadata.valueType}`)}</dd></div>
                <div><dt className="text-muted-foreground">{t('payrollComponentsSourceValue')}</dt><dd className="mt-0.5 break-all"><code>{metadata.value}</code> {metadata.unit}</dd></div>
                <div><dt className="text-muted-foreground">{t('payrollComponentsParameterSource')}</dt><dd className="mt-0.5 break-words">{metadata.sourceReference}</dd></div>
              </dl> : null}
          </div>
        })}</div> : <p className="mt-2 text-sm text-muted-foreground">{t('payrollComponentsNoParameters')}</p>}
      </div>
      {entry.roundingDefinitions.length ? <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">{t('payrollComponentsRoundingDefinitions')}</p>
        <ul className="mt-2 space-y-3">{entry.roundingDefinitions.map((rounding) => <li className="min-w-0 border-l-2 border-border-subtle pl-3" key={rounding.id}>
          <p className="text-sm font-medium">{rounding.stage} · {t(`payrollComponentsRoundingMode_${rounding.mode}`)}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{rounding.decimalPlaces !== undefined ? `${rounding.decimalPlaces} · ` : ''}{rounding.targetMultiple ? `${rounding.targetMultiple} · ` : ''}{rounding.effectiveFrom} – {rounding.effectiveTo ?? '—'}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{rounding.provenance.sourceReference}</p>
        </li>)}</ul>
      </div> : <p className="mt-4 text-sm text-muted-foreground">{t('payrollComponentsNoRounding')}</p>}
    </section>

    <section aria-labelledby="payroll-component-dependencies" className="border-t border-border-subtle pt-5">
      <SectionHeader title={<span id="payroll-component-dependencies">{t('payrollComponentsDependencies')}</span>} />
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div><p className="text-xs font-medium text-muted-foreground">{t('payrollComponentsUpstream')}</p><div className="mt-2"><ReferenceList components={components} emptyLabel={t('payrollComponentsNoUpstream')} references={entry.upstream} t={t} /></div></div>
        <div><p className="text-xs font-medium text-muted-foreground">{t('payrollComponentsDownstream')}</p><div className="mt-2"><ReferenceList components={components} emptyLabel={t('payrollComponentsNoDownstream')} references={entry.downstream} t={t} /></div></div>
      </div>
      {!entry.dependencies.length ? <p className="mt-4 text-sm text-muted-foreground">{t('payrollComponentsNoDependencies')}</p> : null}
      {!entry.validation.valid ? <div className="mt-4 rounded-[var(--radius-surface)] border border-warning bg-warning-surface p-3" role="status">
        <p className="text-sm font-medium text-foreground">{t('payrollComponentsValidationWarning')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('payrollComponentsValidationIssues')}: {entry.validation.issues.map((issue) => issue.code).join(', ')}</p>
      </div> : null}
    </section>

    <section aria-labelledby="payroll-component-versions" className="border-t border-border-subtle pt-5">
      <SectionHeader title={<span id="payroll-component-versions">{t('payrollComponentsVersions')}</span>} />
      {versions.length ? <ul className="mt-4 space-y-2">{versions.map((version) => <li className="flex min-w-0 flex-wrap items-center gap-2" key={version.key}>
        {version.key === entry.key ? <Badge tone="info">v{version.definition.version}</Badge> : <Link className="font-mono text-sm text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus" href={`/payroll-components?component=${encodeURIComponent(version.key)}`}>v{version.definition.version}</Link>}
        <span className="break-all text-xs text-muted-foreground">{formatDate(version.definition.effectiveFrom, locale)} – {formatDate(version.definition.effectiveTo, locale)}</span>
        <span className="break-all text-xs text-muted-foreground">{version.package.version ?? version.package.compositionId}</span>
      </li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{t('payrollComponentsNoVersions')}</p>}
    </section>

    <section aria-labelledby="payroll-component-provenance" className="border-t border-border-subtle pt-5">
      <SectionHeader title={<span id="payroll-component-provenance">{t('payrollComponentsProvenance')}</span>} />
      <InfoList className="mt-4" columns={2} items={[
        { label: t('payrollComponentsOwnership'), value: t(`payrollComponentsOwnership_${entry.ownership}`) },
        { label: t(ownership.kind === 'CUSTOMER_FORK' ? 'payrollComponentsSourcePackage' : 'payrollComponentsPackage'), value: entry.package.packageId ?? entry.package.compositionId },
        { label: t(ownership.kind === 'CUSTOMER_FORK' ? 'payrollComponentsSourcePackageVersion' : 'payrollComponentsPackageVersion'), value: entry.package.version ?? '—' },
        { label: t(ownership.kind === 'CUSTOMER_FORK' ? 'payrollComponentsSourcePackageHash' : 'payrollComponentsPackageHash'), value: entry.package.packageHash ? <code className="break-all font-mono text-xs">{entry.package.packageHash}</code> : '—' },
        ...(ownership.kind === 'CUSTOMER_FORK' ? [
          { label: t('payrollComponentsOrigin'), value: <span className="break-all font-mono text-xs">{ownership.origin.code} v{ownership.origin.version}</span> },
          { label: t('payrollComponentsForkedAt'), value: formatDateTime(ownership.forkedAt, locale) },
        ] : []),
      ]} />
      {entry.sourceMetadata && Object.keys(entry.sourceMetadata).length ? <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{Object.entries(entry.sourceMetadata).map(([name, value]) => <MetadataValue key={name} name={name} value={value} />)}</dl> : <p className="mt-4 text-sm text-muted-foreground">{t('payrollComponentsNoSourceMetadata')}</p>}
    </section>
  </Surface>
}
