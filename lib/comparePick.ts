import type { Server } from './servers';

/** What the /compare server picker renders — nothing more. */
export type ComparePickServer = Pick<
  Server,
  'id' | 'name' | 'category' | 'description' | 'logoUrl'
>;

/** Trims a listing to the picker fields so the RSC payload stays small. */
export function toPickServer(s: ComparePickServer): ComparePickServer {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    description: s.description?.slice(0, 160) ?? '',
    logoUrl: s.logoUrl,
  };
}
