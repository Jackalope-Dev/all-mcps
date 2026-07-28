# Newsletter Signup UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable newsletter signup form wired to Sequenzy's "Newsletter Subscribers" list,
placed in the footer, the homepage, and a delayed popup modal, with a GA4 event on success.

**Architecture:** One API route + one reusable client form component, consumed from three
placements. Spam protection reuses the existing `TurnstileWidget`/Turnstile-siteverify pattern
already used by `SubmitForm`/`ContactForm`, extended with an invisible `interaction-only`
appearance mode.

**Tech Stack:** Next.js client components, `@marsidev/react-turnstile`, existing `lib/sequenzy.ts`
client, `lib/gtag.ts` GA4 helpers.

## Global Constraints

- Turnstile verification failure returns `{ error: ... }` with 403 and IS shown to the user
  (unlike the Sequenzy sync itself, which is fire-and-forget and never surfaces as a user error).
- `NewsletterSignupForm` is the single form implementation reused by all three placements —
  no copy-pasted forms.
- The modal must never reappear once dismissed OR subscribed, and must not render on `/login`,
  `/dashboard`, or `/admin`.
- Existing `SubmitForm`/`ContactForm` behavior (visible Turnstile, `appearance: 'always'`) must be
  unchanged after `TurnstileWidget`'s prop additions — verify via `npx tsc --noEmit` and a visual
  check that those two forms still render their Turnstile widget as before.

---

### Task 1: Foundation — list ID constant, GA event, Turnstile prop extensions

**Files:**
- Modify: `lib/sequenzy.ts`
- Modify: `lib/gtag.ts`
- Modify: `components/ui/TurnstileWidget.tsx`

**Interfaces:**
- Produces: `NEWSLETTER_SUBSCRIBERS_LIST_ID: string` (from `lib/sequenzy.ts`),
  `trackNewsletterSignup(data: { source: 'footer' | 'homepage' | 'modal' }): void` (from
  `lib/gtag.ts`), and `TurnstileWidget`'s new `appearance?: 'always' | 'interaction-only'` /
  `compact?: boolean` props — all consumed by Task 3.

- [ ] **Step 1: Add the list ID constant**

  In `lib/sequenzy.ts`, after the existing `PRODUCT_SUBSCRIBERS_LIST_ID` export, add:
  ```ts
  /** AllMCPs company, "Newsletter Subscribers" list. */
  export const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';
  ```

- [ ] **Step 2: Add the GA4 tracking function**

  In `lib/gtag.ts`, after `trackShare` (before the `getDomain` helper at the bottom), add:
  ```ts
  /**
   * GA4 Custom Event: newsletter_signup
   * Fired when a user subscribes via the footer, homepage, or popup modal form.
   * Mark this as a GA4 "Key Event" in Admin → Events once it has fired at least once —
   * that step can't be done from code/API, only the GA4 Admin UI.
   */
  export function trackNewsletterSignup(data: { source: 'footer' | 'homepage' | 'modal' }) {
    trackEvent('newsletter_signup', { method: data.source });
  }
  ```

- [ ] **Step 3: Extend `TurnstileWidget` with `appearance`/`compact` props**

  Replace `components/ui/TurnstileWidget.tsx` in full:
  ```tsx
  'use client';

  import { Turnstile } from '@marsidev/react-turnstile';

  interface TurnstileWidgetProps {
    onSuccess?: (token: string) => void;
    onError?: () => void;
    onExpire?: () => void;
    /** 'interaction-only' renders no visible UI unless Cloudflare decides a challenge is needed. Defaults to 'always' (existing behavior). */
    appearance?: 'always' | 'interaction-only';
    /** Omits the vertical margin wrapper — for inline/compact forms. Defaults to false (existing behavior). */
    compact?: boolean;
  }

  export function TurnstileWidget({
    onSuccess,
    onError,
    onExpire,
    appearance = 'always',
    compact = false,
  }: TurnstileWidgetProps) {
    // Use the provided environment variable or the user's actual site key
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAD_iUPDcKGNCmYcX';

    return (
      <div className={compact ? undefined : 'my-4'} style={compact ? undefined : { marginTop: '1rem', marginBottom: '1rem' }}>
        <Turnstile
          siteKey={siteKey}
          onSuccess={onSuccess}
          onError={onError}
          onExpire={onExpire}
          options={{ action: 'turnstile-spin-v2', appearance }}
        />
      </div>
    );
  }
  ```

