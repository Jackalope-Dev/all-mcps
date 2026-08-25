import { auth } from './auth';

/**
 * Resolves the signed-in admin's email from the app session (NextAuth), or
 * null if the request is anonymous or the signed-in user isn't an admin.
 * Replaces the old Cloudflare Access JWT check — this is now the primary
 * gate for /admin and /api/admin/*, not defense-in-depth.
 */
export async function getAuthorizedAdminEmail(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') return null;
  return session.user.email ?? null;
}

/**
 * Checks whether the incoming request is authorized for admin actions or automated crons.
 */
export async function isAdminAuthorized(request?: Request): Promise<boolean> {
  const email = await getAuthorizedAdminEmail();
  if (email) return true;
  if (request) {
    const authHeader = request.headers.get('authorization') || request.headers.get('x-cron-secret');
    const secret = process.env.ADMIN_SECRET;
    if (secret && authHeader && (authHeader === secret || authHeader === `Bearer ${secret}`)) {
      return true;
    }
  }
  return false;
}

