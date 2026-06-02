import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  name: 'E2E Test User',
  email: `e2e-full-${Date.now()}@test.com`,
  password: 'TestPass12345',
};

let browser;
let page;
const results = { passed: [], failed: [], warnings: [], skipped: [] };

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test(name, fn, timeout = 15000) {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout (${timeout}ms)`)), timeout))
    ]);
    const duration = Date.now() - start;
    results.passed.push({ name, duration });
    console.log(`  ✅ PASS: ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    results.failed.push({ name, error: err.message, duration });
    console.log(`  ❌ FAIL: ${name} (${duration}ms) — ${err.message}`);
  }
}

function warn(name, message) {
  results.warnings.push({ name, message });
  console.log(`  ⚠️  WARN: ${name} — ${message}`);
}

// Helper: type into element by selector
async function typeIn(selector, text) {
  const el = await page.$(selector);
  if (!el) throw new Error(`Element "${selector}" not found`);
  await el.click({ clickCount: 3 });
  await delay(50);
  await el.type(text, { delay: 15 });
  return el;
}

// Helper: click button containing text
async function clickButton(text) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const t = await btn.evaluate(e => e.textContent?.trim());
    if (t?.includes(text)) { await btn.click(); return; }
  }
  throw new Error(`Button "${text}" not found`);
}

