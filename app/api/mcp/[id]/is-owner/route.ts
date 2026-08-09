import { NextResponse } from 'next/server';
import { auth } from '../../../../../lib/auth';
import { checkIsOwner } from '../../../../../lib/servers';

/**
 * Client-side ownership check for the /mcp/[id] detail page. Split out into its
 * own route (instead of computed in the page component) so the page itself
 * never has to read the session server-side — that's what was forcing the
 * whole detail page to render dynamically on every request instead of being
 * cached/ISR'd.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ isOwner: false });
  }
  const isOwner = await checkIsOwner(id, session.user.id);
  return NextResponse.json({ isOwner });
}
