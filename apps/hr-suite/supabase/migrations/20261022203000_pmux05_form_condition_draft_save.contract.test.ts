import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { describe, expect, it } from "vitest"

const p4Runtime = readFileSync(new URL("./20260808142249_process_automation_p4_runtime_engine.sql", import.meta.url), "utf8")
const p5FormRuntime = readFileSync(new URL("./20260808143934_process_automation_p5_form_runtime.sql", import.meta.url), "utf8")
const p5Hardening = readFileSync(new URL("./20260808150735_process_automation_p4_p5_hardening_v2.sql", import.meta.url), "utf8")
const documentCompatibility = readFileSync(new URL("./20260808160102_process_automation_p5_document_reference_compatibility.sql", import.meta.url), "utf8")
const pmux05Migration = readFileSync(new URL("./20261022203000_pmux05_form_condition_draft_save.sql", import.meta.url), "utf8")

const ids = {
  actorUser: "10000000-0000-4000-8000-000000000001",
  actorEmployee: "10000000-0000-4000-8000-000000000002",
  tenantA: "10000000-0000-4000-8000-000000000010",
  tenantB: "10000000-0000-4000-8000-000000000011",
  groupA: "10000000-0000-4000-8000-000000000020",
  groupB: "10000000-0000-4000-8000-000000000021",
  formDefinition: "10000000-0000-4000-8000-000000000030",
  formVersionA: "10000000-0000-4000-8000-000000000031",
  formVersionLater: "10000000-0000-4000-8000-000000000032",
  formVersionPlain: "10000000-0000-4000-8000-000000000033",
  processVersionA: "10000000-0000-4000-8000-000000000040",
  processVersionLater: "10000000-0000-4000-8000-000000000041",
  processVersionPlain: "10000000-0000-4000-8000-000000000042",
  instanceA: "10000000-0000-4000-8000-000000000050",
  instanceFinal: "10000000-0000-4000-8000-000000000051",
  instancePlain: "10000000-0000-4000-8000-000000000052",
  instanceTenantB: "10000000-0000-4000-8000-000000000053",
  stepA: "10000000-0000-4000-8000-000000000060",
  stepFinal: "10000000-0000-4000-8000-000000000061",
  stepPlain: "10000000-0000-4000-8000-000000000062",
  stepTenantB: "10000000-0000-4000-8000-000000000063",
  itemA: "10000000-0000-4000-8000-000000000070",
  itemFinal: "10000000-0000-4000-8000-000000000071",
  itemPlain: "10000000-0000-4000-8000-000000000072",
  itemTenantB: "10000000-0000-4000-8000-000000000073",
}

const highCostCondition = {
  operator: "greaterThan",
  left: { kind: "FIELD", fieldKey: "expected_cost" },
  right: { kind: "LITERAL", value: 1000 },
}

function extractFunctionDefinition(source: string, functionName: string): string {
  const start = source.toLowerCase().indexOf("create or replace function " + functionName.toLowerCase() + "(")
  if (start < 0) throw new Error("Expected SQL function not found: " + functionName)
  const endMarker = "\n$$;"
  const end = source.indexOf(endMarker, start)
  if (end < 0) throw new Error("Expected SQL function terminator not found: " + functionName)
  return source.slice(start, end + endMarker.length)
}

