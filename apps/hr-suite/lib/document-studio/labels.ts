import type { Translator } from '@/lib/i18n/translator'

export function createDocumentStudioLabels(t: Translator) {
  const categoryCodes = ['EMPLOYMENT', 'COMPENSATION', 'ABSENCE_LEAVE', 'PERFORMANCE_DEVELOPMENT', 'ONBOARDING', 'OFFBOARDING', 'POLICY_COMPLIANCE', 'GENERAL'] as const
  const kindCodes = ['DOCUMENT', 'COVER', 'APPENDIX'] as const
  return {
    library: {
      title: t('library.title'), new: t('library.new'), types: t('library.types'), profiles: t('library.profiles'), empty: t('library.empty'),
      name: t('library.name'), kind: t('library.kind'), language: t('library.language'), category: t('library.category'), status: t('library.status'),
      version: t('library.version'), updated: t('library.updated'), draft: t('library.draft'), active: t('library.active'), archived: t('library.archived'), open: t('library.open'),
      categories: Object.fromEntries(categoryCodes.map((code) => [code, t(`categories.${code}`)])),
      kinds: Object.fromEntries(kindCodes.map((code) => [code, t(`kinds.${code}`)])),
    },
    create: {
      title: t('create.title'), templateKey: t('create.templateKey'), name: t('create.name'), description: t('create.description'), kind: t('create.kind'), language: t('create.language'),
      documentType: t('create.documentType'), profile: t('create.profile'), category: t('create.category'), defaultDossier: t('create.defaultDossier'), save: t('create.save'), cancel: t('create.cancel'), failed: t('create.failed'), noOptions: t('create.noOptions'),
      categories: Object.fromEntries(categoryCodes.map((code) => [code, t(`categories.${code}`)])), kinds: Object.fromEntries(kindCodes.map((code) => [code, t(`kinds.${code}`)])),
    },
    editor: {
      title: t('editor.title'), back: t('editor.back'), save: t('editor.save'), saved: t('editor.saved'), activate: t('editor.activate'), archive: t('editor.archive'), discard: t('editor.discard'), revision: t('editor.revision'), dirty: t('editor.dirty'), clean: t('editor.clean'), content: t('editor.content'), metadata: t('editor.metadata'), composition: t('editor.composition'), validation: t('editor.validation'), valid: t('editor.valid'), invalid: t('editor.invalid'), validate: t('editor.validate'), activationConfirm: t('editor.activationConfirm'), archiveConfirm: t('editor.archiveConfirm'), conflict: t('editor.conflict'), failed: t('editor.failed'), tags: t('editor.tags'), tagSearch: t('editor.tagSearch'), tagEmpty: t('editor.tagEmpty'), tagNoOptions: t('editor.tagNoOptions'), tagSelected: t('editor.tagSelected'), tagSave: t('editor.tagSave'), tagSaved: t('editor.tagSaved'),
      name: t('create.name'), description: t('create.description'), documentType: t('create.documentType'), profile: t('create.profile'), category: t('create.category'), defaultDossier: t('create.defaultDossier'),
      categories: Object.fromEntries(categoryCodes.map((code) => [code, t(`categories.${code}`)])), kinds: Object.fromEntries(kindCodes.map((code) => [code, t(`kinds.${code}`)])),
      toolbar: { bold: t('toolbar.bold'), italic: t('toolbar.italic'), underline: t('toolbar.underline'), heading: t('toolbar.heading'), bulletList: t('toolbar.bulletList'), orderedList: t('toolbar.orderedList'), rule: t('toolbar.rule'), pageBreak: t('toolbar.pageBreak'), columns: t('toolbar.columns'), placeholder: t('toolbar.placeholder'), placeholderField: t('toolbar.placeholderField') },
    },
    types: { title: t('types.title'), subtitle: t('types.subtitle'), new: t('types.new'), code: t('types.code'), name: t('types.name'), retention: t('types.retention'), permanent: t('types.permanent'), years: t('types.years'), empty: t('types.empty'), save: t('types.save'), cancel: t('types.cancel'), failed: t('types.failed') },
    profiles: { title: t('profiles.title'), subtitle: t('profiles.subtitle'), new: t('profiles.new'), name: t('profiles.name'), administration: t('profiles.administration'), default: t('profiles.default'), empty: t('profiles.empty'), save: t('profiles.save'), cancel: t('profiles.cancel'), failed: t('profiles.failed') },
  }
}
