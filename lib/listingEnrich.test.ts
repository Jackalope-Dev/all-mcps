import {
  deriveServerName,
  extractCandidateImagesFromReadme,
  extractCandidateWebsitesFromReadme,
  extractReadmeTitle,
  humanizeSlug,
  isGenericServerName,
  logoSourcePriority,
} from './listingEnrich';

// Basic assertions runner for node execution
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing listingEnrich helpers...');

// 1. Test logoSourcePriority
assert(logoSourcePriority('manual') === 5, 'manual priority should be 5');
assert(logoSourcePriority('readme') === 4, 'readme priority should be 4');
assert(
  logoSourcePriority('website_favicon') === 3,
  'website_favicon priority should be 3',
);
assert(
  logoSourcePriority('github_org') === 2,
  'github_org priority should be 2',
);
assert(
  logoSourcePriority('github_user') === 1,
  'github_user priority should be 1',
);
assert(logoSourcePriority(null) === 0, 'null priority should be 0');

// 2. Test extractCandidateWebsitesFromReadme
const readmeContent = `
# My Cool MCP Server

[Official Website](https://cool-mcp.example.com)
Check out our [Documentation](https://docs.cool-mcp.example.com)!

Badges:
[![Build](https://img.shields.io/github/actions/workflow/status/owner/repo/ci.yml)](https://github.com/owner/repo)
[![npm](https://img.shields.io/npm/v/cool-mcp)](https://www.npmjs.com/package/cool-mcp)
`;

const candidateWebsites = extractCandidateWebsitesFromReadme(
  readmeContent,
  'owner',
  'cool-mcp',
);
assert(
  candidateWebsites.includes('https://cool-mcp.example.com'),
  'Should extract official website',
);
assert(
  candidateWebsites.includes('https://docs.cool-mcp.example.com'),
  'Should extract docs website',
);
assert(
  !candidateWebsites.some((u) => u.includes('github.com')),
  'Should filter out github.com',
);
assert(
  !candidateWebsites.some((u) => u.includes('npmjs.com')),
  'Should filter out npmjs.com',
);

// 3. Test extractCandidateImagesFromReadme with picture and light mode tags
const readmeImagesContent = `
# Logo Header
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/owner/cool-mcp/main/assets/dark-logo.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/owner/cool-mcp/main/assets/light-logo.png">
  <img src="https://raw.githubusercontent.com/owner/cool-mcp/main/assets/default-logo.png">
</picture>

Status badges:
![CI Status](https://img.shields.io/badge/build-passing-brightgreen)
`;

const candidateImages = extractCandidateImagesFromReadme(
  readmeImagesContent,
  'owner',
  'cool-mcp',
);
assert(
  candidateImages.includes(
    'https://raw.githubusercontent.com/owner/cool-mcp/main/assets/light-logo.png',
  ),
  'Should prioritize light mode logo',
);
assert(
  candidateImages[0] ===
    'https://raw.githubusercontent.com/owner/cool-mcp/main/assets/light-logo.png',
  'Light mode logo should be first candidate',
);
assert(
  !candidateImages.some((img) => img.includes('shields.io')),
  'Should filter out shield badges',
);

// 4. Test isGenericServerName
assert(isGenericServerName('mcp'), '"mcp" should be generic');
assert(isGenericServerName('MCP Server'), '"MCP Server" should be generic');
assert(isGenericServerName('mcp-server'), '"mcp-server" should be generic');
assert(
  isGenericServerName('reference-data'),
  '"reference-data" should be generic',
);
assert(isGenericServerName('docs-mcp'), '"docs-mcp" should be generic');
assert(isGenericServerName('booking'), '"booking" should be generic');
assert(
  !isGenericServerName('Storefront'),
  '"Storefront" should not be generic (not a generic word)',
);
assert(
  !isGenericServerName('Kai AGI - Autonomous AI Agent'),
  'Long descriptive names should not be generic',
);
assert(
  !isGenericServerName('Tavily MCP Server'),
  '"Tavily MCP Server" has a distinguishing word, not generic',
);

// 5. Test humanizeSlug
assert(
  humanizeSlug('cueapi-mcp') === 'CueAPI MCP' ||
    humanizeSlug('cueapi-mcp') === 'Cueapi MCP',
  'Should title-case slug words',
);
assert(
  humanizeSlug('atlaso-labs') === 'Atlaso Labs',
  'Should title-case hyphenated slug',
);
assert(
  humanizeSlug('some-repo').includes('MCP') === false,
  'Should not inject MCP that is not present',
);

