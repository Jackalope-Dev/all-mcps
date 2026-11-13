/**
 * Loads Google Analytics and PostHog after the page has settled instead of
 * at window load.
 *
 * Together they are ~300KB of script and 300-500ms of main-thread work on a
 * mid-range phone (Lighthouse: "reduce unused JavaScript", "defer
 * third-party tags"). At `lazyOnload` that work landed right after first
 * paint, while the page was still hydrating, and was most of the Total
 * Blocking Time on / and /mcp/[id]. Now they load on the visitor's first
 * interaction (pointer, key, wheel, touch) or, failing that, a few seconds
 * after load once the browser is idle, so every visit is still counted.
 *
 * Consent: the defaults are set by the inline consent-mode script in
 * app/layout.tsx before anything else, and CookieBanner updates them through
 * window.gtag (a dataLayer queue, so order is kept). PostHog starts opted out;
 * when it finishes loading it is synced with the stored choice, because the
 * banner's own opt-in call usually runs before PostHog exists.
 */

const GA_ID = 'G-NZ92KYZX74';
const CONSENT_KEY = 'allmcps_cookie_consent';

// The PostHog loader snippet (creates the window.posthog stub and injects
// array.js from our first-party proxy). Kept as text and run as an inline
// script, exactly as the <Script> tag in app/layout.tsx used to.
const POSTHOG_SNIPPET = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="an ln init xn Cn Br kn In capture Fn nn calculateEventProperties On register register_once register_for_session unregister unregister_for_session Ln getFeatureFlag getFeatureFlagPayload getFeatureFlagResult getAllFeatureFlags isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync Dn identify setPersonProperties unsetPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset shutdown setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty An Rn createPersonProfile setInternalOrTestUser $n yn jn opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Tn debug Ur Rt getPageViewId captureTraceFeedback captureTraceMetric pn".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);`;

type PostHogLoaded = {
  has_opted_in_capturing?: () => boolean;
  opt_in_capturing?: () => void;
  opt_out_capturing?: () => void;
};

let started = false;
const readyCallbacks: Array<() => void> = [];

function storedConsent(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

/** Sync PostHog's own opt-in state with the visitor's stored choice. */
function syncPostHogConsent(ph: PostHogLoaded) {
  const consent = storedConsent();
  const optedIn = ph.has_opted_in_capturing?.() ?? false;
  if (consent === 'granted' && !optedIn) ph.opt_in_capturing?.();
  if (consent === 'denied' && optedIn) ph.opt_out_capturing?.();
}

function runInline(id: string, code: string) {
  const script = document.createElement('script');
  script.id = id;
  script.text = code;
  document.head.appendChild(script);
}

/** Run `cb` once the analytics stubs exist (immediately if they already do). */
export function onAnalyticsReady(cb: () => void) {
  if (started) cb();
  else readyCallbacks.push(cb);
}

/** Inject GA and PostHog. Safe to call more than once. */
function loadAnalytics() {
  if (started || typeof window === 'undefined') return;
  started = true;

  const gtagScript = document.createElement('script');
  gtagScript.async = true;
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(gtagScript);
  runInline(
    'google-analytics',
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`,
  );

  runInline('posthog-init', POSTHOG_SNIPPET);
  window.posthog?.init?.('phc_r8gEwaQjDhxSLZVbQEYpdxqbNMLExUwjFyvj94DkyPY5', {
    api_host: 'https://p.allmcps.com',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    opt_out_capturing_by_default: true,
    loaded: syncPostHogConsent,
  });

  for (const cb of readyCallbacks.splice(0)) {
    try {
      cb();
    } catch {
      // A failing listener must not stop the others.
    }
  }
}

// Not 'scroll': with a capturing listener it also fires for element scrolls
// the page makes itself on mount (e.g. the listing section nav centring its
// active chip), which loaded analytics mid-hydration. Real scrolling starts
// with touchstart or wheel.
const INTERACTION_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
  'wheel',
  'mousemove',
] as const;

/**
 * Call loadAnalytics on the first interaction, or `fallbackMs` after the
 * window load event (in an idle period), whichever comes first. Returns a
 * cleanup function.
 */
export function scheduleAnalytics(fallbackMs = 5000): () => void {
  let timer: number | undefined;
  let idle: number | undefined;

  const cleanup = () => {
    for (const ev of INTERACTION_EVENTS) {
      window.removeEventListener(ev, fire, true);
    }
    window.removeEventListener('load', onLoad);
    if (timer !== undefined) window.clearTimeout(timer);
    if (idle !== undefined && typeof window.cancelIdleCallback === 'function')
      window.cancelIdleCallback(idle);
  };

  function fire() {
    cleanup();
    // Yield first so the interaction that triggered this paints its own
    // response before ~300KB of analytics script is parsed.
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(loadAnalytics, { timeout: 1500 });
    } else {
      window.setTimeout(loadAnalytics, 50);
    }
  }

  function onLoad() {
    timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(fire, { timeout: 2000 });
      } else {
        fire();
      }
    }, fallbackMs);
  }

  for (const ev of INTERACTION_EVENTS) {
    window.addEventListener(ev, fire, { capture: true, passive: true });
  }
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });

  return cleanup;
}
