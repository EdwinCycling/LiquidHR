#!/usr/bin/env node

import {
  compareContexts,
  isActiveAdministrationContextConsistent,
  parseAccessibleAdministrationIds,
  safeContextConfiguration,
} from './local-test-acceptance-context.mjs'

const MOBILE_VIEWPORT = Object.freeze({ label: 'mobile', width: 393, height: 852 })
const DESKTOP_VIEWPORT = Object.freeze({ label: 'desktop', width: 1440, height: 900 })
const PERSONAS = Object.freeze(['hr-admin', 'manager', 'employee'])
const PROBE_METHODS = Object.freeze(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let chromium

class RunnerError extends Error {
  constructor(code, kind, details = {}) {
    super(code)
    this.code = code
    this.kind = kind
    this.details = details
  }
}

function runnerError(code, kind, details = {}) {
  return new RunnerError(code, kind, details)
}

function fail(code, kind, details = {}) {
  throw runnerError(code, kind, details)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSafeRelativePath(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !/[\u0000-\u001f]/u.test(value)
}

function normalizeRoute(value) {
  if (!isSafeRelativePath(value) || value === '/login' || value.startsWith('/login?')) {
    fail('INVALID_ROUTE', 'CONFIGURATION')
  }

  const parsed = new URL(value, 'http://localhost')
  if (parsed.hash) fail('INVALID_ROUTE', 'CONFIGURATION')
  return `${parsed.pathname}${parsed.search}`
}

function pathLocation(value) {
  try {
    const parsed = new URL(value)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return '/unknown'
  }
}

function displayPath(value) {
  try {
    return new URL(value, 'http://localhost').pathname
  } catch {
    return '/unknown'
  }
}

function normalizeBaseUrl(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    fail('INVALID_BASE_URL', 'CONFIGURATION')
  }

  if (parsed.username || parsed.password) fail('BASE_URL_USERINFO_FORBIDDEN', 'CONFIGURATION')

  const loopbackHost = parsed.hostname === 'localhost'
    || parsed.hostname === '127.0.0.1'
    || parsed.hostname === '[::1]'
    || parsed.hostname === '::1'
  if (!loopbackHost || !['http:', 'https:'].includes(parsed.protocol)) {
    fail('NON_LOOPBACK_BASE_URL', 'CONFIGURATION')
  }

  parsed.pathname = parsed.pathname.replace(/\/$/u, '')
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString().replace(/\/$/u, '')
}

function requireUuid(value, code) {
  if (!UUID_PATTERN.test(value)) fail(code, 'CONFIGURATION')
  return value
}

function parseStatusList(value) {
  const statuses = value.split(',').map((item) => Number(item.trim()))
  if (statuses.length === 0 || statuses.some((status) => !Number.isInteger(status) || status < 100 || status > 599)) {
    fail('INVALID_PROBE_STATUS', 'CONFIGURATION')
  }
  return statuses
}

function assertSafeProbeBody(value) {
  if (!isRecord(value)) fail('INVALID_PROBE_BODY', 'CONFIGURATION')
  const forbiddenKey = /password|passcode|token|secret|cookie|authorization|credential|magic.?link|api.?key|bearer|session|jwt/iu
  const visit = (candidate) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit)
      return
    }
    if (!isRecord(candidate)) return
    for (const [key, child] of Object.entries(candidate)) {
      if (forbiddenKey.test(key)) fail('UNSAFE_PROBE_BODY', 'CONFIGURATION')
      visit(child)
    }
  }
  visit(value)
}

function parseProbeSpec(raw, mode) {
  if (typeof raw !== 'string' || raw.trim() === '') fail('INVALID_PROBE', 'CONFIGURATION')

  let value = raw.trim()
  let persona = null
  const personaSeparator = value.indexOf('=')
  if (personaSeparator > 0) {
    const possiblePersona = value.slice(0, personaSeparator).trim().toLowerCase()
    if (PERSONAS.includes(possiblePersona)) {
      persona = possiblePersona
      value = value.slice(personaSeparator + 1).trim()
    }
  }

  let body
  const bodySeparator = value.indexOf('|')
  if (bodySeparator > -1) {
    const bodyText = value.slice(bodySeparator + 1).trim()
    value = value.slice(0, bodySeparator).trim()
    try {
      body = JSON.parse(bodyText)
    } catch {
      fail('INVALID_PROBE_BODY', 'CONFIGURATION')
    }
    assertSafeProbeBody(body)
  }

  let statuses = mode === 'allow' ? null : [401, 403, 404]
  const statusSeparator = value.lastIndexOf('@')
  if (statusSeparator > -1) {
    const statusText = value.slice(statusSeparator + 1)
    if (!/^[0-9,]+$/u.test(statusText)) fail('INVALID_PROBE_STATUS', 'CONFIGURATION')
    statuses = parseStatusList(statusText)
    const allowedStatuses = mode === 'allow'
      ? statuses.every((status) => status >= 200 && status < 300)
      : statuses.every((status) => [401, 403, 404].includes(status))
    if (!allowedStatuses) fail(mode === 'allow' ? 'INVALID_ALLOW_PROBE_STATUS' : 'INVALID_DENY_PROBE_STATUS', 'CONFIGURATION')
    value = value.slice(0, statusSeparator).trim()
  }

  const methodMatch = value.match(/^([A-Za-z]+)(?::|\s+)(.+)$/u)
  if (!methodMatch) fail('INVALID_PROBE', 'CONFIGURATION')

  const method = methodMatch[1].toUpperCase()
  if (!PROBE_METHODS.includes(method)) fail('INVALID_PROBE_METHOD', 'CONFIGURATION')
  if (body !== undefined && ['GET', 'HEAD', 'OPTIONS'].includes(method)) fail('INVALID_PROBE_BODY_METHOD', 'CONFIGURATION')

  const path = methodMatch[2].trim()
  if (!isSafeRelativePath(path)) fail('INVALID_PROBE_PATH', 'CONFIGURATION')
  const parsedPath = new URL(path, 'http://localhost')
  if (parsedPath.hash) fail('INVALID_PROBE_PATH', 'CONFIGURATION')

  return {
    mode,
    method,
    path: `${parsedPath.pathname}${parsedPath.search}`,
    displayPath: parsedPath.pathname,
    persona,
    statuses,
    body,
  }
}

