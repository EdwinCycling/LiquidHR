const { chromium } = require('@playwright/test');

const BASE = 'http://127.0.0.1:3010';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const NEGATIVE_SCOPE_ONLY = process.env.LIQUIDHR_NEGATIVE_SCOPE_ONLY === '1';
const PREPARE_SYNTHETIC_CASE = process.env.LIQUIDHR_PREPARE_SYNTHETIC_CASE === '1';
const CREATE_SYNTHETIC_CASE = process.env.LIQUIDHR_CREATE_SYNTHETIC_CASE === 'APPROVED_ONE';
const WORK_CALENDAR_READ_ONLY = process.env.LIQUIDHR_WORK_CALENDAR_READ_ONLY === '1';
const WORK_CALENDAR_APPROVED = process.env.LIQUIDHR_WORK_CALENDAR_PUBLISH === 'APPROVED_ONE';
const EXISTING_P9_READ_ONLY = process.env.LIQUIDHR_EXISTING_P9_READ_ONLY === 'c20e10fd-14ca-44bb-bb4f-09d6a999b320';
const SKIP_MANAGER_DIRECTORY_PROBE = process.env.LIQUIDHR_SKIP_MANAGER_DIRECTORY_PROBE === 'PRIOR_BROWSER_PASS';
const APPROVED_CASE_SUBJECT_ID = process.env.LIQUIDHR_APPROVED_CASE_SUBJECT_ID || '';
const APPROVED_CASE_EMPLOYEE_NUMBER = process.env.LIQUIDHR_APPROVED_CASE_EMPLOYEE_NUMBER || '';
const APPROVED_CASE_EFFECTIVE_DATE = process.env.LIQUIDHR_APPROVED_CASE_EFFECTIVE_DATE || '';
const FIXTURES = {
  hr_admin: 'hradmin.fixture@liquidhr.test',
  manager: 'manager.fixture@liquidhr.test',
  employee: 'employee.fixture@liquidhr.test',
};
const out = {
  runtime: BASE,
  browser: 'system Chrome, fresh isolated context, 1440x900',
  writes: 0,
  writeAttempts: 0,
  auth: {},
  groups: { offered: [], results: [], checked: false },
  manager: {},
  employee: {},
  faults: { console: 0, page: 0 },
};
let browser;
let page;
let studioFixtureRef = '';
let adminCaseCandidates = [];
let adminDirectoryCandidates = [];

function pathOf(value) {
  try { return new URL(value).pathname; } catch { return ''; }
}

function roleForEmail(email) {
  const value = String(email || '').toLowerCase();
  return Object.entries(FIXTURES).find(([, fixture]) => fixture === value)?.[0] || 'unknown';
}

function roleFromCookies(cookies) {
  const groups = new Map();
  for (const cookie of cookies) {
    const match = cookie.name.match(/^(.*-auth-token)(?:\.(\d+))?$/);
    if (!match) continue;
    if (!groups.has(match[1])) groups.set(match[1], []);
    groups.get(match[1]).push({ index: match[2] === undefined ? 0 : Number(match[2]), value: cookie.value });
  }
  for (const chunks of groups.values()) {
    const raw = chunks.sort((a, b) => a.index - b.index).map((chunk) => chunk.value).join('');
    const candidates = [raw];
    try { candidates.push(decodeURIComponent(raw)); } catch {}
    for (let candidate of candidates) {
      try {
        if (candidate.startsWith('base64-')) candidate = Buffer.from(candidate.slice(7), 'base64').toString('utf8');
        const parsed = JSON.parse(candidate);
        const user = parsed?.user || parsed?.currentSession?.user;
        if (typeof user?.email === 'string') return roleForEmail(user.email);
        if (typeof parsed?.access_token === 'string') {
          const claims = JSON.parse(Buffer.from(parsed.access_token.split('.')[1], 'base64url').toString('utf8'));
          if (typeof claims?.email === 'string') return roleForEmail(claims.email);
        }
      } catch {}
    }
  }
  return 'unknown';
}

async function identity() {
  return roleFromCookies(await page.context().cookies(BASE));
}

async function api(path, method = 'GET', body) {
  const options = { headers: { accept: 'application/json' }, failOnStatusCode: false, timeout: path.startsWith('/api/employees?') ? 60000 : 30000 };
  if (method === 'POST') {
    options.headers['content-type'] = 'application/json';
    options.headers.origin = BASE;
    options.headers.referer = BASE + '/dashboard/start';
    options.data = body || {};
  }
  const response = method === 'POST'
    ? await page.context().request.post(BASE + path, options)
    : await page.context().request.get(BASE + path, options);
  let data = null;
  try { data = await response.json(); } catch {}
  return { status: response.status(), data };
}

function getContext(response) {
  const context = response.data?.data;
  if (!context) return null;
  return {
    tenantId: context.tenant?.id || '',
    tenant: context.tenant?.name || '',
    groupId: context.activeHrGroup?.id || '',
    group: context.activeHrGroup?.name || '',
    groups: Array.isArray(context.hrGroups) ? context.hrGroups.map((group) => group.name).filter(Boolean) : [],
    administrations: Array.isArray(context.administrationsInActiveHrGroup)
      ? context.administrationsInActiveHrGroup.map((administration) => ({ id: administration.id, name: administration.name }))
      : [],
    activeAdministrationId: context.activeAdministration?.id || '',
    activeAdministration: context.activeAdministration?.name || '',
  };
}

async function go(path) {
  let response = null;
  let navigationError = '';
  try {
    response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: path==='/settings/work-calendars' ? 60000 : 20000 });
  } catch (error) {
    navigationError = String(error?.name || 'Error');
  }
  let request = response?.request();
  const redirectChain = [];
  while (request) {
    const requestResponse = await request.response().catch(() => null);
    redirectChain.unshift({ path: pathOf(request.url()), status: requestResponse?.status() ?? null });
    request = request.redirectedFrom();
  }
  const finalPath = pathOf(page.url()).replace(/^\/employees\/[^/]+$/, '/employees/{self}');
  return {
    status: response?.status() ?? null,
    requestedPath: pathOf(BASE + path),
    redirectChain: redirectChain.map((item) => item.path),
    redirectResponses: redirectChain,
    finalPath,
    navigationError,
  };
}

async function route(path) {
  const result = await go(path);
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => Boolean(document.querySelector('main h1')?.textContent?.trim()), null, { timeout: 5000 }).catch(() => {});
  result.page = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = main?.innerText || document.body?.innerText || '';
    return {
      title: document.title,
      heading: main?.querySelector('h1')?.textContent?.trim() || '',
      visibleTextLength: text.trim().length,
      accessDeniedContentVisible: /geen toegang|nog geen toegang|onvoldoende rechten|no access|insufficient permissions|access denied/i.test(text),
      workContentVisible: /\bwerk\b|\bwork\b|mijn aanvragen|my requests/i.test(text),
      studioContentVisible: /processtudio|process studio|workflows en formulieren|workflows and forms/i.test(text),
      recipeNotActivatedVisible: /activeer het gecertificeerde recept eerst|activate the certified recipe first/i.test(text),
      processDefinitionsVisible: /procesdefinities|process definitions/i.test(text),
      managementActionsVisible: /opslaan|save|publiceren|publish|kopiëren|clone/i.test(text),
      internalTransferFormVisible: Boolean(main?.querySelector('#internal-transfer-employee')),
      visibleRows: main?.querySelectorAll('table tbody tr').length || 0,
    };
  }).catch(() => ({ title: '', heading: '', visibleTextLength: 0, accessDeniedContentVisible: false, workContentVisible: false, studioContentVisible: false, recipeNotActivatedVisible: false, processDefinitionsVisible: false, managementActionsVisible: false, internalTransferFormVisible: false, visibleRows: 0 }));
  const clientFinalPath = pathOf(page.url());
  result.clientFinalPath = clientFinalPath;
  result.finalPath = clientFinalPath.replace(/^\/employees\/[^/]+$/, '/employees/{self}');
  const finalPath = clientFinalPath;
  const denialPage = finalPath === '/geen-toegang' || finalPath === '/login';
  const pageContentPass = result.page.visibleTextLength > 0 && (
    denialPage
      ? result.page.accessDeniedContentVisible && /geen toegang|no access/i.test(result.page.heading)
      : path === '/work'
        ? result.page.workContentVisible && /^(werk|work)$/i.test(result.page.heading)
        : path === '/settings/process-automation'
          ? result.page.studioContentVisible && /workflows en formulieren|workflows and forms|processtudio|process studio/i.test(result.page.heading)
        : path === '/work/new/internal-transfer'
          ? result.page.internalTransferFormVisible && /interne overplaatsing starten|start internal transfer/i.test(result.page.heading)
          : Boolean(result.page.heading)
  );
  return {
    path,
    ...result,
    http: { status: result.status, redirectResponses: result.redirectResponses },
    navigation: {
      requestedPath: result.requestedPath,
      redirectChain: result.redirectChain,
      finalPath: result.finalPath,
      clientRedirected: result.finalPath !== result.requestedPath,
      error: result.navigationError,
    },
    pageContentPass,
    allowed: result.status === 200 && finalPath === pathOf(BASE + path) && pageContentPass,
    denied: denialPage && pageContentPass,
  };
}

