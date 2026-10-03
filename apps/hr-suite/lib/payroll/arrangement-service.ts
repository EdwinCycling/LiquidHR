import 'server-only'

import { randomUUID } from 'node:crypto'
import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'
import {
  ARRANGEMENT_PACKAGES,
  ArrangementFoundationError,
  buildCalculationCompositionSnapshot,
  getSyntheticArrangementFixture,
  isIsoDate,
  validateArrangementSelection,
  type ArrangementPackage,
  type CalculationCompositionSnapshot,
} from './arrangement-foundation'
import { requireComponentLibraryAccess } from './component-library-access'
import type {
  PayrollArrangementAssignmentRow,
  PayrollArrangementAvailabilityRow,
  PayrollArrangementCompositionSnapshotRow,
  PayrollJson,
} from './database'
import { ArrangementRepositoryError, createArrangementRepository, type ArrangementRepository } from './arrangement-repository'

type AuthorizedArrangementContext = Awaited<ReturnType<typeof requireComponentLibraryAccess>>

export type ArrangementServiceErrorCode =
  | 'ARRANGEMENT_DATA_INVALID'
  | 'ARRANGEMENT_NOT_AVAILABLE'
  | 'ARRANGEMENT_ASSIGNMENT_MISSING'
  | 'ARRANGEMENT_ASSIGNMENT_ALREADY_EXISTS'
  | 'ARRANGEMENT_SNAPSHOT_ALREADY_EXISTS'
  | 'ARRANGEMENT_STORAGE_UNAVAILABLE'
  | 'ARRANGEMENT_SCOPE_MISMATCH'
  | 'ARRANGEMENT_INVALID_REQUEST'
  | 'ARRANGEMENT_FIXTURE_NOT_AVAILABLE'

export class ArrangementServiceError extends Error {
  constructor(readonly code: ArrangementServiceErrorCode) {
    super(code)
    this.name = 'ArrangementServiceError'
  }
}

export interface ArrangementServiceDependencies {
  readonly requireAccess: (write: boolean) => Promise<AuthorizedArrangementContext>
  readonly repository?: ArrangementRepository
  readonly createId: () => string
  readonly now: () => string
}

const defaultDependencies: Omit<ArrangementServiceDependencies, 'repository'> = {
  requireAccess: requireComponentLibraryAccess,
  createId: randomUUID,
  now: () => new Date().toISOString(),
}

function dependenciesWithDefaults(dependencies?: Partial<ArrangementServiceDependencies>): ArrangementServiceDependencies {
  return {
    requireAccess: dependencies?.requireAccess ?? defaultDependencies.requireAccess,
    repository: dependencies?.repository,
    createId: dependencies?.createId ?? defaultDependencies.createId,
    now: dependencies?.now ?? defaultDependencies.now,
  }
}

interface ArrangementState {
  readonly availability: readonly PayrollArrangementAvailabilityRow[]
  readonly assignments: readonly PayrollArrangementAssignmentRow[]
  readonly snapshots: readonly PayrollArrangementCompositionSnapshotRow[]
}

