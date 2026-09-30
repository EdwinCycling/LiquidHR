export type PayrollJsonValue =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: PayrollJsonValue | undefined }
  | readonly PayrollJsonValue[]

export interface PayrollPeriodReference {
  readonly year: number
  readonly month: number
}

export interface PayrollSourceProviderInput {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationId: string
  readonly employeeId: string
  readonly payrollPeriod: PayrollPeriodReference
}

export type PayrollSourceGapStatus = 'SOURCE_GAP' | 'UNSUPPORTED'

export interface PayrollSourceGap {
  readonly field: string
  readonly status: PayrollSourceGapStatus
  readonly reasonCode: string
}

export interface PayrollSourceProvider {
  getPayrollSourceSnapshot(input: PayrollSourceProviderInput): Promise<PayrollSourceSnapshot>
}

/** Canonical LiquidHR source data only; rule and engine versions belong to an input set. */
export interface PayrollSourceSnapshot {
  readonly id: string
  readonly sourceTenantId: string
  readonly sourceHrGroupId: string
  readonly sourceAdministrationId: string
  readonly sourceEmployeeId: string
  readonly sourceEmploymentId: string
  readonly sourceIncomeRelationshipId: string | null
  readonly periodReference: PayrollPeriodReference
  readonly canonicalSource: PayrollJsonValue
  readonly sourceVersionVector: Readonly<Record<string, string>>
  readonly sourceGaps: readonly PayrollSourceGap[]
  readonly sourceHash: string
  readonly createdAt: string
}

/** A source snapshot may be replayed under another rule composition or engine version. */
export interface CalculationInputSet {
  readonly id: string
  readonly sourceSnapshotId: string
  readonly payrollPeriodId: string
  readonly rulePackageCompositionId: string
  readonly engineVersion: string
  readonly inputHash: string
  readonly createdAt: string
}

export interface CalculationRun {
  readonly id: string
  readonly calculationInputSetId: string
  readonly runType: string
  readonly status: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly resultHash: string | null
}