async function contextOptions() {
  if (pathOf(page.url()) !== '/context/select') await go('/context/select');
  const selector = page.locator('#context-selection');
  if (await selector.count() !== 1) return [];
  return selector.locator('option').evaluateAll((items) => items.map((item) => ({ label: (item.textContent || '').trim(), value: item.value })).filter((item) => item.value && item.label));
}

async function searchChoicePicker(id, query) {
  const input = page.locator(`#${id}`);
  if (await input.count() !== 1) return { available: false, matches: 0, options: 0 };
  await input.click();
  await page.waitForFunction((inputId) => document.getElementById(inputId)?.getAttribute('aria-expanded') === 'true', id, { timeout: 5000 }).catch(() => {});
  await input.fill(query);
  const options = page.locator(`#${id}-options [role="option"]`);
  await options.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  return { available: true, matches: await options.filter({ hasText: query }).count(), options: await options.count() };
}

async function selectContext(label) {
  const options = await contextOptions();
  const target = options.find((option) => option.label === label) || options.find((option) => option.label.toLowerCase().includes(label.toLowerCase()));
  if (!target) return { ok: false, cause: 'context-not-offered', options: options.map((option) => option.label) };
  await page.locator('#context-selection').selectOption(target.value);
  const responsePromise = page.waitForResponse((response) => pathOf(response.url()) === '/api/context/select' && response.request().method() === 'POST', { timeout: 20000 });
  await page.locator('form[action="/api/context/select"] button[type="submit"]').click({ noWaitAfter: true });
  const response = await responsePromise;
  await page.waitForTimeout(200);
  const current = await api('/api/context');
  const context = getContext(current);
  const [expectedTenantId, expectedGroupId] = target.value.split('|');
  const selectionMatches = context?.tenantId === expectedTenantId && context?.groupId === expectedGroupId;
  return {
    ok: (response.ok() || response.status() === 303) && current.status === 200 && selectionMatches,
    context,
    selected: { label: target.label, tenantId: expectedTenantId, groupId: expectedGroupId },
    selectionMatches,
    options: options.map((option) => option.label),
  };
}

async function selectAdministration(admin) {
  const selector = page.locator('#administration-switcher');
  if (await selector.count() !== 1) {
    const current = getContext(await api('/api/context'));
    const defaulted = current?.administrations.length === 1
      && current.activeAdministrationId === admin.id
      && current.activeAdministration === admin.name;
    return {
      ok: Boolean(defaulted),
      activeAdministration: current?.activeAdministration || '',
      activeAdministrationId: current?.activeAdministrationId || '',
      selectionMatches: Boolean(defaulted),
      defaulted: Boolean(defaulted),
    };
  }
  await selector.selectOption(admin.id);
  const responsePromise = page.waitForResponse((response) => pathOf(response.url()) === '/api/context/administration' && response.request().method() === 'POST', { timeout: 20000 });
  await page.locator('form[action="/api/context/administration"] button[type="submit"]').click({ noWaitAfter: true });
  const response = await responsePromise;
  const current = getContext(await api('/api/context'));
  const selectionMatches = current?.activeAdministrationId === admin.id && current.activeAdministration === admin.name;
  return {
    ok: (response.ok() || response.status() === 303) && selectionMatches,
    activeAdministration: current?.activeAdministration || '',
    activeAdministrationId: current?.activeAdministrationId || '',
    selectionMatches,
    defaulted: false,
  };
}

async function switchTo(target) {
  await go('/local/personas');
  const selector = page.locator('#local-persona-target');
  if (await selector.count() !== 1) return { ok: false, cause: 'persona-selector-unavailable', identity: await identity() };
  const option = selector.locator(`option[value="${target}"]`);
  if (await option.count() !== 1 || await option.isDisabled()) return { ok: false, cause: 'persona-not-offered', identity: await identity() };
  await selector.selectOption(target);
  const responsePromise = page.waitForResponse((response) => pathOf(response.url()) === '/api/auth/test-role-switch' && response.request().method() === 'POST', { timeout: 20000 });
  await page.locator('form[action="/api/auth/test-role-switch"]').first().locator('button[type="submit"]').click({ noWaitAfter: true });
  const response = await responsePromise;
  const redirectPath = pathOf(new URL(response.headers().location || '/', BASE).href);
  const navigationCompleted = await page.waitForURL((url) => ['/context/select', '/dashboard/start', '/login'].includes(pathOf(url.href)), { timeout: 20000,waitUntil:'domcontentloaded' }).then(()=>true).catch(()=>false);
  await page.waitForTimeout(300);
  const actual = await identity();
  return { ok: (response.ok() || response.status() === 303) && actual === target, identity: actual, status: response.status(), redirectPath, finalPath: pathOf(page.url()), navigationCompleted };
}

async function returnToAdmin() {
  await go('/local/personas');
  const form = page.locator('form[action="/api/auth/test-role-switch"]');
  if (await form.count() < 1) return { ok: false, cause: 'return-form-unavailable', identity: await identity() };
  const responsePromise = page.waitForResponse((response) => pathOf(response.url()) === '/api/auth/test-role-switch' && response.request().method() === 'POST', { timeout: 20000 });
  await form.first().locator('button[type="submit"]').click({ noWaitAfter: true });
  const response = await responsePromise;
  const redirectPath = pathOf(new URL(response.headers().location || '/', BASE).href);
  await page.waitForURL((url) => ['/context/select', '/dashboard/start', '/login'].includes(pathOf(url.href)), { timeout: 20000 });
  await page.waitForTimeout(300);
  const actual = await identity();
  return { ok: (response.ok() || response.status() === 303) && actual === 'hr_admin', identity: actual, status: response.status(), redirectPath, finalPath: pathOf(page.url()) };
}

async function employeeRows() {
  const result = await api('/api/employees?scope=all');
  const rows = Array.isArray(result.data?.data) ? result.data.data : [];
  const profileHintId = rows.find((row) => String(row?.workEmail || '').toLowerCase() === FIXTURES.employee)?.id || '';
  if (await identity() === 'hr_admin') {
    adminDirectoryCandidates = rows.map((row) => ({
      id: row?.id || row?.employeeId,
      employeeNumber: typeof row?.employeeNumber === 'string' ? row.employeeNumber : '',
      uiName: `${row?.firstName || ''} ${row?.birthName || ''}`.trim(),
      workEmail: typeof row?.workEmail === 'string' ? row.workEmail : '',
      status: typeof row?.status === 'string' ? row.status : '',
      administrationNames: Array.isArray(row?.administrationNames) ? row.administrationNames : [],
    })).filter((row) => typeof row.id === 'string');
  }
  return {
    status: result.status,
    count: rows.length,
    totalCount: Number.isSafeInteger(result.data?.totalCount) ? result.data.totalCount : rows.length,
    ids: rows.map((row) => row?.id || row?.employeeId).filter((id) => typeof id === 'string'),
    profileHintId,
    errorCode: typeof result.data?.error === 'string' ? result.data.error : '',
  };
}

async function resolveOwnEmployeeProfile(employeeIds, profileHintId = '') {
  const candidates = [profileHintId, ...employeeIds.filter((id) => id !== profileHintId)].filter(Boolean);
  for (const employeeRef of candidates) {
    const result = await privateReadProbe(`/api/employees/${encodeURIComponent(employeeRef)}`);
    if (result.status === 200) return { available: true, employeeRef, status: result.status, errorCode: result.errorCode, matchedOwnIdentity: true };
  }
  return { available: false, employeeRef: '', status: null, errorCode: 'SELF_PROFILE_NOT_FOUND_IN_AUTHORIZED_DIRECTORY', matchedOwnIdentity: false };
}

async function studioApiChecks(existingFixture = '') {
  const catalog = await api('/api/process-automation/studio');
  const definitions = Array.isArray(catalog.data?.data) ? catalog.data.data : [];
  studioFixtureRef = existingFixture || definitions.find((item) => typeof item?.id === 'string')?.id || '';
  const definition = studioFixtureRef
    ? await api(`/api/process-automation/studio/${encodeURIComponent(studioFixtureRef)}`)
    : { status: null, data: { code: 'NO_DEFINITION_FIXTURE' } };
  return {
    catalog: { status: catalog.status, errorCode: catalog.data?.code || catalog.data?.error || '', count: definitions.length },
    definition: { status: definition.status, errorCode: definition.data?.code || definition.data?.error || '' },
  };
}

async function directoryDetailProbe(employeeRef) {
  const result = await api(`/api/employees/${encodeURIComponent(employeeRef)}/directory`);
  const fields = result.data && typeof result.data === 'object' ? Object.keys(result.data).sort() : [];
  const allowedFields = new Set(['employeeId', 'name', 'avatarUrl', 'jobTitle', 'departmentName', 'workEmail', 'workPhone', 'schedule', 'presence']);
  return {
    status: result.status,
    errorCode: result.data?.error || result.data?.code || '',
    fields,
    safeProjectionOnly: fields.length > 0 && fields.every((field) => allowedFields.has(field)),
  };
}

