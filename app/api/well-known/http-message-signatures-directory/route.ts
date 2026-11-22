import { directoryResponse } from '@/lib/webBotAuth';

export const dynamic = 'force-dynamic';

/** /.well-known/http-message-signatures-directory — Web Bot Auth public keys. */
export async function GET(req: Request) {
  return directoryResponse(new URL(req.url).host);
}