function sameScope(row: {
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
}, context: AuthorizedArrangementContext): boolean {
  return row.payroll_administration_id === context.administration.id
    && row.source_tenant_id === context.scope.tenantId
    && row.source_hr_group_id === context.scope.hrGroupId
    && row.source_administration_id === context.scope.administrationId
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function availabilityIncludesDate(row: PayrollArrangementAvailabilityRow, date: string): boolean {
  return isIsoDate(date)
    && row.effective_from <= date
    && (row.effective_to === null || date <= row.effective_to)
}

function isValidPackageVersionSnapshot(arrangement: Record<string, unknown>, salaryStrategy: string, asOfDate: string): boolean {
  const packageId = arrangement.packageId
  const kind = arrangement.kind
  const version = arrangement.version
  const effectiveFrom = arrangement.effectiveFrom
  const effectiveTo = arrangement.effectiveTo
  const packageVersionHash = arrangement.packageVersionHash
  const supportedSalaryStrategies = arrangement.supportedSalaryStrategies
  const sourceMetadata = arrangement.sourceMetadata
  if (typeof packageId !== 'string' || packageId.length === 0
    || (kind !== 'COLLECTIVE_AGREEMENT' && kind !== 'COMPANY_POLICY')
    || typeof arrangement.displayName !== 'string' || arrangement.displayName.length === 0
    || typeof version !== 'string' || version.length === 0
    || typeof effectiveFrom !== 'string' || !isIsoDate(effectiveFrom)
    || (effectiveTo !== null && (typeof effectiveTo !== 'string' || !isIsoDate(effectiveTo) || effectiveTo < effectiveFrom))
    || effectiveFrom > asOfDate || (effectiveTo !== null && asOfDate > effectiveTo)
    || typeof packageVersionHash !== 'string' || !/^[0-9a-f]{64}$/.test(packageVersionHash)
    || !Array.isArray(supportedSalaryStrategies) || !supportedSalaryStrategies.includes(salaryStrategy)
    || !isRecord(sourceMetadata)
    || typeof sourceMetadata.sourceTitle !== 'string'
    || typeof sourceMetadata.sourceUrl !== 'string'
    || typeof sourceMetadata.recordedOn !== 'string' || !isIsoDate(sourceMetadata.recordedOn)
    || (sourceMetadata.status !== 'REFERENCE_ONLY' && sourceMetadata.status !== 'SYNTHETIC_POLICY')
    || typeof sourceMetadata.note !== 'string') return false

  return sha256(stableSerialize({
    packageId,
    packageKind: kind,
    version,
    effectiveFrom,
    effectiveTo,
    supportedSalaryStrategies,
    sourceMetadata,
  })) === packageVersionHash
}

function assertSnapshotRow(
  row: PayrollArrangementCompositionSnapshotRow,
  context: AuthorizedArrangementContext,
  assignment: PayrollArrangementAssignmentRow,
): CalculationCompositionSnapshot {
  const content = row.snapshot_json
  const primaryAssignment = isRecord(content) && isRecord(content.primaryAssignment) ? content.primaryAssignment : null
  const arrangement = isRecord(content) && isRecord(content.arrangement) ? content.arrangement : null
  if (!sameScope(row, context)
    || row.assignment_id !== assignment.id
    || row.source_employment_id !== assignment.source_employment_id
    || !isIsoDate(row.as_of_date)
    || !isRecord(content)
    || content.schemaVersion !== 'ARRANGEMENT_COMPOSITION_V1'
    || content.asOfDate !== row.as_of_date
    || !isRecord(content.scope)
    || content.scope.tenantId !== context.scope.tenantId
    || content.scope.hrGroupId !== context.scope.hrGroupId
    || content.scope.administrationId !== context.scope.administrationId
    || content.scope.payrollAdministrationId !== context.administration.id
    || !isRecord(content.employment)
    || content.employment.source !== 'SYNTHETIC_FIXTURE'
    || content.employment.sourceEmploymentId !== assignment.source_employment_id
    || content.employment.fixtureCode !== assignment.fixture_code
    || !primaryAssignment
    || primaryAssignment.id !== assignment.id
    || primaryAssignment.packageId !== assignment.package_id
    || primaryAssignment.salaryStrategy !== assignment.salary_strategy
    || primaryAssignment.effectiveFrom !== assignment.effective_from
    || primaryAssignment.effectiveTo !== assignment.effective_to
    || !arrangement
    || arrangement.packageId !== assignment.package_id
    || !isValidPackageVersionSnapshot(arrangement, assignment.salary_strategy, row.as_of_date)
    || content.calculationStatus !== 'FOUNDATION_ONLY'
    || sha256(stableSerialize(content)) !== row.snapshot_hash) {
    throw new ArrangementServiceError('ARRANGEMENT_DATA_INVALID')
  }
  return content as unknown as CalculationCompositionSnapshot
}

async function readState(
  context: AuthorizedArrangementContext,
  repository: ArrangementRepository,
): Promise<ArrangementState> {
  const [availability, assignments, snapshots] = await Promise.all([
    repository.listAvailability(context.scope, context.administration.id),
    repository.listAssignments(context.scope, context.administration.id),
    repository.listCompositionSnapshots(context.scope, context.administration.id),
  ])
  const availablePackageIds = new Set<string>()
  for (const row of availability) {
    if (!sameScope(row, context)
      || typeof row.package_id !== 'string' || row.package_id.trim().length === 0
      || !isIsoDate(row.effective_from)
      || (row.effective_to !== null && (!isIsoDate(row.effective_to) || row.effective_to < row.effective_from))
      || ((row.updated_at === null) !== (row.updated_by_user_id === null))
      || availablePackageIds.has(row.package_id)) {
      throw new ArrangementServiceError('ARRANGEMENT_DATA_INVALID')
    }
    availablePackageIds.add(row.package_id)
  }

  const assignmentsById = new Map<string, PayrollArrangementAssignmentRow>()
  const assignmentsByFixture = new Set<string>()
  const assignmentsByEmployment = new Set<string>()
  for (const row of assignments) {
    const fixture = getSyntheticArrangementFixture(row.fixture_code)
    if (!sameScope(row, context)
      || !fixture
      || fixture.sourceEmploymentId !== row.source_employment_id
      || fixture.salaryStrategy !== row.salary_strategy
      || !fixture.allowedPackageIds.includes(row.package_id)
      || !availablePackageIds.has(row.package_id)
      || !availabilityIncludesDate(availability.find((item) => item.package_id === row.package_id)!, row.effective_from)
      || !row.is_primary
      || !isIsoDate(row.effective_from)
      || (row.effective_to !== null && (!isIsoDate(row.effective_to) || row.effective_to < row.effective_from))
      || assignmentsById.has(row.id)
      || assignmentsByFixture.has(row.fixture_code)
      || assignmentsByEmployment.has(row.source_employment_id)) {
      throw new ArrangementServiceError('ARRANGEMENT_DATA_INVALID')
    }
    assignmentsById.set(row.id, row)
    assignmentsByFixture.add(row.fixture_code)
    assignmentsByEmployment.add(row.source_employment_id)
  }

  for (const row of snapshots) {
    const assignment = assignmentsById.get(row.assignment_id)
    if (!assignment) {
      throw new ArrangementServiceError('ARRANGEMENT_DATA_INVALID')
    }
    assertSnapshotRow(row, context, assignment)
  }
  return { availability, assignments, snapshots }
}

function packageAvailabilityInsert(
  context: AuthorizedArrangementContext,
  packageId: string,
  effectiveFrom: string,
  effectiveTo: string | null,
  createdAt: string,
  id: string,
): PayrollArrangementAvailabilityRow {
  return {
    id,
    payroll_administration_id: context.administration.id,
    source_tenant_id: context.scope.tenantId,
    source_hr_group_id: context.scope.hrGroupId,
    source_administration_id: context.scope.administrationId,
    package_id: packageId,
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    created_at: createdAt,
    created_by_user_id: context.actorUserId,
    updated_at: null,
    updated_by_user_id: null,
  }
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof ArrangementServiceError) throw error
  if (error instanceof ArrangementRepositoryError) {
    if (error.code === 'ARRANGEMENT_ASSIGNMENT_ALREADY_EXISTS') {
      throw new ArrangementServiceError('ARRANGEMENT_ASSIGNMENT_ALREADY_EXISTS')
    }
    if (error.code === 'ARRANGEMENT_SNAPSHOT_ALREADY_EXISTS') {
      throw new ArrangementServiceError('ARRANGEMENT_SNAPSHOT_ALREADY_EXISTS')
    }
    if (error.code === 'ARRANGEMENT_NOT_AVAILABLE') throw new ArrangementServiceError('ARRANGEMENT_NOT_AVAILABLE')
    throw new ArrangementServiceError('ARRANGEMENT_STORAGE_UNAVAILABLE')
  }
  if (error instanceof ArrangementFoundationError) throw error
  throw new ArrangementServiceError('ARRANGEMENT_STORAGE_UNAVAILABLE')
}