async function installRuntimeContract(db: PGlite): Promise<void> {
  const bootstrapSql = [
    "create role authenticated;",
    "create role anon;",
    "create schema auth;",
    "create schema internal_security;",
    "create schema extensions;",
    "set plpgsql.variable_conflict = 'use_column';",
    "create function auth.uid() returns uuid language sql stable as $fn$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;",
    "create function extensions.gen_random_uuid() returns uuid language sql volatile as $fn$ select pg_catalog.gen_random_uuid() $fn$;",
    "create type public.process_definition_status as enum ('DRAFT', 'PUBLISHED', 'RETIRED');",
    "create type public.process_instance_status as enum ('RUNNING', 'WAITING', 'BLOCKED', 'COMPLETED');",
    "create type public.process_step_instance_status as enum ('PENDING', 'ACTIVE', 'COMPLETED');",
    "create type public.process_work_item_status as enum ('OPEN', 'CLAIMED', 'BLOCKED', 'COMPLETED');",
    "create table public.process_versions (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, version_number integer not null, definition_json jsonb not null);",
    "create table public.form_definitions (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, status public.process_definition_status not null);",
    "create table public.form_versions (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, form_definition_id uuid not null, version_number integer not null, definition_json jsonb not null);",
    "create table public.employees (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, auth_user_id uuid not null, is_active boolean not null, deleted_at timestamptz, created_at timestamptz not null default now());",
    "create table public.process_instances (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, process_version_id uuid not null, status public.process_instance_status not null, scope_type text, administration_id uuid, metadata jsonb not null default '{}'::jsonb, correlation_id uuid);",
    "create table public.process_step_instances (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, process_instance_id uuid not null, status public.process_step_instance_status not null);",
    "create table public.process_work_items (id uuid primary key, tenant_id uuid not null, hr_group_id uuid not null, process_instance_id uuid not null, step_instance_id uuid not null, status public.process_work_item_status not null, step_key text not null, participant_key text not null);",
    "create table public.process_work_item_candidates (tenant_id uuid not null, hr_group_id uuid not null, work_item_id uuid not null, employee_id uuid not null, candidate_user_id uuid not null, is_eligible boolean not null, resolution_revision integer not null);",
    "create table public.process_form_responses (id uuid primary key default extensions.gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null, process_instance_id uuid not null, step_instance_id uuid not null, work_item_id uuid not null, process_version_id uuid not null, form_version_id uuid, form_key text, participant_key text, revision bigint not null, expected_version bigint not null, current_values jsonb not null default '{}'::jsonb, new_values jsonb not null default '{}'::jsonb, status text not null default 'IN_PROGRESS', last_saved_by_user_id uuid, correlation_id uuid);",
    "create table public.process_form_response_revisions (id uuid primary key default extensions.gen_random_uuid(), tenant_id uuid not null, hr_group_id uuid not null, response_id uuid not null, revision bigint not null, expected_version bigint not null, current_values jsonb not null, new_values jsonb not null, changed_by_user_id uuid not null, idempotency_key text not null, correlation_id uuid);",
    "create table public.employee_documents (id uuid primary key, tenant_id uuid not null, deleted_at timestamptz);",
    "create function internal_security.process_scope_has_permission(uuid, uuid, text, uuid, text) returns boolean language sql stable as $fn$ select false $fn$;",
    "create function internal_security.current_employee_id(uuid, uuid) returns uuid language sql stable as $fn$ select nullif(pg_catalog.current_setting('test.actor_employee_id', true), '')::uuid $fn$;",
    "create function internal_security.process_subject_context(uuid, uuid, uuid) returns jsonb language sql stable as $fn$ select '{}'::jsonb $fn$;",
    "create function internal_security.can_access_document(uuid, text) returns boolean language sql stable as $fn$ select false $fn$;",
  ]
  await db.exec(bootstrapSql.join("\n"))

  const functions: Array<[string, string]> = [
    [p4Runtime, "internal_security.process_definition_content"],
    [p4Runtime, "internal_security.process_condition_value"],
    [p4Runtime, "internal_security.process_condition_matches"],
    [p5Hardening, "internal_security.process_form_html_escape"],
    [p5Hardening, "internal_security.process_form_language_allowed"],
    [p5Hardening, "internal_security.process_form_value_is_empty"],
    [p5Hardening, "internal_security.process_form_value_is_valid"],
    [p5Hardening, "internal_security.process_form_field_required"],
    [p5Hardening, "internal_security.resolve_process_form_definition"],
    [p5FormRuntime, "internal_security.process_form_fields"],
    [p5FormRuntime, "internal_security.process_form_access_rule"],
    [p5Hardening, "internal_security.process_form_actor_allowed"],
    [p5Hardening, "internal_security.process_form_runtime_fields"],
    [p5Hardening, "internal_security.prepare_process_form_action"],
    [p5Hardening, "internal_security.get_process_form_projection"],
    [p5Hardening, "internal_security.save_process_form_response"],
  ]
  for (const [source, functionName] of functions) await db.exec(extractFunctionDefinition(source, functionName))

}

