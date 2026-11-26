import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'
import { chromium } from '@playwright/test'
import { ensureContext, loginWithTestAuth, navigateToRoute, parseArguments, switchFromHrAdmin } from './local-test-acceptance.mjs'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
nextEnv.loadEnvConfig(appRoot, true)
const config = parseArguments(process.argv.slice(2))
const employeeId = 'c6b1c7a9-c250-3d19-b1a0-87e317e80b13'
const reviewerEmployeeId = '9048f02b-4fdc-3c4c-e1aa-fd339660029c'
const result = []
const sessions = new Map()
const pages = new Map()
const runLabel = new Date().toISOString().replace(/[:.]/gu, '-')
const origin = new URL(config.baseUrl).origin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

function check(condition, code) {
  if (!condition) throw new Error(code)
}

async function api(actor, method, path, body, expectedStatuses = [200], idempotencyKey = null, multipart = null) {
  const headers = { origin }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const response = await sessions.get(actor).request.fetch(new URL(path, config.baseUrl).toString(), {
    method,
    headers,
    ...(multipart ? { multipart } : body === undefined ? {} : { data: body }),
  })
  const status = response.status()
  check(expectedStatuses.includes(status), `HTTP_${actor}_${method}_${status}_${path.split('/').filter(Boolean).slice(-2).join('_').toUpperCase()}`)
  const contentType = response.headers()['content-type'] ?? ''
  return {
    status,
    data: status === 204 || !contentType.includes('application/json') ? null : await response.json(),
    text: contentType.includes('text/csv') ? await response.text() : null,
  }
}

function parseSessionCookie(cookies, projectRef) {
  const base = `sb-${projectRef}-auth-token`
  const chunks = cookies
    .filter((cookie) => cookie.name === base || cookie.name.startsWith(`${base}.`))
    .sort((left, right) => {
      const leftIndex = left.name === base ? -1 : Number(left.name.slice(base.length + 1))
      const rightIndex = right.name === base ? -1 : Number(right.name.slice(base.length + 1))
      return leftIndex - rightIndex
    })
  if (!chunks.length) return null
  let value = decodeURIComponent(chunks.map((cookie) => cookie.value).join(''))
  if (value.startsWith('base64-')) value = Buffer.from(value.slice(7), 'base64url').toString('utf8')
  const parsed = JSON.parse(value)
  const token = Array.isArray(parsed) ? parsed[0] : parsed?.access_token
  return typeof token === 'string' && token.split('.').length === 3 ? token : null
}

async function directStorageGet(actor, storageKey) {
  check(typeof supabaseUrl === 'string' && typeof publishableKey === 'string', 'PUBLIC_SUPABASE_RUNTIME_CONFIG_UNAVAILABLE')
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const token = parseSessionCookie(await sessions.get(actor).cookies(config.baseUrl), projectRef)
  check(Boolean(token), `SUPABASE_USER_SESSION_NOT_FOUND_${actor.toUpperCase()}`)
  const url = new URL(`/storage/v1/object/authenticated/performance-review-attachments/${storageKey.split('/').map(encodeURIComponent).join('/')}`, supabaseUrl)
  const response = await fetch(url, { headers: { apikey: publishableKey, authorization: `Bearer ${token}` } })
  return { status: response.status, contentType: response.headers.get('content-type') }
}

async function createActiveRound(title) {
  const draft = await api('hr-admin', 'POST', '/api/performance-reviews', {
    action: 'save-draft', title, introduction: 'Een afgebakende controle van workflow, dossierhistorie en toegangsrechten.',
    roundType: 'DEVELOPMENT', periodStart: '2026-01-01', periodEnd: '2026-12-31',
    startDate: '2026-11-26', dueDate: '2026-12-31', rating: null,
  }, [201], randomUUID())
  const published = await api('hr-admin', 'POST', `/api/performance-reviews/rounds/${draft.data.id}/publish`, { version: draft.data.version }, [200], randomUUID())
  const dossier = await api('hr-admin', 'POST', `/api/performance-reviews/rounds/${draft.data.id}/dossiers`, {
    employeeId, reviewerEmployeeId, administrationId: config.administrationId,
  }, [201], randomUUID())
  check(dossier.data.phase === 'WAITING_EMPLOYEE' && published.data.status === 'ACTIVE', 'ACTIVE_DOSSIER_INITIAL_PHASE_MISMATCH')
  return { round: draft.data, dossier: dossier.data, title }
}

