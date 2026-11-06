import { completeSession } from '@/lib/acpCheckout';
import { acpRoute } from '@/lib/acpRoute';

export const dynamic = 'force-dynamic';

/** ACP: pay for a checkout session with a Stripe shared payment token. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return acpRoute(req, (ctx) => completeSession(ctx, id));
}
