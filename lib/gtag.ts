import { PAID_PRODUCTS, PaidSku } from './pricing';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Generic helper to send a Google Analytics event safely if gtag is loaded.
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

/**
 * GA4 Standard Event: purchase
 * Fired when a user successfully completes checkout for listing promotion / upgrade.
 */
export function trackPurchase(data: {
  transactionId: string;
  sku: PaidSku;
  serverId: string;
}) {
  const product = PAID_PRODUCTS[data.sku];
  if (!product) return;

  const value = product.unitAmount / 100;

  trackEvent('purchase', {
    transaction_id: data.transactionId,
    value,
    currency: 'USD',
    sku: data.sku,
    server_id: data.serverId,
    items: [
      {
        item_id: data.sku,
        item_name: product.name,
        item_category: 'MCP Listing Upgrade',
        price: value,
        quantity: 1,
      },
    ],
  });
}

/**
 * GA4 Standard Event: begin_checkout
 * Fired when a user initiates Stripe checkout from a button click.
 */
export function trackBeginCheckout(data: {
  sku: PaidSku;
  serverId: string;
}) {
  const product = PAID_PRODUCTS[data.sku];
  if (!product) return;

  const value = product.unitAmount / 100;

  trackEvent('begin_checkout', {
    value,
    currency: 'USD',
    sku: data.sku,
    server_id: data.serverId,
    items: [
      {
        item_id: data.sku,
        item_name: product.name,
        item_category: 'MCP Listing Upgrade',
        price: value,
        quantity: 1,
      },
    ],
  });
}

/**
 * GA4 Standard Event: generate_lead (and mcp_submission custom event)
 * Fired when a new MCP server is submitted.
 */
export function trackSubmitLead(data: {
  serverName: string;
  category: string;
  url?: string;
}) {
  trackEvent('generate_lead', {
    lead_type: 'mcp_server_submission',
    server_name: data.serverName,
    category: data.category,
  });

  trackEvent('mcp_submission', {
    server_name: data.serverName,
    category: data.category,
    url: data.url || '',
  });
}

/**
 * GA4 Standard Event: generate_lead (and contact_submission custom event)
 * Fired when a contact form is submitted.
 */
export function trackContactSubmit(data: {
  name?: string;
  messageLength?: number;
}) {
  trackEvent('generate_lead', {
    lead_type: 'contact_form',
  });

  trackEvent('contact_submission', {
    message_length: data.messageLength || 0,
  });
}

/**
 * GA4 Event: select_content / copy_install_config
 * Fired when a user copies an MCP server command, code block, or config.
 */
export function trackCopyConfig(data: {
  serverId?: string;
  snippetType?: string;
}) {
  trackEvent('select_content', {
    content_type: 'install_config',
    item_id: data.serverId || 'general',
  });

  trackEvent('copy_install_config', {
    server_id: data.serverId || 'general',
    snippet_type: data.snippetType || 'code',
  });
}

/**
 * GA4 Event: click / outbound_click
 * Fired when a user clicks an external link (GitHub repo, author website, etc.).
 */
export function trackOutboundClick(data: {
  url: string;
  destinationType: 'github' | 'website' | 'other';
  serverId?: string;
}) {
  trackEvent('click', {
    link_url: data.url,
    link_domain: getDomain(data.url),
    outbound: true,
  });

  trackEvent('outbound_click', {
    url: data.url,
    destination_type: data.destinationType,
    server_id: data.serverId || '',
  });
}

/**
 * GA4 Custom Event: upvote_mcp
 * Fired when a user upvotes an MCP server listing.
 */
export function trackUpvote(data: {
  serverId: string;
  serverName?: string;
}) {
  trackEvent('upvote_mcp', {
    server_id: data.serverId,
    server_name: data.serverName || '',
  });
}

/**
 * GA4 Standard Event: search
 * Fired when a user searches or filters in the directory grid.
 */
export function trackSearch(data: {
  searchTerm: string;
  category?: string | null;
  resultCount?: number;
}) {
  trackEvent('search', {
    search_term: data.searchTerm,
    category: data.category || 'all',
    result_count: data.resultCount,
  });
}

/**
 * GA4 Standard Event: share
 * Fired when a user copies share links, badge code, or embed snippets.
 */
export function trackShare(data: {
  method: string;
  serverId: string;
}) {
  trackEvent('share', {
    method: data.method,
    content_type: 'mcp_server',
    item_id: data.serverId,
  });
}

/**
 * GA4 Custom Event: newsletter_signup
 * Fired when a user subscribes via the footer, homepage, or popup modal form.
 * Mark this as a GA4 "Key Event" in Admin → Events once it has fired at least once —
 * that step can't be done from code/API, only the GA4 Admin UI.
 */
export function trackNewsletterSignup(data: { source: 'footer' | 'homepage' | 'modal' }) {
  trackEvent('newsletter_signup', { method: data.source });
}

function getDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname;
  } catch {
    return '';
  }
}
