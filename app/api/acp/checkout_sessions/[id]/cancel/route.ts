import { cancelSession } from '@/lib/acpCheckout';
import { acpRoute } from '@/lib/acpRoute';

export const dynamic = 'force-dynamic';

/** ACP: cancel a checkout session. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return acpRoute(req, (ctx) => cancelSession(ctx, id));
}