function parseViewports(options) {
  const requested = [...options.viewports]
  if (options.desktop) requested.push('desktop')
  if (options.mobile) requested.push('mobile')
  const unique = [...new Set(requested)]
  if (unique.length === 0) unique.push('desktop')
  if (unique.some((label) => !['desktop', 'mobile'].includes(label))) fail('INVALID_VIEWPORT', 'CONFIGURATION')
  return unique.map((label) => label === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT)
}

function parsePersonas(options) {
  const requested = options.personas.length > 0 ? options.personas : [...PERSONAS]
  const unique = [...new Set(requested.flatMap((value) => value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)))]
  if (unique.length === 0 || unique.some((persona) => !PERSONAS.includes(persona))) fail('INVALID_PERSONA', 'CONFIGURATION')
  return unique
}

function takeValue(argv, index, inlineValue) {
  if (inlineValue !== undefined) return { value: inlineValue, nextIndex: index }
  const nextValue = argv[index + 1]
  if (!nextValue || nextValue.startsWith('--')) fail('MISSING_ARGUMENT_VALUE', 'CONFIGURATION')
  return { value: nextValue, nextIndex: index + 1 }
}

function parseArguments(argv) {
  const options = {
    baseUrl: null,
    route: '/dashboard/start',
    employeeRoute: '/personal-settings',
    personas: [],
    tenantId: null,
    hrGroupId: null,
    administrationId: null,
    viewports: [],
    desktop: false,
    mobile: false,
    timeoutMs: 15000,
    allowProbes: [],
    denyProbes: [],
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }

    const separator = argument.indexOf('=')
    const name = separator > -1 ? argument.slice(0, separator) : argument
    const inlineValue = separator > -1 ? argument.slice(separator + 1) : undefined
    if (!name.startsWith('--')) fail('UNKNOWN_ARGUMENT', 'CONFIGURATION')

    if (name === '--desktop' || name === '--mobile') {
      const optionName = name.slice(2)
      const value = inlineValue === undefined ? true : inlineValue !== 'false'
      options[optionName] = value
      continue
    }

    const valueOption = takeValue(argv, index, inlineValue)
    index = valueOption.nextIndex
    const value = valueOption.value
    switch (name) {
      case '--base-url':
        options.baseUrl = value
        break
      case '--route':
        options.route = value
        break
      case '--employee-route':
        options.employeeRoute = value
        break
      case '--persona':
      case '--personas':
        options.personas.push(value)
        break
      case '--tenant-id':
      case '--tenant':
        options.tenantId = value
        break
      case '--hr-group-id':
      case '--hr-group':
        options.hrGroupId = value
        break
      case '--administration-id':
      case '--administration':
        options.administrationId = value
        break
      case '--viewport':
        options.viewports.push(...value.split(',').map((item) => item.trim().toLowerCase()))
        break
      case '--timeout-ms':
        options.timeoutMs = Number(value)
        if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 120000) fail('INVALID_TIMEOUT', 'CONFIGURATION')
        break
      case '--allow-probe':
        options.allowProbes.push(parseProbeSpec(value, 'allow'))
        break
      case '--deny-probe':
        options.denyProbes.push(parseProbeSpec(value, 'deny'))
        break
      default:
        fail('UNKNOWN_ARGUMENT', 'CONFIGURATION')
    }
  }

  if (options.help) return options
  if (!options.baseUrl) fail('BASE_URL_REQUIRED', 'CONFIGURATION')

  return {
    ...options,
    baseUrl: normalizeBaseUrl(options.baseUrl),
    route: normalizeRoute(options.route),
    employeeRoute: normalizeRoute(options.employeeRoute),
    personas: parsePersonas(options),
    viewports: parseViewports(options),
    tenantId: options.tenantId ? requireUuid(options.tenantId, 'INVALID_TENANT_ID') : null,
    hrGroupId: options.hrGroupId ? requireUuid(options.hrGroupId, 'INVALID_HR_GROUP_ID') : null,
    administrationId: options.administrationId ? requireUuid(options.administrationId, 'INVALID_ADMINISTRATION_ID') : null,
  }
}

function expectedContext(config) {
  return {
    tenantId: config.tenantId,
    hrGroupId: config.hrGroupId,
    administrationId: config.administrationId,
  }
}

function expectedContextSummary(config) {
  return {
    tenantConfigured: config.tenantId !== null,
    hrGroupConfigured: config.hrGroupId !== null,
    administrationExpectation: config.requireServerAuthorizedAdministration
      ? 'server-authorized'
      : config.administrationId !== null ? 'exact' : 'not-configured',
  }
}

function contextComparison(actual, expected) {
  return {
    tenantMatches: expected.tenantId === null ? null : actual.tenantId === expected.tenantId,
    hrGroupMatches: expected.hrGroupId === null ? null : actual.hrGroupId === expected.hrGroupId,
    administrationPresent: actual.administrationId !== null,
    administrationMatches: expected.administrationId === null ? null : actual.administrationId === expected.administrationId,
    administrationConsistentWithAccessibleSet: isActiveAdministrationContextConsistent(actual),
  }
}

