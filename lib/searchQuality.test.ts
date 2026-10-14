import { describe, expect, it } from 'vitest';
import { qualityMultiplier, rankServers } from './search';

describe('qualityMultiplier', () => {
  it('lifts listings we saw run and sinks dead ones', () => {
    expect(qualityMultiplier({})).toBe(1);
    expect(qualityMultiplier({ toolsSource: 'introspected' })).toBeCloseTo(
      1.15,
    );
    expect(qualityMultiplier({ installNeedsConfig: new Date() })).toBeCloseTo(
      1.15,
    );
    expect(qualityMultiplier({ healthStatus: 'archived' })).toBeCloseTo(0.6);
    expect(qualityMultiplier({ healthStatus: 'offline' })).toBeCloseTo(0.5);
  });

  it('breaks a relevance tie toward the working listing', () => {
    const ranked = rankServers(
      [
        {
          name: 'Postgres Tools',
          description: 'db',
          category: 'Databases',
          healthStatus: 'offline',
        },
        {
          name: 'Postgres Tools',
          description: 'db',
          category: 'Databases',
          toolsSource: 'introspected',
        },
      ],
      'postgres',
    );
    expect(ranked[0].toolsSource).toBe('introspected');
  });
});