async function prepareFixture(db: PGlite): Promise<void> {
  await installRuntimeContract(db)
  await db.exec(documentCompatibility)
  await db.exec(pmux05Migration)

  const actorAndFormSql = [
    "insert into public.employees (id, tenant_id, hr_group_id, auth_user_id, is_active) values ('" + ids.actorEmployee + "', '" + ids.tenantA + "', '" + ids.groupA + "', '" + ids.actorUser + "', true);",
    "insert into public.form_definitions (id, tenant_id, hr_group_id, status) values ('" + ids.formDefinition + "', '" + ids.tenantA + "', '" + ids.groupA + "', 'PUBLISHED');",
    "insert into public.form_versions (id, tenant_id, hr_group_id, form_definition_id, version_number, definition_json) values ('" + ids.formVersionA + "', '" + ids.tenantA + "', '" + ids.groupA + "', '" + ids.formDefinition + "', 1, '" + JSON.stringify(conditionalForm) + "'::jsonb);",
    "insert into public.form_versions (id, tenant_id, hr_group_id, form_definition_id, version_number, definition_json) values ('" + ids.formVersionLater + "', '" + ids.tenantA + "', '" + ids.groupA + "', '" + ids.formDefinition + "', 2, '" + JSON.stringify(laterForm) + "'::jsonb);",
    "insert into public.form_versions (id, tenant_id, hr_group_id, form_definition_id, version_number, definition_json) values ('" + ids.formVersionPlain + "', '" + ids.tenantA + "', '" + ids.groupA + "', '" + ids.formDefinition + "', 3, '" + JSON.stringify(plainForm) + "'::jsonb);",
  ]
  await db.exec(actorAndFormSql.join("\n"))

  await insertVersion(db, ids.processVersionA, ids.tenantA, ids.groupA, ids.formVersionA, 1)
  await insertVersion(db, ids.processVersionLater, ids.tenantA, ids.groupA, ids.formVersionLater, 2)
  await insertVersion(db, ids.processVersionPlain, ids.tenantA, ids.groupA, ids.formVersionPlain, 3)
  await insertWorkItem(db, ids.instanceA, ids.stepA, ids.itemA, ids.tenantA, ids.groupA, ids.processVersionA)
  await insertWorkItem(db, ids.instanceFinal, ids.stepFinal, ids.itemFinal, ids.tenantA, ids.groupA, ids.processVersionA)
  await insertWorkItem(db, ids.instancePlain, ids.stepPlain, ids.itemPlain, ids.tenantA, ids.groupA, ids.processVersionPlain)
  await insertWorkItem(db, ids.instanceTenantB, ids.stepTenantB, ids.itemTenantB, ids.tenantB, ids.groupB, ids.processVersionA, false)
  await db.query("select pg_catalog.set_config('request.jwt.claim.sub', $1, false)", [ids.actorUser])
  await db.query("select pg_catalog.set_config('test.actor_employee_id', $1, false)", [ids.actorEmployee])
}

const conditionalForm = {
  title: { nl: "Opleidingsaanvraag" },
  enabledLanguages: ["nl"],
  sections: [{
    key: "training",
    title: { nl: "Opleiding" },
    fields: [
      { key: "expected_cost", label: { nl: "Verwachte kosten" }, type: "MONEY", access: [{ participantKey: "employee", mode: "WRITE_REQUIRED" }], options: [] },
      { key: "high_cost_reason", label: { nl: "Toelichting hoge kosten" }, type: "SHORT_TEXT", visibilityCondition: highCostCondition, requiredCondition: highCostCondition, access: [{ participantKey: "employee", mode: "WRITE_OPTIONAL" }], options: [] },
      { key: "manager_note", label: { nl: "Interne notitie" }, type: "SHORT_TEXT", visibilityCondition: highCostCondition, access: [{ participantKey: "employee", mode: "READ" }], options: [] },
    ],
  }],
}

