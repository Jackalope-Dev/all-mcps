import { describe, expect, it } from 'vitest';
import { classifyProbeResponse } from './verifyRemoteEndpoint';

const initializeResult = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  result: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    serverInfo: { name: 'magic-hour', version: '0.1.0' },
  },
});

describe('endpoints that must be kept', () => {
  it('accepts a Streamable HTTP handshake', () => {
    expect(
      classifyProbeResponse({
        status: 200,
        contentType: 'application/json',
        body: initializeResult,
      }).verdict,
    ).toBe('alive');
  });

  it('accepts the same handshake delivered as SSE frames', () => {
    expect(
      classifyProbeResponse({
        status: 200,
        contentType: 'text/event-stream',
        body: `event: message\ndata: ${initializeResult}\n\n`,
      }).verdict,
    ).toBe('alive');
  });

  it('accepts an OAuth-protected server', () => {
    // RFC 9728: a correctly-configured protected server. Clearing these would punish
    // exactly the operators who implemented auth properly.
    expect(
      classifyProbeResponse({
        status: 401,
        contentType: 'application/json',
        wwwAuthenticate:
          'Bearer resource_metadata="https://acme.dev/.well-known/oauth-protected-resource"',
        body: '{"error":"invalid or missing mcp credentials"}',
      }).verdict,
    ).toBe('alive');
  });

  it('accepts an event stream that has not sent a frame yet', () => {
    expect(
      classifyProbeResponse({
        status: 200,
        contentType: 'text/event-stream',
        body: '',
      }).verdict,
    ).toBe('alive');
  });

  it('accepts a JSON-RPC error — something MCP-shaped is listening', () => {
    expect(
      classifyProbeResponse({
        status: 400,
        contentType: 'application/json',
        body: '{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"Bad Request"}}',
      }).verdict,
    ).toBe('alive');
  });
});

describe('endpoints that are provably not MCP', () => {
  it('rejects a documentation page served to a JSON-RPC POST', () => {
    // The real case: https://magichour.ai/mcp is the human connection-docs page, and it
    // was cached as a listing's endpoint because the URL shape passed.
    const result = classifyProbeResponse({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!DOCTYPE html><html><head><title>MCP</title></head></html>',
    });
    expect(result.verdict).toBe('not-mcp');
    expect(result.detail).toContain('HTML');
  });

  it('rejects an endpoint that is gone', () => {
    for (const status of [404, 410]) {
      expect(
        classifyProbeResponse({
          status,
          contentType: 'application/json',
          body: '{"message":"Not Found"}',
        }).verdict,
        String(status),
      ).toBe('not-mcp');
    }
  });
});

describe('inconclusive responses never cost a listing its endpoint', () => {
  it('treats bot walls, outages and POST-hostile endpoints as unknown', () => {
    for (const [status, contentType] of [
      [403, 'application/json'],
      [500, 'application/json'],
      [502, 'text/plain'],
      [405, 'application/json'],
      [429, 'application/json'],
    ] as const) {
      expect(
        classifyProbeResponse({ status, contentType, body: '' }).verdict,
        String(status),
      ).toBe('unknown');
    }
  });

  it('does not read a 403 bot wall that happens to be an HTML page as proof', () => {
    // Deliberate tension: HTML is our strongest "not MCP" signal, but a Cloudflare
    // challenge page is HTML too. The status is what separates them, so an HTML body
    // behind a 403 stays unknown rather than clearing a possibly-fine endpoint.
    expect(
      classifyProbeResponse({
        status: 403,
        contentType: 'text/html',
        body: '<html>Just a moment...</html>',
      }).verdict,
    ).toBe('unknown');
  });
});
