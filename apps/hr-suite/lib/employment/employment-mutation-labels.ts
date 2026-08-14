const nestedTranslationKeys: Readonly<Record<string, string>> = {
  salaryApplicationScheme: 'salaryApplication.scheme',
  salaryMinimumScheme: 'salaryApplication.scheme',
  salaryBand: 'salaryApplication.salaryBand',
  salaryRegular: 'salaryApplication.regular',
  salaryBbl: 'salaryApplication.bbl',
  salaryApplicationExternalAmount: 'salaryApplication.externalAmount',
  salaryBandMinimum: 'salaryApplication.bandMinimum',
  salaryBandMidpoint: 'salaryApplication.bandMidpoint',
  salaryBandMaximum: 'salaryApplication.bandMaximum',
  salaryOpenEnded: 'salaryApplication.openEnded',
  compaRatio: 'salaryApplication.compaRatio',
  rangePenetration: 'salaryApplication.rangePenetration',
  status: 'salaryApplication.status',
  underMinimum: 'salaryApplication.underMinimum',
  withinRange: 'salaryApplication.withinRange',
  aboveMaximum: 'salaryApplication.aboveMaximum',
  noValidBand: 'salaryApplication.noValidBand',
}

export function employmentMutationTranslationKey(key: string): string {
  return nestedTranslationKeys[key] ?? key
}
