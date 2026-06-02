# Nanggroe IoT — Testing

> E2E testing documentation for Nanggroe IoT using Playwright.

---

## Table of Contents

- [Overview](#overview)
- [Playwright Setup](#playwright-setup)
- [Running Tests Locally](#running-tests-locally)
- [Test Structure](#test-structure)
- [Writing New Tests](#writing-new-tests)
- [CI Integration](#ci-integration)
- [API Testing](#api-testing)
- [Manual Testing Checklist](#manual-testing-checklist)

---

## Overview

Nanggroe IoT uses **Playwright** for end-to-end testing. The test suite covers:

- **8 spec files** covering all major dashboard features
- **183 tests** across dashboard navigation, API health, agents, hardware, missions, navigation, flash, and power
- **Mock API responses** for deterministic testing
- **Mobile responsive testing** with viewport changes
- **API response time validation** for critical endpoints

### Test Statistics

| Spec File | Tests | Category |
|-----------|-------|----------|
| `dashboard.spec.ts` | 29 | Dashboard, navigation, branding, tab switching |
| `api-health.spec.ts` | 31 | API endpoint health, response times, error handling |
| `agents.spec.ts` | 18 | Agent tab, chat, quick commands |
| `hardware.spec.ts` | 15 | Hardware scan, device list, status filter |
| `missions.spec.ts` | 15 | Mission creation, status, detail, abort |
| `navigation.spec.ts` | 22 | Navigation types, RTH, delivery, field mapping |
| `flash.spec.ts` | 14 | Firmware flash, code deploy, device selection |
| `power.spec.ts` | 15 | Power sources, battery, solar, emergency mode |
| **Total** | **183** | |

---

## Playwright Setup

### Configuration

The Playwright configuration is in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

### Prerequisites

- **Bun** >= 1.0
- **Playwright** browsers installed: `npx playwright install chromium`
- **Development server** running on port 3000

---

## Running Tests Locally

### Run All Tests

```bash
bun run test:e2e
```

### Run with Playwright UI

```bash
bun run test:e2e:ui
```

### Run Specific Spec File

```bash
npx playwright test e2e/dashboard.spec.ts
```

### Run Specific Test

```bash
npx playwright test -g "sidebar brand shows NANGGROE IOT"
```

### Run with Verbose Output

```bash
npx playwright test --reporter=list
```

### Run with Debug Mode

```bash
npx playwright test --debug
```

### Run with Trace Viewer

```bash
npx playwright test --trace on
npx playwright show-trace
```

### Environment Variables

```bash
# Base URL (default: http://localhost:3000)
BASE_URL=http://localhost:3000 npx playwright test

# CI mode (no retries, no parallel)
CI=true npx playwright test
```

---

## Test Structure

### File Organization

```
e2e/
├── fixtures.ts          # Shared fixtures, mock data, helpers
├── helpers.ts           # Additional test utilities
├── dashboard.spec.ts    # Dashboard & navigation tests
├── api-health.spec.ts   # API endpoint health checks
├── agents.spec.ts       # AI agent tab tests
├── hardware.spec.ts     # Hardware tab tests
├── missions.spec.ts     # Mission planning tests
├── navigation.spec.ts   # Navigation tab tests
├── flash.spec.ts        # Firmware flash tests
└── power.spec.ts        # Power management tests
```

### Fixtures (`fixtures.ts`)

The shared fixtures file provides:

- **Tab IDs**: Array of all 20 dashboard tab identifiers
- **Tab Labels**: Map of tab IDs to display labels
- **API Endpoints**: List of all API endpoint paths
- **Mock Responses**: Pre-built mock API responses for all major endpoints
- **Helper Functions**:
  - `switchToTab(page, label)` — Click a tab and wait for content
  - `verifyApiEndpoint(request, endpoint)` — Verify API returns success
  - `getActiveTabLabel(page)` — Get the currently active tab header text
  - `mockAllApiResponses(page)` — Mock all API responses for offline testing
  - `waitForToast(page)` — Wait for a Sonner toast notification

### Test Pattern

Each spec file follows this pattern:

```typescript
import { test, expect, switchToTab, MOCK_RESPONSES } from './fixtures'

test.describe('Feature Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="brand-title"]', { timeout: 15_000 })
    await switchToTab(page, 'Feature')
  })

  test('basic navigation works', async ({ page }) => {
    await expect(page.getByTestId('active-tab-title')).toContainText('Feature')
  })

  // ... more tests
})
```

### Data Test IDs

The dashboard uses `data-testid` attributes for reliable element selection:

| Test ID | Element |
|---------|---------|
| `brand-title` | Sidebar brand header |
| `sidebar` | Desktop sidebar container |
| `tab-content` | Tab content area |
| `active-tab-title` | Active tab header text |
| `system-online` | System online indicator |
| `system-online-dot` | System online pulsing dot |
| `region-info` | Region information text |
| `mobile-nav` | Mobile bottom navigation |
| `nav-tab-{id}` | Sidebar navigation button |
| `mobile-nav-tab-{id}` | Mobile navigation button |

### Mock API Pattern

Tests use Playwright's route interception for deterministic testing:

```typescript
await page.route('**/api/hardware**', (route) => {
  if (route.request().method() === 'GET') {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RESPONSES.hardware),
    })
  } else {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { ... } }),
    })
  }
})
```

---

## Writing New Tests

### Step 1: Add to Existing Spec

For features within an existing tab, add tests to the corresponding spec file:

```typescript
// In e2e/hardware.spec.ts
test('device detail shows firmware version', async ({ page }) => {
  await page.waitForTimeout(2_000)
  const moreButton = page.locator('text=More').first()
  if (await moreButton.isVisible({ timeout: 3_000 })) {
    await moreButton.click()
    await expect(page.locator('text=Firmware:')).toBeVisible({ timeout: 3_000 })
  }
})
```

### Step 2: Create New Spec File

For new features, create a new spec file:

```typescript
// e2e/new-feature.spec.ts
import { test, expect, switchToTab } from './fixtures'

test.describe('New Feature Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="brand-title"]', { timeout: 15_000 })
    await switchToTab(page, 'New Feature')
  })

  test('navigates to tab successfully', async ({ page }) => {
    await expect(page.getByTestId('active-tab-title')).toContainText('New Feature')
  })
})
```

### Step 3: Add Mock Responses

Add mock responses to `fixtures.ts`:

```typescript
export const MOCK_RESPONSES = {
  // ... existing mocks
  newFeature: {
    success: true,
    data: {
      items: [
        { id: 'item-001', name: 'Test Item', status: 'active' }
      ]
    }
  }
}
```

### Step 4: Add API Endpoints

Add new API endpoint paths to `fixtures.ts`:

```typescript
export const API_ENDPOINTS = {
  // ... existing endpoints
  newFeature: '/api/new-feature',
} as const
```

### Testing Guidelines

1. **Use `data-testid`** for element selection (not CSS classes or text content)
2. **Mock API responses** for deterministic test results
3. **Wait for elements** with appropriate timeouts (use `{ timeout: 5_000 }`)
4. **Handle empty states** — tests should work with or without data
5. **Test both desktop and mobile** views where applicable
6. **Use `waitForTimeout`** sparingly — prefer `waitForSelector` or `toBeVisible`
7. **Keep tests independent** — each test should work in isolation
8. **Avoid test interdependencies** — don't rely on test execution order

---

## CI Integration

### GitHub Actions

The CI pipeline runs E2E tests on every push and pull request:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run lint
      - run: bun run db:push
      - run: bun run db:generate
      - run: npx playwright install chromium
      - run: bun run test:e2e
        env:
          CI: true
```

### CI Configuration

In CI mode:
- **Retries**: 2 (vs 0 locally)
- **Workers**: 1 (vs auto locally)
- **Timeout**: 30 seconds per test
- **Screenshots**: Only on failure
- **Videos**: Retained on failure
- **Traces**: On first retry

---

## API Testing

### Health Check Tests

The `api-health.spec.ts` file tests all API endpoints:

```typescript
test('GET /api — system health check', async ({ request }) => {
  const json = await verifyApiEndpoint(request, API_ENDPOINTS.health)
  expect(json.data).toBeDefined()
  expect(json.data.system).toBe('Nanggroe IoT')
  expect(json.data.version).toBeDefined()
})
```

### Response Time Tests

Critical endpoints are tested for response time:

```typescript
test('GET /api/hardware responds within 5 seconds', async ({ request }) => {
  const start = Date.now()
  const response = await request.get('/api/hardware')
  const duration = Date.now() - start
  expect(response.ok()).toBeTruthy()
  expect(duration).toBeLessThan(5000)
})
```

### Error Handling Tests

```typescript
test('GET /api/nonexistent — returns 404', async ({ request }) => {
  const response = await request.get('/api/nonexistent')
  expect(response.status()).toBe(404)
})

test('POST /api/missions with invalid data — returns error', async ({ request }) => {
  const response = await request.post('/api/missions', {
    data: {},
    headers: { 'Content-Type': 'application/json' },
  })
  expect(response.status()).not.toBe(200)
})
```

### Testing API Key Authentication

```typescript
test('POST /api/mcp without API key — returns 401 in production', async ({ request }) => {
  // This test requires NANGGROE_API_KEY to be set
  const response = await request.post('/api/mcp', {
    data: { tool: 'safety_assessment', arguments: {} },
  })
  // In dev mode without key: 200
  // In production without key: 401
})
```

---

## Manual Testing Checklist

### Dashboard

- [ ] Page loads without crash
- [ ] Sidebar shows "NANGGROE IOT" branding
- [ ] Version number is displayed
- [ ] System online indicator shows green pulsing dot
- [ ] Region info shows "Aceh Utara Region"
- [ ] All 20 tabs are visible and clickable
- [ ] Tab switching works correctly
- [ ] Active tab has teal highlight
- [ ] Mobile bottom nav appears on small screens

### API Endpoints

- [ ] `GET /api` returns system health
- [ ] `GET /api/hardware` returns device list
- [ ] `GET /api/missions` returns mission list
- [ ] `GET /api/telemetry` returns telemetry data
- [ ] `GET /api/agents` returns agent messages
- [ ] `GET /api/system` returns system config
- [ ] `GET /api/power` returns power sources
- [ ] `GET /api/navigation` returns navigation plans
- [ ] `GET /api/doctor` returns diagnostics
- [ ] `GET /api/alerts` returns alerts
- [ ] All SSE streams connect and emit events

### Agents

- [ ] Hermes and PicoClaw status badges are visible
- [ ] Chat input is functional
- [ ] Send button enables when text is entered
- [ ] Quick command buttons work
- [ ] Message appears in chat after sending

### Hardware

- [ ] Scan Hardware button triggers scan
- [ ] Device list populates from API
- [ ] Status filter dropdown works
- [ ] Device expansion shows details
- [ ] Set Active / Set Offline buttons work

### Missions

- [ ] New Mission button opens dialog
- [ ] Form validation works (disabled without name)
- [ ] Mission creation succeeds
- [ ] Status badges display correctly
- [ ] Abort confirmation dialog works

### Navigation

- [ ] RTH Emergency button shows confirmation
- [ ] Field mapping form validates inputs
- [ ] Delivery form validates coordinates
- [ ] Navigation plans display with status

### Power

- [ ] Battery info displays voltage and percentage
- [ ] Solar panel data shows correctly
- [ ] Enable/Disable buttons toggle sources
- [ ] Emergency mode banner appears when active
- [ ] Error state shows retry button

---

*Last updated: 2025*