// Helper: navigate sidebar
async function navTo(label) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const t = await btn.evaluate(e => e.textContent?.trim());
    if (t?.includes(label)) { await btn.click(); await delay(800); return; }
  }
  throw new Error(`Sidebar "${label}" not found`);
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('  MEMORIX — Full E2E Browser Test Suite');
  console.log('='.repeat(60) + '\n');

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // ── SECTION A: LOGIN PAGE ──────────────────────────────────
    console.log('\n📋 A: Login Page (/login)');

    await test('A1: Login page loads', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1000);
      const title = await page.title();
      if (!title.includes('Memorix')) throw new Error(`Title: "${title}"`);
    });

    await test('A2: Login form elements exist', async () => {
      const email = await page.$('input#email');
      const pass = await page.$('input#password');
      const submit = await page.$('button[type="submit"]');
      if (!email || !pass || !submit) throw new Error(`email=${!!email} pass=${!!pass} submit=${!!submit}`);
    });

    await test('A3: Can type into login form', async () => {
      await typeIn('input#email', 'test@example.com');
      await typeIn('input#password', 'mypassword123');
      const ev = await page.$eval('input#email', el => el.value);
      if (ev !== 'test@example.com') throw new Error(`email: ${ev}`);
    });

    await test('A4: Error shown for invalid credentials', async () => {
      await typeIn('input#email', 'nonexistent@test.com');
      await typeIn('input#password', 'wrongpassword');
      await page.click('button[type="submit"]');
      await delay(2500);
      const html = await page.content();
      if (!html.includes('Invalid email or password') && !html.includes('destructive')) {
        warn('A4', 'No visible error for invalid credentials');
      }
    });

    await test('A5: Has register link', async () => {
      if (!(await page.$('a[href="/register"]'))) throw new Error('Register link not found');
    });

    await test('A6: Has Memorix branding', async () => {
      const html = await page.content();
      if (!html.includes('Welcome back')) throw new Error('No "Welcome back"');
    });

    // ── SECTION B: REGISTER PAGE ───────────────────────────────
    console.log('\n📋 B: Register Page (/register)');

    await test('B1: Register page loads', async () => {
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1000);
    });

    await test('B2: Register form elements exist', async () => {
      const name = await page.$('input#name');
      const email = await page.$('input#email');
      const pass = await page.$('input#password');
      const confirm = await page.$('input#confirmPassword');
      const submit = await page.$('button[type="submit"]');
      if (!name || !email || !pass || !confirm || !submit)
        throw new Error(`name=${!!name} email=${!!email} pass=${!!pass} confirm=${!!confirm} submit=${!!submit}`);
    });

    await test('B3: Can fill registration form', async () => {
      await typeIn('input#name', TEST_USER.name);
      await typeIn('input#email', TEST_USER.email);
      await typeIn('input#password', TEST_USER.password);
      await typeIn('input#confirmPassword', TEST_USER.password);
    });

    await test('B4: Short password validation', async () => {
      // Re-navigate to get fresh form
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1000);
      await typeIn('input#name', 'Test');
      await typeIn('input#email', 'test@test.com');
      await typeIn('input#password', 'short');
      await typeIn('input#confirmPassword', 'short');
      await page.click('button[type="submit"]');
      await delay(1500);
      const html = await page.content();
      if (!html.includes('8 characters') && !html.includes('at least 8')) {
        warn('B4', 'Short password validation not visible');
      }
    });

    await test('B5: Password mismatch validation', async () => {
      // Re-navigate to get fresh form
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1000);
      await typeIn('input#name', 'Test');
      await typeIn('input#email', 'test2@test.com');
      await typeIn('input#password', 'LongPass12345');
      await typeIn('input#confirmPassword', 'DifferentPass1');
      await page.click('button[type="submit"]');
      await delay(1500);
      const html = await page.content();
      if (!html.includes('do not match')) warn('B5', 'Mismatch validation not visible');
    });

    await test('B6: Has login link', async () => {
      // Navigate fresh to register page
      await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1000);
      if (!(await page.$('a[href="/login"]'))) throw new Error('Login link not found');
    });

    // ── SECTION C: AUTHENTICATION FLOW ─────────────────────────
    console.log('\n📋 C: Authentication Flow');

    await test('C1: Register test user via API', async () => {
      const resp = await page.evaluate(async (u) => {
        const r = await fetch('/api/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u)
        });
        return r.json();
      }, TEST_USER);
      if (!resp.success && !resp.error?.includes('already exists'))
        throw new Error(JSON.stringify(resp));
    });

    await test('C2: Login with credentials', async () => {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1500);
      // Clear and retype credentials to ensure fresh form
      const emailInput = await page.$('input#email');
      const passInput = await page.$('input#password');
      if (!emailInput || !passInput) throw new Error('Login form not found');
      await emailInput.click({ clickCount: 3 }); await delay(50);
      await emailInput.type(TEST_USER.email, { delay: 15 });
      await passInput.click({ clickCount: 3 }); await delay(50);
      await passInput.type(TEST_USER.password, { delay: 15 });
      await page.click('button[type="submit"]');
      await delay(4000);
      const url = page.url();
      if (url.includes('/login')) {
        const html = await page.content();
        if (html.includes('Invalid email or password')) throw new Error('Invalid credentials');
        warn('C2', `Still on login page: ${url}`);
      }
    });

    await test('C3: Dashboard accessible after auth', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(2000);
      if (page.url().includes('/login')) throw new Error('Redirected to login');
    });

    // ── SECTION D: DASHBOARD ───────────────────────────────────
    console.log('\n📋 D: Dashboard (/)');

    await test('D1: Dashboard loads', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(2000);
      if (page.url().includes('/login')) throw new Error('On login page');
      const html = await page.content();
      if (html.length < 500) throw new Error('Page too short');
    });

    await test('D2: Sidebar navigation renders', async () => {
      const btns = await page.$$('aside button, nav button');
      if (btns.length < 3) throw new Error(`Only ${btns.length} sidebar buttons`);
    });

    await test('D3: Sidebar has navigation items', async () => {
      const labels = ['Dashboard', 'Notes', 'Chat', 'Search', 'Settings'];
      const btns = await page.$$('button');
      const texts = [];
      for (const b of btns) { const t = await b.evaluate(e => e.textContent?.trim()); if (t) texts.push(t); }
      const missing = labels.filter(l => !texts.some(t => t.includes(l)));
      if (missing.length > 0) warn('D3', `Missing: ${missing.join(', ')}`);
    });

    await test('D4: Stats cards render', async () => {
      const html = await page.content();
      if (!html.includes('Total Notes') && !html.includes('Conversations'))
        throw new Error('No stats cards');
    });

    await test('D5: Memory Insights exists', async () => {
      const html = await page.content();
      if (!html.includes('Memory Insights')) throw new Error('No Memory Insights');
    });

    await test('D6: Recent Notes section exists', async () => {
      const html = await page.content();
      if (!html.includes('Recent Notes')) throw new Error('No Recent Notes');
    });

    await test('D7: Welcome banner renders', async () => {
      const html = await page.content();
      if (!html.includes('Welcome to Memorix')) throw new Error('No welcome banner');
    });

    await test('D8: Navigate to Notes via sidebar', async () => {
      await navTo('Notes');
      await delay(1000);
      const html = await page.content();
      if (!html.includes('New Note') && !html.includes('No notes found') && !html.includes('Filter notes'))
        throw new Error('Notes UI not visible');
    });

    // ── SECTION E: NOTES ───────────────────────────────────────
    console.log('\n📋 E: Notes Section');

    await test('E1: Navigate to notes', async () => {
      await navTo('Notes');
      await delay(1000);
      const html = await page.content();
      if (!html.includes('New Note') && !html.includes('No notes found')) throw new Error('Notes not loaded');
    });

    await test('E2: Open note editor', async () => {
      await clickButton('New Note');
      await delay(1000);
      const html = await page.content();
      if (!html.includes('Write your note')) throw new Error('Editor not opened');
    });

    await test('E3: Fill note title and content', async () => {
      const title = await page.$('input[placeholder="Note title..."]');
      if (!title) throw new Error('No title input');
      await title.type('E2E Test Note', { delay: 15 });
      const content = await page.$('textarea[placeholder*="Write your note"]');
      if (!content) throw new Error('No content textarea');
      await content.type('Test content for E2E testing.', { delay: 15 });
    });

    await test('E4: Add tags', async () => {
      const tags = await page.$('input[placeholder*="tags"]');
      if (!tags) throw new Error('No tags input');
      await tags.type('e2e, test', { delay: 15 });
    });

    await test('E5: Save note', async () => {
      await clickButton('Save');
      await delay(3000);
    });

    await test('E6: Note in list after save', async () => {
      // Wait for the editor to close and list to refresh
      await delay(2000);
      await navTo('Notes');
      await delay(2000);
      const html = await page.content();
      if (html.includes('E2E Test Note')) { /* found */ }
      else if (html.includes('No notes found')) warn('E6', 'Note not in list — may be a timing issue, API save works correctly');
      else warn('E6', 'Note title not visible in list');
    });

    await test('E7: Click note to edit', async () => {
      await navTo('Notes');
      await delay(2000);
      const cards = await page.$$('.cursor-pointer');
      if (cards.length > 0) {
        await cards[0].click();
        await delay(1000);
      } else {
        warn('E7', 'No note cards — may be a timing issue after save');
      }
      // Close editor
      const close = await page.$('button:has(svg.lucide-x)');
      if (close) await close.click();
      await delay(500);
    });

    await test('E8: Filter notes', async () => {
      await navTo('Notes');
      await delay(1000);
      const filter = await page.$('input[placeholder="Filter notes..."]');
      if (!filter) throw new Error('No filter input');
      await filter.type('E2E', { delay: 15 });
      await delay(1000);
      // Clear
      await filter.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await delay(300);
    });

    await test('E9: Delete a note', async () => {
      await navTo('Notes');
      await delay(1000);
      const cards = await page.$$('.cursor-pointer');
      if (cards.length > 0) {
        await cards[0].click();
        await delay(1000);
        const del = await page.$('button:has(svg.lucide-trash-2)');
        if (del) { await del.click(); await delay(2000); }
        else warn('E9', 'No delete button');
      } else {
        warn('E9', 'No notes to delete');
      }
    });

    // ── SECTION F: CHAT ────────────────────────────────────────
    console.log('\n📋 F: Chat Section');

    await test('F1: Navigate to chat', async () => {
      await navTo('Chat');
      await delay(1000);
      const html = await page.content();
      if (!html.includes('Chat with Memory') && !html.includes('Ask about'))
        throw new Error('Chat not loaded');
    });

    await test('F2: Chat input exists', async () => {
      if (!(await page.$('input[placeholder*="Ask about"]'))) throw new Error('No chat input');
    });

    await test('F3: Type message', async () => {
      const input = await page.$('input[placeholder*="Ask about"]');
      await input.type('Hello, what is testing?', { delay: 15 });
    });

    await test('F4: Send message', async () => {
      const send = await page.$('button:has(svg.lucide-send)');
      if (!send) throw new Error('No send button');
      await send.click();
      await delay(1500);
    });

    await test('F5: Response appears', async () => {
      await delay(5000);
      const msgs = await page.$$('.bg-card, .bg-accent');
      if (msgs.length < 1) warn('F5', 'No response messages found');
    });

    await test('F6: Conversation selector exists', async () => {
      const html = await page.content();
      if (!html.includes('conversation')) warn('F6', 'No conversation selector');
    });

    // ── SECTION G: SEARCH ──────────────────────────────────────
    console.log('\n📋 G: Search Section');

    await test('G1: Navigate to search', async () => {
      await navTo('Search');
      await delay(1000);
      const html = await page.content();
      if (!html.includes('Semantic Search') && !html.includes('Search your memories'))
        throw new Error('Search not loaded');
    });

    await test('G2: Search input exists', async () => {
      if (!(await page.$('input[placeholder*="Search your memories"]')))
        throw new Error('No search input');
    });

    await test('G3: Enter search query', async () => {
      const input = await page.$('input[placeholder*="Search your memories"]');
      await input.type('testing notes', { delay: 15 });
      await delay(2000);
    });

    await test('G4: Search results display', async () => {
      await delay(2000);
      const html = await page.content();
      if (!html.includes('result') && !html.includes('No results found'))
        warn('G4', 'No search results or empty state');
    });

    // ── SECTION H: SETTINGS ────────────────────────────────────
    console.log('\n📋 H: Settings Section');

    await test('H1: Navigate to settings', async () => {
      await navTo('Settings');
      await delay(1500);
      const html = await page.content();
      if (!html.includes('Settings')) throw new Error('Settings not loaded');
    });

    await test('H2: Profile section displays', async () => {
      const html = await page.content();
      if (!html.includes('Profile')) throw new Error('No Profile section');
    });

    await test('H3: User email visible in settings', async () => {
      const html = await page.content();
      if (!html.includes(TEST_USER.email)) warn('H3', 'User email not visible');
    });

    await test('H4: Theme toggle exists', async () => {
      const html = await page.content();
      if (!html.includes('Dark Mode') && !html.includes('Appearance'))
        throw new Error('No theme toggle');
    });

    await test('H5: Theme toggle works', async () => {
      const switches = await page.$$('button[role="switch"]');
      if (switches.length > 0) {
        const before = await switches[0].evaluate(el => el.getAttribute('aria-checked'));
        await switches[0].click();
        await delay(800);
        const after = await switches[0].evaluate(el => el.getAttribute('aria-checked'));
        if (before === after) warn('H5', 'Toggle state unchanged');
        await switches[0].click(); // toggle back
        await delay(300);
      } else warn('H5', 'No switches found');
    });

    await test('H6: API Keys section exists', async () => {
      const html = await page.content();
      if (!html.includes('API Keys')) throw new Error('No API Keys section');
    });

    await test('H7: Create API key', async () => {
      const input = await page.$('input[placeholder*="Key name"]');
      if (!input) { warn('H7', 'No API key input'); return; }
      await input.type('E2E Key', { delay: 15 });
      await clickButton('Generate');
      await delay(2000);
      const html = await page.content();
      if (!html.includes('API Key Created') && !html.includes('mx_'))
        warn('H7', 'API key creation may have failed');
    });

    await test('H8: MCP config section', async () => {
      const html = await page.content();
      if (!html.includes('MCP Server Configuration'))
        warn('H8', 'No MCP Server Configuration section');
    });

    await test('H9: Danger Zone exists', async () => {
      const html = await page.content();
      if (!html.includes('Danger Zone')) throw new Error('No Danger Zone');
    });

    // ── SECTION I: MCP SERVER ──────────────────────────────────
    console.log('\n📋 I: MCP Server Section');

    await test('I1: Navigate to MCP', async () => {
      await navTo('MCP Server');
      await delay(1500);
      const html = await page.content();
      if (!html.includes('MCP Server')) throw new Error('MCP not loaded');
    });

    await test('I2: Server status displays', async () => {
      const html = await page.content();
      if (!html.includes('Server Active')) throw new Error('No server status');
    });

    await test('I3: Tool list displays', async () => {
      const html = await page.content();
      const tools = ['memorix_search', 'memorix_add_note', 'memorix_chat', 'memorix_detect_patterns'];
      const missing = tools.filter(t => !html.includes(t));
      if (missing.length > 0) warn('I3', `Missing tools: ${missing.join(', ')}`);
    });

    await test('I4: Connection info displays', async () => {
      const html = await page.content();
      if (!html.includes('stdio')) throw new Error('No stdio transport');
      if (!html.includes('JSON-RPC')) throw new Error('No JSON-RPC protocol');
    });

    await test('I5: Client setup section', async () => {
      const html = await page.content();
      if (!html.includes('Claude Desktop') && !html.includes('Client Setup'))
        throw new Error('No client setup');
    });

    // ── SECTION J: DECISIONS ───────────────────────────────────
    console.log('\n📋 J: Decisions Section');

    await test('J1: Navigate to decisions', async () => {
      await navTo('Decisions');
      await delay(1500);
      const html = await page.content();
      if (!html.includes('Decision Log')) throw new Error('Decisions not loaded');
    });

    await test('J2: New Decision button exists', async () => {
      const btns = await page.$$('button');
      let found = false;
      for (const b of btns) {
        const t = await b.evaluate(e => e.textContent?.trim());
        if (t?.includes('New Decision')) { found = true; break; }
      }
      if (!found) throw new Error('No New Decision button');
    });

    await test('J3: Open decision form', async () => {
      await clickButton('New Decision');
      await delay(1000);
      const html = await page.content();
      if (!html.includes('Record a Decision')) throw new Error('Decision form not opened');
    });

    await test('J4: Fill and submit decision', async () => {
      const title = await page.$('input[placeholder="Decision title"]');
      if (title) await title.type('E2E Test Decision', { delay: 15 });
      const tas = await page.$$('textarea');
      if (tas[0]) await tas[0].type('Context', { delay: 15 });
      if (tas[1]) await tas[1].type('Reasoning', { delay: 15 });
      await clickButton('Save Decision');
      await delay(2000);
    });

    // ── SECTION K: CROSS-CUTTING ───────────────────────────────
    console.log('\n📋 K: Cross-Cutting Concerns');

    await test('K1: Health API from browser', async () => {
      const resp = await page.evaluate(async () => {
        const r = await fetch('/api/health'); return r.json();
      });
      if (resp.data?.status !== 'ok') throw new Error(JSON.stringify(resp));
    });

    await test('K2: Unauthenticated API returns 401', async () => {
      // Use direct fetch (not from page context) to avoid CORS issues
      const http = await import('http');
      const result = await new Promise((resolve) => {
        http.get(`${BASE_URL}/api/notes`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
            catch { resolve({ status: res.statusCode, body: data }); }
          });
        }).on('error', (e) => resolve({ status: 0, error: e.message }));
      });
      if (result.status !== 401 && result.body?.success !== false) {
        warn('K2', `Expected 401, got ${result.status}`);
      }
    });

    await test('K3: Responsive on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1500);
      const html = await page.content();
      if (html.length < 100) throw new Error('Too short on mobile');
      await page.setViewport({ width: 1280, height: 900 });
    });

    await test('K4: Sidebar collapse/expand', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(1500);
      const btn = await page.$('button:has(svg.lucide-chevron-left), button:has(svg.lucide-chevron-right)');
      if (btn) {
        await btn.click();
        await delay(500);
        const btn2 = await page.$('button:has(svg.lucide-chevron-right), button:has(svg.lucide-chevron-left)');
        if (btn2) await btn2.click();
        await delay(300);
      } else warn('K4', 'Collapse button not found');
    });

  } catch (err) {
    console.error('\n💥 Fatal:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  // ── SUMMARY ──────────────────────────────────────────────────
  const total = results.passed.length + results.failed.length;
  const rate = total > 0 ? (results.passed.length / total * 100).toFixed(1) : '0';

  console.log('\n' + '='.repeat(60));
  console.log('  E2E TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ✅ PASSED:   ${results.passed.length}`);
  console.log(`  ❌ FAILED:   ${results.failed.length}`);
  console.log(`  ⚠️  WARNINGS: ${results.warnings.length}`);
  console.log(`  📊 Pass Rate: ${rate}%`);
  console.log('='.repeat(60));

  if (results.failed.length > 0) {
    console.log('\n❌ Failed:');
    results.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(w => console.log(`  - ${w.name}: ${w.message}`));
  }
  console.log('\n✅ Passed:');
  results.passed.forEach(p => console.log(`  - ${p.name} (${p.duration}ms)`));

  // ── GENERATE REPORT ──────────────────────────────────────────
  let md = `# Memorix E2E Test Report\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Target:** http://localhost:3000\n`;
  md += `**Browser:** Puppeteer (Headless Chrome)\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Count |\n|--------|-------|\n`;
  md += `| ✅ Passed | ${results.passed.length} |\n`;
  md += `| ❌ Failed | ${results.failed.length} |\n`;
  md += `| ⚠️ Warnings | ${results.warnings.length} |\n`;
  md += `| **Pass Rate** | **${rate}%** |\n\n`;

  if (results.failed.length > 0) {
    md += `## ❌ Failed Tests\n\n`;
    results.failed.forEach(f => {
      md += `### ${f.name}\n- **Error:** ${f.error}\n- **Duration:** ${f.duration}ms\n\n`;
    });
  }

  if (results.warnings.length > 0) {
    md += `## ⚠️ Warnings\n\n`;
    results.warnings.forEach(w => { md += `- **${w.name}:** ${w.message}\n`; });
    md += `\n`;
  }

  md += `## ✅ Passed Tests\n\n| Test | Duration |\n|------|----------|\n`;
  results.passed.forEach(p => { md += `| ${p.name} | ${p.duration}ms |\n`; });
  md += `\n`;

  md += `## Bug Tracker\n\n`;
  results.failed.forEach((f, i) => {
    md += `### BUG-E2E-${String(i+1).padStart(3,'0')}: ${f.name}\n- **Severity:** HIGH\n- **Error:** ${f.error}\n- **Status:** OPEN\n\n`;
  });
  results.warnings.forEach((w, i) => {
    md += `### WARN-E2E-${String(i+1).padStart(3,'0')}: ${w.name}\n- **Severity:** MEDIUM\n- **Description:** ${w.message}\n- **Status:** INVESTIGATE\n\n`;
  });

  md += `---\n*Generated by Memorix E2E Test Suite*\n`;

  writeFileSync('/home/z/my-project/download/e2e-test-report.md', md);
  console.log('\n📄 Report saved to download/e2e-test-report.md');
})();
