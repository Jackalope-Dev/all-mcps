async function testFreeCoupon() {
  console.log('--- Testing 100% Off Agentic Boost Coupon: jbo3bbnfka ---');

  const payload = {
    serverId: 'alexar76-aimarket-plugins',
    sku: 'featured_7d',
    coupon: 'jbo3bbnfka',
    email: 'agent-test@allmcps.com',
  };

  // 1. Test POST /api/v1/boost/checkout
  console.log(
    'Sending request to POST https://allmcps.com/api/v1/boost/checkout ...',
  );
  const res = await fetch('https://allmcps.com/api/v1/boost/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log('Status Code:', res.status);
  const data = await res.json();
  console.log('Response Payload:\n', JSON.stringify(data, null, 2));

  // 2. Test Remote MCP Tool call for boost_mcp_server with coupon parameter
  console.log(
    '\nTesting Remote MCP Server tool (boost_mcp_server) with coupon ...',
  );
  const mcpRes = await fetch('https://allmcps.com/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/call',
      params: {
        name: 'boost_mcp_server',
        arguments: {
          id: 'alexar76-aimarket-plugins',
          sku: 'featured_7d',
          coupon: 'jbo3bbnfka',
        },
      },
    }),
  });

  console.log('MCP Tool Status:', mcpRes.status);
  const mcpData = await mcpRes.json();
  console.log('MCP Tool Result Text:\n', mcpData.result?.content?.[0]?.text);
}

testFreeCoupon().catch(console.error);
