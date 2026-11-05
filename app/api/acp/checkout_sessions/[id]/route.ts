import { getSession, updateSession } from '@/lib/acpCheckout';
import { acpRoute } from '@/lib/acpRoute';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** ACP: retrieve a checkout session. */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  return acpRoute(req, (ctx) => getSession(ctx, id));
}

/** ACP: update a checkout session's items or buyer. */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  return acpRoute(req, (ctx) => updateSession(ctx, id));
}