async function closeAndCheck(item, expectedPhase) {
  const before = await api('hr-admin', 'GET', `/api/performance-reviews/dossiers/${item.dossier.id}`)
  check(before.data.phase === expectedPhase, `CLOSE_BEFORE_PHASE_MISMATCH_${expectedPhase}`)
  const round = await api('hr-admin', 'GET', `/api/performance-reviews/rounds/${item.round.id}`)
  await api('hr-admin', 'POST', `/api/performance-reviews/rounds/${item.round.id}/close`, {
    version: round.data.version,
    reason: 'Gecontroleerde closeout van open dossierfasen; status blijft als historie behouden.',
  }, [200], randomUUID())
  const after = await api('hr-admin', 'GET', `/api/performance-reviews/dossiers/${item.dossier.id}`)
  check(after.data.phase === expectedPhase, `CLOSE_CHANGED_DOSSIER_PHASE_${expectedPhase}`)
  check(after.data.performance_review_rounds?.status === 'CLOSED', `CLOSE_ROUND_NOT_CLOSED_${expectedPhase}`)
  const history = await api('employee', 'GET', `/api/performance-reviews?employeeId=${employeeId}`)
  check(history.data.items?.some((entry) => entry.id === item.dossier.id && entry.status === 'CLOSED_OPEN' && entry.phase === expectedPhase), `CLOSED_OPEN_HISTORY_MISSING_${expectedPhase}`)
  for (const actor of ['employee', 'manager']) {
    const dashboard = await api(actor, 'GET', `/api/performance-reviews/dashboard?role=${actor}`)
    check(!dashboard.data.nextActions?.some((action) => action.id === item.dossier.id || action.dossierId === item.dossier.id || action.title === item.title), `CLOSED_DOSSIER_ACTION_REMAINS_${actor}_${expectedPhase}`)
  }
  return { roundId: item.round.id, dossierId: item.dossier.id, processInstanceId: after.data.process_instance_id, phase: after.data.phase, historyStatus: 'CLOSED_OPEN' }
}