function contextSnapshot(payload) {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null
  if (!data || !isRecord(data.tenant) || !isRecord(data.activeHrGroup)) return null
  const accessibleAdministrationIds = parseAccessibleAdministrationIds(data.administrationsInActiveHrGroup)
  if (accessibleAdministrationIds === null) return null

  return {
    tenantId: typeof data.tenant.id === 'string' ? data.tenant.id : null,
    hrGroupId: typeof data.activeHrGroup.id === 'string' ? data.activeHrGroup.id : null,
    administrationId: isRecord(data.activeAdministration) && typeof data.activeAdministration.id === 'string'
      ? data.activeAdministration.id
      : null,
    accessibleAdministrationIds,
  }
}



function statusMatches(probe, status) {
  if (probe.statuses) return probe.statuses.includes(status)
  return probe.mode === 'allow' ? status >= 200 && status < 300 : [401, 403, 404].includes(status)
}

function statusForKind(kind) {
  switch (kind) {
    case 'CONTEXT':
      return 'BLOCKED BY CONTEXT'
    case 'AUTH':
      return 'BLOCKED BY ENVIRONMENT'
    case 'HARNESS':
      return 'HARNESS_FRICTION'
    case 'COVERAGE':
      return 'PARTIAL'
    case 'CONFIGURATION':
      return 'RED'
    default:
      return 'RED'
  }
}

function safeFailure(error, phase = 'unknown') {
  if (!(error instanceof RunnerError)) {
    return {
      status: 'HARNESS_FRICTION',
      code: 'UNEXPECTED_RUNNER_ERROR',
      phase,
      errorName: error instanceof Error ? error.name : 'NonErrorThrown',
    }
  }
  const output = { status: statusForKind(error.kind), code: error.code }
  if (error.details && typeof error.details === 'object') {
    for (const key of ['actualPath', 'expectedPath', 'endpoint', 'method', 'httpStatus', 'confirmationStatus', 'destinationStatus', 'sameOrigin', 'personaSubmitted', 'target', 'mismatches', 'context', 'selectorVisible', 'targetOptionPresent', 'targetOptionCount', 'triggerExpanded', 'actorMarkerPresent', 'actorMatchesTarget', 'actorMarkerCount', 'triggerVisible', 'returnToAdminVisible', 'selectedRole', 'serverRoleUiAccepted', 'observedPersona', 'viewport', 'menuTriggerVisible', 'sidebarOpen']) {
      if (error.details[key] !== undefined) output[key] = error.details[key]
    }
  }
  return output
}

async function waitForLeavingLogin(page, timeoutMs) {
  try {
    await page.waitForURL((url) => url.pathname !== '/login' && url.pathname !== '/api/auth/test-login', { timeout: timeoutMs })
  } catch {
    fail('AUTH_REDIRECT_TIMEOUT', 'AUTH', { actualPath: displayPath(page.url()) })
  }
  const path = displayPath(page.url())
  if (path === '/login' || path === '/api/auth/test-login') fail('AUTH_REDIRECT_TIMEOUT', 'AUTH', { actualPath: path })
  return path
}

async function waitForRoleSwitchCompletion(page, select, timeoutMs, target) {
  const expectedPath = pathLocation(page.url())
  let resolveObserved
  let settled = false
  const observedPromise = new Promise((resolve) => { resolveObserved = resolve })
  let postStatus = null
  let confirmationStatus = null
  let destinationStatus = null
  const finish = (timedOut = false) => {
    if (settled) return
    settled = true
    page.off('response', onResponse)
    clearTimeout(timer)
    resolveObserved({ timedOut, postStatus, confirmationStatus, destinationStatus })
  }
  const onResponse = (response) => {
    const request = response.request()
    let pathname
    try {
      pathname = new URL(response.url()).pathname
    } catch {
      return
    }

    if (request.method() === 'POST' && pathname === '/api/auth/test-role-switch') {
      postStatus = response.status()
      if (postStatus !== 303) {
        finish()
        return
      }
    } else if (request.method() === 'GET' && pathname === '/auth/test-role-switch/confirm') {
      confirmationStatus = response.status()
    } else if (request.method() === 'GET' && pathname === expectedPath) {
      destinationStatus = response.status()
    }

    if (postStatus === 303 && confirmationStatus !== null && destinationStatus !== null) finish()
  }
  const timer = setTimeout(() => finish(true), timeoutMs)
  page.on('response', onResponse)

  try {
    await select.selectOption(target)
  } catch {
    finish(true)
    fail('ROLE_SWITCH_SELECTION_FAILED', 'HARNESS', { target })
  }

  const observed = await observedPromise
  if (observed.postStatus !== 303) {
    fail(observed.postStatus === null ? 'ROLE_SWITCH_SUBMIT_TIMEOUT' : 'ROLE_SWITCH_POST_REJECTED', 'PRODUCT', {
      target,
      httpStatus: observed.postStatus,
      confirmationStatus: observed.confirmationStatus,
      destinationStatus: observed.destinationStatus,
    })
  }
  if (observed.timedOut || observed.confirmationStatus !== 307 || observed.destinationStatus === null) {
    fail('ROLE_SWITCH_REDIRECT_TIMEOUT', 'PRODUCT', {
      target,
      actualPath: displayPath(page.url()),
      httpStatus: observed.confirmationStatus,
      destinationStatus: observed.destinationStatus,
    })
  }

  const path = pathLocation(page.url())
  if (path !== expectedPath) fail('ROLE_SWITCH_REDIRECT_MISMATCH', 'PRODUCT', { target, actualPath: displayPath(page.url()), expectedPath: displayPath(expectedPath) })
  return displayPath(page.url())
}

