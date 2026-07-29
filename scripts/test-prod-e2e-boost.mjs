async function runE2EProductionBoostTest() {
  console.log('=== Running Live Production E2E Agentic Boost Test ===\n');

  const payload = {
    serverId: 'alexar76-aimarket-plugins',
    sku: 'featured_7d',
    coupon: 'jbo3bbnfka',
    email: 'test-agent@allmcps.com',
  };

  // 1. Call production API endpoint
  console.log('1. Calling POST https://allmcps.com/api/v1/boost/checkout ...');
  const res = await fetch('https://allmcps.com/api/v1/boost/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log('   HTTP Status:', res.status);
  const data = await res.json();
  console.log('   Response Data:', JSON.stringify(data, null, 2));

  if (!data.checkout_url) {
    console.error('\n[FAIL] No checkout_url returned.');
    return;
  }

  // 2. Fetch the Stripe Checkout URL to verify it resolves
  console.log('\n2. Verifying generated Stripe Checkout URL ...');
  console.log('   Target URL:', data.checkout_url);

  const stripeCheckRes = await fetch(data.checkout_url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  console.log('   Stripe Checkout Page HTTP Status:', stripeCheckRes.status);
  if (stripeCheckRes.status === 200 || stripeCheckRes.status === 303 || stripeCheckRes.status === 302) {
    console.log('\n✅ [SUCCESS] Stripe Checkout Session generated and verified live on production!');
  } else {
    console.log('   Checkout Response Status:', stripeCheckRes.status);
  }
}

runE2EProductionBoostTest().catch(console.error);
