#!/usr/bin/env node
/**
 * MTC Smoke Test Suite
 * Runs against staging or prod depending on which branch triggered the workflow.
 * Tests that every API route is reachable, returns valid JSON, and responds with
 * the expected status code. Does NOT test AI output quality — only structure + availability.
 *
 * Usage: node scripts/smoke-test.mjs <BASE_URL>
 */

const BASE_URL = process.argv[2];
const BACKEND_URL = 'https://mtc-backend-rust.vercel.app';

if (!BASE_URL) {
  console.error('Usage: node scripts/smoke-test.mjs <BASE_URL>');
  process.exit(1);
}

console.log(`\n🔍 MTC Smoke Tests`);
console.log(`   Frontend: ${BASE_URL}`);
console.log(`   Backend:  ${BACKEND_URL}\n`);

// ─── Test definitions ────────────────────────────────────────────────────────

const tests = [
  // Frontend API routes
  {
    // Clerk middleware intercepts unauthenticated requests and returns HTML 401
    // We just verify the status code — JSON shape is tested on routes we control directly
    name: 'GET /api/profile — returns 401 without auth',
    url: `${BASE_URL}/api/profile`,
    method: 'GET',
    expectedStatus: 401,
  },
  {
    name: 'GET /api/saved-ideas — returns 401 without auth',
    url: `${BASE_URL}/api/saved-ideas`,
    method: 'GET',
    expectedStatus: 401,
  },
  {
    name: 'GET /api/relevance-feedback — returns 401 without auth',
    url: `${BASE_URL}/api/relevance-feedback`,
    method: 'GET',
    expectedStatus: 401,
  },
  {
    // Returns 401 if Clerk middleware intercepts, 400/405 if route handles it directly
    name: 'POST /api/analyze-niche — reachable (4xx without auth)',
    url: `${BASE_URL}/api/analyze-niche`,
    method: 'POST',
    body: { keywords: [] },
    expectedStatusRange: [400, 499],
  },
  {
    name: 'POST /api/get-narratives — reachable (4xx without auth)',
    url: `${BASE_URL}/api/get-narratives`,
    method: 'POST',
    body: { postUrl: 'https://reddit.com/r/test/comments/smoke', subreddits: ['test'] },
    expectedStatusRange: [400, 499],
  },
  {
    name: 'GET /api/reddit-for-trend — reachable (4xx without auth)',
    url: `${BASE_URL}/api/reddit-for-trend`,
    method: 'GET',
    expectedStatusRange: [400, 499],
  },

  // Backend routes
  {
    name: 'GET /health — backend is alive',
    url: `${BACKEND_URL}/health`,
    method: 'GET',
    expectedStatus: 200,
    requiresJson: true,
    requiredKeys: ['status'],
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function runTest(test) {
  const options = {
    method: test.method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (test.body) {
    options.body = JSON.stringify(test.body);
  }

  let status;
  let json;

  try {
    const res = await fetch(test.url, options);
    status = res.status;

    if (test.requiresJson) {
      const text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Response is not valid JSON. Body: ${text.slice(0, 200)}`);
      }
    }
  } catch (err) {
    if (err.message.includes('not valid JSON')) throw err;
    throw new Error(`Network error: ${err.message}`);
  }

  // Check status code
  if (test.expectedStatusRange) {
    const [min, max] = test.expectedStatusRange;
    if (status < min || status > max) {
      throw new Error(`Expected status ${min}-${max}, got ${status}`);
    }
  } else if (status !== test.expectedStatus) {
    throw new Error(`Expected status ${test.expectedStatus}, got ${status}`);
  }

  // Check required keys in response body
  if (test.requiredKeys) {
    for (const key of test.requiredKeys) {
      if (!(key in json)) {
        throw new Error(`Response JSON missing required key: "${key}"`);
      }
    }
  }
}

for (const test of tests) {
  process.stdout.write(`  ${test.name} ... `);
  try {
    await runTest(test);
    console.log('✅ PASS');
    passed++;
  } catch (err) {
    console.log(`❌ FAIL — ${err.message}`);
    failed++;
    failures.push({ name: test.name, error: err.message });
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`─────────────────────────────────────────\n`);

if (failures.length > 0) {
  console.error('Failed tests:');
  for (const f of failures) {
    console.error(`  ✗ ${f.name}`);
    console.error(`    ${f.error}`);
  }
  console.error('');
  process.exit(1);
} else {
  console.log('All smoke tests passed ✅');
  process.exit(0);
}