const laterForm = {
  title: { nl: "Opleidingsaanvraag later" },
  enabledLanguages: ["nl"],
  sections: [{
    key: "training",
    title: { nl: "Opleiding" },
    fields: [
      { key: "expected_cost", label: { nl: "Kosten" }, type: "MONEY", access: [{ participantKey: "employee", mode: "WRITE_REQUIRED" }], options: [] },
      { key: "later_only", label: { nl: "Nieuw later veld" }, type: "SHORT_TEXT", access: [{ participantKey: "employee", mode: "WRITE_OPTIONAL" }], options: [] },
    ],
  }],
}

const plainForm = {
  title: { nl: "Bestaand proces" },
  enabledLanguages: ["nl"],
  sections: [{
    key: "training",
    title: { nl: "Bestaand" },
    fields: [
      { key: "topic", label: { nl: "Onderwerp" }, type: "SHORT_TEXT", access: [{ participantKey: "employee", mode: "WRITE_OPTIONAL" }], options: [] },
    ],
  }],
}

async function insertVersion(db: PGlite, versionId: string, tenantId: string, groupId: string, formVersionId: string, versionNumber: number): Promise<void> {
  const definition = {
    content: {
      steps: [{ key: "capture", formKey: "training" }],
      forms: [{ key: "training", formVersionId }],
    },
  }
  await db.query(
    "insert into public.process_versions (id, tenant_id, hr_group_id, version_number, definition_json) values ($1, $2, $3, $4, $5::jsonb)",
    [versionId, tenantId, groupId, versionNumber, JSON.stringify(definition)],
  )
}

async function insertWorkItem(db: PGlite, instanceId: string, stepId: string, itemId: string, tenantId: string, groupId: string, versionId: string, addCandidate = true): Promise<void> {
  await db.query(
    "insert into public.process_instances (id, tenant_id, hr_group_id, process_version_id, status, scope_type, metadata, correlation_id) values ($1, $2, $3, $4, 'RUNNING', 'TENANT', '{}'::jsonb, $5)",
    [instanceId, tenantId, groupId, versionId, instanceId],
  )
  await db.query(
    "insert into public.process_step_instances (id, tenant_id, hr_group_id, process_instance_id, status) values ($1, $2, $3, $4, 'ACTIVE')",
    [stepId, tenantId, groupId, instanceId],
  )
  await db.query(
    "insert into public.process_work_items (id, tenant_id, hr_group_id, process_instance_id, step_instance_id, status, step_key, participant_key) values ($1, $2, $3, $4, $5, 'OPEN', 'capture', 'employee')",
    [itemId, tenantId, groupId, instanceId, stepId],
  )
  if (addCandidate) {
    await db.query(
      "insert into public.process_work_item_candidates (tenant_id, hr_group_id, work_item_id, employee_id, candidate_user_id, is_eligible, resolution_revision) values ($1, $2, $3, $4, $5, true, 1)",
      [tenantId, groupId, itemId, ids.actorEmployee, ids.actorUser],
    )
  }
}

async function save(db: PGlite, itemId: string, instanceId: string, revision: number, version: number, values: Record<string, unknown>, key: string): Promise<unknown> {
  const payload = JSON.stringify({ current: {}, new: values })
  const result = await db.query<{ projection: unknown }>(
    "select internal_security.save_process_form_response($1, $2, $3, $4::jsonb, $5, $6, 'nl') as projection",
    [itemId, revision, version, payload, key, instanceId],
  )
  return result.rows[0]?.projection
}

interface ProjectedField {
  key: string
  required: boolean
  newValue: unknown
}

function projectedFields(projection: unknown): ProjectedField[] {
  const value = projection as { sections: Array<{ fields: ProjectedField[] }> }
  return value.sections.flatMap((section) => section.fields)
}

async function expectSqlError(promise: Promise<unknown>, code: string, detail?: string): Promise<void> {
  let caught: unknown
  try {
    await promise
  } catch (error) {
    caught = error
  }
  expect(caught).toBeDefined()
  const error = caught as { message?: unknown; detail?: unknown }
  const message = String(error.message ?? caught)
  const details = typeof error.detail === "string" ? error.detail : ""
  expect(message + "\n" + details).toContain(code)
  if (detail) expect(message + "\n" + details).toContain(detail)
}