const browser = await chromium.launch({ headless: true, ...(process.env.PERF_MVP_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PERF_MVP_CHROMIUM_EXECUTABLE_PATH } : {}) })
try {
  for (const actor of ['hr-admin', 'manager', 'employee']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    sessions.set(actor, context)
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(Math.max(config.timeoutMs, 120000))
    pages.set(actor, page)
    await loginWithTestAuth(page, config, '/dashboard/start', { allowContextSelection: true })
    await ensureContext(context, actor === 'employee' ? { ...config, administrationId: null, requireServerAuthorizedAdministration: true } : config)
    await navigateToRoute(page, config, '/dashboard/start')
    if (actor !== 'hr-admin') {
      await switchFromHrAdmin(page, config, actor, { label: 'desktop', width: 1440, height: 900 })
      await ensureContext(context, actor === 'employee' ? { ...config, administrationId: null, requireServerAuthorizedAdministration: true } : config)
    }
    await navigateToRoute(page, config, '/dashboard/start')
  }
  result.push({ id: 'persona-session', status: 'PASS', actors: ['hr-admin', 'manager', 'employee'], auth: 'existing role-switch flow' })

  const waitingEmployee = await createActiveRound(`Closeout fase medewerker · ${runLabel}`)
  const waitingManager = await createActiveRound(`Closeout fase manager · ${runLabel}`)
  await api('employee', 'POST', '/api/performance-reviews', {
    action: 'submit-self', dossierId: waitingManager.dossier.id, version: waitingManager.dossier.version,
    body: 'Ik heb de overdracht verbeterd en plan verdere vakontwikkeling voor het volgende kwartaal.',
  })
  waitingManager.dossier = (await api('employee', 'GET', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}`)).data
  check(waitingManager.dossier.phase === 'WAITING_MANAGER', 'EMPLOYEE_SUBMISSION_PHASE_MISMATCH')

  const noteCanary = `PRIVATE-NOTE-CANARY-PERF-A14-A29-${randomUUID()}`
  await api('manager', 'POST', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}/private-note`, {
    version: waitingManager.dossier.version, body: noteCanary,
  })
  const privateRead = await api('manager', 'GET', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}/private-note`)
  check(privateRead.data?.some((note) => note.body === noteCanary), 'MANAGER_PRIVATE_NOTE_READBACK_MISSING')

  const idempotencyKey = randomUUID()
  const filename = 'closeout-unreleased.pdf'
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n', 'utf8')
  const upload = await api('manager', 'POST', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}/attachments`, undefined, [201], idempotencyKey, {
    file: { name: filename, mimeType: 'application/pdf', buffer: pdf },
  })
  const storageKey = `${config.tenantId}/${waitingManager.dossier.id}/${idempotencyKey}/${filename}`
  const managerStorage = await directStorageGet('manager', storageKey)
  const employeeStorage = await directStorageGet('employee', storageKey)
  check(managerStorage.status === 200, `MANAGER_STORAGE_OBJECT_UNAVAILABLE_${managerStorage.status}`)
  check([400, 401, 403, 404].includes(employeeStorage.status), `EMPLOYEE_STORAGE_POLICY_ALLOWED_${employeeStorage.status}`)
  const employeeUpload = await api('employee', 'POST', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}/attachments`, undefined, [403], randomUUID(), {
    file: { name: 'unauthorized-upload.pdf', mimeType: 'application/pdf', buffer: pdf },
  })
  const employeeDelete = await api('employee', 'DELETE', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}/attachments/${upload.data.id}`, undefined, [403, 404])
  const employeeAttachmentRead = await api('employee', 'GET', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}/attachments/${upload.data.id}`, undefined, [403, 404])
  result.push({ id: 'A13-storage-and-employee-mutations', status: 'PASS', managerRawStorageGet: managerStorage.status, employeeRawStorageGet: employeeStorage.status, employeeUpload: employeeUpload.status, employeeDelete: employeeDelete.status, employeeAttachmentRead: employeeAttachmentRead.status, unreleasedAttachmentDenied: true })

  const dossierEmployee = await api('employee', 'GET', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}`)
  const appraisalEmployee = await api('employee', 'GET', `/api/continuous-appraisal?employeeId=${employeeId}`)
  const historyEmployee = await api('employee', 'GET', `/api/performance-reviews/employees/${employeeId}`)
  const generalDocuments = await api('employee', 'GET', `/api/employees/${employeeId}/documents`, undefined, [200, 403, 404])
  const exportResponse = await api('employee', 'GET', '/api/talent/reports/export?mode=self&reportType=all&timeframe=all', undefined, [200, 403, 404])
  const projectedOutputs = [dossierEmployee.data, appraisalEmployee.data, historyEmployee.data, generalDocuments.data, exportResponse.text].map((value) => JSON.stringify(value))
  check(projectedOutputs.every((value) => !value.includes(noteCanary)), 'PRIVATE_NOTE_LEAK_IN_EMPLOYEE_PROJECTION')
  check([403, 404].includes((await api('employee', 'GET', `/api/performance-reviews/dossiers/${waitingManager.dossier.id}/private-note`, undefined, [403, 404])).status), 'EMPLOYEE_PRIVATE_NOTE_ENDPOINT_ALLOWED')
  result.push({ id: 'A14-A25-private-note-projections', status: 'PASS', employeeDossier: 'PASS', continuousAppraisal: 'PASS', employeeHistory: 'PASS', generalDocuments: generalDocuments.status, selfExport: exportResponse.status, noteMarkerAbsent: true })

  const waitingAck = await createActiveRound(`Closeout fase akkoord · ${runLabel}`)
  await api('employee', 'POST', '/api/performance-reviews', {
    action: 'submit-self', dossierId: waitingAck.dossier.id, version: waitingAck.dossier.version,
    body: 'Ik heb de samenwerking en overdracht verbeterd en wil deze afspraken evalueren.',
  })
  let ackDossier = (await api('employee', 'GET', `/api/performance-reviews/dossiers/${waitingAck.dossier.id}`)).data
  check(ackDossier.phase === 'WAITING_MANAGER', 'ACK_FLOW_SELF_PHASE_MISMATCH')
  await api('manager', 'POST', '/api/performance-reviews', {
    action: 'submit-manager', dossierId: ackDossier.id, version: ackDossier.version,
    body: 'De overdracht verloopt consistenter; we evalueren de werkafspraken na het volgende kwartaal.',
  })
  ackDossier = (await api('manager', 'GET', `/api/performance-reviews/dossiers/${waitingAck.dossier.id}`)).data
  check(ackDossier.phase === 'WAITING_ACKNOWLEDGEMENT', 'ACK_FLOW_MANAGER_PHASE_MISMATCH')

  const closed = []
  closed.push(await closeAndCheck(waitingEmployee, 'WAITING_EMPLOYEE'))
  closed.push(await closeAndCheck(waitingManager, 'WAITING_MANAGER'))
  closed.push(await closeAndCheck(waitingAck, 'WAITING_ACKNOWLEDGEMENT'))
  result.push({ id: 'A19-close-all-open-phases', status: 'PASS', dossiers: closed })

  const history = await api('employee', 'GET', `/api/performance-reviews?employeeId=${employeeId}`)
  const hasClosedOpen = history.data.items?.some((item) => closed.some((entry) => entry.dossierId === item.id && item.phase === entry.phase && item.status === 'CLOSED_OPEN'))
  const hasAgree = history.data.items?.some((item) => item.phase === 'COMPLETED_AGREED')
  const hasDisagree = history.data.items?.some((item) => item.phase === 'COMPLETED_DISAGREED')
  check(hasClosedOpen && hasAgree && hasDisagree, 'HISTORY_CLOSED_OPEN_OR_ACK_DECISIONS_MISSING')
  const completed = history.data.items?.find((item) => item.phase === 'COMPLETED_AGREED' || item.phase === 'COMPLETED_DISAGREED')
  check(Boolean(completed?.id), 'HISTORY_COMPLETED_DOSSIER_MISSING')
  const completedDetail = await api('hr-admin', 'GET', `/api/performance-reviews/dossiers/${completed.id}`)
  const submissions = completedDetail.data.performance_review_submissions ?? []
  const selfFinal = submissions.find((submission) => submission.kind === 'SELF' && submission.submitted_at)
  const managerFinal = submissions.find((submission) => submission.kind === 'MANAGER' && submission.submitted_at)
  check(Boolean(selfFinal?.body && (selfFinal.author_user_id || selfFinal.actor_user_id) && Date.parse(selfFinal.submitted_at) && selfFinal.id), 'HISTORY_SELF_AUTHOR_OR_TIMESTAMP_MISSING')
  check(Boolean(managerFinal?.body && (managerFinal.author_user_id || managerFinal.actor_user_id) && Date.parse(managerFinal.submitted_at) && managerFinal.id), 'HISTORY_MANAGER_AUTHOR_OR_TIMESTAMP_MISSING')
  const releasedAttachments = completedDetail.data.performance_review_attachments ?? []
  check(releasedAttachments.length > 0 && releasedAttachments.every((attachment) => attachment.created_at && attachment.released_at), 'HISTORY_ATTACHMENT_METADATA_INCOMPLETE')
  result.push({ id: 'A23-history-content-authors-times-attachments-decisions', status: 'PASS', completedPhase: completed.phase, detailActor: 'hr-admin', selfAuthorTimestamp: true, managerAuthorTimestamp: true, releasedAttachmentCount: releasedAttachments.length, agreement: hasAgree, disagreement: hasDisagree, prematureCloseHistory: 'PASS' })

  result.push({ id: 'scope-closeout', status: 'PASS', closedDossiers: closed.map((entry) => entry.dossierId), employeeHistoryDenied: 'see A26 supplemental checks' })
} catch (error) {
  const code = error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message) ? error.message : 'CLOSEOUT_OPERATION_FAILED'
  result.push({ id: 'closeout-run', status: 'FAIL', code })
  process.exitCode = 1
} finally {
  await browser.close()
  console.log(JSON.stringify({ mode: 'local-existing-personas', codeSha: process.env.PERF_MVP_CODE_SHA ?? null, results: result }, null, 2))
}