async function workListEvidence(query, rememberAdminItems = false) {
  const result = await api(`/api/process-work?${query}`);
  const items = Array.isArray(result.data?.data?.items) ? result.data.data.items : [];
  if (rememberAdminItems) {
    adminCaseCandidates = items
      .filter((item) => typeof item?.workItemId === 'string' && typeof item?.processInstanceId === 'string')
      .map((item) => ({
        workItemRef: item.workItemId,
        caseRef: item.processInstanceId,
        subjectRef: item.subjectEmployeeId || '',
        assigneeRef: item.assigneeEmployeeId || '',
      }));
  }
  const ownItemRef = items.find((item) => typeof item?.workItemId === 'string')?.workItemId || '';
  const ownDetail = ownItemRef ? await api(`/api/process-work-items/${encodeURIComponent(ownItemRef)}?language=nl`) : null;
  return {
    status: result.status,
    errorCode: result.data?.code || result.data?.error || '',
    count: items.length,
    total: Number.isSafeInteger(result.data?.data?.total) ? result.data.data.total : items.length,
    ownTaskDetail: ownDetail ? { status: ownDetail.status, errorCode: ownDetail.data?.code || ownDetail.data?.error || '' } : { status: null, errorCode: 'NO_OWN_TASK_FIXTURE' },
    ownItems: items
      .filter((item) => typeof item?.workItemId === 'string' && typeof item?.processInstanceId === 'string')
      .map((item) => ({ workItemRef: item.workItemId, caseRef: item.processInstanceId, subjectRef: item.subjectEmployeeId || '', assigneeRef: item.assigneeEmployeeId || '' })),
  };
}

async function employeeOwnProcessCase(actorRef, ownItems) {
  for (const candidate of ownItems) {
    const response = await privateReadProbe(`/api/process-instances/${encodeURIComponent(candidate.caseRef)}`);
    if (response.status === 200) {
      const subjectMatch = candidate.subjectRef === actorRef;
      return {
        available: true,
        caseId: candidate.caseRef,
        status: response.status,
        decision: 'ALLOW',
        relation: subjectMatch ? 'process employee/employment subject' : 'initiator_employee_id under Employee self-only permission',
        relationConfirmed: true,
      };
    }
  }
  return { available: false, caseId: '', status: null, decision: 'NOT_TESTED', relation: '', relationConfirmed: false, errorCode: 'NO_EMPLOYEE_PROCESS_INSTANCE_FIXTURE' };
}

async function otherCaseEvidence(actorRef) {
  if (!actorRef || adminCaseCandidates.length === 0) {
    return { available: false, caseId: '', status: null, decision: 'NOT_TESTED', relation: '', unrelatedToEmployee: false, errorCode: 'NO_ADMIN_PROCESS_INSTANCE_FIXTURE' };
  }
  let relatedCase = null;
  for (const candidate of adminCaseCandidates) {
    const response = await privateReadProbe(`/api/process-instances/${encodeURIComponent(candidate.caseRef)}`);
    const subjectMatch = candidate.subjectRef === actorRef;
    if (response.status === 403 || response.status === 404) {
      return {
        available: true,
        caseId: candidate.caseRef,
        status: response.status,
        errorCode: response.errorCode,
        decision: 'DENY',
        relation: {
          isSubjectOrEmploymentSubject: subjectMatch,
          isInitiator: false,
          isAssignee: candidate.assigneeRef === actorRef,
          initiatorDecisionBasis: 'denied by process_instance_can_read under Employee self-only permission',
        },
        unrelatedToEmployee: !subjectMatch,
        relatedCase,
      };
    }
    if (response.status === 200 && !relatedCase) {
      relatedCase = {
        caseId: candidate.caseRef,
        decision: 'ALLOW',
        relation: subjectMatch ? 'process employee/employment subject' : 'initiator_employee_id under Employee self-only permission',
        relationConfirmed: true,
      };
    }
  }
  return {
    available: false,
    caseId: '',
    status: null,
    decision: 'NOT_TESTED',
    relation: '',
    unrelatedToEmployee: false,
    errorCode: 'NO_UNRELATED_PROCESS_INSTANCE_FIXTURE',
    relatedCase,
  };
}

function validWorkScope(manager, admin) {
  return manager.status === 200 && manager.ids.every((id) => admin.ids.includes(id)) && manager.count < admin.count;
}

function safeDirectoryListSummary(result) {
  const rows = Array.isArray(result.data?.data) ? result.data.data : [];
  const fields = rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0]).sort() : [];
  const sensitive = /birth|private|salary|iban|bank|bsn|address|document/i;
  return {
    status: result.status,
    errorCode: result.data?.error || result.data?.code || '',
    count: rows.length,
    totalCount: Number.isSafeInteger(result.data?.totalCount) ? result.data.totalCount : rows.length,
    fields,
    employeeNumbersEmpty: rows.every((row) => !row?.employeeNumber),
    noPrivateFieldNames: fields.every((field) => !sensitive.test(field)),
    allActive: rows.every((row) => row?.status === 'ACTIVE_EMPLOYEE' && row?.isArchived !== true),
  };
}

async function privateReadProbe(path) {
  const result = await api(path);
  return { status: result.status, errorCode: result.data?.error || result.data?.code || '' };
}

async function approvedCalendarPublication(administration) {
  const proposal = require('./docs/quality/acceptance/runs/PMUX-06A1-20261025-TEST-WRITE-PROPOSAL.json');
  const approved = proposal.calendarPublication.body;
  if (administration.id !== approved.administrationId || await identity() !== 'hr_admin') throw Error('calendar-approved-scope-mismatch');
  const view = await route('/settings/work-calendars');
  const before = await api('/api/settings/work-calendars');
  out.workCalendar = { page:view, beforeStatus:before.status, publicationAttempts:0 };
  if (!view.allowed || before.status!==200) throw Error('calendar-page-unavailable');
  if (before.data?.data?.calendars?.length) throw Error('calendar-already-exists-no-publication-retry');
  const row = page.locator('tbody tr').filter({hasText:'Administratieafwijking — Jupiter BV'});
  out.workCalendar.stage='open-administration-editor';
  await row.getByRole('button',{name:'Instellen',exact:true}).click();
  const drawer = page.getByRole('dialog');
  await drawer.waitFor({state:'visible',timeout:5000}).catch(async()=>{
    await row.getByRole('button',{name:'Instellen',exact:true}).click();
    await drawer.waitFor({state:'visible',timeout:10000});
  });
  out.workCalendar.stage='fill-name';
  await drawer.getByLabel('Kalendernaam',{exact:true}).fill(approved.config.name);
  out.workCalendar.stage='fill-validity';
  await drawer.getByLabel('Geldig vanaf',{exact:true}).fill(approved.config.validFrom);
  await drawer.getByLabel('Geldig tot en met',{exact:true}).fill(approved.config.validUntil);
  const holidaysReady = page.waitForResponse(r=>pathOf(r.url())==='/api/settings/work-calendars/holidays' && r.request().method()==='GET');
  out.workCalendar.stage='load-holidays';
  await drawer.getByRole('button',{name:'Feestdagen voor deze periode laden',exact:true}).click();
  const holidayResponse=await holidaysReady;
  const holidays=(await holidayResponse.json()).data;
  if(holidayResponse.status()!==200 || !Array.isArray(holidays)) throw Error('calendar-holidays-unavailable');
  for(const id of approved.config.holidayIds) {
    out.workCalendar.stage='select-approved-holidays';
    const day=holidays.find(h=>h.id===id);
    if(!day) throw Error('calendar-approved-holiday-missing');
    await drawer.locator('label').filter({hasText:day.label}).getByRole('checkbox').check();
  }
  await drawer.getByRole('checkbox',{name:'Ik heb gecontroleerd welke feestdagen in deze periode vrije dagen zijn, ook wanneer ik geen feestdagen selecteer.',exact:true}).check();
  out.workCalendar.stage='fill-reason';
  await drawer.getByLabel('Reden van publicatie',{exact:true}).fill(approved.config.reason);
  await page.route('**/api/settings/work-calendars', async intercepted=>{
    if(intercepted.request().method()!=='POST') return intercepted.continue();
    const body=intercepted.request().postDataJSON();
    const same=body.administrationId===approved.administrationId && body.expectedRevision===0
      && body.config.name===approved.config.name && body.config.validFrom===approved.config.validFrom && body.config.validUntil===approved.config.validUntil
      && JSON.stringify([...body.config.weekdays].sort())===JSON.stringify(approved.config.weekdays)
      && JSON.stringify([...body.config.holidayIds].sort())===JSON.stringify([...approved.config.holidayIds].sort())
      && body.config.exceptions.length===0 && body.config.holidaySelectionConfirmed===true && body.config.reason===approved.config.reason;
    out.workCalendar.requestMatchesApproval=same;
    if(!same) return intercepted.abort('blockedbyclient');
    return intercepted.continue();
  },{times:1});
  const publishedPromise=page.waitForResponse(r=>pathOf(r.url())==='/api/settings/work-calendars' && r.request().method()==='POST',{timeout:60000});
  out.workCalendar.publicationAttempts=1;
  await drawer.getByRole('button',{name:'Nieuwe versie publiceren',exact:true}).click();
  const published=await publishedPromise;
  const body=await published.json();
  out.workCalendar.publicationStatus=published.status();
  out.workCalendar.publicationCode=body.code||'';
  const calendar=body.data?.calendars?.find(c=>c.administrationId===approved.administrationId);
  if(published.status()!==201 || !calendar) throw Error('calendar-publication-unconfirmed-no-retry');
  out.workCalendar.versionId=calendar.version.id;
  out.workCalendar.calendarId=calendar.id;
  out.workCalendar.revision=calendar.revision;
  out.workCalendar.businessWrites=1;
  await drawer.waitFor({state:'hidden'});
  await page.getByLabel('Lokale startdatum',{exact:true}).fill('2026-10-24');
  await page.getByLabel('Lokale starttijd',{exact:true}).fill('09:00');
  await page.getByLabel('Aantal werkdagen',{exact:true}).fill('2');
  const previewPromise=page.waitForResponse(r=>pathOf(r.url())==='/api/settings/work-calendars/preview' && r.request().method()==='POST');
  await page.getByRole('button',{name:'Deadlinevoorbeeld',exact:true}).click();
  const response=await previewPromise;
  const preview=(await response.json()).data;
  out.workCalendar.preview={status:response.status(),...preview};
  out.workCalendar.visiblePreview=await page.getByRole('status').filter({hasText:'Uiterste datum'}).innerText();
  out.workCalendar.pass=response.status()===200 && preview.calendarVersionId===calendar.version.id
    && new Date(preview.deadlineAt).toISOString()==='2026-10-27T08:00:00.000Z'
    && JSON.stringify(preview.countedDates)===JSON.stringify(['2026-10-26','2026-10-27']);
  if(!out.workCalendar.pass) throw Error('calendar-preview-assertion-failed');
}