export interface ArrangementFoundationPageData {
  readonly administrationName: string
  readonly today: string
  readonly packages: readonly {
    readonly definition: ArrangementPackage
    readonly availability: PayrollArrangementAvailabilityRow | null
    readonly available: boolean
  }[]
  readonly assignments: readonly PayrollArrangementAssignmentRow[]
  readonly snapshots: readonly { readonly row: PayrollArrangementCompositionSnapshotRow; readonly content: CalculationCompositionSnapshot }[]
  readonly canWrite: boolean
}

export async function loadArrangementFoundationPage(
  dependencies?: Partial<ArrangementServiceDependencies>,
): Promise<ArrangementFoundationPageData> {
  const resolved = dependenciesWithDefaults(dependencies)
  const context = await resolved.requireAccess(false)
  const repository = resolved.repository ?? createArrangementRepository()
  try {
    const state = await readState(context, repository)
    const assignmentMap = new Map(state.assignments.map((assignment) => [assignment.id, assignment]))
    return {
      administrationName: context.administration.displayName,
      today: resolved.now().slice(0, 10),
      packages: ARRANGEMENT_PACKAGES.map((definition) => ({
        definition,
        availability: state.availability.find((row) => row.package_id === definition.id) ?? null,
        available: state.availability.some((row) => row.package_id === definition.id
          && availabilityIncludesDate(row, resolved.now().slice(0, 10))),
      })),
      assignments: state.assignments,
      snapshots: state.snapshots.map((row) => {
        const assignment = assignmentMap.get(row.assignment_id)
        if (!assignment) throw new ArrangementServiceError('ARRANGEMENT_DATA_INVALID')
        return { row, content: assertSnapshotRow(row, context, assignment) }
      }),
      canWrite: context.canCopy,
    }
  } catch (error) {
    mapRepositoryError(error)
  }
}

