/**
 * Listing category classification.
 *
 * The catalog's categories were assigned by a first-match-wins regex list that
 * returns nothing when no rule hits, and the miss falls through to
 * `DEFAULT_SUBMIT_CATEGORY` — which is "💻 Developer Tools". That is why that
 * one bucket holds roughly 38% of the catalog: it means both "this is a
 * developer tool" and "we could not tell", and nothing downstream can
 * distinguish the two.
 *
 * Jev's choice primitive answers the question directly against the real
 * category list and reports how sure it is. We only take the answer when it
 * clears a confidence bar; below that we keep whatever the caller already had,
 * because a low-confidence reassignment is worse than an honest default.
 *
 * Falls back to the caller's existing value on every failure — see lib/typesafe.ts.
 */

import { DIRECTORY_CATEGORIES } from './categories';
import { toolNamesFromJson } from './listingReview';
import { askJev, confidentChoice, type JevChoiceQuestion } from './typesafe';

/**
 * Below this we keep the existing category. Calibrated against a sample of live
 * listings: unambiguous ones answered at 0.96–1.00, genuinely unclear ones at
 * 0.26–0.54, so this cleanly separates "knows" from "guessing".
 */
export const CATEGORY_CONFIDENCE_FLOOR = 0.75;

/** Category labels carry a leading emoji; option keys are the text after it. */
function optionKey(category: string): string {
  return category.replace(/^[^\p{L}]+/u, '').trim();
}

const KEY_TO_CATEGORY = new Map(
  DIRECTORY_CATEGORIES.map((c) => [optionKey(c), c] as const),
);

/**
 * One line per category, sent to Jev as the option's meaning. Bare names left
 * neighbours like Data Platforms / Databases / Data Science Tools to a guess,
 * which split the model's confidence below the floor, so most listings kept
 * the Developer Tools default. Keyed by option key (label without emoji);
 * lib/categoryClassifier.test.ts fails if a category has no definition.
 */
export const CATEGORY_DEFINITIONS: Record<string, string> = {
  'Aerospace & Astrodynamics':
    'Satellites, orbits, spaceflight, aviation data and flight tracking.',
  Aggregators:
    'Gateways, proxies or hubs that combine many MCP servers or third-party APIs behind one connection.',
  'Agreements & Coordination':
    'Contracts, e-signatures, scheduling between parties, multi-agent coordination and negotiation.',
  'Architecture & Design':
    'Building/CAD/BIM design, UI/UX and graphic design tools such as Figma or Canva.',
  'Art & Culture':
    'Museums, art collections, literature, music theory, history and cultural heritage.',
  'Biology & Bioinformatics':
    'Life sciences, genomics, proteins, chemistry, medicine, healthcare and clinical data.',
  'Browser Automation':
    'Driving a real or headless web browser: navigation, clicking, form filling, screenshots.',
  'Cloud Platforms':
    'AWS, GCP, Azure, Cloudflare, Vercel, Kubernetes and other infrastructure provisioning or deployment.',
  'Code Execution':
    'Running arbitrary code in sandboxes, notebooks or interpreters on behalf of the AI.',
  'Coding Agents':
    'Autonomous software-engineering agents, agent frameworks and AI coding assistants exposed over MCP.',
  'Command Line': 'Shell and terminal access, running CLI commands.',
  Communication:
    'Email, chat, SMS, Slack, Discord, Telegram, phone calls and other messaging.',
  'Conversational AI':
    'Chatbots, LLM providers, prompt tooling and calling other AI models.',
  Cryptography:
    'Encryption, hashing, keys, certificates and signing. Not cryptocurrency (that is Finance & Fintech).',
  'Customer Data Platforms':
    'CRMs and customer records: HubSpot, Salesforce, Segment, customer profiles.',
  'Data Platforms':
    'Data warehouses, ETL/pipelines and analytics platforms such as Snowflake, BigQuery or dbt.',
  'Data Science Tools':
    'Statistics, machine-learning training, dataframes and numerical computing.',
  'Data Visualization': 'Generating charts, graphs, dashboards and diagrams.',
  Databases:
    'Querying or managing a database: SQL, NoSQL, vector stores, key-value stores.',
  Delivery:
    'Logistics, shipping, parcel tracking, freight, and food or grocery delivery services.',
  'Developer Tools':
    'General software-engineering tooling (linters, package registries, API testing, docs lookup, build tools) that no more specific category covers.',
  Education:
    'Learning platforms, courses, tutoring, quizzes and academic tools for students or teachers.',
  'E-Commerce':
    'Online stores, product catalogs, carts, Shopify/Amazon seller tools and price comparison.',
  'Embedded System':
    'Microcontrollers, firmware, Arduino, Raspberry Pi and hardware programming.',
  'Environment & Nature':
    'Weather, climate, air quality, ecology, agriculture and earth observation.',
  'File Systems':
    'Reading, writing and organizing local or cloud files and documents (Drive, Dropbox, S3 as files).',
  'Finance & Fintech':
    'Banking, payments, accounting, invoicing, stock and market data, trading, cryptocurrency, blockchain and DeFi.',
  Gaming: 'Video games, game engines, game data, chess and other games.',
  'Home Automation': 'Smart home devices, Home Assistant, lights, thermostats.',
  'Industrial & IoT':
    'Industrial equipment, sensors, PLCs, manufacturing and IoT device fleets.',
  'Knowledge & Memory':
    'Persistent memory for the AI, note-taking apps, knowledge bases, wikis and RAG over your own documents.',
  Legal:
    'Law, regulations, compliance, court records, patents and legal documents.',
  'Location Services': 'Maps, geocoding, routing, places and geographic data.',
  Marketing:
    'SEO, advertising, campaigns, marketing analytics, email marketing and content strategy.',
  Monitoring:
    'Observability, logs, metrics, tracing, uptime and incident alerting (Datadog, Sentry, Grafana).',
  'Multimedia Process':
    'Creating or editing images, video and audio, including image generation.',
  'OS Automation':
    'Controlling the desktop or operating system: apps, windows, mouse and keyboard, system settings.',
  'Other Tools and Integrations': 'Only when nothing else fits at all.',
  Podcasts: 'Podcast search, publishing, transcripts and feeds.',
  'Product Management':
    'Issue trackers, roadmaps and project management (Jira, Linear, Asana, Trello).',
  'Real Estate': 'Property listings, valuations, mortgages and rentals.',
  Research:
    'Academic papers, scholarly search, citations and scientific literature.',
  'Search & Data Extraction':
    'Web search, scraping, crawling and extracting structured data from web pages or documents.',
  Security:
    'Vulnerability scanning, pentesting, threat intelligence, secrets management, auth and access control.',
  'Social Media':
    'Posting to or reading from social networks: X/Twitter, Reddit, LinkedIn, YouTube, TikTok, Instagram.',
  'Speech-to-Text': 'Transcribing spoken audio into text.',
  'Spirituality & Esoterica':
    'Astrology, tarot, religion, meditation and esoteric practices.',
  Sports: 'Sports scores, stats, fitness tracking and betting odds.',
  'Support & Service Management':
    'Customer support desks, ticketing and IT service management (Zendesk, Intercom, ServiceNow).',
  'Text-to-Speech': 'Generating spoken audio or voices from text.',
  'Translation Services': 'Translating text between human languages.',
  'Travel & Transportation':
    'Flights, hotels, trip planning, public transit, ride-hailing and vehicles.',
  'Version Control':
    'Git, GitHub, GitLab and Bitbucket: repositories, pull requests, commits.',
  'Workplace & Productivity':
    'Calendars, documents, spreadsheets, office suites, to-do lists and team workspaces (Notion, Google Workspace, Microsoft 365).',
};

