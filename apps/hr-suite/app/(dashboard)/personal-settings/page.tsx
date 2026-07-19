import type { SettingsModalLabels } from '@/components/layout/settings-modal'
import { PersonalSettingsForm } from '@/components/settings/personal-settings-form'
import { getTranslator } from '@/lib/i18n/server'
import { getUserPreferences } from '@/lib/preferences/server'

export default async function PersonalSettingsPage() {
  const [preferences, settings, common] = await Promise.all([getUserPreferences(), getTranslator('settings'), getTranslator('common')])
  const labels: SettingsModalLabels = {
    open: settings('open'), close: settings('close'), title: settings('title'),
    language: settings('language'), languageHelp: settings('languageHelp'), dutch: settings('dutch'), english: settings('english'),
    theme: settings('theme'), themeHelp: settings('themeHelp'), clock: settings('clock'), clockHelp: settings('clockHelp'),
    analog: settings('analog'), digital: settings('digital'), hidden: settings('hidden'), clockStyle: settings('clockStyle'),
    classic: settings('classic'), minimal: settings('minimal'), liquid: settings('liquid'), appearanceTab: settings('appearanceTab'),
    dateFormat: settings('dateFormat'), dateFormatHelp: settings('dateFormatHelp'), dmy: settings('dmy'), mdy: settings('mdy'), ymd: settings('ymd'),
    timeFormat: settings('timeFormat'), timeFormatHelp: settings('timeFormatHelp'), time24: settings('time24'), time12: settings('time12'),
    weekNumbering: settings('weekNumbering'), weekNumberingHelp: settings('weekNumberingHelp'), weekNumberingInternational: settings('weekNumberingInternational'), weekNumberingIso: settings('weekNumberingIso'),
    timeHubTab: settings('timeHubTab'), clockPreview: settings('clockPreview'), save: common('save'), cancel: common('cancel'),
    saving: settings('saving'), saved: settings('saved'), saveFailed: settings('saveFailed'), invalid: settings('invalid'), unauthenticated: settings('unauthenticated'),
    themes: Object.fromEntries(UI_THEME_KEYS.map((value) => [value, { name: settings(`themes.${value}`), description: settings(`themeDescriptions.${value}`) }])) as SettingsModalLabels['themes'],
  }
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">
      <header className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{settings('personalEyebrow')}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.title}</h1>
      </header>
      <PersonalSettingsForm labels={labels} preferences={preferences} />
    </div>
  )
}

const UI_THEME_KEYS = ['liquid-navy', 'noordzee', 'bos', 'warm-zand', 'aubergine', 'nacht'] as const