export async function isArrangementFoundationStorageReady(
  context: AuthorizedArrangementContext,
  repository?: ArrangementRepository,
): Promise<boolean> {
  try {
    await readState(context, repository ?? createArrangementRepository())
    return true
  } catch {
    return false
  }
}

export async function makeArrangementPackagesAvailable(
  input: { readonly effectiveFrom: string; readonly effectiveTo: string | null },
  dependencies?: Partial<ArrangementServiceDependencies>,
): Promise<void> {
  const resolved = dependenciesWithDefaults(dependencies)
  const context = await resolved.requireAccess(true)
  const repository = resolved.repository ?? createArrangementRepository()
  try {
    if (!isIsoDate(input.effectiveFrom)
      || (input.effectiveTo !== null && (!isIsoDate(input.effectiveTo) || input.effectiveTo < input.effectiveFrom))) {
      throw new ArrangementServiceError('ARRANGEMENT_INVALID_REQUEST')
    }
    const existing = (await readState(context, repository)).availability
    const availablePackageIds = new Set(existing.map((row) => row.package_id))
    for (const arrangementPackage of ARRANGEMENT_PACKAGES) {
      if (availablePackageIds.has(arrangementPackage.id)) continue
      try {
        await repository.insertAvailability(
          context.scope,
          context.administration.id,
          packageAvailabilityInsert(context, arrangementPackage.id, input.effectiveFrom, input.effectiveTo, resolved.now(), resolved.createId()),
        )
      } catch (error) {
        if (!(error instanceof ArrangementRepositoryError) || error.code !== 'ARRANGEMENT_AVAILABILITY_ALREADY_EXISTS') throw error
      }
    }
  } catch (error) {
    mapRepositoryError(error)
  }
}