(async () => {
  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROME });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') out.faults.console += 1; });
    page.on('pageerror', (error) => {
      out.faults.page += 1;
      if (WORK_CALENDAR_READ_ONLY) {
        out.faults.pageMessages = [...(out.faults.pageMessages || []), String(error.message).split('\n')[0].replace(/https?:\/\/\S+/g,'[url]').slice(0,180)];
      }
    });

    const login = await page.goto(BASE + '/local/sign-in', { waitUntil: 'domcontentloaded', timeout: 20000 });
    out.auth.loginPage = login?.status() ?? null;
    if (out.auth.loginPage !== 200 || await page.locator('[data-testid="test-login-hr-admin"]').count() !== 1) throw new Error('admin-login-page-unavailable');
    const loginPromise = page.waitForResponse((response) => pathOf(response.url()) === '/api/local/sign-in' && response.request().method() === 'POST', { timeout: 20000 });
    await page.locator('[data-testid="test-login-hr-admin"]').click();
    const loginResponse = await loginPromise;
    await page.waitForURL((url) => ['/context/select', '/dashboard/start'].includes(pathOf(url.href)), { timeout: 20000 });
    out.auth.login = { status: loginResponse.status(), identity: await identity(), finalPath: pathOf(page.url()) };
    if (out.auth.login.identity !== 'hr_admin') throw new Error('admin-auth-identity-unverified');

    const options = await contextOptions();
    const sterren = options.filter((option) => /de sterren holding/i.test(option.label));
    const planeten = sterren.find((option) => /planeten/i.test(option.label));
    if (!planeten) throw new Error('planeten-context-not-offered');
    if(EXISTING_P9_READ_ONLY) {
      if(CREATE_SYNTHETIC_CASE || WORK_CALENDAR_APPROVED) throw Error('existing-case-mode-must-be-readonly');
      const caseId='c20e10fd-14ca-44bb-bb4f-09d6a999b320';
      const selected=await selectContext(planeten.label);
      const administration=selected.context?.administrations.find(a=>a.name==='Jupiter BV');
      if(!selected.ok || !administration) throw Error('existing-case-context-unavailable');
      if(selected.context.activeAdministrationId!==administration.id) {await go('/dashboard/start');if(!(await selectAdministration(administration)).ok) throw Error('existing-case-admin-selection-failed');}
      const calendar=await api('/api/settings/work-calendars');
      const admin=await api(`/api/process-instances/${caseId}`);
      out.existingCase={caseId,readOnly:true,admin:{identity:await identity(),directStatus:admin.status,workItems:admin.data?.data?.workItems?.map(w=>({participantKey:w.participantKey,assigneeEmployeeId:w.assigneeEmployeeId,deadlineAt:w.deadlineAt}))},calendarStatus:calendar.status};
      const handoff=await switchTo('employee');
      out.existingCase.handoff=handoff;
      if(!handoff.ok) throw Error('existing-case-employee-handoff-failed');
      const employeeContext=await selectContext(planeten.label);
      const directory=await employeeRows();
      const direct=await privateReadProbe(`/api/process-instances/${caseId}`);
      const work=await workListEvidence('view=WORK&tab=ALL&limit=100&language=nl');
      const deniedCalendar=await api('/api/settings/work-calendars');
      out.existingCase.employee={identity:await identity(),contextSelected:employeeContext.ok && employeeContext.selectionMatches,ownEmployeeId:directory.profileHintId,directStatus:direct.status,errorCode:direct.errorCode,workStatus:work.status,caseInWork:work.ownItems.some(w=>w.caseRef===caseId),calendarStatus:deniedCalendar.status};
      const unrelated=directory.profileHintId && directory.profileHintId!=='9048f02b-4fdc-3c4c-e1aa-fd339660029c' && directory.profileHintId!=='01c349f0-be6f-01dc-4d96-b5bf66085a56';
      out.final={pass:admin.status===200 && calendar.status===200 && handoff.ok && employeeContext.ok && unrelated && [403,404].includes(direct.status) && work.status===200 && !out.existingCase.employee.caseInWork && deniedCalendar.status===403,writes:0,writeAttempts:0,existingCaseOnly:true};
      return;
    }
    if (WORK_CALENDAR_READ_ONLY) {
      const adminContext = await selectContext(planeten.label);
      if (!adminContext.ok) throw new Error('calendar-admin-context-failed');
      const adminPage = await route('/settings/work-calendars');
      const adminApi = await api('/api/settings/work-calendars');
      out.workCalendar = { readOnly: true, admin: { identity: await identity(), page: adminPage, apiStatus: adminApi.status, code: adminApi.data?.code || '' }, roles: [] };
      for (const target of (process.env.LIQUIDHR_WORK_CALENDAR_ADMIN_ONLY==='1' ? [] : ['manager','employee'])) {
        const handoff = await switchTo(target);
        if (!handoff.ok) throw new Error(`calendar-${target}-handoff-failed`);
        const selected = await selectContext(planeten.label);
        if (!selected.ok) throw new Error(`calendar-${target}-context-failed`);
        const deniedPage = await route('/settings/work-calendars');
        const deniedApi = await api('/api/settings/work-calendars');
        out.workCalendar.roles.push({ identity: await identity(), page: deniedPage, apiStatus: deniedApi.status, pass: await identity()===target && deniedPage.denied && deniedApi.status===403 });
        const returned = await returnToAdmin();
        if (!returned.ok) throw new Error('calendar-return-admin-failed');
      }
      out.final = { pass: adminApi.status===200 && adminPage.allowed && out.workCalendar.roles.every(role=>role.pass), negativeScopePass: out.workCalendar.roles.length===2 && out.workCalendar.roles.every(role=>role.pass), writes:0, migrationPending: adminApi.status===503 && adminApi.data?.code==='WORK_CALENDAR_UNAVAILABLE' };
      return;
    }
    if (PREPARE_SYNTHETIC_CASE || CREATE_SYNTHETIC_CASE) {
      const selected = await selectContext(planeten.label);
      if (!selected.ok || !selected.context) throw new Error('fixture-preview-context-selection-failed');
      const administration = selected.context.administrations.find((item) => item.name === 'Jupiter BV');
      if (!administration) throw new Error('fixture-preview-no-administration');
      let administrationSelection = selected.context.activeAdministrationId === administration.id
        ? { ok: true, activeAdministration: selected.context.activeAdministration, activeAdministrationId: selected.context.activeAdministrationId, selectionMatches: true, defaulted: true }
        : await (async () => { await go('/dashboard/start'); return selectAdministration(administration) })();
      if (WORK_CALENDAR_APPROVED) {
        if (!CREATE_SYNTHETIC_CASE || !administrationSelection.ok) throw Error('calendar-flow-preconditions-failed');
        await approvedCalendarPublication(administration);
      }
      let directory = await employeeRows();

      // Reuse the live read-only Manager PASS when the case-only retry is requested.
      const managerHandoff = SKIP_MANAGER_DIRECTORY_PROBE ? { ok: false, identity: 'not-rerun' } : await switchTo('manager');
      const managerContext = managerHandoff.ok ? await selectContext(planeten.label) : { ok: false, context: null };
      const managerAdministrationSelection = managerContext.ok && managerContext.context
        ? await selectAdministration(administration)
        : { ok: false, activeAdministration: '', activeAdministrationId: '', selectionMatches: false };
      const managerDirectoryPage = managerAdministrationSelection.ok
        ? await route('/employees')
        : { status: null, finalPath: '', pageContentPass: false, allowed: false };
      const managerDirectoryRows = managerAdministrationSelection.ok
        ? await employeeRows()
        : { status: null, count: 0, ids: [], profileHintId: '' };
      const managerDirectoryCandidate = SKIP_MANAGER_DIRECTORY_PROBE ? null : adminDirectoryCandidates.find((item) => item.id !== directory.profileHintId
        && item.status === 'ACTIVE_EMPLOYEE'
        && item.administrationNames.includes(administration.name)
        && !managerDirectoryRows.ids.includes(item.id));
      const managerDirectoryDetail = managerDirectoryCandidate
        ? await directoryDetailProbe(managerDirectoryCandidate.id)
        : { status: null, errorCode: 'NO_SAME_ADMIN_OUTSIDE_TEAM_FIXTURE', fields: [], safeProjectionOnly: false };
      const managerFullProfile = SKIP_MANAGER_DIRECTORY_PROBE
        ? { status: null, errorCode: 'REUSED_PRIOR_BROWSER_PASS' }
        : managerDirectoryCandidate
        ? await privateReadProbe(`/api/employees/${encodeURIComponent(managerDirectoryCandidate.id)}`)
        : { status: null, errorCode: 'NO_SAME_ADMIN_OUTSIDE_TEAM_FIXTURE' };
      const managerFullProfileDenied = managerFullProfile.status === 403 || managerFullProfile.status === 404;
      out.manager.directory = SKIP_MANAGER_DIRECTORY_PROBE
        ? { result: 'NOT_RERUN', basis: 'prior live Manager browser PASS' }
        : {
        identity: await identity(),
        tenant: managerContext.context?.tenant || '',
        group: managerContext.context?.group || '',
        activeAdministration: managerContext.context?.activeAdministration || '',
        contextSelected: managerContext.ok && managerContext.selectionMatches,
        administrationSelected: managerAdministrationSelection.ok && managerAdministrationSelection.selectionMatches,
        page: { status: managerDirectoryPage.status, finalPath: managerDirectoryPage.finalPath, contentPASS: managerDirectoryPage.pageContentPass },
        list: { endpoint: '/api/employees?scope=all', status: managerDirectoryRows.status, count: managerDirectoryRows.count },
        outsideTeamTargetFound: Boolean(managerDirectoryCandidate),
        detail: { endpoint: managerDirectoryCandidate ? `/api/employees/${managerDirectoryCandidate.id}/directory` : '', status: managerDirectoryDetail.status, safeProjectionOnly: managerDirectoryDetail.safeProjectionOnly, fields: managerDirectoryDetail.fields },
        fullProfile: { status: managerFullProfile.status, denied: managerFullProfileDenied },
      };
      const managerDirectoryPass = !SKIP_MANAGER_DIRECTORY_PROBE && await identity() === 'manager'
        && managerContext.ok && managerContext.selectionMatches
        && managerAdministrationSelection.ok && managerAdministrationSelection.selectionMatches
        && managerDirectoryPage.allowed && managerDirectoryRows.status === 200
        && Boolean(managerDirectoryCandidate)
        && managerDirectoryDetail.status === 200 && managerDirectoryDetail.safeProjectionOnly
        && managerFullProfileDenied
        && managerDirectoryPage.status !== 500 && managerDirectoryRows.status !== 500 && managerDirectoryDetail.status !== 500;
      out.manager.directoryScopePASS = SKIP_MANAGER_DIRECTORY_PROBE ? 'NOT_RERUN_PRIOR_PASS' : managerDirectoryPass;
      out.manager.returnToAdmin = SKIP_MANAGER_DIRECTORY_PROBE
        ? { ok: true, identity: await identity(), skipped: true }
        : await returnToAdmin();
      const returnedAdminContext = SKIP_MANAGER_DIRECTORY_PROBE
        ? selected
        : out.manager.returnToAdmin.ok ? await selectContext(planeten.label) : { ok: false, context: null };
      if (!SKIP_MANAGER_DIRECTORY_PROBE && returnedAdminContext.ok) await go('/dashboard/start');
      administrationSelection = SKIP_MANAGER_DIRECTORY_PROBE
        ? administrationSelection
        : returnedAdminContext.ok && returnedAdminContext.context
          ? await selectAdministration(administration)
          : { ok: false, activeAdministration: '', activeAdministrationId: '', selectionMatches: false };
      directory = administrationSelection.ok ? await employeeRows() : { status: null, count: 0, ids: [], profileHintId: '' };
      const candidate = adminDirectoryCandidates.find((item) => item.id !== directory.profileHintId
        && item.status === 'ACTIVE_EMPLOYEE'
        && /@liquidhr\.test$/i.test(item.workEmail)
          && (!CREATE_SYNTHETIC_CASE || (item.id === APPROVED_CASE_SUBJECT_ID && item.employeeNumber === APPROVED_CASE_EMPLOYEE_NUMBER))
        && item.administrationNames.includes(administration.name));
      if ((!SKIP_MANAGER_DIRECTORY_PROBE && (!managerDirectoryPass || !out.manager.returnToAdmin.ok || !returnedAdminContext.ok))
        || !administrationSelection.ok || !candidate || directory.status !== 200) {
        out.syntheticCasePreparation = {
          writes: 0,
          writeAttempts: 0,
          identity: await identity(),
          managerDirectoryPASS: SKIP_MANAGER_DIRECTORY_PROBE ? 'NOT_RERUN_PRIOR_PASS' : managerDirectoryPass,
          returnedToAdmin: out.manager.returnToAdmin.ok && await identity() === 'hr_admin',
          contextSelected: returnedAdminContext.ok && returnedAdminContext.selectionMatches,
          administrationSelected: administrationSelection.ok && administrationSelection.selectionMatches,
          activeAdministration: administrationSelection.activeAdministration,
          approvedTargetAvailable: Boolean(candidate),
          errorCode: 'PREWRITE_ACCEPTANCE_PRECONDITIONS_FAILED',
          submitClicked: false,
        };
        out.final = { pass: false, writeAttempts: 0, writes: 0, managerDirectoryPASS: SKIP_MANAGER_DIRECTORY_PROBE ? 'NOT_RERUN_PRIOR_PASS' : managerDirectoryPass };
        return;
      }
      const startPage = await route('/work/new/internal-transfer');
      const internalTransferEmployeePickerCount = await page.locator('#internal-transfer-employee').count();
      let candidateOffered = false;
      let employmentOptions = 0;
      let activeEmploymentOptions = 0;
        let activeEmploymentOptionIndex = -1;
      if (candidate && startPage.allowed && internalTransferEmployeePickerCount === 1) {
        const employeeSearch = await searchChoicePicker('internal-transfer-employee', candidate.employeeNumber);
        const option = page.locator('#internal-transfer-employee-options [role="option"]')
          .filter({ hasText: candidate.employeeNumber });
        candidateOffered = employeeSearch.matches === 1;
        if (candidateOffered) {
          await option.first().locator('button').click();
          await page.waitForFunction(({ inputId, searchValue }) => {
            const value = document.getElementById(inputId)?.value?.trim() || '';
            return Boolean(value) && value !== searchValue;
          }, { inputId: 'internal-transfer-employee', searchValue: candidate.employeeNumber }, { timeout: 5000 }).catch(() => {});
          const employmentPicker = page.locator('#internal-transfer-employment');
          if (await employmentPicker.count() === 1) {
            await employmentPicker.click();
            const options = page.locator('#internal-transfer-employment-options [role="option"]');
            const labels = await options.allInnerTexts();
            employmentOptions = labels.length;
            const today = new Date().toISOString().slice(0, 10);
              const employmentIsActiveToday = (label) => {
              const dates = [...label.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((match) => match[0]);
              return dates.length > 0 && dates[0] <= today && (!dates[1] || dates[1] >= today);
              };
              activeEmploymentOptionIndex = labels.findIndex(employmentIsActiveToday);
              activeEmploymentOptions = labels.filter(employmentIsActiveToday).length;
          }
        }
      }
        if (CREATE_SYNTHETIC_CASE) {
          const approvedDate = /^\d{4}-\d{2}-\d{2}$/.test(APPROVED_CASE_EFFECTIVE_DATE)
            ? APPROVED_CASE_EFFECTIVE_DATE : '';
          const dateInput = page.locator('#internal-transfer-effective-on');
          const submissionReady = selected.context.tenant.toLowerCase() === 'de sterren holding'
            && selected.context.group.toLowerCase() === 'planeten'
            && administration.name === 'Jupiter BV'
            && selected.selectionMatches && administrationSelection.ok && administrationSelection.selectionMatches
            && await identity() === 'hr_admin'
            && Boolean(candidate && directory.profileHintId && candidate.id !== directory.profileHintId)
            && candidateOffered && activeEmploymentOptionIndex >= 0 && activeEmploymentOptions === 1
            && approvedDate && await dateInput.count() === 1;
          if (!submissionReady) {
            out.syntheticCasePreparation = {
              writes: 0,
              identity: await identity(),
              tenant: selected.context.tenant,
              group: selected.context.group,
              activeAdministration: administrationSelection.activeAdministration,
              target: candidate ? { employeeId: candidate.id, employeeNumber: candidate.employeeNumber } : null,
              employeeFixtureExcluded: Boolean(candidate && candidate.id !== directory.profileHintId),
              internalTransfer: { contentPASS: startPage.pageContentPass, candidateOffered, activeEmploymentOptions },
              errorCode: 'APPROVED_SYNTHETIC_CASE_PRECONDITIONS_FAILED',
              submitClicked: false,
            };
            out.final = { pass: false, readOnlyPreparation: true, writes: 0, writeAttempts: 0 };
            return;
          }

          await page.locator('#internal-transfer-employment-options [role="option"]')
            .nth(activeEmploymentOptionIndex).locator('button').click();
          await dateInput.fill(approvedDate);
          const p9Form = page.locator('main form').filter({ has: page.locator('#internal-transfer-employee') });
          const p9Submit = p9Form.locator('button[type="submit"]');
          const selectedEmployeeLabel = await page.locator('#internal-transfer-employee').inputValue();
          const selectedEmploymentLabel = await page.locator('#internal-transfer-employment').inputValue();
          const selectedEffectiveDate = await dateInput.inputValue();
          const p9SubmitReady = await p9Form.count() === 1 && await p9Submit.count() === 1
            && await p9Submit.isEnabled()
            && candidateOffered && Boolean(selectedEmployeeLabel.trim()) && selectedEmployeeLabel !== candidate.employeeNumber
            && Boolean(selectedEmploymentLabel)
            && selectedEffectiveDate === approvedDate;
          if (!p9SubmitReady) {
            out.syntheticCasePreparation = {
              writes: 0,
              writeAttempts: 0,
              identity: await identity(),
              managerDirectoryPASS: managerDirectoryPass,
              selectedEmployee: candidateOffered && Boolean(selectedEmployeeLabel.trim()),
              selectedEmployment: Boolean(selectedEmploymentLabel),
              selectedEffectiveDate,
              expectedEffectiveDate: approvedDate,
              errorCode: 'P9_FORM_SUBMISSION_PRECONDITIONS_FAILED',
              submitClicked: false,
            };
            out.final = { pass: false, writeAttempts: 0, writes: 0, managerDirectoryPASS: managerDirectoryPass };
            return;
          }
          const isUuid = (value) => typeof value === 'string'
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
          await page.route('**/api/processes/start', async (route) => {
            const body = route.request().postDataJSON() || {};
            const allowedRequest = body.subjectEmployeeId === APPROVED_CASE_SUBJECT_ID
              && body.subjectEmployeeId === candidate.id
              && body.businessEffectiveDate === approvedDate
              && isUuid(body.processDefinitionId)
              && isUuid(body.employmentId)
              && typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length >= 1 && body.idempotencyKey.length <= 200
              && (body.correlationId === null || body.correlationId === undefined || isUuid(body.correlationId));
            out.syntheticCaseRequestGate = {
              approvedTarget: body.subjectEmployeeId === APPROVED_CASE_SUBJECT_ID && body.subjectEmployeeId === candidate.id,
              approvedDate: body.businessEffectiveDate === approvedDate,
              processDefinitionIdValid: isUuid(body.processDefinitionId),
              employmentIdValid: isUuid(body.employmentId),
              idempotencyKeyValid: typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim().length >= 1 && body.idempotencyKey.length <= 200,
              correlationIdValidOrNull: body.correlationId === null || body.correlationId === undefined || isUuid(body.correlationId),
              forwardedToTest: allowedRequest,
            };
            if (!allowedRequest) {
              await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'APPROVED_P9_REQUEST_GATE_BLOCKED' }) });
              return;
            }
            // Het reguliere API-idempotentiecontract voorkomt een tweede case bij herhaling.
            const stableKey = `PMUX-P9:${APPROVED_CASE_SUBJECT_ID}:${approvedDate}`;
            out.syntheticCaseRequestGate.stableIdempotencyKey = true;
            await route.continue({ postData: JSON.stringify({ ...body, idempotencyKey: stableKey }) });
          }, { times: 1 });
          const startResponsePromise = page.waitForResponse((response) => pathOf(response.url()) === '/api/processes/start'
            && response.request().method() === 'POST', { timeout: 60000 });
          out.writeAttempts = 1;
          await p9Submit.click();
          const startResponse = await startResponsePromise;
          const startBody = await startResponse.json().catch(() => null);
          const startPayload = startResponse.request().postDataJSON() || {};
          const allowedStartKeys = new Set(['processDefinitionId', 'subjectEmployeeId', 'employmentId', 'businessEffectiveDate', 'idempotencyKey', 'correlationId']);
          const caseId = startBody?.data?.processInstanceId || '';
          out.writes = startResponse.ok() && /^[0-9a-f-]{36}$/i.test(caseId) ? 1 : 0;
          out.syntheticCaseCreation = {
            writeAttempts: out.writeAttempts,
            writes: out.writes,
            status: startResponse.status(),
            processInstanceId: caseId,
            targetEmployeeId: candidate.id,
            targetEmployeeNumber: candidate.employeeNumber,
            effectiveDate: approvedDate,
            initiatorIdentity: await identity(),
            responseCode: typeof startBody?.code === 'string' ? startBody.code : '',
            requestShape: {
              keys: Object.keys(startPayload).sort(),
              unexpectedKeys: Object.keys(startPayload).filter((key) => !allowedStartKeys.has(key)),
              subjectEmployeeIdMatchesApprovedTarget: startPayload.subjectEmployeeId === APPROVED_CASE_SUBJECT_ID
                && startPayload.subjectEmployeeId === candidate.id,
              processDefinitionIdValid: isUuid(startPayload.processDefinitionId),
              subjectEmployeeIdValid: isUuid(startPayload.subjectEmployeeId),
              employmentIdValidOrNull: startPayload.employmentId === null || isUuid(startPayload.employmentId),
              businessEffectiveDateValidOrNull: startPayload.businessEffectiveDate === null
                || (typeof startPayload.businessEffectiveDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startPayload.businessEffectiveDate)),
              idempotencyKeyValid: typeof startPayload.idempotencyKey === 'string' && startPayload.idempotencyKey.trim().length >= 1 && startPayload.idempotencyKey.length <= 200,
              correlationIdValidOrNull: startPayload.correlationId === null || startPayload.correlationId === undefined || isUuid(startPayload.correlationId),
            },
          };
          if (out.writes !== 1) {
            out.final = { pass: false, writeAttempts: out.writeAttempts, writes: out.writes, caseState: 'UNCONFIRMED_NO_RETRY' };
            return;
          }

          const adminProjectionResponse = await api(`/api/process-instances/${encodeURIComponent(caseId)}`);
          const adminDirect = { status: adminProjectionResponse.status, errorCode: adminProjectionResponse.data?.code || adminProjectionResponse.data?.error || '' };
          const workItems = Array.isArray(adminProjectionResponse.data?.data?.workItems)
            ? adminProjectionResponse.data.data.workItems : [];
          const activeWorkItemsOnlyInitiator = workItems.length > 0
            && workItems.every((item) => item.participantKey === 'initiator');
          const adminWork = await api('/api/process-work?view=WORK&tab=ALL&limit=100&language=nl');
          const adminWorkItems = Array.isArray(adminWork.data?.data?.items) ? adminWork.data.data.items : [];
          const caseWorkItems = adminWorkItems.filter((item) => item?.processInstanceId === caseId);
          const caseWorkItemsObserved = caseWorkItems.length > 0;
          const caseSubjectMatchesTarget = caseWorkItemsObserved
            && caseWorkItems.every((item) => item.subjectEmployeeId === candidate.id);

          const employeeHandoff = await switchTo('employee');
          const employeeContext = employeeHandoff.ok ? await selectContext(planeten.label) : { ok: false, context: null };
          const employeeDirectory = employeeContext.ok ? await employeeRows() : { status: null, profileHintId: '' };
          const employeeSelfId = employeeDirectory.profileHintId;
          const employeeWork = employeeContext.ok
            ? await workListEvidence('view=WORK&tab=ALL&limit=100&language=nl')
            : { status: null, ownItems: [] };
          const employeeDirect = employeeContext.ok
            ? await privateReadProbe(`/api/process-instances/${encodeURIComponent(caseId)}`)
            : { status: null, errorCode: 'EMPLOYEE_CONTEXT_UNAVAILABLE' };
          const employeeCaseInWork = employeeWork.ownItems.some((item) => item.caseRef === caseId);
          const employeeAssigneeInAdminWork = caseWorkItems.some((item) => item.assigneeEmployeeId === employeeSelfId);
          const deniedDirect = employeeDirect.status === 403 || employeeDirect.status === 404;
          out.syntheticCaseScope = {
            admin: { identity: 'hr_admin', directStatus: adminDirect.status, decision: adminDirect.status === 200 ? 'ALLOW' : 'NOT_ALLOWED' },
            employee: {
              identity: employeeHandoff.identity,
              contextSelected: employeeContext.ok && employeeContext.selectionMatches,
              ownEmployeeId: employeeSelfId,
              subjectIsDifferentEmployee: Boolean(employeeSelfId && employeeSelfId !== candidate.id),
              subjectAppearsAsDifferentEmployee: caseSubjectMatchesTarget && !caseWorkItems.some((item) => item.subjectEmployeeId === employeeSelfId),
              directStatus: employeeDirect.status,
              decision: deniedDirect ? 'DENY' : 'NOT_DENIED',
              ownWorkListStatus: employeeWork.status,
              caseAppearsInOwnWork: employeeCaseInWork,
              caseWorkItemsObserved,
              assignedAsEmployeeInAdminWork: employeeAssigneeInAdminWork,
            },
            activeParticipantKeys: workItems.map((item) => item.participantKey).filter((key) => typeof key === 'string'),
            initialWorkItemsOnlyInitiator: activeWorkItemsOnlyInitiator,
          };
          out.final = {
            pass: out.writes === 1 && out.syntheticCaseCreation.initiatorIdentity === 'hr_admin'
              && adminDirect.status === 200
              && employeeHandoff.ok && employeeHandoff.identity === 'employee'
              && employeeContext.ok && employeeContext.selectionMatches
              && employeeSelfId && employeeSelfId !== candidate.id && caseSubjectMatchesTarget && employeeDirect.status !== null && deniedDirect
              && activeWorkItemsOnlyInitiator
              && employeeWork.status === 200 && !employeeCaseInWork && caseWorkItemsObserved && !employeeAssigneeInAdminWork,
            writeAttempts: out.writeAttempts,
            writes: out.writes,
            groupsSkipped: true,
          };
          return;
        }
      const documentStartPage = await route('/work/new/document-acknowledgement');
      const documentEmployeePickerCount = await page.locator('#document-acknowledgement-employee').count();
      let documentCandidateOffered = false;
      let syntheticDocumentOptionCount = 0;
      let documentOptionCount = 0;
      if (candidate && documentStartPage.allowed && documentEmployeePickerCount === 1) {
        const employeeSearch = await searchChoicePicker('document-acknowledgement-employee', candidate.employeeNumber);
        const option = page.locator('#document-acknowledgement-employee-options [role="option"]')
          .filter({ hasText: candidate.employeeNumber });
        documentCandidateOffered = employeeSearch.matches === 1;
        if (documentCandidateOffered) {
          await option.first().locator('button').click();
          const documentPicker = page.locator('#document-acknowledgement-document');
          if (await documentPicker.count() === 1) {
            await documentPicker.click();
            const documentOptions = page.locator('#document-acknowledgement-document-options [role="option"]');
            documentOptionCount = await documentOptions.count();
            syntheticDocumentOptionCount = await documentOptions.filter({ hasText: /test|synthetisch|synthetic/i }).count();
          }
        }
      }
      out.syntheticCasePreparation = {
        writes: 0,
        identity: await identity(),
        tenant: selected.context.tenant,
        group: selected.context.group,
        activeAdministration: administrationSelection.activeAdministration,
        activeAdministrationIdMatches: administrationSelection.activeAdministrationId === administration.id
          && administrationSelection.selectionMatches,
        administrationSelectionPASS: administrationSelection.ok,
        internalTransfer: {
          status: startPage.status,
          finalPath: startPage.finalPath,
          heading: startPage.page.heading,
          contentPASS: startPage.pageContentPass,
          recipeNotActivated: startPage.page.recipeNotActivatedVisible,
          employeePickerCount: internalTransferEmployeePickerCount,
          candidateOffered,
          activeEmploymentOptionCount: employmentOptions,
          employmentCurrentlyEffectiveOptionCount: activeEmploymentOptions,
        },
        documentAcknowledgement: {
          status: documentStartPage.status,
          finalPath: documentStartPage.finalPath,
          heading: documentStartPage.page.heading,
          contentPASS: documentStartPage.pageContentPass,
          recipeNotActivated: documentStartPage.page.recipeNotActivatedVisible,
          employeePickerCount: documentEmployeePickerCount,
          candidateOffered: documentCandidateOffered,
          documentOptionCount,
          syntheticDocumentOptionCount,
        },
        target: candidate ? { employeeId: candidate.id, employeeNumber: candidate.employeeNumber, status: candidate.status, administration: administration.name } : null,
        employeeFixtureExcluded: Boolean(candidate && candidate.id !== directory.profileHintId),
        submitClicked: false,
      };
      out.final = {
        pass: out.syntheticCasePreparation.identity === 'hr_admin'
          && selected.context.tenant.toLowerCase() === 'de sterren holding'
          && selected.selectionMatches && administrationSelection.ok
          && Boolean(candidate) && out.syntheticCasePreparation.employeeFixtureExcluded
          && ((startPage.allowed && candidateOffered && activeEmploymentOptions > 0)
            || (documentStartPage.allowed && documentCandidateOffered && syntheticDocumentOptionCount > 0))
          && out.writes === 0,
        readOnlyPreparation: true,
        writes: out.writes,
      };
      return;
    }
    if (NEGATIVE_SCOPE_ONLY) {
      out.groups.skipped = 'previously-proven; negative-scope-only run';
    } else {
      out.groups.offered = options.map((option) => option.label);
      const expectedGroups = ['Planeten', 'Stap 6 testgroep meerdere autorisaties', 'TEST (leeg)'];
      const missingGroups = expectedGroups.filter((group) => !sterren.some((option) => option.label.toLowerCase().includes(group.toLowerCase())));
      if (missingGroups.length > 0) throw new Error('expected-de-sterren-group-not-offered');

      for (const option of sterren) {
        const selected = await selectContext(option.label);
        if (!selected.ok || !selected.context) {
          out.groups.checked = false;
          out.groups.failed = option.label;
          continue;
        }
        const checks = [];
        for (const administration of selected.context.administrations) {
          await go('/dashboard/start');
          const switched = await selectAdministration(administration);
          const work = await route('/work');
          checks.push({ administration: administration.name, active: switched.activeAdministration, administrationPASS: switched.ok, workStatus: work.status, workPASS: work.allowed });
        }
        out.groups.results.push({ tenant: selected.context.tenant, group: selected.context.group, administrations: checks, pass: checks.length === selected.context.administrations.length && checks.every((check) => check.administrationPASS && check.workPASS) });
      }
      out.groups.checked = sterren.length === 3 && out.groups.results.length === 3 && out.groups.results.every((item) => item.pass);
    }

    const adminContext = await selectContext(planeten.label);
    if (!adminContext.ok || !adminContext.context) throw new Error('admin-planeten-context-failed');
    const admin = await employeeRows();
    const processStudio = await route('/settings/process-automation');
    const adminStudioApi = await studioApiChecks();
    const adminWorkEvidence = await workListEvidence('view=WORK&tab=ALL&limit=100&language=nl', true);
    const work = await route('/work');
    out.auth.hrAdmin = {
      identity: await identity(), tenant: adminContext.context.tenant, group: adminContext.context.group,
      administrations: adminContext.context.administrations.map((item) => item.name), activeAdministration: adminContext.context.activeAdministration,
      directory: { status: admin.status, count: admin.count }, processStudio,
      studioApi: adminStudioApi, processItems: { status: adminWorkEvidence.status, count: adminWorkEvidence.count }, work,
      contextSelectionPASS: adminContext.ok && adminContext.selectionMatches,
      pass: await identity() === 'hr_admin' && adminContext.ok && /de sterren holding/i.test(adminContext.context.tenant) && /planeten/i.test(adminContext.context.group) && processStudio.allowed && processStudio.pageContentPass && adminStudioApi.catalog.status === 200 && adminStudioApi.definition.status === 200 && work.allowed && work.pageContentPass,
    };

    const managerHandoff = await switchTo('manager');
    out.manager.handoff = managerHandoff;
    if (!managerHandoff.ok) throw new Error('manager-handoff-not-proven');
    const managerContext = await selectContext(planeten.label);
    const managerWork = await route('/work');
    const managerDirectory = await employeeRows();
    const managerStudio = await route('/settings/process-automation');
    const managerStudioApi = await studioApiChecks(studioFixtureRef);
    const managerOutsideRef = admin.ids.find((id) => !managerDirectory.ids.includes(id)) || '';
    const managerSameAdministrationOutsideRef = adminDirectoryCandidates.find((candidate) =>
      !managerDirectory.ids.includes(candidate.id)
      && candidate.administrationNames.some((name) => name === managerContext.context?.activeAdministration)
    )?.id || '';
    const managerOutsideInActiveAdministration = adminDirectoryCandidates.some((candidate) =>
      candidate.id === managerOutsideRef
      && candidate.administrationNames.some((name) => name === managerContext.context?.activeAdministration)
    );
    const managerOutsideDirectory = managerOutsideRef ? await directoryDetailProbe(managerOutsideRef) : { status: null, errorCode: 'NO_OUTSIDE_TEAM_FIXTURE', fields: [], safeProjectionOnly: false };
    const managerSameAdministrationDirectory = managerSameAdministrationOutsideRef ? await directoryDetailProbe(managerSameAdministrationOutsideRef) : { status: null, errorCode: 'NO_SAME_ADMIN_OUTSIDE_TEAM_FIXTURE', fields: [], safeProjectionOnly: false };
    const managerOutsideProfile = managerOutsideRef ? await privateReadProbe(`/api/employees/${encodeURIComponent(managerOutsideRef)}`) : { status: null, errorCode: 'NO_OUTSIDE_TEAM_FIXTURE' };
    out.manager.context = managerContext.context ? { tenant: managerContext.context.tenant, group: managerContext.context.group, activeAdministration: managerContext.context.activeAdministration, selectionPASS: managerContext.ok && managerContext.selectionMatches } : null;
    out.manager.work = { ...managerWork, count: managerDirectory.count, status: managerDirectory.status };
    out.manager.teamScope = { status: managerDirectory.status, count: managerDirectory.count, sixDirectReports: managerDirectory.count === 6, subsetOfAdmin: validWorkScope(managerDirectory, admin) };
    out.manager.processStudio = managerStudio;
    out.manager.studioApi = managerStudioApi;
    out.manager.outsideTeamDirectory = managerOutsideDirectory;
    out.manager.sameAdministrationOutsideTeamDirectory = managerSameAdministrationDirectory;
    out.manager.outsideTeamTargetInActiveAdministration = managerOutsideInActiveAdministration;
    out.manager.outsideTeamFullProfile = managerOutsideProfile;
    const managerStudioBlocked = (managerStudio.denied || (!managerStudio.page.processDefinitionsVisible && !managerStudio.page.managementActionsVisible))
      && managerStudioApi.catalog.status === 403 && managerStudioApi.definition.status === 403;
    const exactDirectoryDecisionPass = managerOutsideInActiveAdministration
      ? managerOutsideDirectory.status === 200 && managerOutsideDirectory.safeProjectionOnly
      : managerOutsideDirectory.status === 403 || managerOutsideDirectory.status === 404;
    const managerDirectoryScopePass = exactDirectoryDecisionPass
      && (!managerSameAdministrationOutsideRef || (managerSameAdministrationDirectory.status === 200 && managerSameAdministrationDirectory.safeProjectionOnly));
    out.manager.negativeScope = managerContext.ok && managerWork.allowed && managerStudioBlocked && managerDirectoryScopePass
      && (managerOutsideProfile.status === 403 || managerOutsideProfile.status === 404)
      && managerOutsideDirectory.status !== 500;
    out.manager.return = await returnToAdmin();

    const employeeHandoff = await switchTo('employee');
    out.employee.handoff = employeeHandoff;
    if (!employeeHandoff.ok) throw new Error('employee-handoff-not-proven');
    const employeeContext = await selectContext(planeten.label);
    const employeeWork = await route('/work');
    const employeeDirectory = await employeeRows();
    const employeeStudio = await route('/settings/process-automation');
    const employeeStudioApi = await studioApiChecks(studioFixtureRef);
    const employeeListResponse = await api('/api/employees?scope=all');
    const employeeList = safeDirectoryListSummary(employeeListResponse);
    const ownProfile = await resolveOwnEmployeeProfile(employeeDirectory.ids, employeeDirectory.profileHintId);
    const ownEmployeeRef = ownProfile.employeeRef;
    const ownWorkEvidence = await workListEvidence('view=WORK&tab=ALL&limit=50&language=nl');
    const ownCase = await employeeOwnProcessCase(ownEmployeeRef, ownWorkEvidence.ownItems);
    const otherCase = await otherCaseEvidence(ownEmployeeRef);
    const employeeOutsideRef = employeeDirectory.ids.find((id) => id !== ownEmployeeRef) || managerOutsideRef;
    const employeeOutsideDirectory = employeeOutsideRef ? await directoryDetailProbe(employeeOutsideRef) : { status: null, errorCode: 'NO_OTHER_EMPLOYEE_FIXTURE', fields: [], safeProjectionOnly: false };
    const employeeOutsideProfile = employeeOutsideRef ? await privateReadProbe(`/api/employees/${encodeURIComponent(employeeOutsideRef)}`) : { status: null, errorCode: 'NO_OTHER_EMPLOYEE_FIXTURE' };
    const employeeOutsideSalary = employeeOutsideRef ? await privateReadProbe(`/api/employees/${encodeURIComponent(employeeOutsideRef)}/salary`) : { status: null, errorCode: 'NO_OTHER_EMPLOYEE_FIXTURE' };
    const employeeOutsideDocuments = employeeOutsideRef ? await privateReadProbe(`/api/employees/${encodeURIComponent(employeeOutsideRef)}/documents`) : { status: null, errorCode: 'NO_OTHER_EMPLOYEE_FIXTURE' };
    out.employee.context = employeeContext.context ? { tenant: employeeContext.context.tenant, group: employeeContext.context.group, activeAdministration: employeeContext.context.activeAdministration, selectionPASS: employeeContext.ok && employeeContext.selectionMatches } : null;
    out.employee.work = { page: employeeWork, taskList: { status: ownWorkEvidence.status, errorCode: ownWorkEvidence.errorCode, count: ownWorkEvidence.count, total: ownWorkEvidence.total }, ownTaskDetail: ownWorkEvidence.ownTaskDetail };
    out.employee.directory = employeeList;
    out.employee.selfProfile = { status: ownProfile.status, errorCode: ownProfile.errorCode, matchedOwnIdentity: ownProfile.matchedOwnIdentity };
    out.employee.otherEmployeeDirectory = employeeOutsideDirectory;
    out.employee.otherEmployeeFullProfile = employeeOutsideProfile;
    out.employee.otherEmployeeSalary = employeeOutsideSalary;
    out.employee.otherEmployeeDocuments = employeeOutsideDocuments;
    out.employee.processStudio = employeeStudio;
    out.employee.studioApi = employeeStudioApi;
    out.employee.ownCase = ownCase;
    out.employee.otherCase = otherCase;
    const employeeStudioBlocked = (employeeStudio.denied || (!employeeStudio.page.processDefinitionsVisible && !employeeStudio.page.managementActionsVisible))
      && employeeStudioApi.catalog.status === 403 && employeeStudioApi.definition.status === 403;
    out.employee.negativeScope = employeeContext.ok && employeeWork.allowed && employeeStudioBlocked
      && employeeOutsideDirectory.status === 200 && employeeOutsideDirectory.safeProjectionOnly
      && ownProfile.status === 200 && ownProfile.matchedOwnIdentity
      && (employeeOutsideProfile.status === 403 || employeeOutsideProfile.status === 404)
      && (employeeOutsideSalary.status === 403 || employeeOutsideSalary.status === 404)
      && (employeeOutsideDocuments.status === 403 || employeeOutsideDocuments.status === 404)
      && ownCase.available && ownCase.decision === 'ALLOW' && ownCase.relationConfirmed
      && otherCase.available && otherCase.decision === 'DENY' && otherCase.unrelatedToEmployee;
    out.employee.return = await returnToAdmin();

    const finalContext = await api('/api/context');
    const finalIdentity = await identity();
    const rolesReturned = out.manager.return?.ok === true && out.employee.return?.ok === true;
    out.final = {
      identity: finalIdentity,
      activeContextStatus: finalContext.status,
      managerNegativeScope: out.manager.negativeScope === true,
      employeeNegativeScope: out.employee.negativeScope === true,
      returnedToAdmin: rolesReturned,
      pass: finalIdentity === 'hr_admin' && finalContext.status === 200
        && out.auth.hrAdmin?.pass === true && out.manager.handoff?.ok === true && out.employee.handoff?.ok === true
        && out.manager.negativeScope === true && out.employee.negativeScope === true && rolesReturned,
    };
  } catch (error) {
    out.error = { type: error?.name || 'Error', code: String(error?.message || 'browser-run-failed').slice(0, 400) };
    if(WORK_CALENDAR_APPROVED && page) out.calendarFailureElements=await page.evaluate(()=>({dialogs:document.querySelectorAll('[role=dialog]').length,inputs:[...document.querySelectorAll('[role=dialog] input')].map(x=>({type:x.type,label:x.getAttribute('aria-label')})),buttons:[...document.querySelectorAll('[role=dialog] button')].map(x=>x.textContent?.trim())})).catch(()=>null);
  } finally {
    if (browser) await browser.close().catch(() => {});
    process.stdout.write(JSON.stringify(out) + '\n');
    process.exitCode = out.final?.pass === true ? 0 : 1;
  }
})();