async function loginWithTestAuth(page, config, expectedLocation, { allowContextSelection = false } = {}) {
  const loginUrl = new URL('/login', config.baseUrl)
  loginUrl.searchParams.set('next', expectedLocation)
  await page.goto(loginUrl.toString(), { waitUntil: 'domcontentloaded' })

  const button = page.getByTestId('test-login-hr-admin')
  try {
    await button.waitFor({ state: 'visible', timeout: config.timeoutMs })
  } catch {
    fail('TEST_AUTH_UI_UNAVAILABLE', 'AUTH', { actualPath: displayPath(page.url()) })
  }

  let response
  try {
    const responses = await Promise.all([
      page.waitForResponse((candidate) => {
        try {
          return candidate.request().method() === 'POST'
            && new URL(candidate.url()).pathname === '/api/auth/test-login'
        } catch {
          return false
        }
      }, { timeout: config.timeoutMs }),
      button.click(),
    ])
    response = responses[0]
  } catch {
    fail('TEST_LOGIN_RESPONSE_TIMEOUT', 'AUTH', { actualPath: displayPath(page.url()) })
  }
  const responseStatus = response.status()
  if (responseStatus < 300 || responseStatus >= 400) {
    let errorCode = null
    const payload = await response.json().catch(() => null)
    if (isRecord(payload) && ['TEST_LOGIN_DISABLED', 'TEST_LOGIN_FORBIDDEN', 'TEST_LOGIN_UNAVAILABLE'].includes(payload.error)) {
      errorCode = payload.error
    }
    const request = response.request()
    const requestOrigin = request.headers().origin
    const originUrl = new URL(request.url())
    const submittedPersona = new URLSearchParams(request.postData() ?? '').get('persona')
    const failureKind = errorCode === 'TEST_LOGIN_FORBIDDEN' || responseStatus >= 500
      ? 'PRODUCT'
      : 'AUTH'
    fail(errorCode ?? 'TEST_LOGIN_HTTP_FAILURE', failureKind, {
      httpStatus: responseStatus,
      sameOrigin: requestOrigin === originUrl.origin,
      personaSubmitted: submittedPersona === 'hr-admin',
    })
  }
  await waitForLeavingLogin(page, config.timeoutMs)
  const actualLocation = pathLocation(page.url())
  if (actualLocation !== expectedLocation && !(allowContextSelection && displayPath(page.url()) === '/context/select')) {
    fail('LOGIN_REDIRECT_MISMATCH', 'PRODUCT', {
      actualPath: displayPath(page.url()),
      expectedPath: displayPath(expectedLocation),
    })
  }
  return { path: actualLocation, httpStatus: responseStatus }
}

async function openMobileNavigation(page, viewport, config) {
  if (viewport.label !== 'mobile') return
  const menuTrigger = page.locator('header button[aria-label]').first()
  const waitUntilOpen = async (timeoutMs) => {
    try {
      await page.waitForFunction(
      () => document.querySelector('aside')?.classList.contains('translate-x-0') === true,
      undefined,
        { timeout: timeoutMs },
      )
      return true
    } catch {
      return false
    }
  }

  try {
    await menuTrigger.click({ timeout: config.timeoutMs })
  } catch {
    fail('MOBILE_NAVIGATION_UNAVAILABLE', 'HARNESS', { viewport: viewport.label, menuTriggerVisible: false })
  }
  if (!await waitUntilOpen(Math.min(config.timeoutMs, 1500))) {
    try {
      await menuTrigger.click({ timeout: config.timeoutMs })
    } catch {
      fail('MOBILE_NAVIGATION_UNAVAILABLE', 'HARNESS', { viewport: viewport.label, menuTriggerVisible: false })
    }
    if (!await waitUntilOpen(config.timeoutMs)) {
      fail('MOBILE_NAVIGATION_UNAVAILABLE', 'HARNESS', {
        viewport: viewport.label,
        menuTriggerVisible: await menuTrigger.isVisible().catch(() => false),
        sidebarOpen: false,
      })
    }
  }
}

async function openRoleSwitcher(page, trigger, select, config, persona) {
  const waitUntilExpanded = async (timeoutMs) => {
    try {
      await page.waitForFunction(
        () => document.querySelector('[data-testid="test-role-switch-trigger"]')?.getAttribute('aria-expanded') === 'true',
        undefined,
        { timeout: timeoutMs },
      )
      return true
    } catch {
      return false
    }
  }

  try {
    await trigger.click({ timeout: config.timeoutMs })
  } catch {
    fail('ROLE_SWITCH_TRIGGER_UNAVAILABLE', 'HARNESS', {
      target: persona,
      triggerVisible: await trigger.isVisible().catch(() => false),
      triggerExpanded: await trigger.getAttribute('aria-expanded').catch(() => null),
    })
  }
  if (!await waitUntilExpanded(Math.min(config.timeoutMs, 1500))) {
    if (await trigger.getAttribute('aria-expanded').catch(() => null) !== 'true') {
      try {
        await trigger.click({ timeout: config.timeoutMs })
      } catch {
        fail('ROLE_SWITCH_TRIGGER_UNAVAILABLE', 'HARNESS', {
          target: persona,
          triggerVisible: await trigger.isVisible().catch(() => false),
          triggerExpanded: await trigger.getAttribute('aria-expanded').catch(() => null),
        })
      }
    }
    if (!await waitUntilExpanded(config.timeoutMs)) {
      fail('ROLE_SWITCH_TARGET_UNAVAILABLE', 'PRODUCT', {
        target: persona,
        selectorVisible: false,
        triggerExpanded: await trigger.getAttribute('aria-expanded').catch(() => null),
      })
    }
  }

  try {
    await select.waitFor({ state: 'visible', timeout: config.timeoutMs })
  } catch {
    fail('ROLE_SWITCH_TARGET_UNAVAILABLE', 'PRODUCT', {
      target: persona,
      selectorVisible: false,
      triggerExpanded: await trigger.getAttribute('aria-expanded').catch(() => null),
    })
  }
}

