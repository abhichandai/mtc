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
    name: 'GET /api/profile — returns 401 without auth',
    url: `${BASE_URL}/api/profile`,
    method: 'GET',
    expectedStatus: 401,
    requiresJson: true,
  },
  {
    name: 'GET /api/saved-ideas — returns 401 without auth',
    url: `${BASE_URL}/api/saved-ideas`,
    method: 'GET',
    expectedStatus: 401,
    requiresJson: true,
  },
  {
    name: 'GET /api/relevance-feedback — returns 401 without auth',
    url: `${BASE_URL}/api/relevance-feedback`,
    method: 'GET',
    expectedStatus: 401,
    requiresJson: true,
  },
  {
    name: 'POST /api/analyze-niche — returns 400 with empty keywords',
    url: `${BASE_URL}/api/analyze-niche`,
    method: 'POST',
    body: { keywords: [] },
    expectedStatus: 400,
    requiresJson: true,
  },
  {
    name: 'POST /api/get-narratives — returns 401 without auth',
    url: `${BASE_URL}/api/get-narratives`,
    method: 'POST',
    body: { postUrl: 'https://reddit.com/r/test/comments/smoke', subreddits: ['test'] },
    expectedStatus: 401,
    requiresJson: true,
  },
  {
    name: 'GET /api/reddit-for-trend — returns 400 with no subreddits param',
    url: `${BASE_URL}/api/reddit-for-trend`,
    method: 'GET',
    expectedStatus: 400,
    requiresJson: true,
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
  if (status !== test.expectedStatus) {
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
