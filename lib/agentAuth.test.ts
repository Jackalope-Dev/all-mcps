import {
  AGENT_SCOPES,
  DEFAULT_AGENT_SCOPES,
  isValidAgentScope,
  parseAgentScopes,
  serializeAgentScopes,
  hasAgentScope,
} from './agentAuth';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing agent token scopes...');

// 1. Valid scopes are recognized; unknown strings are rejected.
assert(isValidAgentScope('listings:claim'), '"listings:claim" should be a valid scope');
assert(!isValidAgentScope('listings:delete'), 'Unsupported scope should be rejected');
assert(!isValidAgentScope(123), 'Non-string input should be rejected');

// 2. Null/malformed stored scopes fall back to the legacy default (pre-scopes tokens keep working).
assert(
  JSON.stringify(parseAgentScopes(null)) === JSON.stringify(DEFAULT_AGENT_SCOPES),
  'null scopes column should fall back to DEFAULT_AGENT_SCOPES'
);
assert(
  JSON.stringify(parseAgentScopes('not json')) === JSON.stringify(DEFAULT_AGENT_SCOPES),
  'Malformed scopes JSON should fall back to DEFAULT_AGENT_SCOPES'
);
assert(
  JSON.stringify(parseAgentScopes('[]')) === JSON.stringify(DEFAULT_AGENT_SCOPES),
  'Empty scopes array should fall back to DEFAULT_AGENT_SCOPES rather than granting nothing'
);

// 3. Valid stored scopes round-trip; unknown scopes inside a stored array are dropped.
assert(
  JSON.stringify(parseAgentScopes(serializeAgentScopes(['listings:claim']))) === JSON.stringify(['listings:claim']),
  'A serialized valid scope set should parse back unchanged'
);
assert(
  JSON.stringify(parseAgentScopes('["listings:claim","bogus:scope"]')) === JSON.stringify(['listings:claim']),
  'Unknown scopes mixed into a stored array should be filtered out'
);

// 4. hasAgentScope checks membership correctly.
assert(hasAgentScope({ scopes: ['listings:claim'] }, 'listings:claim'), 'Agent with the scope should pass the check');
assert(!hasAgentScope({ scopes: [] }, 'listings:claim'), 'Agent without the scope should fail the check');

// 5. AGENT_SCOPES is the single source of truth referenced by oauth-protected-resource / auth.md.
assert(AGENT_SCOPES.includes('listings:claim'), 'AGENT_SCOPES should include listings:claim');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