const CATEGORY_CRITERIA: Record<string, string | null> = Object.fromEntries(
  DIRECTORY_CATEGORIES.map((c) => [
    optionKey(c),
    CATEGORY_DEFINITIONS[optionKey(c)] ?? null,
  ]),
);

/** Option key for a stored category, exported for the definitions test. */
export const categoryOptionKey = optionKey;

export type ListingForClassification = {
  name?: string | null;
  description?: string | null;
  url?: string | null;
  /** AI summary, when the listing has one; usually clearer than a scraped description. */
  aiSummary?: string | null;
  /** Stored tools JSON; only the tool names are sent. */
  tools?: string | null;
};

export type CategoryClassification = {
  category: string;
  confidence: number;
  /** False when we kept the caller's value because Jev was unavailable or unsure. */
  fromJev: boolean;
};

const categoryQuestion: JevChoiceQuestion = {
  type: 'choice',
  instructions:
    'Which directory category best fits this Model Context Protocol (MCP) server? Judge by what its tools let an AI assistant do (the domain or service it connects to), not by the language it is written in or the fact that it is software. Choose Developer Tools only for general software-engineering tooling that no more specific category covers, and Other Tools and Integrations only when nothing fits.',
  criteria: CATEGORY_CRITERIA,
};

/**
 * Best category for a listing, or `currentCategory` unchanged when Jev is
 * unavailable, errors, or is not confident enough to improve on it.
 *
 * Never throws.
 */
export async function classifyCategory(
  listing: ListingForClassification,
  currentCategory: string,
  minConfidence: number = CATEGORY_CONFIDENCE_FLOOR,
): Promise<CategoryClassification> {
  const keep: CategoryClassification = {
    category: currentCategory,
    confidence: 0,
    fromJev: false,
  };

  if (!listing.name && !listing.description) return keep;

  const res = await askJev(
    {
      name: listing.name ?? '',
      description: listing.description ?? '',
      url: listing.url ?? '',
      summary: (listing.aiSummary ?? '').slice(0, 1000),
      tool_names: toolNamesFromJson(listing.tools),
    },
    { category: categoryQuestion },
  );
  if (!res) return keep;

  const answer = res.answers.category;
  const picked = confidentChoice(answer, minConfidence);
  if (!picked) return keep;

  // The model can only return keys we sent, but map defensively rather than
  // writing an unknown string into the category column.
  const category = KEY_TO_CATEGORY.get(picked);
  if (!category) return keep;

  return { category, confidence: answer?.confidence ?? 0, fromJev: true };
}
