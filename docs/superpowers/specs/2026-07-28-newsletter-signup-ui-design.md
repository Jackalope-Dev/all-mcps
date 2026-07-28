# Newsletter signup UI (footer, homepage, popup modal)

## Problem

Sequenzy already has a "Newsletter Subscribers" list (`ta0zh9e3l9rcjlfpzpk80tcn`), but nothing on
the site feeds it — there's no newsletter signup surface anywhere. This piece adds three
touchpoints (footer, homepage section, delayed popup modal) sharing one reusable form component
and one API route, plus a GA4 event for tracking signups as a key event.

## Data flow

One new API route, one new reusable form component, three placements.

- **`app/api/newsletter/subscribe/route.ts`** (new): validates `{ email, source,
  'cf-turnstile-response' }` via zod (`source: z.enum(['footer', 'homepage', 'modal'])`), verifies
  the Turnstile token against `https://challenges.cloudflare.com/turnstile/v0/siteverify` — same
  inline verification block already duplicated in `/api/submit` and `/api/contact` (matches this
  codebase's existing per-route pattern rather than introducing a shared helper for a third call
  site). On success, best-effort `syncSequenzySubscriber({ email, tags: ['newsletter-signup'],
  lists: [NEWSLETTER_SUBSCRIBERS_LIST_ID], customAttributes: { source } })` and returns `{
  success: true }`.
- **`lib/sequenzy.ts`**: add `export const NEWSLETTER_SUBSCRIBERS_LIST_ID =
  'ta0zh9e3l9rcjlfpzpk80tcn';` alongside the existing `PRODUCT_SUBSCRIBERS_LIST_ID`.
- **`components/forms/NewsletterSignupForm.tsx`** (new client component): `{ source: 'footer' |
  'homepage' | 'modal'; compact?: boolean }`. Email input + submit button (compact = inline
  single-row layout for footer/homepage; non-compact = stacked layout for the modal), an invisible
  Turnstile instance, `toast` success/error feedback (matching `SubmitForm`/`ContactForm`'s
  existing pattern), and on success calls `trackNewsletterSignup({ source })`.
- **`components/ui/TurnstileWidget.tsx`**: add an optional `appearance?: 'always' |
  'interaction-only'` prop (default `'always'`, preserving current behavior on `SubmitForm`/
  `ContactForm`), passed through to the underlying `<Turnstile options={{ appearance }}>`.
  `NewsletterSignupForm` passes `appearance="interaction-only"` — Cloudflare only renders the
  widget UI if it decides an interactive challenge is needed, invisible otherwise. No new site key
  required.
- **`lib/gtag.ts`**: add
  ```ts
  export function trackNewsletterSignup(data: { source: 'footer' | 'homepage' | 'modal' }) {
    trackEvent('newsletter_signup', { method: data.source });
  }
  ```
  `newsletter_signup` is a custom GA4 event, not a GA4-standard one — marking it as a **Key Event**
  is a GA4 Admin UI action (Admin → Events → toggle "Mark as key event" once the event has fired at
  least once), not something reachable from this repo or session; noting this so it isn't
  mistaken for something the code should have done automatically.

## Placements

- **Footer** (`components/SiteFooter.tsx`): new full-width section between the `<hr
  className="brand-divider" />` and `.site-footer-grid`, heading "Stay in the loop" + one-line
  blurb + `<NewsletterSignupForm source="footer" compact />`.
- **Homepage** (`components/DirectoryGrid.tsx`): `{showDiscovery && <NewsletterSignupForm
  source="homepage" compact />}` inserted immediately after the existing `{showDiscovery &&
  <FeaturedCards servers={featuredCards} />}` line — `showDiscovery` is already gated to the
  unfiltered landing view only, so this never appears on `/browse` or filtered/searched views.
- **Popup modal** (`components/NewsletterModal.tsx`, new): centered overlay, appears once after a
  10-second `setTimeout` from mount. Dismiss-once persistence mirrors `CookieBanner`'s
  `localStorage` pattern: key `allmcps_newsletter_dismissed` (or subscribed) — once set, the modal
  never mounts its visible state again on that browser. Mounted in `app/layout.tsx` next to
  `<CookieBanner />`, but only rendered when `usePathname()` is **not** `/login`, `/dashboard`, or
  under `/admin` (logged-in/utility surfaces, not marketing surfaces — this requires
  `NewsletterModal` to be a client component reading `usePathname`, same as how other client
  components in this app already read routing state).

## Error handling

Same fire-and-forget-to-Sequenzy pattern as the submit/webhook routes: `syncSequenzySubscriber`
failures are logged and swallowed, never surfaced as a user-facing error — the route still returns
`{ success: true }` once the subscriber-facing intent (email captured) is fulfilled, consistent
with the prior specs' established error-handling posture. Turnstile verification failure **does**
surface as a user-facing error (`{ error: 'Verification failed' }`, 403) — same as `/api/submit`
and `/api/contact` today.

## Testing

- Manual: submit each of the three forms in dev with a real test email, confirm the subscriber
  lands on the Newsletter Subscribers list tagged `newsletter-signup` with the correct `source`
  attribute for each placement.
- Manual: confirm the modal appears once after ~10s on a fresh browser profile, does not reappear
  after a dismiss + reload, and does not render at all on `/login`, `/dashboard`, or `/admin`.
- Manual: confirm the GA4 DebugView (or browser network tab) shows a `newsletter_signup` event
  firing with `method` set to the correct source after a successful signup.
- No existing automated test suite covers form/API routes in this repo (per the prior two specs'
  same observation); this spec doesn't introduce one.
