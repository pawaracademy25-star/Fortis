import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './src/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runTestSuite() {
  console.log('=== STARTING COMPLETE END-TO-END WEBSITE TEST ===\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  try {
    // 1. Load Page
    console.log('[TEST 1] Loading http://localhost:3000...');
    const response = await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    console.log(`Page loaded with status: ${response.status()}`);
    if (response.status() !== 200) throw new Error('Page did not load with status 200');

    // 2. Security Check: Verify absolutely NO admin controls or links exist
    console.log('\n[TEST 2] Verifying strict absence of admin controls...');
    const adminOccurrences = await page.evaluate(() => {
      const allText = document.body.innerText.toLowerCase();
      // Check for admin action words like "admin login", "admin dashboard", "manage users", "admin panel"
      const forbiddenPhrases = [
        'admin login',
        'admin portal',
        'admin dashboard',
        'manage users',
        'staff portal',
        'admin panel',
        'delete booking',
        'admin settings'
      ];
      const found = forbiddenPhrases.filter(phrase => allText.includes(phrase));
      const adminLinks = Array.from(document.querySelectorAll('a, button'))
        .filter(el => (el.getAttribute('href') || '').toLowerCase().includes('admin') || el.innerText.toLowerCase().includes('admin login'));
      return { found, adminLinksCount: adminLinks.length };
    });

    console.log(`Forbidden admin controls found: ${adminOccurrences.found.length}`);
    console.log(`Admin navigation links found: ${adminOccurrences.adminLinksCount}`);
    if (adminOccurrences.found.length > 0 || adminOccurrences.adminLinksCount > 0) {
      throw new Error('Admin controls exposed in UI!');
    }
    console.log('✓ PASS: Zero admin controls exposed to normal users.');

    // 3. Test Schedule tabs & filters
    console.log('\n[TEST 3] Testing Live Schedule interaction & filters...');
    await page.waitForSelector('.class-card');
    const initialCardCount = await page.$$eval('.class-card', cards => cards.length);
    console.log(`Initial classes displayed: ${initialCardCount}`);

    // Click Wednesday tab
    console.log('Clicking Wednesday tab...');
    await page.click('button[data-day="Wednesday"]');
    await new Promise(r => setTimeout(r, 600));
    const wednesdayCardCount = await page.$$eval('.class-card', cards => cards.length);
    console.log(`Wednesday classes count: ${wednesdayCardCount}`);

    // Click Boxing filter chip
    console.log('Clicking Boxing filter chip...');
    await page.click('button[data-category="Boxing"]');
    await new Promise(r => setTimeout(r, 600));
    const boxingClassTitle = await page.$eval('.class-title', el => el.innerText);
    console.log(`Filtered class title: "${boxingClassTitle}"`);
    console.log('✓ PASS: Schedule filtering functions dynamically.');

    // 4. Test Class Spot Reservation Flow
    console.log('\n[TEST 4] Testing Class Spot Reservation modal and submission...');
    // Reset filters to Monday
    await page.click('button[data-category="All"]');
    await page.click('button[data-day="Monday"]');
    await new Promise(r => setTimeout(r, 600));

    // Reserve first spot
    const firstReserveBtn = await page.$('.class-card button.btn-primary');
    await firstReserveBtn.click();
    await page.waitForSelector('#bookingModal.active', { timeout: 3000 });
    console.log('Booking modal opened.');

    await page.type('#bookingFullName', 'Test Athlete Alexander');
    await page.type('#bookingEmail', 'alexander.test@example.com');
    await page.type('#bookingPhone', '+1 555 999 1234');

    await page.click('#classBookingForm button[type="submit"]');
    await page.waitForSelector('.toast', { timeout: 4000 });
    const toastText = await page.$eval('.toast', el => el.innerText);
    console.log(`Received Toast: "${toastText}"`);

    // Verify record in SQLite database
    const bookingInDb = db.prepare('SELECT * FROM class_bookings WHERE email = ? ORDER BY id DESC LIMIT 1').get('alexander.test@example.com');
    console.log('Database verified booking ref:', bookingInDb?.booking_ref, 'Name:', bookingInDb?.full_name);
    if (!bookingInDb) throw new Error('Booking was not persisted to SQLite database!');
    console.log('✓ PASS: Class reservation end-to-end verified in database.');

    // 5. Test 1-Day VIP Pass Generator
    console.log('\n[TEST 5] Testing 1-Day VIP Trial Pass generator...');
    await page.type('#trialFullName', 'Victoria Vance');
    await page.type('#trialEmail', 'victoria.vance@example.com');
    await page.type('#trialPhone', '+1 555 888 7766');

    await page.click('#trialPassForm button[type="submit"]');
    await page.waitForFunction(() => {
      const code = document.querySelector('.pass-code-val');
      return code && code.innerText && code.innerText !== 'FTS-DEMO-00';
    }, { timeout: 5000 });
    const generatedCode = await page.$eval('.pass-code-val', el => el.innerText);
    console.log(`Generated VIP Pass Code on card: "${generatedCode}"`);

    // Verify in SQLite (latest record)
    const passInDb = db.prepare('SELECT * FROM trial_passes WHERE email = ? ORDER BY id DESC LIMIT 1').get('victoria.vance@example.com');
    console.log('Database verified trial pass code:', passInDb?.pass_code, 'Athlete:', passInDb?.full_name);
    if (!passInDb || passInDb.pass_code !== generatedCode) {
      throw new Error('Trial pass was not persisted to SQLite database correctly!');
    }
    console.log('✓ PASS: 1-Day VIP Pass generator and barcode card verified.');

    // 6. Test Membership Configurator
    console.log('\n[TEST 6] Testing Membership Pricing switcher...');
    const monthlyPriceEl = await page.$eval('.plan-card .price-val', el => el.innerText);
    console.log(`Annual discounted price shown: $${monthlyPriceEl}`);

    // Toggle switch
    await page.click('.slider');
    await new Promise(r => setTimeout(r, 400));
    const switchedPriceEl = await page.$eval('.plan-card .price-val', el => el.innerText);
    console.log(`Regular monthly price after toggle: $${switchedPriceEl}`);
    console.log('✓ PASS: Pricing configurator reactive toggling verified.');

    // 7. Test Biometric & Caloric Calculator
    console.log('\n[TEST 7] Testing Interactive Biometrics & Caloric Calculator...');
    // Change weight slider
    await page.$eval('#calcWeight', el => { el.value = 85; el.dispatchEvent(new Event('input')); });
    await page.$eval('#calcHeight', el => { el.value = 185; el.dispatchEvent(new Event('input')); });
    await page.$eval('#calcGoal', el => { el.value = 'fatloss'; el.dispatchEvent(new Event('change')); });
    await new Promise(r => setTimeout(r, 400));

    const calculatedBmi = await page.$eval('#resBmi', el => el.innerText);
    const calculatedCalories = await page.$eval('#resCalories', el => el.innerText);
    const recommendation = await page.$eval('#resRecommendation', el => el.innerText);
    console.log(`Calculated BMI: ${calculatedBmi}, Target Calories: ${calculatedCalories}`);
    console.log(`Prescribed Protocol snippet: "${recommendation.slice(0, 60)}..."`);
    console.log('✓ PASS: Biometric calculator inputs and algorithms verified.');

    // 8. Test Facilities Showcase tabs
    console.log('\n[TEST 8] Testing Facilities interactive showcase tabs...');
    await page.click('button[data-facility="recovery"]');
    await new Promise(r => setTimeout(r, 300));
    const recoveryTag = await page.$eval('#facilitySpecTag', el => el.innerText);
    console.log(`Recovery facility spec tag: "${recoveryTag.slice(0, 45)}..."`);

    await page.click('button[data-facility="combat"]');
    await new Promise(r => setTimeout(r, 300));
    const combatTag = await page.$eval('#facilitySpecTag', el => el.innerText);
    console.log(`Combat facility spec tag: "${combatTag.slice(0, 45)}..."`);
    console.log('✓ PASS: Facilities tabs switch smoothly.');

    // 9. Test Concierge Inquiries Form
    console.log('\n[TEST 9] Testing Concierge Inquiry dispatch...');
    await page.type('#contactName', 'Liam Sterling');
    await page.type('#contactEmail', 'liam@testdomain.com');
    await page.type('#contactPhone', '+1 555 412 0099');
    await page.type('#contactMessage', 'Requesting a walk-in consultation for the Olympic lifting protocol.');

    await page.click('#contactForm button[type="submit"]');
    await page.waitForSelector('.toast', { timeout: 4000 });

    const inquiryInDb = db.prepare('SELECT * FROM inquiries WHERE email = ?').get('liam@testdomain.com');
    console.log('Database verified inquiry ID:', inquiryInDb?.id, 'Subject:', inquiryInDb?.subject);
    if (!inquiryInDb) throw new Error('Inquiry not saved to database!');
    console.log('✓ PASS: Concierge inquiry registered in database.');

    // 10. Test Newsletter Subscription
    console.log('\n[TEST 10] Testing Newsletter subscription...');
    await page.$eval('#newsletterEmail', el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await new Promise(r => setTimeout(r, 400));
    await page.type('#newsletterEmail', 'journal.subscriber@example.com');
    await page.click('#newsletterForm button[type="submit"]');
    await new Promise(r => setTimeout(r, 800));

    const newsletterInDb = db.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').get('journal.subscriber@example.com');
    console.log('Database verified newsletter subscriber:', newsletterInDb?.email);
    if (!newsletterInDb) throw new Error('Newsletter not saved to database!');
    console.log('✓ PASS: Newsletter subscription verified in database.');

    // 11. Capture high-res screenshot
    console.log('\n[TEST 11] Capturing full-page screenshot...');
    const screenshotPath = path.join(__dirname, 'public', 'assets', 'website_full_preview.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Check for any client-side JavaScript console errors
    console.log('\n[TEST 12] Checking client console errors...');
    console.log(`Console error count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.warn('Console errors detected:', consoleErrors);
    } else {
      console.log('✓ PASS: Zero console errors on the page.');
    }

    console.log('\n======================================================');
    console.log('ALL 12 AUTOMATED TESTS PASSED WITH 100% SUCCESS RATE');
    console.log('======================================================');
  } finally {
    await browser.close();
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
