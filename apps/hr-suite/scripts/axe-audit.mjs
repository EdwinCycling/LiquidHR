import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.AXE_AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
const email = process.env.AXE_AUDIT_EMAIL;
const password = process.env.AXE_AUDIT_PASSWORD;

if (!email || !password) {
  throw new Error('AXE_AUDIT_EMAIL en AXE_AUDIT_PASSWORD zijn vereist voor de geauthenticeerde audit.');
}

const routes = [
  { path: '/dashboard/start', readyText: 'Goedemorgen' },
  { path: '/workforce', readyText: 'Workforce' },
  { path: '/employees', readyText: 'Medewerkers' },
  { path: '/settings', readyText: 'Instellingen' },
  { path: '/settings/talent', readyText: 'Talentfundament' },
  { path: '/workforce/talent', readyText: 'Talent' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('E-mailadres', { exact: true }).fill(email);
  await page.getByLabel('Wachtwoord', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Inloggen', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

  const results = [];
  for (const route of routes) {
    await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    const closeButton = page.getByRole('button', { name: 'Sluiten', exact: true });
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
      await page.waitForTimeout(250);
    }

    const currentUrl = page.url();
    const ready = await page.getByText(route.readyText, { exact: false }).first().isVisible().catch(() => false);
    const scan = ready && !currentUrl.endsWith('/login')
      ? await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      : null;

    results.push({
      path: route.path,
      url: currentUrl,
      ready,
      violations: scan?.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      })) ?? [],
      incomplete: scan?.incomplete.map((check) => ({
        id: check.id,
        impact: check.impact,
        help: check.help,
        nodes: check.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      })) ?? [],
      passCount: scan?.passes.length ?? 0,
      inapplicableCount: scan?.inapplicable.length ?? 0,
    });
  }

  const summary = results.reduce(
    (accumulator, result) => ({
      routes: accumulator.routes + 1,
      ready: accumulator.ready + (result.ready ? 1 : 0),
      violations: accumulator.violations + result.violations.length,
      incomplete: accumulator.incomplete + result.incomplete.length,
    }),
    { routes: 0, ready: 0, violations: 0, incomplete: 0 },
  );

  console.log(JSON.stringify({ summary, results }, null, 2));
  if (summary.ready !== summary.routes || summary.violations > 0) {
    process.exitCode = 1;
  }
} finally {
  await context.close();
  await browser.close();
}
