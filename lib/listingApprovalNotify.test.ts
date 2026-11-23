import { beforeEach, describe, expect, it, vi } from 'vitest';

const verified = new Set<string>();
const sendSequenzyTransactional = vi.fn(async () => true);
const syncSequenzySubscriber = vi.fn(async () => {});

vi.mock('./notify', () => ({
  mayEmail: async (to: string) => verified.has(to),
  sendListingStatusEmail: vi.fn(),
}));
vi.mock('./sequenzyTransactional', () => ({
  SEQUENZY_TX: { LISTING_APPROVED: 'listing-approved' },
  sendSequenzyTransactional,
}));
vi.mock('./sequenzy', () => ({
  PRODUCT_SUBSCRIBERS_LIST_ID: 'product',
  syncSequenzySubscriber,
}));

const { notifyListingApproved } = await import('./listingApprovalNotify');

beforeEach(() => {
  verified.clear();
  sendSequenzyTransactional.mockClear();
  syncSequenzySubscriber.mockClear();
});

describe('notifyListingApproved', () => {
  it("doesn't email or tag a submitter who never proved the address", async () => {
    const result = await notifyListingApproved({
      id: 'brain',
      name: 'Brain',
      submitterEmail: 'typed-in@gmail.com',
    });
    expect(result).toMatchObject({ emailed: false, channel: 'none' });
    expect(sendSequenzyTransactional).not.toHaveBeenCalled();
    expect(syncSequenzySubscriber).not.toHaveBeenCalled();
  });

  it('emails and tags a verified submitter as before', async () => {
    verified.add('dev@brainscanner.dev');
    const result = await notifyListingApproved({
      id: 'brain',
      name: 'Brain',
      submitterEmail: 'Dev@BrainScanner.dev',
    });
    expect(result).toEqual({ emailed: true, channel: 'sequenzy' });
    expect(syncSequenzySubscriber).toHaveBeenCalledTimes(1);
  });
});