async function switchFromHrAdmin(page, config, persona, viewport) {
  await openMobileNavigation(page, viewport, config)
  const trigger = page.getByTestId('test-role-switch-trigger')
  try {
    await trigger.waitFor({ state: 'visible', timeout: config.timeoutMs })
  } catch {
    fail('ROLE_SWITCH_UI_UNAVAILABLE', 'PRODUCT', { actualPath: displayPath(page.url()), target: persona })
  }

  const select = page.getByTestId('test-role-switch-target')
  await openRoleSwitcher(page, trigger, select, config, persona)

  const values = await select.locator('option').evaluateAll((options) => options.map((option) => option.value))
  if (!values.includes(persona)) {
    fail('ROLE_SWITCH_TARGET_UNAVAILABLE', 'PRODUCT', {
      target: persona,
      selectorVisible: true,
      targetOptionPresent: false,
      targetOptionCount: values.length,
      triggerExpanded: await trigger.getAttribute('aria-expanded').catch(() => null),
    })
  }

  await waitForRoleSwitchCompletion(page, select, config.timeoutMs, persona)
  const path = displayPath(page.url())
  if (path === '/login') fail('ROLE_SWITCH_FAILED', 'PRODUCT', { actualPath: path, target: persona })
  return path
}

async function inspectServerRoleUi(page, config, persona, viewport) {
  await openMobileNavigation(page, viewport, config)
  const trigger = page.getByTestId('test-role-switch-trigger')
  const returnButton = page.getByTestId('test-role-return-to-admin')
  const actorMarker = page.getByTestId('test-role-current-persona')
  const actorMarkerCount = await actorMarker.count()
  const actorPersona = actorMarkerCount === 1
    ? await actorMarker.getAttribute('data-persona').catch(() => null)
    : null
  const triggerVisible = await trigger.isVisible().catch(() => false)
  const returnVisible = await returnButton.isVisible().catch(() => false)
  if (actorPersona !== persona) {
    fail('ROLE_UI_IDENTITY_MISMATCH', 'PRODUCT', {
      target: persona,
      observedPersona: ['edwin', 'hr-admin', 'manager', 'employee'].includes(actorPersona) ? actorPersona : 'unknown',
      actorMarkerPresent: actorPersona !== null,
      actorMatchesTarget: false,
      actorMarkerCount,
      triggerVisible,
      returnToAdminVisible: returnVisible,
    })
  }
  let selectedRole = null

  if (triggerVisible) {
    const select = page.getByTestId('test-role-switch-target')
    await openRoleSwitcher(page, trigger, select, config, persona)
    selectedRole = await select.inputValue().catch(() => null)
    await page.keyboard.press('Escape')
  }

  const exact = selectedRole === persona
  const serverGated = persona === 'hr-admin' || persona === 'manager'
    ? exact || returnVisible
    : returnVisible

  if (!serverGated) {
    fail('ROLE_UI_IDENTITY_MISMATCH', 'PRODUCT', {
      target: persona,
      observedPersona: ['edwin', 'hr-admin', 'manager', 'employee'].includes(actorPersona) ? actorPersona : 'unknown',
      actorMarkerPresent: actorPersona !== null,
      actorMatchesTarget: actorPersona === persona,
      actorMarkerCount,
      triggerVisible,
      returnToAdminVisible: returnVisible,
      selectedRole,
      serverRoleUiAccepted: false,
    })
  }

  return {
    actorPersona,
    triggerVisible,
    returnToAdminVisible: returnVisible,
    selectedRole,
    exact,
  }
}

async function returnToHrAdmin(page, context, config, viewport) {
  await openMobileNavigation(page, viewport, config)
  const returnButton = page.getByTestId('test-role-return-to-admin')
  try {
    await returnButton.waitFor({ state: 'visible', timeout: config.timeoutMs })
  } catch {
    fail('ROLE_RETURN_UI_UNAVAILABLE', 'PRODUCT', { actualPath: displayPath(page.url()), target: 'hr-admin' })
  }

  const expectedPath = pathLocation(page.url())
  const postResponsePromise = page.waitForResponse((response) => {
    const request = response.request()
    try {
      return request.method() === 'POST' && new URL(response.url()).pathname === '/api/auth/test-login'
    } catch {
      return false
    }
  }, { timeout: config.timeoutMs })
  const navigationPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: config.timeoutMs })
  let postResponse
  let navigationResponse
  try {
    [postResponse, navigationResponse] = await Promise.all([
      postResponsePromise,
      navigationPromise,
      returnButton.click(),
    ])
  } catch {
    fail('ROLE_RETURN_REDIRECT_TIMEOUT', 'PRODUCT', {
      actualPath: displayPath(page.url()),
      target: 'hr-admin',
      httpStatus: postResponse?.status() ?? null,
      destinationStatus: navigationResponse?.status() ?? null,
    })
  }

  if (postResponse.status() !== 303) {
    fail('ROLE_RETURN_POST_REJECTED', 'PRODUCT', {
      target: 'hr-admin',
      httpStatus: postResponse.status(),
      destinationStatus: navigationResponse?.status() ?? null,
    })
  }

  const actualPath = pathLocation(page.url())
  if (actualPath !== expectedPath && actualPath !== '/context/select') {
    fail('ROLE_RETURN_REDIRECT_MISMATCH', 'PRODUCT', {
      actualPath: displayPath(page.url()),
      expectedPath: displayPath(expectedPath),
      target: 'hr-admin',
      httpStatus: navigationResponse?.status() ?? null,
    })
  }

  const returnedContext = await ensureContext(context, config)
  const destination = await navigateToRoute(page, config, expectedPath)
  const identity = await inspectServerRoleUi(page, config, 'hr-admin', viewport)
  return {
    target: 'hr-admin',
    path: displayPath(page.url()),
    httpStatus: postResponse.status(),
    destinationStatus: destination.httpStatus,
    context: returnedContext.after,
    identity,
  }
}