- [ ] **Step 4: Type-check**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output (no errors). This also confirms `SubmitForm.tsx`/`ContactForm.tsx`, which
  call `<TurnstileWidget onSuccess={...} onExpire={...} onError={...}>` without the new props,
  still compile (both new props are optional with defaults matching current behavior).

---

### Task 2: Subscribe API route

**Files:**
- Create: `app/api/newsletter/subscribe/route.ts`

**Interfaces:**
- Consumes: `syncSequenzySubscriber`, `NEWSLETTER_SUBSCRIBERS_LIST_ID` from `lib/sequenzy.ts`
  (Task 1).
- Produces: `POST /api/newsletter/subscribe` accepting `{ email: string; source: 'footer' |
  'homepage' | 'modal'; 'cf-turnstile-response': string }`, consumed by Task 3.

- [ ] **Step 1: Write the route**

  ```ts
  import { NextResponse } from 'next/server';
  import { z } from 'zod';
  import { syncSequenzySubscriber, NEWSLETTER_SUBSCRIBERS_LIST_ID } from '../../../../lib/sequenzy';

  const subscribeSchema = z.object({
    email: z.string().email(),
    source: z.enum(['footer', 'homepage', 'modal']),
  });

  export async function POST(req: Request) {
    try {
      const body = (await req.json()) as any;
      const token = body['cf-turnstile-response'];

      if (!token) {
        return NextResponse.json({ error: 'Missing Turnstile token' }, { status: 400 });
      }

      const verifyForm = new URLSearchParams();
      verifyForm.append('secret', process.env.TURNSTILE_SECRET || '');
      verifyForm.append('response', token);
      verifyForm.append('remoteip', req.headers.get('x-forwarded-for') || '');

      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: verifyForm,
      });

      const verifyResult = (await verifyRes.json()) as any;
      if (!verifyResult.success) {
        return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
      }

      const parsed = subscribeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      }

      const { email, source } = parsed.data;

      await syncSequenzySubscriber({
        email,
        tags: ['newsletter-signup'],
        lists: [NEWSLETTER_SUBSCRIBERS_LIST_ID],
        customAttributes: { source },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Newsletter subscribe error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Type-check**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output.

---

### Task 3: `NewsletterSignupForm` reusable component

**Files:**
- Create: `components/forms/NewsletterSignupForm.tsx`

**Interfaces:**
- Consumes: `POST /api/newsletter/subscribe` (Task 2), `trackNewsletterSignup` (Task 1),
  `TurnstileWidget` with `appearance`/`compact` (Task 1).
- Produces: `<NewsletterSignupForm source={'footer'|'homepage'|'modal'} compact? onSuccess?
  />` — consumed by Tasks 4 and 5.

- [ ] **Step 1: Write the component**

  ```tsx
  'use client';

  import { useState } from 'react';
  import { Input } from '../ui/Input';
  import { Button } from '../ui/Button';
  import { TurnstileWidget } from '../ui/TurnstileWidget';
  import { toast } from '../ui/Toast';
  import { trackNewsletterSignup } from '../../lib/gtag';

  type NewsletterSource = 'footer' | 'homepage' | 'modal';

  export function NewsletterSignupForm({
    source,
    compact = false,
    onSuccess,
  }: {
    source: NewsletterSource;
    compact?: boolean;
    onSuccess?: () => void;
  }) {
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!token) {
        toast.error('Complete the security check', {
          description: 'Please try again in a moment.',
        });
        return;
      }

      setStatus('loading');
      try {
        const res = await fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source, 'cf-turnstile-response': token }),
        });

        if (res.ok) {
          setStatus('success');
          trackNewsletterSignup({ source });
          toast.success('Subscribed', { description: "You're on the list." });
          onSuccess?.();
        } else {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setStatus('error');
          toast.error('Could not subscribe', { description: data?.error || 'Please try again.' });
          (window as any).turnstile?.reset();
          setToken('');
        }
      } catch {
        setStatus('error');
        toast.error('Could not subscribe', { description: 'Network error. Please try again.' });
        (window as any).turnstile?.reset();
        setToken('');
      }
    };

    if (status === 'success') {
      return (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
          You&apos;re subscribed — thanks for joining!
        </p>
      );
    }

    return (
      <form
        onSubmit={handleSubmit}
        className={compact ? 'newsletter-form newsletter-form-compact' : 'newsletter-form'}
      >
        <Input
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
        <TurnstileWidget
          appearance="interaction-only"
          compact
          onSuccess={setToken}
          onExpire={() => setToken('')}
          onError={() => setToken('')}
        />
        <Button variant="primary" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
        </Button>
      </form>
    );
  }
  ```

- [ ] **Step 2: Type-check**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output.

---

### Task 4: Footer and homepage placements + their CSS

**Files:**
- Modify: `components/SiteFooter.tsx`
- Modify: `components/DirectoryGrid.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `NewsletterSignupForm` (Task 3).

