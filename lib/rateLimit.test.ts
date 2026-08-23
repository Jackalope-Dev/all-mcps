import { checkRateLimit, rateLimitHeaders, clientKey } from './rateLimit';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing rate limiting...');

// 1. Requests under the limit are allowed and remaining counts down.
const key1 = `test:${Math.random()}`;
const r1 = checkRateLimit(key1, 3, 60);
assert(r1.allowed && r1.remaining === 2, 'First request (limit 3) should be allowed with 2 remaining');
const r2 = checkRateLimit(key1, 3, 60);
assert(r2.allowed && r2.remaining === 1, 'Second request should be allowed with 1 remaining');
const r3 = checkRateLimit(key1, 3, 60);
assert(r3.allowed && r3.remaining === 0, 'Third request should be allowed with 0 remaining');

// 2. The request that exceeds the limit is rejected, not the one that reaches it exactly.
const r4 = checkRateLimit(key1, 3, 60);
assert(!r4.allowed && r4.remaining === 0, 'Fourth request over a limit of 3 should be rejected');

// 3. Different keys are independent buckets.
const key2 = `test:${Math.random()}`;
const other = checkRateLimit(key2, 3, 60);
assert(other.allowed && other.remaining === 2, 'A different key should have its own fresh bucket');

// 4. rateLimitHeaders shape matches the RateLimit-* header convention.
const headers = rateLimitHeaders(r1);
assert(headers['RateLimit-Limit'] === '3', 'RateLimit-Limit header should reflect the configured limit');
assert(typeof headers['RateLimit-Remaining'] === 'string', 'RateLimit-Remaining header should be present');
assert(typeof headers['RateLimit-Reset'] === 'string', 'RateLimit-Reset header should be present');

// 5. clientKey prefers cf-connecting-ip, falls back to x-forwarded-for, then 'unknown'.
const reqWithCf = new Request('https://example.com', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
assert(clientKey(reqWithCf) === '1.2.3.4', 'clientKey should read cf-connecting-ip when present');
const reqWithXff = new Request('https://example.com', { headers: { 'x-forwarded-for': '5.6.7.8, 9.9.9.9' } });
assert(clientKey(reqWithXff) === '5.6.7.8', 'clientKey should take the first x-forwarded-for entry');
const reqBare = new Request('https://example.com');
assert(clientKey(reqBare) === 'unknown', 'clientKey should fall back to "unknown" with no IP headers');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
