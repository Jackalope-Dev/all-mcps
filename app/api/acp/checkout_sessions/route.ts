import { createSession } from '@/lib/acpCheckout';
import { acpRoute } from '@/lib/acpRoute';

export const dynamic = 'force-dynamic';

/** ACP: create a checkout session. */
export function POST(req: Request) {
  return acpRoute(req, createSession);
}