export async function createSyntheticArrangementAssignment(input: {
  readonly fixtureCode: string
  readonly packageId: string
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
}, dependencies?: Partial<ArrangementServiceDependencies>): Promise<PayrollArrangementAssignmentRow> {
  const resolved = dependenciesWithDefaults(dependencies)
  const context = await resolved.requireAccess(true)
  const repository = resolved.repository ?? createArrangementRepository()
  try {
    const state = await readState(context, repository)
    const fixture = getSyntheticArrangementFixture(input.fixtureCode)
    if (!fixture) throw new ArrangementServiceError('ARRANGEMENT_FIXTURE_NOT_AVAILABLE')
    const availability = state.availability.find((row) => row.package_id === input.packageId)
    const selectedOn = resolved.now().slice(0, 10)
    if (!availability
      || !availabilityIncludesDate(availability, input.effectiveFrom)
      || !availabilityIncludesDate(availability, selectedOn)) {
      throw new ArrangementServiceError('ARRANGEMENT_NOT_AVAILABLE')
    }
    const selection = validateArrangementSelection({
      fixtureCode: input.fixtureCode,
      packageId: input.packageId,
      salaryStrategy: fixture.salaryStrategy,
    })
    if (!state.availability.some((row) => row.package_id === selection.arrangementPackage.id
      && availabilityIncludesDate(row, input.effectiveFrom)
      && availabilityIncludesDate(row, selectedOn))) {
      throw new ArrangementServiceError('ARRANGEMENT_NOT_AVAILABLE')
    }
    if (state.assignments.some((row) => row.source_employment_id === fixture.sourceEmploymentId)) {
      throw new ArrangementServiceError('ARRANGEMENT_ASSIGNMENT_ALREADY_EXISTS')
    }
    if (!isIsoDate(input.effectiveFrom)
      || input.effectiveFrom !== fixture.effectiveFrom
      || (input.effectiveTo !== null && (!isIsoDate(input.effectiveTo) || input.effectiveTo < input.effectiveFrom))) {
      throw new ArrangementServiceError('ARRANGEMENT_INVALID_REQUEST')
    }

    const row = await repository.insertAssignment(context.scope, context.administration.id, {
      id: resolved.createId(),
      payroll_administration_id: context.administration.id,
      source_tenant_id: context.scope.tenantId,
      source_hr_group_id: context.scope.hrGroupId,
      source_administration_id: context.scope.administrationId,
      source_employment_id: fixture.sourceEmploymentId,
      fixture_code: fixture.code,
      package_id: selection.arrangementPackage.id,
      salary_strategy: fixture.salaryStrategy,
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo,
      is_primary: true,
      created_at: resolved.now(),
      created_by_user_id: context.actorUserId,
    })
    if (!sameScope(row, context) || row.source_employment_id !== fixture.sourceEmploymentId
      || row.package_id !== selection.arrangementPackage.id || !row.is_primary) {
      throw new ArrangementServiceError('ARRANGEMENT_DATA_INVALID')
    }
    return row
  } catch (error) {
    mapRepositoryError(error)
  }
}