async function fetchJson(context, baseUrl, method, path, data) {
  let response
  try {
    response = await context.request.fetch(new URL(path, baseUrl).toString(), {
      method,
      data,
      failOnStatusCode: false,
      maxRedirects: 0,
      headers: { accept: 'application/json', origin: new URL(baseUrl).origin },
    })
  } catch {
    fail('CONTEXT_REQUEST_FAILED', 'CONTEXT', { endpoint: displayPath(path), method })
  }

  const payload = await response.json().catch(() => null)
  return { status: response.status(), payload }
}

async function postSwitchContextEvidence(context, config, hrAdminConfig) {
  let cookieList = []
  try {
    cookieList = await context.cookies(config.baseUrl)
  } catch {
  }

  let response
  try {
    response = await context.request.get(new URL('/api/context', config.baseUrl).toString(), {
      failOnStatusCode: false,
      maxRedirects: 0,
      headers: { accept: 'application/json', origin: new URL(config.baseUrl).origin },
    })
  } catch {
    return {
      contextHttpStatus: null,
      contextCookiePresent: {
        tenant: cookieList.some((cookie) => cookie.name === 'liquid-hr-tenant'),
        hrGroup: cookieList.some((cookie) => cookie.name === 'liquid-hr-hr-group'),
        administration: cookieList.some((cookie) => cookie.name === 'liquid-hr-administration'),
      },
      context: null,
      code: 'POST_SWITCH_CONTEXT_READ_FAILED',
    }
  }

  const snapshot = response.status() === 200 ? contextSnapshot(await response.json().catch(() => null)) : null
  return {
    contextHttpStatus: response.status(),
    contextCookiePresent: {
      tenant: cookieList.some((cookie) => cookie.name === 'liquid-hr-tenant'),
      hrGroup: cookieList.some((cookie) => cookie.name === 'liquid-hr-hr-group'),
      administration: cookieList.some((cookie) => cookie.name === 'liquid-hr-administration'),
    },
    context: snapshot ? {
      tenantMatchesExpected: config.tenantId === null ? null : snapshot.tenantId === config.tenantId,
      hrGroupMatchesExpected: config.hrGroupId === null ? null : snapshot.hrGroupId === config.hrGroupId,
      administrationPresent: snapshot.administrationId !== null,
      administrationMatchesHrAdminSelection: hrAdminConfig.administrationId === null
        ? null
        : snapshot.administrationId === hrAdminConfig.administrationId,
    } : null,
  }
}

async function readContext(context, config, { allowMissing = false } = {}) {
  const response = await fetchJson(context, config.baseUrl, 'GET', '/api/context')
  if (allowMissing && response.status === 409) return null
  if (response.status !== 200) {
    fail('CONTEXT_READ_BLOCKED', 'CONTEXT', { endpoint: '/api/context', httpStatus: response.status, method: 'GET' })
  }
  const snapshot = contextSnapshot(response.payload)
  if (!snapshot) fail('CONTEXT_RESPONSE_INVALID', 'CONTEXT', { endpoint: '/api/context', method: 'GET' })
  return snapshot
}

async function setContext(context, config, before, expected) {
  const actions = []
  const tenantMismatch = expected.tenantId !== null && (!before || before.tenantId !== expected.tenantId)
  const groupMismatch = expected.hrGroupId !== null && (!before || before.hrGroupId !== expected.hrGroupId)
  const administrationMismatch = expected.administrationId !== null && (!before || before.administrationId !== expected.administrationId)

  if (tenantMismatch && expected.hrGroupId === null) {
    fail('TENANT_SELECTION_REQUIRES_HR_GROUP', 'CONTEXT', { context: safeContextConfiguration(expected) })
  }
  if (!before && (expected.tenantId === null || expected.hrGroupId === null)) {
    fail('CONTEXT_SELECTION_REQUIRES_TENANT_AND_HR_GROUP', 'CONTEXT')
  }

  if (tenantMismatch || (groupMismatch && expected.tenantId !== null)) {
    const response = await fetchJson(context, config.baseUrl, 'POST', '/api/context/select', {
      tenantId: expected.tenantId ?? before?.tenantId,
      hrGroupId: expected.hrGroupId ?? before?.hrGroupId,
    })
    actions.push({ endpoint: '/api/context/select', method: 'POST', httpStatus: response.status })
    if (response.status !== 200) {
      fail('CONTEXT_SELECTION_BLOCKED', 'CONTEXT', { endpoint: '/api/context/select', method: 'POST', httpStatus: response.status })
    }
  } else if (groupMismatch) {
    const response = await fetchJson(context, config.baseUrl, 'POST', '/api/context/hr-group', { hrGroupId: expected.hrGroupId })
    actions.push({ endpoint: '/api/context/hr-group', method: 'POST', httpStatus: response.status })
    if (response.status !== 200) {
      fail('HR_GROUP_SELECTION_BLOCKED', 'CONTEXT', { endpoint: '/api/context/hr-group', method: 'POST', httpStatus: response.status })
    }
  }

  if (administrationMismatch) {
    const response = await fetchJson(context, config.baseUrl, 'POST', '/api/context/administration', { administrationId: expected.administrationId })
    actions.push({ endpoint: '/api/context/administration', method: 'POST', httpStatus: response.status })
    if (response.status !== 200) {
      const observed = await readContext(context, config, { allowMissing: true }).catch(() => null)
      fail('ADMINISTRATION_SELECTION_BLOCKED', 'CONTEXT', {
        endpoint: '/api/context/administration',
        method: 'POST',
        httpStatus: response.status,
        context: observed ? contextComparison(observed, expected) : null,
      })
    }
  }

  return actions
}

