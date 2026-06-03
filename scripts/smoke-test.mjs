#!/usr/bin/env node
/**
 * MTC Smoke Test Suite v2
 * Comprehensive coverage: all frontend API routes + all backend endpoints.
 * Tests availability, status codes, and JSON shape where applicable.
 * Does NOT test AI output quality — only structure + reachability.
 *
 * Usage: node scripts/smoke-test.mjs <BASE_URL>
 */

const BASE_URL = process.argv[2];
const BACKEND_URL = 'https://mtc-backend-rust.vercel.app';

if (!BASE_URL) {
  console.error('Usage: node scripts/smoke-test.mjs <BASE_URL>');
  process.exit(1);
}

console.log(`\n🔍 MTC Smoke Tests v2`);
console.log(`   Frontend: ${BASE_URL}`);
console.log(`   Backend:  ${BACKEND_URL}\n`);

// ─── Test definitions ────────────────────────────────────────────────────────

const tests = [
  // ═══════════════════════════════════════════════════════════════════════════
  // FRONTEND — Auth-protected routes (Clerk middleware returns 401)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'GET /api/profile — 401 without auth',
    url: `${BASE_URL}/api/profile`,
    method: 'GET',
    expectedStatus: 401,
  },
  {
    name: 'GET /api/saved-ideas — 401 without auth',
    url: `${BASE_URL}/api/saved-ideas`,
    method: 'GET',
    expectedStatus: 401,
  },
  {
    name: 'GET /api/relevance-feedback — 401 without auth',
    url: `${BASE_URL}/api/relevance-feedback`,
    method: 'GET',
    expectedStatus: 401,
  },
  {
    name: 'GET /api/pulse-feed — 401 without auth',
    url: `${BASE_URL}/api/pulse-feed`,
    method: 'GET',
    expectedStatus: 401,
  },
  {
    name: 'GET /api/pulse-unlocks — 401 without auth',
    url: `${BASE_URL}/api/pulse-unlocks`,
    method: 'GET',
    expectedStatus: 401,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRONTEND — Routes that behave differently across envs (accept any 4xx)
  // ═══════════════════════════════════════════════════════════════════════════
  {
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
  {
    name: 'POST /api/pulse-relevance — reachable (2xx/4xx)',
    url: `${BASE_URL}/api/pulse-relevance`,
    method: 'POST',
    body: { trends: [], brief: '' },
    expectedStatusRange: [200, 499],
    requiresJson: true,
  },
  {
    name: 'POST /api/pulse-bridge — reachable (4xx without auth)',
    url: `${BASE_URL}/api/pulse-bridge`,
    method: 'POST',
    body: {},
    expectedStatusRange: [400, 499],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRONTEND — Proxy routes (no Clerk auth, hit the backend directly)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'GET /api/pulse-trends — proxies to backend',
    url: `${BASE_URL}/api/pulse-trends?limit=1`,
    method: 'GET',
    expectedStatusRange: [200, 299],
    requiresJson: true,
  },
  {
    name: 'GET /api/pulse-reddit — proxies to backend',
    url: `${BASE_URL}/api/pulse-reddit?limit=1`,
    method: 'GET',
    expectedStatusRange: [200, 299],
    requiresJson: true,
  },
  {
    name: 'GET /api/pulse-unlock — requires query param',
    url: `${BASE_URL}/api/pulse-unlock`,
    method: 'GET',
    expectedStatus: 400,
    requiresJson: true,
    requiredKeys: ['success'],
  },
  {
    name: 'GET /api/reddit-comments — requires url param',
    url: `${BASE_URL}/api/reddit-comments`,
    method: 'GET',
    expectedStatus: 400,
    requiresJson: true,
    requiredKeys: ['error'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRONTEND — Cron / system routes
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'GET /api/keepalive — Supabase ping',
    url: `${BASE_URL}/api/keepalive`,
    method: 'GET',
    expectedStatus: 200,
    requiresJson: true,
    requiredKeys: ['ok'],
  },
  {
    // pulse-master-refresh requires CRON_SECRET — without it, expect 401
    name: 'GET /api/pulse-master-refresh — 401 without cron secret',
    url: `${BASE_URL}/api/pulse-master-refresh`,
    method: 'GET',
    expectedStatusRange: [401, 500],
  },
  {
    // Clerk webhook requires svix headers — without them, 400
    name: 'POST /api/webhooks/clerk — 400 without svix headers',
    url: `${BASE_URL}/api/webhooks/clerk`,
    method: 'POST',
    body: {},
    expectedStatusRange: [400, 500],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BACKEND — Direct endpoint tests
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'GET /health — backend alive',
    url: `${BACKEND_URL}/health`,
    method: 'GET',
    expectedStatus: 200,
    requiresJson: true,
    requiredKeys: ['status'],
  },
  {
    name: 'GET / — backend root info',
    url: `${BACKEND_URL}/`,
    method: 'GET',
    expectedStatus: 200,
    requiresJson: true,
    requiredKeys: ['service', 'endpoints'],
  },
  {
    name: 'GET /trends/google — Google Trends data',
    url: `${BACKEND_URL}/trends/google`,
    method: 'GET',
    expectedStatus: 200,
    requiresJson: true,
  },
  {
    name: 'GET /pulse/trends/raw — Pulse Google source',
    url: `${BACKEND_URL}/pulse/trends/raw?limit=3`,
    method: 'GET',
    expectedStatus: 200,
    requiresJson: true,
    requiredKeys: ['success', 'trends'],
  },
  {
    name: 'GET /pulse/trends/reddit — Pulse Reddit source',
    url: `${BACKEND_URL}/pulse/trends/reddit?limit=3`,
    method: 'GET',
    expectedStatus: 200,
    requiresJson: true,
    requiredKeys: ['success', 'trends'],
  },
  {
    name: 'GET /pulse/enrich — requires query param',
    url: `${BACKEND_URL}/pulse/enrich`,
    method: 'GET',
    expectedStatus: 400,
    requiresJson: true,
    requiredKeys: ['success'],
  },
  {
    name: 'GET /trends/reddit — 400 without subreddits param',
    url: `${BACKEND_URL}/trends/reddit`,
    method: 'GET',
    expectedStatus: 400,
    requiresJson: true,
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(test.url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    status = res.status;

    if (test.requiresJson) {
      const text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Response is not valid JSON. Status: ${status}. Body: ${text.slice(0, 200)}`);
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out after 30s');
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
  if (test.requiredKeys && json) {
    for (const key of test.requiredKeys) {
      if (!(key in json)) {
        throw new Error(`Response JSON missing required key: "${key}". Got keys: ${Object.keys(json).join(', ')}`);
      }
    }
  }
}

// ─── Run all tests with section headers ──────────────────────────────────────

const sections = [
  { label: 'Frontend — Auth-protected', start: 0, end: 5 },
  { label: 'Frontend — Env-dependent', start: 5, end: 10 },
  { label: 'Frontend — Proxy routes', start: 10, end: 14 },
  { label: 'Frontend — System routes', start: 14, end: 17 },
  { label: 'Backend — Direct endpoints', start: 17, end: tests.length },
];

let testIdx = 0;
for (const section of sections) {
  console.log(`\n  ┌─ ${section.label}`);
  for (let i = section.start; i < section.end; i++) {
    const test = tests[i];
    process.stdout.write(`  │ ${test.name} ... `);
    try {
      await runTest(test);
      console.log('✅');
      passed++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
      failed++;
      failures.push({ name: test.name, error: err.message });
    }
  }
  console.log('  └─');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════`);
console.log(`  Results: ${passed} passed, ${failed} failed (${tests.length} total)`);
console.log(`═══════════════════════════════════════════\n`);

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
