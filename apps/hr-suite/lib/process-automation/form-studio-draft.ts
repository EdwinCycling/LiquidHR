import type { FieldBinding, FieldDefinition, FieldType } from './definition-schemas'
import { defaultOptionsForFieldType } from './form-field-catalog'
import { bindingAllowsWrite, bindingCatalogEntry, bindingCatalogForFieldType } from './form-binding-catalog'

export function uniqueDefinitionKey(base: string, usedKeys: readonly string[]): string {
  const used = new Set(usedKeys)
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(base + '-' + suffix)) suffix += 1
  return base + '-' + suffix
}

export function reorderDefinitionItems<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset
  if (index < 0 || target < 0 || target >= items.length) return [...items]
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function duplicateDefinitionField(field: FieldDefinition, usedKeys: readonly string[], copySuffix: string): FieldDefinition {
  const key = uniqueDefinitionKey(field.key + '-copy', usedKeys)
  return {
    ...field,
    key,
    label: {
      nl: (field.label.nl ?? field.label.en ?? 'Nieuw veld') + ' (' + copySuffix + ')',
      en: (field.label.en ?? field.label.nl ?? 'New field') + ' (' + copySuffix + ')',
    },
    ...(field.options ? { options: field.options.map((option) => ({ ...option, label: { ...option.label } })) } : {}),
    access: field.access.map((rule) => ({ ...rule })),
  }
}

export function changeDefinitionFieldType(field: FieldDefinition, type: FieldType): FieldDefinition {
  const currentEntry = bindingCatalogEntry(field.binding)
  const compatible = bindingCatalogForFieldType(type).some((entry) => entry.id === currentEntry?.id)
  const binding: FieldBinding = compatible ? field.binding : { kind: 'PROCESS_ONLY' }
  const access = bindingAllowsWrite(binding.kind)
    ? field.access
    : field.access.map((rule) => rule.mode === 'WRITE_OPTIONAL' || rule.mode === 'WRITE_REQUIRED' ? { ...rule, mode: 'READ' as const } : rule)
  return { ...field, type, binding, access, options: defaultOptionsForFieldType(type) }
}
