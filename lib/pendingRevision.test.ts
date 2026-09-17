import { describe, expect, it } from 'vitest';
import {
  diffEditableFields,
  EDITABLE_KEYS,
  type EditableServerFields,
  parsePendingRevision,
  pendingRevisionToDbPatch,
  serializePendingRevision,
} from './pendingRevision';

const base: EditableServerFields = {
  name: 'Brain Scanner',
  description: 'A server.',
  category: 'ai',
  websiteUrl: 'https://example.dev',
  tags: ['ai'],
  pricingModel: 'free',
  pricingNotes: '',
  authType: 'none',
  license: 'MIT',
  compatibleClients: ['claude-desktop'],
  maintenanceStatus: 'active',
  supportUrl: '',
  remoteEndpointUrl: 'https://example.dev',
  suggestedInstallCommand: '',
  suggestedInstallArgs: [],
};

describe('owner-editable remote endpoint', () => {
  it('is an editable key, so owners can fix it without emailing us', () => {
    expect(EDITABLE_KEYS).toContain('remoteEndpointUrl');
  });

  it('round-trips a corrected endpoint through to the DB patch', () => {
    const diff = diffEditableFields(base, {
      ...base,
      remoteEndpointUrl: 'https://example.dev/mcp/v2',
    });
    expect(diff).toEqual({ remoteEndpointUrl: 'https://example.dev/mcp/v2' });

    const parsed = parsePendingRevision(serializePendingRevision(diff));
    expect(parsed?.proposed.remoteEndpointUrl).toBe(
      'https://example.dev/mcp/v2',
    );
    expect(pendingRevisionToDbPatch(parsed!.proposed)).toEqual({
      remoteEndpointUrl: 'https://example.dev/mcp/v2',
    });
  });

  it('clears the endpoint to null so install buttons can be suppressed', () => {
    const diff = diffEditableFields(base, { ...base, remoteEndpointUrl: '' });
    expect(diff).toEqual({ remoteEndpointUrl: '' });
    expect(pendingRevisionToDbPatch(diff)).toEqual({ remoteEndpointUrl: null });
  });

  it('reports no diff when the endpoint is unchanged', () => {
    expect(diffEditableFields(base, { ...base })).toEqual({});
  });

  it('ignores keys that are not owner-editable', () => {
    expect(
      pendingRevisionToDbPatch({ ownerUserId: 'someone-else' } as never),
    ).toEqual({});
  });
});