- [ ] **Step 1: Add the footer section**

  In `components/SiteFooter.tsx`, import the form and insert a new section between the divider and
  the grid:
  ```tsx
  import { NewsletterSignupForm } from './forms/NewsletterSignupForm';
  ```
  Replace:
  ```tsx
      <hr className="brand-divider" />
      <div className="site-footer-grid">
  ```
  with:
  ```tsx
      <hr className="brand-divider" />
      <div className="newsletter-footer-cta">
        <div>
          <h4 className="footer-heading">Stay in the loop</h4>
          <p className="site-footer-blurb" style={{ margin: 0 }}>
            Get new MCP servers and top picks in your inbox.
          </p>
        </div>
        <NewsletterSignupForm source="footer" compact />
      </div>
      <div className="site-footer-grid">
  ```

- [ ] **Step 2: Add the homepage section**

  In `components/DirectoryGrid.tsx`, import the form:
  ```tsx
  import { NewsletterSignupForm } from './forms/NewsletterSignupForm';
  ```
  Find the line `{showDiscovery && <FeaturedCards servers={featuredCards} />}` and add immediately
  after it:
  ```tsx
      {showDiscovery && <FeaturedCards servers={featuredCards} />}
      {showDiscovery && (
        <section className="container newsletter-homepage-section">
          <div>
            <h3 style={{ margin: '0 0 0.25rem' }}>Get new MCP servers in your inbox</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              A roundup of new and top submissions — no spam, unsubscribe anytime.
            </p>
          </div>
          <NewsletterSignupForm source="homepage" compact />
        </section>
      )}
  ```

- [ ] **Step 3: Add the CSS**

  In `app/globals.css`, after the `.site-footer-copy` block, add:
  ```css
  .newsletter-footer-cta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    padding: var(--space-6) 0;
  }

  .newsletter-homepage-section {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    background: var(--bg-elevated);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    margin: 0 auto 4rem;
  }

  .newsletter-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
    max-width: 360px;
  }

  .newsletter-form-compact {
    flex-direction: row;
    align-items: center;
    max-width: 420px;
  }

  .newsletter-form-compact .form-field {
    flex: 1;
    margin: 0;
  }
  ```

- [ ] **Step 4: Type-check and visual check**

  Run: `npx tsc --noEmit -p tsconfig.json` — expected no output.
  Then run `npm run dev`, open `/` and scroll to the footer: confirm the "Stay in the loop" row
  renders with an inline email input + Subscribe button, and the homepage section appears between
  the featured cards and the directory grid.

---

### Task 5: Popup modal + layout mount + CSS

