import { z } from 'zod'

const identifierPattern = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/
const languagePattern = /^[a-z]{2}(?:-[A-Z]{2})?$/
const permissionPattern = /^(?:self:)?[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/
const bindingKeyPattern = /^[a-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+)*$/

export const definitionSchemaVersion = z.literal(1)
export const identifierSchema = z.string().trim().min(1).max(80).regex(identifierPattern)
export const languageCodeSchema = z.string().trim().regex(languagePattern)
export const permissionSchema = z.string().trim().regex(permissionPattern)
export const localizedTextSchema = z.record(languageCodeSchema, z.string().trim().min(1).max(4000))

export const processStepTypeSchema = z.enum([
  'FORM',
  'DECISION',
  'ACKNOWLEDGEMENT',
  'AUTOMATED_COMMAND',
  'WAIT_UNTIL',
  'NOTIFICATION',
  'DOCUMENT_OUTPUT',
  'PARALLEL_FORK',
  'PARALLEL_JOIN',
  'END',
])
export type ProcessStepType = z.infer<typeof processStepTypeSchema>

export const processActionSchema = z.enum([
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'REQUEST_CHANGES',
  'ACKNOWLEDGE',
  'COMPLETE',
  'CANCEL',
])
export type ProcessAction = z.infer<typeof processActionSchema>

export const terminalOutcomeSchema = z.enum(['COMPLETED', 'REJECTED', 'CANCELLED'])
export type TerminalOutcome = z.infer<typeof terminalOutcomeSchema>

export const resolutionDatePolicySchema = z.enum([
  'STEP_ACTIVATED_AT',
  'PROCESS_STARTED_AT',
  'BUSINESS_EFFECTIVE_DATE',
  'FIXED_DATE_FIELD',
  'SNAPSHOT_AT_START',
])

const explicitPersonSelectorSchema = z.object({
  type: z.literal('EXPLICIT_PERSON'),
  personFieldKey: identifierSchema,
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const initiatorSelectorSchema = z.object({
  type: z.literal('INITIATOR'),
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const subjectEmployeeSelectorSchema = z.object({
  type: z.literal('SUBJECT_EMPLOYEE'),
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const directManagerSelectorSchema = z.object({
  type: z.literal('DIRECT_MANAGER_OF_SUBJECT'),
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const subjectDepartmentManagementSelectorSchema = z.object({
  type: z.literal('MANAGEMENT_ROLE_ON_SUBJECT_DEPARTMENT'),
  roleCode: identifierSchema,
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const selectedDepartmentManagementSelectorSchema = z.object({
  type: z.literal('MANAGEMENT_ROLE_ON_SELECTED_DEPARTMENT'),
  roleCode: identifierSchema,
  departmentFieldKey: identifierSchema,
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const processDepartmentManagementSelectorSchema = z.object({
  type: z.literal('MANAGEMENT_ROLE_ON_PROCESS_DEPARTMENT'),
  roleCode: identifierSchema,
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const formFieldPersonSelectorSchema = z.object({
  type: z.literal('FORM_FIELD_PERSON'),
  personFieldKey: identifierSchema,
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const permissionWorkQueueSelectorSchema = z.object({
  type: z.literal('PERMISSION_WORK_QUEUE'),
  permission: permissionSchema,
  queueKey: identifierSchema,
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()
const processOwnerQueueSelectorSchema = z.object({
  type: z.literal('PROCESS_OWNER_QUEUE'),
  queueKey: identifierSchema,
  resolutionDatePolicy: resolutionDatePolicySchema,
  fixedDateFieldKey: identifierSchema.optional(),
}).strict()

export const assignmentSelectorSchema = z.discriminatedUnion('type', [
  explicitPersonSelectorSchema,
  initiatorSelectorSchema,
  subjectEmployeeSelectorSchema,
  directManagerSelectorSchema,
  subjectDepartmentManagementSelectorSchema,
  selectedDepartmentManagementSelectorSchema,
  processDepartmentManagementSelectorSchema,
  formFieldPersonSelectorSchema,
  permissionWorkQueueSelectorSchema,
  processOwnerQueueSelectorSchema,
])
export type AssignmentSelector = z.infer<typeof assignmentSelectorSchema>

export const participantAssignmentModeSchema = z.enum(['EXACTLY_ONE', 'ANY_ONE', 'ALL'])
export const participantDefinitionSchema = z.object({
  key: identifierSchema,
  label: localizedTextSchema,
  selector: assignmentSelectorSchema,
  assignmentMode: participantAssignmentModeSchema,
  permission: permissionSchema,
}).strict()
export type ParticipantDefinition = z.infer<typeof participantDefinitionSchema>

export const fieldTypeSchema = z.enum([
  'SHORT_TEXT',
  'LONG_TEXT',
  'INTEGER',
  'DECIMAL',
  'MONEY',
  'DATE',
  'TIME',
  'DATETIME',
  'BOOLEAN',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'EMPLOYEE_REFERENCE',
  'DEPARTMENT_REFERENCE',
  'JOB_REFERENCE',
  'EMPLOYMENT_REFERENCE',
  'DOCUMENT_REFERENCE',
])
export type FieldType = z.infer<typeof fieldTypeSchema>

export const fieldBindingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('PROCESS_ONLY') }).strict(),
  z.object({ kind: z.literal('DOMAIN_READ'), key: z.string().trim().min(1).max(120).regex(bindingKeyPattern) }).strict(),
  z.object({ kind: z.literal('DOMAIN_PROPOSAL'), key: z.string().trim().min(1).max(120).regex(bindingKeyPattern) }).strict(),
  z.object({ kind: z.literal('COMPUTED'), formulaKey: identifierSchema }).strict(),
])
export type FieldBinding = z.infer<typeof fieldBindingSchema>

export const fieldAccessModeSchema = z.enum(['HIDDEN', 'READ', 'WRITE_OPTIONAL', 'WRITE_REQUIRED'])
export type FieldAccessMode = z.infer<typeof fieldAccessModeSchema>

export const fieldAccessRuleSchema = z.object({
  participantKey: identifierSchema,
  mode: fieldAccessModeSchema,
  permission: permissionSchema.optional(),
}).strict()
export type FieldAccessRule = z.infer<typeof fieldAccessRuleSchema>

const conditionLiteralSchema = z.object({
  kind: z.literal('LITERAL'),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
}).strict()
const conditionFieldReferenceSchema = z.object({
  kind: z.literal('FIELD'),
  fieldKey: identifierSchema,
}).strict()
const conditionSubjectReferenceSchema = z.object({
  kind: z.literal('SUBJECT'),
  subjectKey: z.enum(['employeeId', 'employmentId', 'departmentId', 'effectiveDate']),
}).strict()
export const conditionOperandSchema = z.union([
  conditionLiteralSchema,
  conditionFieldReferenceSchema,
  conditionSubjectReferenceSchema,
])
export type ConditionOperand = z.infer<typeof conditionOperandSchema>

export type ConditionNode =
  | { operator: 'equals'; left: ConditionOperand; right: ConditionOperand }
  | { operator: 'notEquals'; left: ConditionOperand; right: ConditionOperand }
  | { operator: 'in'; left: ConditionOperand; values: Array<string | number | boolean | null> }
  | { operator: 'notIn'; left: ConditionOperand; values: Array<string | number | boolean | null> }
  | { operator: 'isEmpty'; operand: ConditionOperand }
  | { operator: 'isNotEmpty'; operand: ConditionOperand }
  | { operator: 'greaterThan'; left: ConditionOperand; right: ConditionOperand }
  | { operator: 'lessThan'; left: ConditionOperand; right: ConditionOperand }
  | { operator: 'and'; conditions: ConditionNode[] }
  | { operator: 'or'; conditions: ConditionNode[] }
  | { operator: 'not'; condition: ConditionNode }

export const conditionSchema: z.ZodType<ConditionNode> = z.lazy(() => z.union([
  z.object({ operator: z.literal('equals'), left: conditionOperandSchema, right: conditionOperandSchema }).strict(),
  z.object({ operator: z.literal('notEquals'), left: conditionOperandSchema, right: conditionOperandSchema }).strict(),
  z.object({ operator: z.literal('in'), left: conditionOperandSchema, values: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).min(1) }).strict(),
  z.object({ operator: z.literal('notIn'), left: conditionOperandSchema, values: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).min(1) }).strict(),
  z.object({ operator: z.literal('isEmpty'), operand: conditionOperandSchema }).strict(),
  z.object({ operator: z.literal('isNotEmpty'), operand: conditionOperandSchema }).strict(),
  z.object({ operator: z.literal('greaterThan'), left: conditionOperandSchema, right: conditionOperandSchema }).strict(),
  z.object({ operator: z.literal('lessThan'), left: conditionOperandSchema, right: conditionOperandSchema }).strict(),
  z.object({ operator: z.literal('and'), conditions: z.array(conditionSchema).min(2) }).strict(),
  z.object({ operator: z.literal('or'), conditions: z.array(conditionSchema).min(2) }).strict(),
  z.object({ operator: z.literal('not'), condition: conditionSchema }).strict(),
]))

export const fieldDefinitionSchema = z.object({
  key: identifierSchema,
  label: localizedTextSchema,
  helpText: localizedTextSchema.optional(),
  type: fieldTypeSchema,
  binding: fieldBindingSchema,
  access: z.array(fieldAccessRuleSchema).min(1),
  options: z.array(z.object({ value: z.string().trim().min(1), label: localizedTextSchema }).strict()).min(1).optional(),
  visibilityCondition: conditionSchema.optional(),
  requiredCondition: conditionSchema.optional(),
}).strict()
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>

export const formSectionSchema = z.object({
  key: identifierSchema,
  title: localizedTextSchema,
  fields: z.array(fieldDefinitionSchema).min(1),
}).strict()
export type FormSection = z.infer<typeof formSectionSchema>

export const formDefinitionSchema = z.object({
  key: identifierSchema,
  version: z.number().int().positive(),
  title: localizedTextSchema,
  description: localizedTextSchema.optional(),
  sections: z.array(formSectionSchema).min(1),
}).strict()
export type FormDefinition = z.infer<typeof formDefinitionSchema>

export const slaSchema = z.object({
  duration: z.object({
    amount: z.number().int().positive(),
    unit: z.enum(['MINUTES', 'HOURS', 'DAYS']),
  }).strict(),
  businessDays: z.boolean(),
  onBreach: z.enum(['NOTIFY', 'ESCALATE', 'BLOCK']),
  escalationParticipantKey: identifierSchema.optional(),
}).strict()
export type SlaDefinition = z.infer<typeof slaSchema>

export const processStepSchema = z.object({
  key: identifierSchema,
  type: processStepTypeSchema,
  title: localizedTextSchema,
  participantKey: identifierSchema.optional(),
  formKey: identifierSchema.optional(),
  allowedActions: z.array(processActionSchema),
  sla: slaSchema.optional(),
  terminalOutcome: terminalOutcomeSchema.optional(),
}).strict()
export type ProcessStep = z.infer<typeof processStepSchema>

export const processTransitionSchema = z.object({
  key: identifierSchema,
  fromStepKey: identifierSchema,
  toStepKey: identifierSchema,
  action: processActionSchema,
  kind: z.enum(['FORWARD', 'RECOVERY']),
  label: localizedTextSchema,
  condition: conditionSchema.optional(),
}).strict()
export type ProcessTransition = z.infer<typeof processTransitionSchema>

export const processOutputSchema = z.object({
  key: identifierSchema,
  title: localizedTextSchema,
  format: z.enum(['PDF', 'DOCX', 'JSON']),
  fieldKeys: z.array(identifierSchema).min(1),
  dossierCategoryKey: identifierSchema.optional(),
}).strict()
export type ProcessOutput = z.infer<typeof processOutputSchema>

export const processDefinitionDraftSchema = z.object({
  schemaVersion: definitionSchemaVersion,
  key: identifierSchema,
  status: z.literal('DRAFT'),
  title: localizedTextSchema,
  description: localizedTextSchema.optional(),
  enabledLanguages: z.array(languageCodeSchema).min(1),
  startStepKey: identifierSchema,
  participants: z.array(participantDefinitionSchema).min(1),
  forms: z.array(formDefinitionSchema),
  steps: z.array(processStepSchema).min(1),
  transitions: z.array(processTransitionSchema),
  output: processOutputSchema.optional(),
}).strict()
export type ProcessDefinitionDraft = z.infer<typeof processDefinitionDraftSchema>
