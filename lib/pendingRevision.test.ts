import { describe, expect, it } from 'vitest';
import {
  diffEditableFields,
  EDITABLE_KEYS,
  type EditableServerFields,
  editChangesWriteupInputs,
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
  setupSteps: '',
  setupNote: '',
  setupSourceUrl: '',
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
    if (!parsed) throw new Error('expected the revision to parse');
    expect(pendingRevisionToDbPatch(parsed.proposed)).toEqual({
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

describe('owner-editable setup steps', () => {
  it('stores steps as JSON owned by the owner, not the raw form text', () => {
    const now = new Date('2026-11-07T00:00:00Z');
    const patch = pendingRevisionToDbPatch(
      {
        setupSteps: '# Install\nuvx brainscanner',
        setupSourceUrl: 'https://brainscanner.dev/docs',
      },
      now,
    );
    expect(patch).toMatchObject({
      setupSteps: JSON.stringify([
        { label: 'Install', command: 'uvx brainscanner' },
      ]),
      setupSourceUrl: 'https://brainscanner.dev/docs',
      setupSource: 'owner',
      setupExtractedAt: now,
    });
  });

  it('clearing the steps clears the note and source too', () => {
    expect(
      pendingRevisionToDbPatch({ setupSteps: '', setupNote: 'WSL2 only' }),
    ).toMatchObject({
      setupSteps: null,
      setupNote: null,
      setupSourceUrl: null,
      setupSource: null,
      setupExtractedAt: null,
    });
  });
});

describe('editChangesWriteupInputs', () => {
  const live = {
    name: 'NAIF FixGraph',
    description: 'Diagnoses MCP failures.',
    remoteEndpointUrl: 'https://old.sslip.io/mcp',
    suggestedInstallCommand: null,
    suggestedInstallArgs: null,
    setupSteps: null,
    pricingModel: 'free',
  };

  it('queues a rewrite when the owner moves the endpoint', () => {
    expect(
      editChangesWriteupInputs(
        { remoteEndpointUrl: 'https://naifgravity.com/mcp' },
        live,
      ),
    ).toBe(true);
  });

  it('queues a rewrite on a rename or a new install command', () => {
    expect(editChangesWriteupInputs({ name: 'NAIF Gravity' }, live)).toBe(true);
    expect(
      editChangesWriteupInputs(
        {
          suggestedInstallCommand: 'npx',
          suggestedInstallArgs: ['-y', 'naif-mcp'],
        },
        live,
      ),
    ).toBe(true);
  });

  it('leaves the writeup alone for pricing-only edits or restated values', () => {
    expect(
      editChangesWriteupInputs(
        { pricingModel: 'freemium', pricingNotes: 'Paid repairs.' },
        live,
      ),
    ).toBe(false);
    expect(
      editChangesWriteupInputs(
        { remoteEndpointUrl: ' https://old.sslip.io/mcp ' },
        live,
      ),
    ).toBe(false);
    expect(editChangesWriteupInputs({ suggestedInstallArgs: [] }, live)).toBe(
      false,
    );
  });
});
