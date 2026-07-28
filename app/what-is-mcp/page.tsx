import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'What is MCP?',
  description: 'Learn about the Model Context Protocol (MCP) and how it works.',
};

export default function WhatIsMCPPage() {
  return (
    <main className="container" style={{ padding: '6rem 0' }}>
      <div className="glass-panel" style={{ padding: '4rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>What is the Model Context Protocol?</h1>
        <div className="markdown-body">
          <p>The <strong>Model Context Protocol (MCP)</strong> is an open standard that allows AI models to securely connect to local data sources, internal tools, and external APIs.</p>
          <h2>Why does it matter?</h2>
          <p>Traditionally, Large Language Models (LLMs) are isolated from your environment. If you want an AI to read your database, you have to write custom integration code.</p>
          <p>MCP solves this by providing a universal protocol. You run an <em>MCP Server</em> (like the ones in our directory), and any compatible AI client (like Claude Desktop) can instantly talk to it, run commands, and access its resources.</p>
          <h2>How does it work?</h2>
          <ul>
            <li><strong>Clients</strong> (e.g. Claude, cursor) connect to servers.</li>
            <li><strong>Servers</strong> expose tools, resources, and prompts.</li>
            <li>The AI can seamlessly browse these tools and execute them when needed to solve complex tasks.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
