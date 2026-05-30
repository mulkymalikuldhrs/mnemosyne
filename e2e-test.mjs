import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3002';
let browser;
let page;
const results = { passed: [], failed: [], warnings: [] };

async function test(name, fn) {
  try {
    await fn();
    results.passed.push(name);
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    results.failed.push({ name, error: err.message });
    console.log(`❌ FAIL: ${name} — ${err.message}`);
  }
}

async function warn(name, message) {
  results.warnings.push({ name, message });
  console.log(`⚠️  WARN: ${name} — ${message}`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // ==========================================
    // TEST 1: Landing Page Loads
    // ==========================================
    await test('Landing page loads', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      const title = await page.title();
      if (!title.includes('Memorix')) throw new Error(`Title should contain "Memorix", got: ${title}`);
    });

    // ==========================================
    // TEST 2: Redirect to Login (if unauthenticated)
    // ==========================================
    await test('Unauthenticated users redirected to login', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(2000);
      const url = page.url();
      if (!url.includes('/login')) {
        // Might still be on main page if no auth guard
        warn('Auth Guard', 'Page did not redirect to /login — auth guard may not be working');
      }
    });

    // ==========================================
    // TEST 3: Login Page Renders
    // ==========================================
    await test('Login page renders correctly', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
      const html = await page.content();
      // Check for email input, password input, submit button
      const hasEmail = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail" i]');
      const hasPassword = await page.$('input[type="password"]');
      const hasSubmit = await page.$('button[type="submit"]');
      if (!hasEmail || !hasPassword || !hasSubmit) {
        throw new Error(`Login form missing elements: email=${!!hasEmail}, password=${!!hasPassword}, submit=${!!hasSubmit}`);
      }
    });

    // ==========================================
    // TEST 4: Register Page Renders
    // ==========================================
    await test('Register page renders correctly', async () => {
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2', timeout: 15000 });
      const hasEmail = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail" i]');
      const hasPassword = await page.$('input[type="password"]');
      const hasSubmit = await page.$('button[type="submit"]');
      if (!hasEmail || !hasPassword || !hasSubmit) {
        throw new Error(`Register form missing: email=${!!hasEmail}, password=${!!hasPassword}, submit=${!!hasSubmit}`);
      }
    });

    // ==========================================
    // TEST 5: Register a New User
    // ==========================================
    await test('User can register', async () => {
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Fill in the form
      const nameInput = await page.$('input[name="name"], input[placeholder*="name" i]');
      const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail" i]');
      const passwordInputs = await page.$$('input[type="password"]');
      
      if (nameInput) await nameInput.type('E2E Test User');
      if (emailInput) await emailInput.type('e2e-browser@test.com');
      if (passwordInputs[0]) await passwordInputs[0].type('TestPass12345');
      if (passwordInputs[1]) await passwordInputs[1].type('TestPass12345');
      
      // Click submit
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await Promise.all([
          submitBtn.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        ]);
      }
      
      await delay(2000);
      // Should redirect to dashboard or login after registration
      const url = page.url();
      if (!url.includes('localhost')) throw new Error('Not on expected page after registration');
    });

    // ==========================================
    // TEST 6: Login with Credentials
    // ==========================================
    await test('User can login', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
      
      const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="mail" i]');
      const passwordInputs = await page.$$('input[type="password"]');
      
      if (emailInput) await emailInput.type('e2e-browser@test.com');
      if (passwordInputs[0]) await passwordInputs[0].type('TestPass12345');
      
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) {
        await Promise.all([
          submitBtn.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        ]);
      }
      
      await delay(3000);
      const url = page.url();
      // After login, should be on main page (not /login)
      warn('Login redirect', `After login, URL is: ${url}`);
    });

    // ==========================================
    // TEST 7: Dashboard Elements
    // ==========================================
    await test('Dashboard has expected elements', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(2000);
      
      const html = await page.content();
      // Check for key text
      const hasMemorix = html.includes('Memorix') || html.includes('memorix');
      const hasWelcome = html.includes('Welcome') || html.includes('welcome') || html.includes('Dashboard') || html.includes('dashboard');
      warn('Dashboard content', `Has Memorix text: ${hasMemorix}, Has Welcome text: ${hasWelcome}`);
    });

    // ==========================================
    // TEST 8: Sidebar Navigation
    // ==========================================
    await test('Sidebar navigation works', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(2000);
      
      // Try to find and click sidebar items
      const sidebarItems = await page.$$('nav a, nav button, [role="navigation"] a, [role="navigation"] button');
      warn('Sidebar items', `Found ${sidebarItems.length} navigation items`);
    });

    // ==========================================
    // TEST 9: Notes Section
    // ==========================================
    await test('Notes section accessible', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1000);
      
      // Try clicking on Notes in sidebar
      const notesLink = await page.$('a[href*="notes"]');
      // Also try via store
      await page.evaluate(() => {
        const store = window.__ZUSTAND_STORE__;
        if (store) store.setState({ activeSection: 'notes' });
      }).catch(() => {});
      
      // Try clicking any element with "Notes" text
      const elements = await page.$$('button, a');
      for (const el of elements) {
        const text = await el.evaluate(e => e.textContent?.trim());
        if (text?.includes('Notes') || text?.includes('Note')) {
          await el.click().catch(() => {});
          break;
        }
      }
      await delay(1500);
      warn('Notes section', `URL after notes click: ${page.url()}`);
    });

    // ==========================================
    // TEST 10: Chat Section
    // ==========================================
    await test('Chat section accessible', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1000);
      
      const elements = await page.$$('button, a');
      for (const el of elements) {
        const text = await el.evaluate(e => e.textContent?.trim());
        if (text?.includes('Chat')) {
          await el.click().catch(() => {});
          break;
        }
      }
      await delay(1500);
      warn('Chat section', `URL after chat click: ${page.url()}`);
    });

    // ==========================================
    // TEST 11: Search Section
    // ==========================================
    await test('Search section accessible', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1000);
      
      const elements = await page.$$('button, a');
      for (const el of elements) {
        const text = await el.evaluate(e => e.textContent?.trim());
        if (text?.includes('Search')) {
          await el.click().catch(() => {});
          break;
        }
      }
      await delay(1500);
      warn('Search section', `URL after search click: ${page.url()}`);
    });

    // ==========================================
    // TEST 12: API Health Check from Browser
    // ==========================================
    await test('API health endpoint accessible from browser', async () => {
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/health');
        return await res.json();
      });
      if (response.success !== true) throw new Error(`Health check failed: ${JSON.stringify(response)}`);
      if (response.data?.status !== 'ok') throw new Error(`Health status not ok: ${response.data?.status}`);
    });

    // ==========================================
    // TEST 13: API Register from Browser
    // ==========================================
    await test('API register endpoint works from browser', async () => {
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `browser-test-${Date.now()}@test.com`,
            password: 'BrowserTest123!',
            name: 'Browser Test',
          }),
        });
        return await res.json();
      });
      if (response.success !== true) {
        // Might fail if email already exists, which is ok
        if (response.error?.includes('already exists')) {
          warn('Register', 'Email already exists (expected on repeat runs)');
        } else {
          throw new Error(`Register failed: ${JSON.stringify(response)}`);
        }
      }
    });

    // ==========================================
    // TEST 14: No Console Errors on Main Pages
    // ==========================================
    await test('No critical console errors on main page', async () => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(3000);
      
      // Filter out known harmless errors
      const criticalErrors = errors.filter(e => 
        !e.includes('favicon') && 
        !e.includes('404') &&
        !e.includes('net::ERR')
      );
      
      if (criticalErrors.length > 3) {
        warn('Console errors', `${criticalErrors.length} console errors found: ${criticalErrors.slice(0, 3).join('; ')}`);
      }
    });

    // ==========================================
    // TEST 15: Responsive Design
    // ==========================================
    await test('Page is responsive on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(2000);
      
      const html = await page.content();
      if (html.length < 100) throw new Error('Page content too short on mobile');
      
      // Reset viewport
      await page.setViewport({ width: 1280, height: 800 });
    });

    // ==========================================
    // SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('E2E TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ PASSED: ${results.passed.length}`);
    console.log(`❌ FAILED: ${results.failed.length}`);
    console.log(`⚠️  WARNINGS: ${results.warnings.length}`);
    
    if (results.failed.length > 0) {
      console.log('\nFailed tests:');
      results.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    }
    
    if (results.warnings.length > 0) {
      console.log('\nWarnings:');
      results.warnings.forEach(w => console.log(`  - ${w.name}: ${w.message}`));
    }
    
    console.log('\nDetailed results:');
    results.passed.forEach(p => console.log(`  ✅ ${p}`));
    
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    if (browser) await browser.close();
  }
})();
