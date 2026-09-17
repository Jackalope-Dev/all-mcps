/**
 * Helper store for managing selected servers in the MCP Stack Builder.
 * Persists selected server IDs to localStorage and handles shareable URL query strings.
 */

const STORAGE_KEY = 'allmcps_stack_server_ids';

export function getStackServerIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function saveStackServerIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const unique = Array.from(new Set(ids));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
    window.dispatchEvent(new Event('mcp_stack_updated'));
  } catch {
    // Ignore storage quota errors
  }
}

export function addServerToStack(id: string): string[] {
  const current = getStackServerIds();
  if (!current.includes(id)) {
    const next = [...current, id];
    saveStackServerIds(next);
    return next;
  }
  return current;
}

export function removeServerFromStack(id: string): string[] {
  const current = getStackServerIds();
  const next = current.filter((sId) => sId !== id);
  saveStackServerIds(next);
  return next;
}

export function toggleServerInStack(id: string): boolean {
  const current = getStackServerIds();
  if (current.includes(id)) {
    removeServerFromStack(id);
    return false;
  } else {
    addServerToStack(id);
    return true;
  }
}

export function isServerInStack(id: string): boolean {
  const current = getStackServerIds();
  return current.includes(id);
}

export function clearStack(): void {
  saveStackServerIds([]);
}

export function parseStackFromUrl(
  searchParam: string | null | undefined,
): string[] {
  if (!searchParam?.trim()) return [];
  return searchParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildStackShareUrl(serverIds: string[]): string {
  if (typeof window === 'undefined')
    return `/stack?servers=${encodeURIComponent(serverIds.join(','))}`;
  const origin = window.location.origin;
  return `${origin}/stack?servers=${encodeURIComponent(serverIds.join(','))}`;
}
