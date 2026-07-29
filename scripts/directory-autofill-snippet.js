/**
 * Directory Submission Quick Autofill Snippet
 * 
 * Instructions:
 * 1. Open any directory submission page (e.g. SaaSHub, BetaList, SubmitJuice, etc.)
 * 2. Open Chrome DevTools (F12 or Right Click -> Inspect -> Console)
 * 3. Copy and paste this script into the console and hit Enter.
 * 4. All standard form fields (Name, URL, Tagline, Description, Email) will autofill instantly!
 */

(function () {
  const data = {
    name: "AllMCPs",
    url: "https://allmcps.com",
    tagline: "The Open Directory & Registry for Model Context Protocol (MCP) Servers",
    shortDescription: "Discover, search, and connect verified MCP servers to AI tools like Claude Desktop, Cursor, Windsurf, and Antigravity.",
    longDescription: "AllMCPs is the definitive public registry and ecosystem hub for Model Context Protocol (MCP) servers. It provides developers, AI enthusiasts, and teams with instant access to hundreds of verified MCP servers for file management, database connectors, browser automation, search integrations, and API workflows. Features include deep semantic search, developer documentation, badge verification, and single-click config generation for Claude Desktop, Cursor, and custom agentic frameworks.",
    email: "contact@allmcps.com",
    twitter: "https://x.com/allmcps",
    pricing: "Free",
    category: "Developer Tools"
  };

  const inputs = Array.from(document.querySelectorAll('input, textarea, select'));

  let filledCount = 0;

  inputs.forEach(input => {
    const nameAttr = (input.getAttribute('name') || '').toLowerCase();
    const idAttr = (input.getAttribute('id') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const label = (input.labels?.[0]?.textContent || '').toLowerCase();
    const matchStr = `${nameAttr} ${idAttr} ${placeholder} ${label}`;

    // Skip hidden/submit buttons
    if (['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(input.type)) return;

    if (matchStr.includes('title') || matchStr.includes('product') || matchStr.includes('app_name') || matchStr.includes('startup') || matchStr.includes('name')) {
      if (!input.value) { input.value = data.name; filledCount++; }
    } else if (matchStr.includes('url') || matchStr.includes('link') || matchStr.includes('website') || matchStr.includes('domain')) {
      if (!input.value) { input.value = data.url; filledCount++; }
    } else if (matchStr.includes('tagline') || matchStr.includes('headline') || matchStr.includes('summary') || matchStr.includes('one_liner') || matchStr.includes('pitch')) {
      if (!input.value) { input.value = data.tagline; filledCount++; }
    } else if (matchStr.includes('short') && matchStr.includes('desc')) {
      if (!input.value) { input.value = data.shortDescription; filledCount++; }
    } else if (matchStr.includes('desc') || matchStr.includes('detail') || matchStr.includes('about') || matchStr.includes('bio')) {
      if (!input.value) { input.value = data.longDescription; filledCount++; }
    } else if (matchStr.includes('email') || matchStr.includes('contact')) {
      if (!input.value) { input.value = data.email; filledCount++; }
    } else if (matchStr.includes('twitter') || matchStr.includes('x.com')) {
      if (!input.value) { input.value = data.twitter; filledCount++; }
    }

    // Trigger change / input events so frameworks like React/Vue pick up the values
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  console.log(`✅ AllMCPs Autofill completed! Filled ${filledCount} field(s).`);
  alert(`✅ AllMCPs Autofill: Filled ${filledCount} form field(s)!`);
})();