export async function createArrangementCompositionSnapshot(input: {
  readonly fixtureCode: string
  readonly asOfDate: string
}, dependencies?: Partial<ArrangementServiceDependencies>): Promise<PayrollArrangementCompositionSnapshotRow> {
  const resolved = dependenciesWithDefaults(dependencies)
  const context = await resolved.requireAccess(true)
  const repository = resolved.repository ?? createArrangementRepository()
  try {
    const state = await readState(context, repository)
    const fixture = getSyntheticArrangementFixture(input.fixtureCode)
    if (!fixture) throw new ArrangementServiceError('ARRANGEMENT_FIXTURE_NOT_AVAILABLE')
    const assignments = state.assignments.filter((row) => row.source_employment_id === fixture.sourceEmploymentId)
    if (assignments.length !== 1) throw new ArrangementServiceError('ARRANGEMENT_ASSIGNMENT_MISSING')
    const assignment = assignments[0]!
    const composition = buildCalculationCompositionSnapshot({
      tenantId: context.scope.tenantId,
      hrGroupId: context.scope.hrGroupId,
      administrationId: context.scope.administrationId,
      payrollAdministrationId: context.administration.id,
      assignmentId: assignment.id,
      fixtureCode: assignment.fixture_code,
      sourceEmploymentId: assignment.source_employment_id,
      packageId: assignment.package_id,
      salaryStrategy: assignment.salary_strategy,
      assignmentEffectiveFrom: assignment.effective_from,
      assignmentEffectiveTo: assignment.effective_to,
      asOfDate: input.asOfDate,
    })

    const existing = await repository.findCompositionSnapshot(
      context.scope,
      context.administration.id,
      assignment.id,
      input.asOfDate,
      composition.contentHash,
    )
    if (existing) {
      assertSnapshotRow(existing, context, assignment)
      return existing
    }

    try {
      const row = await repository.insertCompositionSnapshot(context.scope, context.administration.id, {
        id: resolved.createId(),
        payroll_administration_id: context.administration.id,
        source_tenant_id: context.scope.tenantId,
        source_hr_group_id: context.scope.hrGroupId,
        source_administration_id: context.scope.administrationId,
        source_employment_id: assignment.source_employment_id,
        assignment_id: assignment.id,
        as_of_date: input.asOfDate,
        snapshot_json: JSON.parse(stableSerialize(composition.content)) as PayrollJson,
        snapshot_hash: composition.contentHash,
        created_at: resolved.now(),
        created_by_user_id: context.actorUserId,
      })
      assertSnapshotRow(row, context, assignment)
      return row
    } catch (error) {
      if (!(error instanceof ArrangementRepositoryError) || error.code !== 'ARRANGEMENT_SNAPSHOT_ALREADY_EXISTS') throw error
      const replay = await repository.findCompositionSnapshot(
        context.scope,
        context.administration.id,
        assignment.id,
        input.asOfDate,
        composition.contentHash,
      )
      if (!replay) throw error
      assertSnapshotRow(replay, context, assignment)
      return replay
    }
  } catch (error) {
    mapRepositoryError(error)
  }
}

export async function endArrangementPackageAvailability(input: {
  readonly packageId: string
  readonly effectiveTo: string
}, dependencies?: Partial<ArrangementServiceDependencies>): Promise<PayrollArrangementAvailabilityRow> {
  const resolved = dependenciesWithDefaults(dependencies)
  const context = await resolved.requireAccess(true)
  const repository = resolved.repository ?? createArrangementRepository()
  try {
    const state = await readState(context, repository)
    const availability = state.availability.find((row) => row.package_id === input.packageId)
    if (!availability || !isIsoDate(input.effectiveTo)
      || input.effectiveTo < availability.effective_from
      || (availability.effective_to !== null && input.effectiveTo >= availability.effective_to)) {
      throw new ArrangementServiceError('ARRANGEMENT_INVALID_REQUEST')
    }
    const latestAssignmentStart = state.assignments
      .filter((row) => row.package_id === input.packageId)
      .reduce((latest, row) => row.effective_from > latest ? row.effective_from : latest, availability.effective_from)
    if (input.effectiveTo < latestAssignmentStart) throw new ArrangementServiceError('ARRANGEMENT_INVALID_REQUEST')
    return await repository.endAvailability(
      context.scope,
      context.administration.id,
      input.packageId,
      input.effectiveTo,
      resolved.now(),
      context.actorUserId,
    )
  } catch (error) {
    mapRepositoryError(error)
  }
}
