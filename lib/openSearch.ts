/**
 * Open the site search (command palette) from any button. A named event
 * rather than a synthetic ⌘K keydown: the palette's chunk is lazy-loaded, and
 * a keydown dispatched before it mounted was simply lost, so the first tap on
 * a search button on a fresh page often did nothing.
 */
export const OPEN_SEARCH_EVENT = 'allmcps:open-search';

export function openSearch(): void {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
