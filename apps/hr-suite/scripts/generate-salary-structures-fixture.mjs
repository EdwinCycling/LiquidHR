import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function argument(name) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing --${name}`)
  return process.argv[index + 1]
}

function optionalArgument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : process.argv[index + 1] ?? null
}

function uuid(value) {
  const hex = createHash('md5').update(`liquidhr-salary-fixture:${value}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function quote(value) {
  return value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
}

function number(value) {
  return value === null || value === undefined ? 'null' : String(value)
}

const datasetPath = argument('dataset')
const tenantId = argument('tenant-id')
const hrGroupId = argument('hr-group-id')
const administrationId = argument('administration-id')
const publisherUserId = argument('publisher-user-id')
const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'))
const lines = [
  '-- Generated from the canonical TEST-SALARY-STRUCTURES-DATASET.json.',
  '-- TEST ONLY. Never execute this fixture against production.',
  'begin;',
  `do $$ begin
    if not exists (select 1 from public.hr_groups where tenant_id = '${tenantId}'::uuid and id = '${hrGroupId}'::uuid) then
      raise exception 'SALARY_FIXTURE_HR_GROUP_NOT_FOUND';
    end if;
    if not exists (select 1 from public.administrations where tenant_id = '${tenantId}'::uuid and hr_group_id = '${hrGroupId}'::uuid and id = '${administrationId}'::uuid) then
      raise exception 'SALARY_FIXTURE_ADMINISTRATION_NOT_FOUND';
    end if;
    if not exists (select 1 from auth.users where id = '${publisherUserId}'::uuid) then
      raise exception 'SALARY_FIXTURE_PUBLISHER_NOT_FOUND';
    end if;
  end $$;`,
]

const structureIds = new Map()
const revisionIds = new Map()

for (const structure of dataset.salary_structures) {
  const structureId = uuid(structure.structure_key)
  structureIds.set(structure.structure_key, structureId)
  lines.push(`insert into public.salary_structures (id, tenant_id, hr_group_id, structure_type, name, code, description)
values ('${structureId}', '${tenantId}', '${hrGroupId}', '${structure.type}', ${quote(structure.name)}, ${quote(structure.code)}, ${quote(`Canonical testfixture ${dataset.fixture_id}`)})
on conflict (id) do nothing;`)

  const scaleIds = new Map()
  const bandIds = new Map()
  for (const revision of structure.revisions) {
    const revisionId = uuid(revision.revision_key)
    revisionIds.set(revision.revision_key, revisionId)
    const revisionNumber = structure.revisions.indexOf(revision) + 1
    lines.push(`insert into public.salary_structure_revisions (id, tenant_id, hr_group_id, salary_structure_id, revision_number, status, effective_from, salary_basis, currency_code, description)
values ('${revisionId}', '${tenantId}', '${hrGroupId}', '${structureId}', ${revisionNumber}, 'DRAFT', '${revision.effective_from}', 'MONTHLY_BASE', ${quote(revision.currency)}, ${quote(revision.synthetic ? 'Synthetische canonieke testdata' : 'Officiële publieke referentiedata')})
on conflict (id) do nothing;`)

    for (const scale of revision.scales ?? []) {
      const scaleId = scaleIds.get(scale.logical_scale_key) ?? uuid(`${structure.structure_key}:${scale.logical_scale_key}`)
      scaleIds.set(scale.logical_scale_key, scaleId)
      lines.push(`insert into public.salary_scales (id, tenant_id, hr_group_id, salary_structure_id, code, name)
values ('${scaleId}', '${tenantId}', '${hrGroupId}', '${structureId}', ${quote(scale.code)}, ${quote(scale.name)})
on conflict (id) do nothing;`)
      const scaleValueId = uuid(`${revision.revision_key}:${scale.logical_scale_key}:value`)
      lines.push(`do $$ begin if not exists (select 1 from public.salary_scale_revision_values where id = '${scaleValueId}') then
insert into public.salary_scale_revision_values (id, tenant_id, hr_group_id, salary_structure_revision_id, salary_scale_id, code, name, sort_order, progression_type, default_months_to_next_step)
values ('${scaleValueId}', '${tenantId}', '${hrGroupId}', '${revisionId}', '${scaleId}', ${quote(scale.code)}, ${quote(scale.name)}, ${scale.sort_order}, ${scale.default_months_to_next_step ? quote('TIME_IN_STEP') : quote('MANUAL')}, ${number(scale.default_months_to_next_step)});
end if; end $$;`)
      for (const [stepIndex, step] of scale.steps.entries()) {
        const isLast = stepIndex === scale.steps.length - 1
        const stepKind = stepIndex === 0 ? 'START' : isLast ? 'MAXIMUM' : 'REGULAR'
        const progressionType = step.months_to_next_step ? 'TIME_IN_STEP' : 'MANUAL'
        const stepId = uuid(`${revision.revision_key}:${step.logical_step_key}`)
        lines.push(`do $$ begin if not exists (select 1 from public.salary_scale_steps where id = '${stepId}') then
insert into public.salary_scale_steps (id, tenant_id, hr_group_id, salary_structure_revision_id, salary_scale_id, step_code, step_name, sequence_number, fulltime_amount, currency_code, step_kind, progression_type, months_to_next_step)
values ('${stepId}', '${tenantId}', '${hrGroupId}', '${revisionId}', '${scaleId}', ${quote(step.label)}, ${quote(step.label)}, ${step.sort_order}, ${number(step.amount_monthly_eur)}, ${quote(revision.currency)}, '${stepKind}', '${progressionType}', ${number(step.months_to_next_step)});
end if; end $$;`)
      }
    }

    for (const band of revision.bands ?? []) {
      const bandId = bandIds.get(band.logical_band_key) ?? uuid(`${structure.structure_key}:${band.logical_band_key}`)
      bandIds.set(band.logical_band_key, bandId)
      lines.push(`insert into public.salary_bands (id, tenant_id, hr_group_id, salary_structure_id, identity_key)
values ('${bandId}', '${tenantId}', '${hrGroupId}', '${structureId}', ${quote(band.logical_band_key)})
on conflict (id) do nothing;`)
      const bandValueId = uuid(`${revision.revision_key}:${band.logical_band_key}:value`)
      lines.push(`do $$ begin if not exists (select 1 from public.salary_band_values where id = '${bandValueId}') then
insert into public.salary_band_values (id, tenant_id, hr_group_id, salary_structure_revision_id, salary_band_id, code, name, sort_order, input_method, minimum_amount, midpoint_amount, maximum_amount, input_spread_percentage)
values ('${bandValueId}', '${tenantId}', '${hrGroupId}', '${revisionId}', '${bandId}', ${quote(band.code)}, ${quote(band.name)}, ${band.sort_order}, '${band.input_method}', ${number(band.minimum)}, ${number(band.midpoint)}, ${number(band.maximum)}, ${number(band.input_spread_pct)});
end if; end $$;`)
    }
  }
}

