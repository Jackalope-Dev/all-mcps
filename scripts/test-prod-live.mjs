async function testLiveProd() {
  console.log(
    '--- Testing Live Production Endpoints on https://allmcps.com ---',
  );

  // 1. Pricing API
  const pricingRes = await fetch('https://allmcps.com/api/v1/boost/pricing');
  console.log('1. GET /api/v1/boost/pricing -> Status:', pricingRes.status);
  const pricingData = await pricingRes.json();
  console.log('   Tiers found:', pricingData.tiers?.length || 0);

  // 2. Checkout API
  const checkoutRes = await fetch('https://allmcps.com/api/v1/boost/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serverId: 'alexar76-aimarket-plugins',
      sku: 'featured_7d',
    }),
  });
  console.log('2. POST /api/v1/boost/checkout -> Status:', checkoutRes.status);
  const checkoutData = await checkoutRes.json();
  console.log('   Checkout URL:', checkoutData.checkout_url);
  console.log('   x402 Spec:', checkoutData.x402_invoice?.spec);

  // 3. Remote MCP Server Tool JSON-RPC
  const mcpRes = await fetch('https://allmcps.com/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_boost_pricing',
        arguments: {},
      },
    }),
  });
  console.log(
    '3. Remote MCP JSON-RPC (get_boost_pricing) -> Status:',
    mcpRes.status,
  );
  const mcpData = await mcpRes.json();
  console.log(
    '   Result Content:',
    `${mcpData.result?.content?.[0]?.text?.substring(0, 100)}...`,
  );

  // 4. Remote MCP Tool boost_mcp_server
  const boostMcpRes = await fetch('https://allmcps.com/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'boost_mcp_server',
        arguments: { id: 'alexar76-aimarket-plugins', sku: 'featured_7d' },
      },
    }),
  });
  console.log(
    '4. Remote MCP JSON-RPC (boost_mcp_server) -> Status:',
    boostMcpRes.status,
  );
  const boostMcpData = await boostMcpRes.json();
  console.log(
    '   Result Text Snippet:\n',
    boostMcpData.result?.content?.[0]?.text?.substring(0, 180),
  );
}

testLiveProd().catch(console.error);