**Files:**
- Create: `components/NewsletterModal.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `NewsletterSignupForm` (Task 3).

- [ ] **Step 1: Write the modal component**

  ```tsx
  'use client';

  import { useState, useEffect } from 'react';
  import { usePathname } from 'next/navigation';
  import { NewsletterSignupForm } from './forms/NewsletterSignupForm';

  const DISMISS_KEY = 'allmcps_newsletter_dismissed';
  const SUPPRESSED_PREFIXES = ['/login', '/dashboard', '/admin'];

  export function NewsletterModal() {
    const pathname = usePathname();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem(DISMISS_KEY)) return;
      if (SUPPRESSED_PREFIXES.some((p) => pathname?.startsWith(p))) return;

      const timer = setTimeout(() => setVisible(true), 10000);
      return () => clearTimeout(timer);
    }, [pathname]);

    const dismiss = () => {
      localStorage.setItem(DISMISS_KEY, '1');
      setVisible(false);
    };

    const handleSuccess = () => {
      localStorage.setItem(DISMISS_KEY, '1');
      setTimeout(() => setVisible(false), 2500);
    };

    if (!visible) return null;

    return (
      <div
        className="newsletter-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Newsletter signup"
        onClick={dismiss}
      >
        <div className="newsletter-modal-card" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="newsletter-modal-close"
            onClick={dismiss}
            aria-label="Close"
          >
            ✕
          </button>
          <h3 style={{ margin: '0 0 0.5rem' }}>Get new MCP servers in your inbox</h3>
          <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
            A roundup of new and top submissions — no spam, unsubscribe anytime.
          </p>
          <NewsletterSignupForm source="modal" onSuccess={handleSuccess} />
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Mount it in the root layout**

  In `app/layout.tsx`, add the import alongside `CookieBanner`:
  ```tsx
  import { NewsletterModal } from "../components/NewsletterModal";
  ```
  And render it right after `<CookieBanner />`:
  ```tsx
        <CookieBanner />
        <NewsletterModal />
  ```

- [ ] **Step 3: Add the CSS**

  In `app/globals.css`, after the newsletter styles added in Task 4, add:
  ```css
  .newsletter-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: rgba(2, 6, 23, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
    animation: fadeInUp 0.2s ease-out;
  }

  .newsletter-modal-card {
    position: relative;
    max-width: 420px;
    width: 100%;
    background: var(--card-bg);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    padding: var(--space-8);
  }

  .newsletter-modal-close {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: var(--space-1);
  }
  ```

- [ ] **Step 4: Type-check**

  Run: `npx tsc --noEmit -p tsconfig.json` — expected no output.

---

### Task 6: End-to-end verification

**Files:** None (verification only).

- [ ] **Step 1: Run the dev server**

  `npm run dev`, open `http://localhost:3000/`.

- [ ] **Step 2: Verify footer and homepage forms**

  Submit the footer form with a real test email. Confirm a success toast appears and the form
  replaces itself with the "You're subscribed" message. Repeat for the homepage section form.
  For each, confirm (via `search_subscribers` or `get_subscriber` on the Sequenzy MCP) that the
  subscriber landed on the Newsletter Subscribers list tagged `newsletter-signup`, with
  `customAttributes.source` equal to `footer` and `homepage` respectively.

- [ ] **Step 3: Verify the modal**

  In a fresh incognito/private window, load `/` and wait ~10 seconds: confirm the modal appears
  centered with a backdrop. Submit it with a test email; confirm the same Sequenzy checks as Step
  2 but with `source: modal`, and confirm the modal auto-closes a couple seconds after success.
  Reload the page: confirm the modal does NOT reappear (dismiss-once persisted). Then clear
  `localStorage`, reload, and this time click the ✕ close button instead of subscribing — confirm
  it also never reappears on subsequent reloads.

- [ ] **Step 4: Verify page suppression**

  Clear `localStorage` again, navigate directly to `/login`, `/dashboard`, and `/admin`, and wait
  10+ seconds on each: confirm the modal never appears on any of the three.

- [ ] **Step 5: Verify GA event firing**

  With the browser's Network tab open (filter: `collect` or `google-analytics`), submit any one of
  the three forms and confirm a request fires containing `en=newsletter_signup` and
  `ep.method=<source>` (or inspect via GA4 DebugView if `debug_mode` is enabled). Note for the
  user: marking `newsletter_signup` as a GA4 **Key Event** still requires a manual toggle in GA4
  Admin → Events, which cannot be done from this session.

- [ ] **Step 6: Confirm existing forms are unaffected**

  Visit `/submit` and `/contact`: confirm both still render their (visible) Turnstile widget as
  before and still submit successfully — the `TurnstileWidget` prop additions from Task 1 must not
  have changed their behavior.

---

## Self-Review Notes

- **Spec coverage:** list ID + GA function + Turnstile appearance/compact props (Task 1);
  subscribe route with Turnstile verification + Sequenzy sync (Task 2); reusable form component
  (Task 3); footer + homepage placements and CSS (Task 4); modal with 10s delay, dismiss-once,
  page suppression, and CSS (Task 5); the GA4 Key Event manual-toggle caveat is called out
  explicitly in Task 1 Step 2's comment and again in Task 6 Step 5, not silently dropped.
- **Type consistency:** `NewsletterSource` (`'footer' | 'homepage' | 'modal'`) matches across
  `trackNewsletterSignup`, the subscribe route's zod enum, and `NewsletterSignupForm`'s prop type.
  `NewsletterSignupForm`'s `onSuccess` prop (added for the modal's dismiss-on-subscribe behavior)
  is optional, so Task 4's footer/homepage call sites (which omit it) remain valid.
- **No placeholders:** every step is literal code or a concretely described manual check with
  named commands and expected output.
