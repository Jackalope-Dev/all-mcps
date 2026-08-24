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