for (const revision of dataset.salary_structures.flatMap((structure) => structure.revisions)) {
  if (revision.status !== 'PUBLISHED') continue
  const revisionId = revisionIds.get(revision.revision_key)
  lines.push(`do $$ begin
    if exists (select 1 from public.salary_structure_revisions where id = '${revisionId}' and status = 'DRAFT') then
      perform internal_security.validate_salary_structure_revision('${revisionId}'::uuid);
      update public.salary_structure_revisions
      set status = 'PUBLISHED', published_at = timezone('utc', now()), published_by_user_id = '${publisherUserId}'::uuid,
          updated_by_user_id = '${publisherUserId}'::uuid, updated_at = timezone('utc', now())
      where id = '${revisionId}';
    end if;
  end $$;`)
}

for (const cao of dataset.caos) {
  const caoId = uuid(cao.cao_key)
  lines.push(`insert into public.labor_condition_sets (id, tenant_id, hr_group_id, administration_id, code, name, valid_from, standard_hours_per_week, probation_maximum_months, is_active)
values ('${caoId}', '${tenantId}', '${hrGroupId}', '${administrationId}', ${quote(cao.cao_key)}, ${quote(cao.name)}, '2026-01-01', 36, 2, true)
on conflict (id) do nothing;`)
  for (const structureKey of cao.linked_structure_keys) {
    const structureId = structureIds.get(structureKey)
    lines.push(`insert into public.labor_condition_salary_structures (id, tenant_id, hr_group_id, labor_condition_set_id, salary_structure_id)
values ('${uuid(`${cao.cao_key}:${structureKey}`)}', '${tenantId}', '${hrGroupId}', '${caoId}', '${structureId}')
on conflict (id) do nothing;`)
  }
}

const migrationConflicts = Array.isArray(dataset.migration_conflict_cases)
  ? dataset.migration_conflict_cases
  : [dataset.migration_conflict_cases]
for (const conflict of migrationConflicts) {
  const conflictingStructureIds = dataset.salary_structures
    .filter((structure) => structure.type === 'SCALE_WITH_STEPS')
    .map((structure) => `'${structureIds.get(structure.structure_key)}'::uuid`)
  lines.push(`insert into public.salary_structure_migration_conflicts (id, tenant_id, hr_group_id, legacy_scale_code, source_administration_ids, salary_structure_ids, reason, status)
values ('${uuid(conflict.case_key)}', '${tenantId}', '${hrGroupId}', ${quote(conflict.scale_code)}, array['${uuid(conflict.administration_a)}'::uuid, '${uuid(conflict.administration_b)}'::uuid], array[${conflictingStructureIds.join(', ')}], ${quote(conflict.reason)}, 'OPEN')
on conflict (id) do nothing;`)
}

lines.push('commit;')
const chunkSize = optionalArgument('chunk-size')
const chunkIndex = optionalArgument('chunk-index')
const executableLines = lines.filter((line) => !line.startsWith('--') && line !== 'begin;' && line !== 'commit;')
if (chunkSize !== null && chunkIndex !== null) {
  const size = Number.parseInt(chunkSize, 10)
  const index = Number.parseInt(chunkIndex, 10)
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(index) || index < 0) {
    throw new Error('Invalid fixture chunk arguments')
  }
  process.stdout.write(`${executableLines.slice(index * size, (index + 1) * size).join('\n\n')}\n`)
} else {
  process.stdout.write(`${lines.join('\n\n')}\n`)
}
