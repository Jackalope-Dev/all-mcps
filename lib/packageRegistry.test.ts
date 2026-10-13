import { describe, expect, it } from 'vitest';
import {
  bareName,
  npmStatusFromDoc,
  pypiStatusFromDoc,
  registryFor,
} from './packageRegistry';

describe('bareName', () => {
  it('keeps scopes and drops versions', () => {
    expect(bareName('@modelcontextprotocol/server-github@1.2.0')).toBe(
      '@modelcontextprotocol/server-github',
    );
    expect(bareName('@scope/pkg')).toBe('@scope/pkg');
    expect(bareName('mcp-server-time==0.6')).toBe('mcp-server-time');
  });
});

describe('registryFor', () => {
  it('maps runners to registries and ignores the rest', () => {
    expect(registryFor('npx')).toBe('npm');
    expect(registryFor('uvx')).toBe('pypi');
    expect(registryFor('docker')).toBeNull();
  });
});

describe('npmStatusFromDoc', () => {
  it('reads deprecation from the latest version only', () => {
    expect(
      npmStatusFromDoc({
        'dist-tags': { latest: '2.0.0' },
        versions: { '1.0.0': { deprecated: 'old' }, '2.0.0': {} },
      }),
    ).toEqual({ kind: 'ok' });
    expect(
      npmStatusFromDoc({
        'dist-tags': { latest: '2.0.0' },
        versions: { '2.0.0': { deprecated: 'Moved to @x/y' } },
      }),
    ).toEqual({ kind: 'deprecated', message: 'Moved to @x/y' });
  });

  it('treats an unpublished package as missing', () => {
    expect(npmStatusFromDoc({ time: { unpublished: { time: 'x' } } })).toEqual({
      kind: 'missing',
    });
  });
});

describe('pypiStatusFromDoc', () => {
  it('treats a yanked latest as deprecated', () => {
    expect(
      pypiStatusFromDoc({ info: { yanked: true, yanked_reason: 'broken' } }),
    ).toEqual({
      kind: 'deprecated',
      message: 'broken',
    });
    expect(pypiStatusFromDoc({ info: {} })).toEqual({ kind: 'ok' });
  });
});
