import { protectedResourceResponse } from '@/lib/protectedResource';

/** /.well-known/oauth-protected-resource — RFC 9728 metadata for the origin. */
export async function GET() {
  return protectedResourceResponse();
}