// 6. Test extractReadmeTitle
const readmeWithTitle = `[![Build](https://img.shields.io/badge/build-passing-green)](https://x)\n\n# Cool Weather MCP\n\nQuery live weather data from any MCP host.\n`;
assert(
  extractReadmeTitle(readmeWithTitle) === 'Cool Weather MCP',
  `Should extract heading, got: ${extractReadmeTitle(readmeWithTitle)}`,
);
assert(
  extractReadmeTitle('# mcp-server\n\nSome text') === null,
  'Should reject a heading that is itself generic',
);
assert(
  extractReadmeTitle(null) === null,
  'Should return null for missing readme',
);
assert(
  extractReadmeTitle('# Quick Start\n\nRun npm install.') === null,
  'Should reject a doc-section heading masquerading as the title',
);
assert(
  extractReadmeTitle('# Table of Contents\n- [Install](#install)') === null,
  'Should reject Table of Contents heading',
);
assert(
  extractReadmeTitle('# What is Shipeasy?\n\nA thing.') === null,
  'Should reject a question-style heading',
);
assert(
  extractReadmeTitle('# @scope/pkg-mcp\n\nText') === null,
  'Should reject a bare space-free package-name heading, preferring slug fallback',
);
const readmeHtmlH1 = `<p align="center"><img src="logo.png"></p>\n\n<h1 align="center">Weather Wizard MCP</h1>\n\n## Quick Start\n\nnpm install`;
assert(
  extractReadmeTitle(readmeHtmlH1) === 'Weather Wizard MCP',
  `Should prefer an HTML h1 over a later markdown section heading, got: ${extractReadmeTitle(readmeHtmlH1)}`,
);
assert(
  extractReadmeTitle('# The tools\n\nText') === null,
  'Should reject "The tools" (filler first word)',
);
assert(
  extractReadmeTitle('# Tools Available\n\nText') === null,
  'Should reject "Tools Available" (section-phrase heading)',
);
assert(
  extractReadmeTitle('# 1 — The skill (every AI coding agent)\n\nText') ===
    null,
  'Should reject a numbered doc-step heading',
);
assert(
  extractReadmeTitle('# Skillsforge MCP\n\nText') === 'Skillsforge MCP',
  'Should NOT false-positive-reject a real title that merely starts with a blocked word as a substring',
);
assert(
  extractReadmeTitle('# Whatsapp MCP\n\nText') === 'Whatsapp MCP',
  'Should NOT false-positive-reject "Whatsapp" for containing "what"',
);
assert(
  extractReadmeTitle('# Let your agent install it\n\nText') === null,
  'Should reject a sentence-case doc instruction masquerading as a title',
);
assert(
  extractReadmeTitle('# Formatix AI — MCP Server\n\nText') ===
    'Formatix AI — MCP Server',
  'Should accept a real Title Case heading with an em-dash subtitle',
);
assert(
  extractReadmeTitle('# Top 5 Stocks MCP Server\n\nText') ===
    'Top 5 Stocks MCP Server',
  'Should accept Title Case headings containing numbers',
);
assert(
  extractReadmeTitle('# Development Status\n\nBeta.') === null,
  'Should reject a short heading that is just a section label, even mid-word',
);
assert(
  extractReadmeTitle('# Quick Setup\n\nRun npm install.') === null,
  'Should reject "Quick Setup" (section noun not at position 0)',
);
assert(
  extractReadmeTitle('# SVGator MCP Server — Documentation\n\nText') === null,
  'Should reject a real name with a trailing section-noun suffix',
);

// 7. Test deriveServerName
assert(
  deriveServerName({
    currentName: 'mcp',
    url: 'https://github.com/atlaso-labs/mcp',
    ghRepo: { owner: 'atlaso-labs', repo: 'mcp' },
    readme: null,
  }) === 'Atlaso Labs MCP',
  'Should fall back to owner name when repo slug is itself generic',
);
assert(
  !!deriveServerName({
    currentName: 'mcp',
    url: 'https://github.com/cueapi/cueapi-mcp',
    ghRepo: { owner: 'cueapi', repo: 'cueapi-mcp' },
    readme: null,
  })?.endsWith('MCP'),
  'Should humanize a distinguishing repo slug and keep the MCP acronym',
);
assert(
  deriveServerName({
    currentName: 'Tavily MCP Server',
    url: 'https://github.com/tavily/mcp',
    ghRepo: { owner: 'tavily', repo: 'mcp' },
    readme: null,
  }) === null,
  'Should not touch an already-descriptive name',
);
assert(
  deriveServerName({
    currentName: 'mcp',
    url: 'https://eevy.ai/mcp',
    ghRepo: null,
    readme: null,
  }) === 'Eevy MCP',
  'Should humanize hostname for non-GitHub listings',
);
assert(
  deriveServerName({
    currentName: 'mcp',
    url: 'https://app.fiuto.ai',
    ghRepo: null,
    readme: null,
  }) === 'Fiuto MCP',
  'Should use the registrable domain label, not a generic subdomain',
);

console.log('ALL TESTS PASSED SUCCESSFULLY!');