async function ensureContext(context, config) {
  const expected = expectedContext(config)
  const before = await readContext(context, config, { allowMissing: true })
  if (!before && expected.tenantId === null && expected.hrGroupId === null && expected.administrationId === null) {
    fail('CONTEXT_REQUIRED', 'CONTEXT', { endpoint: '/api/context', method: 'GET' })
  }
  const actions = await setContext(context, config, before, expected)
  const after = actions.length > 0 ? await readContext(context, config) : before
  if (!after) fail('CONTEXT_REQUIRED', 'CONTEXT', { endpoint: '/api/context', method: 'GET' })
  const mismatches = compareContexts(after, expected, config.strictNullContextFields ?? [])
  if (mismatches.length > 0) {
    fail('CONTEXT_VERIFICATION_MISMATCH', 'CONTEXT', { context: { mismatches, comparisons: contextComparison(after, expected) } })
  }
  if (!isActiveAdministrationContextConsistent(after)) {
    fail('ADMINISTRATION_CONTEXT_OUTSIDE_ACCESSIBLE_SET', 'CONTEXT', { context: contextComparison(after, expected) })
  }
  return {
    before: before ? contextComparison(before, expected) : null,
    actions,
    after: contextComparison(after, expected),
  }
}

async function navigateToRoute(page, config, requestedRoute = config.route) {
  const response = await page.goto(new URL(requestedRoute, config.baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  if (response?.status() === 403) {
    fail('ROUTE_AUTHORIZATION_BLOCKED', 'PRODUCT', { actualPath: displayPath(page.url()), expectedPath: displayPath(requestedRoute), httpStatus: 403 })
  }
  const actualLocation = pathLocation(page.url())
  if (actualLocation !== requestedRoute) {
    const actualPath = displayPath(page.url())
    if (actualPath === '/login') fail('ROUTE_AUTH_REDIRECT', 'PRODUCT', { actualPath, expectedPath: displayPath(requestedRoute) })
    if (actualPath === '/geen-toegang') fail('ROUTE_AUTHORIZATION_BLOCKED', 'PRODUCT', { actualPath, expectedPath: displayPath(requestedRoute) })
    if (actualPath === '/context/select') fail('ROUTE_CONTEXT_REQUIRED', 'CONTEXT', { actualPath, expectedPath: displayPath(requestedRoute) })
    fail('ROUTE_REDIRECT_MISMATCH', 'PRODUCT', { actualPath, expectedPath: displayPath(requestedRoute) })
  }

  const bodyText = await page.locator('body').innerText().catch(() => '')
  if (/application error|internal server error/iu.test(bodyText)) fail('ROUTE_APPLICATION_ERROR', 'PRODUCT', { actualPath: displayPath(page.url()) })
  return { path: displayPath(page.url()), loaded: true, httpStatus: response?.status() ?? null }
}

function probesForPersona(probes, persona) {
  return probes.filter((probe) => probe.persona === null || probe.persona === persona)
}

function verifyProbeCoverage(config, persona) {
  const probes = probesForPersona([...config.allowProbes, ...config.denyProbes], persona)
  const hasAllow = probes.some((probe) => probe.mode === 'allow')
  const hasDeny = probes.some((probe) => probe.mode === 'deny')
  const missing = []
  if (!hasAllow) missing.push('allow')
  if (!hasDeny) missing.push('deny')
  if (missing.length > 0) fail('API_PROBE_COVERAGE_MISSING', 'COVERAGE', { mismatches: missing })
}

async function runProbes(context, config, persona) {
  const probes = [...probesForPersona(config.allowProbes, persona), ...probesForPersona(config.denyProbes, persona)]
  const results = []
  let failedProbe = false

  for (const probe of probes) {
    let response
    try {
      response = await context.request.fetch(new URL(probe.path, config.baseUrl).toString(), {
        method: probe.method,
        data: probe.body,
        failOnStatusCode: false,
        maxRedirects: 0,
        headers: { accept: 'application/json', origin: new URL(config.baseUrl).origin },
      })
    } catch {
      results.push({ mode: probe.mode, method: probe.method, path: probe.displayPath, status: null, expected: probe.statuses ?? (probe.mode === 'allow' ? '2xx' : [401, 403, 404]), matched: false, code: 'API_PROBE_REQUEST_FAILED' })
      failedProbe = true
      continue
    }

    const status = response.status()
    const matched = statusMatches(probe, status)
    results.push({ mode: probe.mode, method: probe.method, path: probe.displayPath, status, expected: probe.statuses ?? (probe.mode === 'allow' ? '2xx' : [401, 403, 404]), matched })
    if (!matched) failedProbe = true
  }

  return { results, failedProbe }
}

async function runPersonaViewport(browser, config, persona, viewport, hrAdminConfig = config) {
  const result = {
    persona,
    viewport: { label: viewport.label, width: viewport.width, height: viewport.height },
    expectedContext: expectedContextSummary(config),
    status: 'GREEN',
    login: { method: 'test-auth-ui', path: null },
    roleSwitch: null,
    returnToAdmin: null,
    identity: null,
    context: null,
    route: null,
    apiProbes: [],
    browserSignals: { consoleErrors: 0, pageErrors: 0 },
  }

  let context = null
  let phase = 'browser-context'
  try {
    context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
    const page = await context.newPage()
    page.on('console', (message) => {
      if (message.type() === 'error') result.browserSignals.consoleErrors += 1
    })
    page.on('pageerror', () => {
      result.browserSignals.pageErrors += 1
    })
    page.setDefaultTimeout(config.timeoutMs)

    phase = 'login'
    const loginLocation = persona === 'hr-admin' ? config.route : '/dashboard/start'
    const loginResult = await loginWithTestAuth(page, config, loginLocation, { allowContextSelection: true })
    result.login.path = loginResult.path
    result.login.httpStatus = loginResult.httpStatus

    if (result.login.path === '/context/select') {
      phase = 'context-selection'
      result.context = await ensureContext(context, persona === 'hr-admin' ? config : hrAdminConfig)
      phase = 'route-navigation'
      await navigateToRoute(page, config, persona === 'hr-admin' ? config.route : '/dashboard/start')
    }

    if (persona !== 'hr-admin') {
      phase = 'role-switch'
      result.roleSwitch = {
        target: persona,
        path: await switchFromHrAdmin(page, config, persona, viewport),
        context: await postSwitchContextEvidence(context, config, hrAdminConfig),
      }
    }

    phase = 'context-verification'
    result.context = await ensureContext(context, config)
    phase = 'role-ui-inspection'
    if (persona !== 'hr-admin') await navigateToRoute(page, config, config.route)
    result.identity = await inspectServerRoleUi(page, config, persona, viewport)
    phase = 'route-acceptance'
    result.route = await navigateToRoute(page, config)
    phase = 'api-probes'
    const probeRun = await runProbes(context, config, persona)
    result.apiProbes = probeRun.results
    if (probeRun.failedProbe) {
      const failedProbe = probeRun.results.find((probe) => !probe.matched)
      fail('API_PROBE_UNEXPECTED_STATUS', 'PRODUCT', {
        endpoint: failedProbe?.path ?? '/unknown',
        method: failedProbe?.method ?? 'GET',
        httpStatus: failedProbe?.status ?? null,
      })
    }
    verifyProbeCoverage(config, persona)
    if (persona !== 'hr-admin') {
      phase = 'return-to-admin'
      result.returnToAdmin = await returnToHrAdmin(page, context, hrAdminConfig, viewport)
    }
    return result
  } catch (error) {
    const failure = safeFailure(error, phase)
    result.status = failure.status
    result.blocker = failure
    return result
  } finally {
    if (context) await context.close().catch(() => undefined)
  }
}

function usage() {
  return [
    'Usage: node apps/hr-suite/scripts/local-test-acceptance.mjs --base-url <loopback-url> [options]',
    '',
    'Options:',
    '  --route <path>                         Protected relative route (default: /dashboard/start)',
    '  --employee-route <path>                Employee relative route (default: /personal-settings)',
    '  --personas <list> / --persona <name>   hr-admin, manager, employee (default: all)',
    '  --tenant-id <uuid>                     Expected tenant context',
    '  --hr-group-id <uuid>                   Expected HR-group context',
    '  --administration-id <uuid>             Expected administration context',
    '  --desktop                              Include 1440x900 viewport',
    '  --mobile                               Include exact 393x852 viewport',
    '  --viewport <desktop,mobile>             Explicit viewport list',
    '  --allow-probe <spec>                   METHOD:/path[@status[,status]][|JSON]; optional persona= prefix',
    '  --deny-probe <spec>                    METHOD:/path[@status[,status]][|JSON]; default status 401,403,404',
    '  --timeout-ms <number>                  Per-action timeout, 1000-120000 (default: 15000)',
    '',
    'Each persona requires at least one matching allow and deny probe for GREEN; missing coverage is PARTIAL.',
    'The runner is loopback-only, headless, and never writes storage state, screenshots, or response bodies.',
  ].join('\n')
}

function printConfigurationFailure(error) {
  const failure = safeFailure(error)
  console.log(JSON.stringify({ schemaVersion: 1, status: failure.status, phase: 'configuration', code: failure.code }))
}

async function main() {
  let config
  try {
    config = parseArguments(process.argv.slice(2))
  } catch (error) {
    printConfigurationFailure(error)
    process.exitCode = 2
    return
  }

  if (config.help) {
    console.log(usage())
    return
  }

  try {
    ({ chromium } = await import('@playwright/test'))
  } catch {
    console.log(JSON.stringify({ schemaVersion: 1, status: 'HARNESS_FRICTION', phase: 'browser-launch', code: 'PLAYWRIGHT_DEPENDENCY_UNAVAILABLE' }))
    process.exitCode = 1
    return
  }

  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch {
    console.log(JSON.stringify({ schemaVersion: 1, status: 'HARNESS_FRICTION', phase: 'browser-launch', code: 'PLAYWRIGHT_BROWSER_UNAVAILABLE' }))
    process.exitCode = 1
    return
  }

  const results = []
  try {
    for (const persona of config.personas) {
      for (const viewport of config.viewports) {
        const personaConfig = persona === 'employee'
          ? { ...config, administrationId: null, requireServerAuthorizedAdministration: true, route: config.employeeRoute }
          : config
        results.push(await runPersonaViewport(browser, personaConfig, persona, viewport, config))
      }
    }
  } finally {
    await browser.close().catch(() => undefined)
  }

  const resultStatuses = results.map((result) => result.status)
  const failed = resultStatuses.some((status) => status !== 'GREEN')
  const aggregateStatus = failed
    ? resultStatuses.includes('RED')
      ? 'RED'
      : resultStatuses.includes('HARNESS_FRICTION')
        ? 'HARNESS_FRICTION'
        : resultStatuses.includes('BLOCKED BY CONTEXT')
          ? 'BLOCKED BY CONTEXT'
          : resultStatuses.includes('PARTIAL')
            ? 'PARTIAL'
            : 'BLOCKED BY ENVIRONMENT'
    : 'GREEN'
  const report = {
    schemaVersion: 1,
    status: aggregateStatus,
    baseUrl: new URL(config.baseUrl).origin,
    route: displayPath(config.route),
    routeByPersona: Object.fromEntries(config.personas.map((persona) => [
      persona,
      displayPath(persona === 'employee' ? config.employeeRoute : config.route),
    ])),
    personas: config.personas,
    viewports: config.viewports.map(({ label, width, height }) => ({ label, width, height })),
    expectedContext: expectedContextSummary(config),
    expectedContextByPersona: Object.fromEntries(config.personas.map((persona) => [
      persona,
      expectedContextSummary(persona === 'employee'
        ? { ...config, administrationId: null, requireServerAuthorizedAdministration: true }
        : config),
    ])),
    results,
  }
  console.log(JSON.stringify(report, null, 2))
  if (failed) process.exitCode = 1
}

await main()