describe("PMUX-05 form condition server contract", () => {
  it("executes draft autosave, final required-field validation, projection and hidden-value purging against the pinned training form", async () => {
    const db = new PGlite()
    try {
      await prepareFixture(db)

      const lowProjection = await save(db, ids.itemA, ids.instanceA, 0, 0, { expected_cost: 750 }, "draft-low")
      expect(projectedFields(lowProjection).map((field) => field.key)).toEqual(["expected_cost"])
      expect(projectedFields(lowProjection)[0]?.newValue).toBe(750)

      const exactProjection = await save(db, ids.itemA, ids.instanceA, 1, 1, { expected_cost: 1000 }, "draft-exact")
      expect(projectedFields(exactProjection).map((field) => field.key)).toEqual(["expected_cost"])

      const highProjection = await save(db, ids.itemA, ids.instanceA, 2, 2, { expected_cost: 1250 }, "draft-high")
      expect(projectedFields(highProjection).map((field) => field.key)).toEqual(["expected_cost", "high_cost_reason", "manager_note"])
      expect(projectedFields(highProjection).find((field) => field.key === "high_cost_reason")).toMatchObject({ required: true, newValue: null })
      await expectSqlError(
        db.query("select internal_security.prepare_process_form_action($1, 'SUBMIT')", [ids.itemA]),
        "REQUIRED_FORM_FIELD",
        "high_cost_reason",
      )

      const filledProjection = await save(db, ids.itemA, ids.instanceA, 3, 3, { high_cost_reason: "Training required for the new platform" }, "draft-reason")
      expect(projectedFields(filledProjection).find((field) => field.key === "high_cost_reason")?.newValue).toBe("Training required for the new platform")

      const lowAgain = await save(db, ids.itemA, ids.instanceA, 4, 4, { expected_cost: 750 }, "draft-lower")
      expect(projectedFields(lowAgain).map((field) => field.key)).toEqual(["expected_cost"])
      const response = await db.query<{ new_values: Record<string, unknown> }>("select new_values from public.process_form_responses where work_item_id = $1", [ids.itemA])
      expect(response.rows[0]?.new_values).toEqual({ expected_cost: 750 })
      const revisions = await db.query<{ revision: number; new_values: Record<string, unknown> }>("select revision, new_values from public.process_form_response_revisions where response_id = (select id from public.process_form_responses where work_item_id = $1) order by revision", [ids.itemA])
      expect(revisions.rows[3]?.new_values).toEqual({ expected_cost: 1250, high_cost_reason: "Training required for the new platform" })

      const runtimeValues = await db.query<{ fields: Record<string, unknown> }>("select internal_security.process_form_runtime_fields($1) as fields", [ids.itemA])
      expect(runtimeValues.rows[0]?.fields).toEqual({ expected_cost: 750 })
      const staleAnswerCondition = {
        operator: "equals",
        left: { kind: "FIELD", fieldKey: "high_cost_reason" },
        right: { kind: "LITERAL", value: "Training required for the new platform" },
      }
      const routeDecision = await db.query<{ matched: boolean }>(
        "select internal_security.process_condition_matches($1::jsonb, $2::jsonb, '{}'::jsonb) as matched",
        [JSON.stringify(staleAnswerCondition), JSON.stringify(runtimeValues.rows[0]?.fields)],
      )
      expect(routeDecision.rows[0]?.matched).toBe(false)

      const highAgain = await save(db, ids.itemA, ids.instanceA, 5, 5, { expected_cost: 1250 }, "draft-raise")
      expect(projectedFields(highAgain).find((field) => field.key === "high_cost_reason")).toMatchObject({ required: true, newValue: null })
      await expectSqlError(
        db.query("select internal_security.prepare_process_form_action($1, 'SUBMIT')", [ids.itemA]),
        "REQUIRED_FORM_FIELD",
        "high_cost_reason",
      )

      await expectSqlError(
        save(db, ids.itemFinal, ids.instanceFinal, 0, 0, { expected_cost: "twelve-fifty" }, "invalid-cost"),
        "INVALID_FORM_VALUE",
        "expected_cost",
      )
      const missingCostProjection = await save(db, ids.itemFinal, ids.instanceFinal, 0, 0, {}, "empty-draft")
      expect(projectedFields(missingCostProjection)).toMatchObject([{ key: "expected_cost", required: true, newValue: null }])
      await expectSqlError(
        db.query("select internal_security.prepare_process_form_action($1, 'SUBMIT')", [ids.itemFinal]),
        "REQUIRED_FORM_FIELD",
        "expected_cost",
      )

      await save(db, ids.itemFinal, ids.instanceFinal, 1, 1, { expected_cost: 1250, high_cost_reason: "Valid final reason" }, "valid-final")
      await db.query("select internal_security.prepare_process_form_action($1, 'SUBMIT')", [ids.itemFinal])
      const submitted = await db.query<{ status: string }>("select status from public.process_form_responses where work_item_id = $1", [ids.itemFinal])
      expect(submitted.rows[0]?.status).toBe("SUBMITTED")
    } finally {
      await db.close()
    }
  })

  it("preserves field authorization, cross-tenant isolation, no-condition process behavior and immutable publication pins", async () => {
    const db = new PGlite()
    try {
      await prepareFixture(db)

      await save(db, ids.itemA, ids.instanceA, 0, 0, { expected_cost: 750 }, "seed-low")
      await expectSqlError(
        save(db, ids.itemA, ids.instanceA, 1, 1, { high_cost_reason: "hidden" }, "hidden-field"),
        "HIDDEN_FIELD_SUBMITTED",
      )
      await save(db, ids.itemA, ids.instanceA, 1, 1, { expected_cost: 1250 }, "seed-high")
      await expectSqlError(
        save(db, ids.itemA, ids.instanceA, 2, 2, { manager_note: "employee cannot write this" }, "read-only-field"),
        "FIELD_NOT_WRITABLE",
      )
      await expectSqlError(
        save(db, ids.itemA, ids.instanceA, 2, 2, { unknown_field: "value" }, "unknown-field"),
        "UNKNOWN_FORM_FIELD",
      )
      await expectSqlError(
        save(db, ids.itemTenantB, ids.instanceTenantB, 0, 0, { expected_cost: 750 }, "cross-tenant"),
        "FORBIDDEN",
      )

      await expectSqlError(
        save(db, ids.itemA, ids.instanceA, 2, 2, { later_only: "from a later publication" }, "later-field"),
        "UNKNOWN_FORM_FIELD",
      )
      const pinned = await db.query<{ form_version_id: string; process_version_id: string }>("select form_version_id, process_version_id from public.process_form_responses where work_item_id = $1", [ids.itemA])
      expect(pinned.rows[0]).toMatchObject({ form_version_id: ids.formVersionA, process_version_id: ids.processVersionA })

      const plainProjection = await save(db, ids.itemPlain, ids.instancePlain, 0, 0, { topic: "Historical process" }, "plain-save")
      expect(projectedFields(plainProjection)).toMatchObject([{ key: "topic", required: false, newValue: "Historical process" }])
      await db.query("select internal_security.prepare_process_form_action($1, 'SUBMIT')", [ids.itemPlain])
      const plainSubmitted = await db.query<{ status: string }>("select status from public.process_form_responses where work_item_id = $1", [ids.itemPlain])
      expect(plainSubmitted.rows[0]?.status).toBe("SUBMITTED")

      const compatibilityBody = await db.query<{ definition: string }>(
        "select pg_catalog.pg_get_functiondef('internal_security.save_process_form_response(uuid, bigint, bigint, jsonb, text, uuid, text)'::regprocedure) as definition",
      )
      expect(compatibilityBody.rows[0]?.definition).toContain("process_document_reference_allowed")
      const projectionBody = await db.query<{ definition: string }>(
        "select pg_catalog.pg_get_functiondef('internal_security.get_process_form_projection(uuid, text)'::regprocedure) as definition",
      )
      expect(projectionBody.rows[0]?.definition).toContain("process_form_active_response_values")
      expect(projectionBody.rows[0]?.definition).toContain("process_document_reference_allowed")
    } finally {
      await db.close()
    }
  })
})