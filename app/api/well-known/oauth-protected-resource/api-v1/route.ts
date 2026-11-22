import { protectedResourceResponse } from '@/lib/protectedResource';

/** /.well-known/oauth-protected-resource/api/v1 — RFC 9728 metadata for the REST API. */
export async function GET() {
  return protectedResourceResponse('/api/v1');
}
