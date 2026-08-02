import {
  extractCandidateWebsitesFromReadme,
  extractCandidateImagesFromReadme,
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
assert(logoSourcePriority('website_favicon') === 3, 'website_favicon priority should be 3');
assert(logoSourcePriority('github_org') === 2, 'github_org priority should be 2');
assert(logoSourcePriority('github_user') === 1, 'github_user priority should be 1');
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

const candidateWebsites = extractCandidateWebsitesFromReadme(readmeContent, 'owner', 'cool-mcp');
assert(candidateWebsites.includes('https://cool-mcp.example.com'), 'Should extract official website');
assert(candidateWebsites.includes('https://docs.cool-mcp.example.com'), 'Should extract docs website');
assert(!candidateWebsites.some((u) => u.includes('github.com')), 'Should filter out github.com');
assert(!candidateWebsites.some((u) => u.includes('npmjs.com')), 'Should filter out npmjs.com');

// 3. Test extractCandidateImagesFromReadme
const readmeImagesContent = `
# Logo Header
![Cool MCP Logo](https://raw.githubusercontent.com/owner/cool-mcp/main/assets/logo.png)
<img src="./docs/banner.png" alt="Banner" width="400" />

Status badges:
![CI Status](https://img.shields.io/badge/build-passing-brightgreen)
`;

const candidateImages = extractCandidateImagesFromReadme(readmeImagesContent, 'owner', 'cool-mcp');
assert(candidateImages.includes('https://raw.githubusercontent.com/owner/cool-mcp/main/assets/logo.png'), 'Should extract absolute image URL');
assert(candidateImages.includes('https://raw.githubusercontent.com/owner/cool-mcp/main/docs/banner.png'), 'Should resolve relative image URL');
assert(!candidateImages.some((img) => img.includes('shields.io')), 'Should filter out shield badges');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
