import { describe, expect, it } from 'vitest';
import {
  bucketKey,
  buildCalibration,
  calibrationNote,
} from './gateCalibration';

const ev = (patch: Record<string, unknown>) =>
  JSON.stringify({
    triageVerdict: 'approve',
    mcpProbability: 0.9,
    repoStatus: 'ok',
    stars: 0,
    ...patch,
  });

describe('buildCalibration', () => {
  it('buckets past admin calls by what the gate would say now', () => {
    const cal = buildCalibration([
      { evidence: ev({}), humanDecision: 'approve' },
      { evidence: ev({}), humanDecision: 'reject' },
      { evidence: ev({ triageVerdict: 'reject' }), humanDecision: 'reject' },
      // Undecided and unreadable rows are skipped.
      { evidence: ev({}), humanDecision: null },
      { evidence: 'nope', humanDecision: 'approve' },
    ]);
    expect(cal[bucketKey('approve', 'approve')]).toEqual({
      approved: 1,
      rejected: 1,
    });
    expect(cal[bucketKey('reject', 'reject')]).toEqual({
      approved: 0,
      rejected: 1,
    });
  });
});

describe('calibrationNote', () => {
  const cal = {
    [bucketKey('hold', 'reject')]: { approved: 4, rejected: 45 },
    [bucketKey('hold', 'needs_review')]: { approved: 40, rejected: 6 },
    [bucketKey('hold', 'approve')]: { approved: 6, rejected: 4 },
    [bucketKey('approve', 'approve')]: { approved: 3, rejected: 1 },
  };

  it('says which way a hold leans once the admin clearly went one way', () => {
    expect(calibrationNote(cal, 'hold', 'reject')).toEqual({
      text: 'You rejected 45 of 49 like this (92%)',
      lean: 'reject',
    });
    expect(calibrationNote(cal, 'hold', 'needs_review')?.lean).toBe('approve');
  });

  it('gives a rate but no lean when the record is split', () => {
    const n = calibrationNote(cal, 'hold', 'approve');
    expect(n?.lean).toBeNull();
    expect(n?.text).toBe('You approved 6 of 10 like this (60%)');
  });

  it('stays quiet on too few decisions', () => {
    expect(calibrationNote(cal, 'approve', 'approve')).toBeNull();
    expect(calibrationNote(cal, 'reject', null)).toBeNull();
  });
});
