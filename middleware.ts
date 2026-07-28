import { auth } from "@/lib/auth";
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;
  const acceptHeader = req.headers.get('accept') || '';

  if (pathname.startsWith('/mcp/')) {
    const isMarkdownAccept = acceptHeader.includes('text/markdown');
    const isMarkdownFormat = searchParams.get('format') === 'md';
    const isDotMdPath = pathname.endsWith('.md');

    if (isMarkdownAccept || isMarkdownFormat || isDotMdPath) {
      let serverId = pathname.replace('/mcp/', '');
      if (serverId.endsWith('.md')) {
        serverId = serverId.slice(0, -3);
      }
      const url = req.nextUrl.clone();
      url.pathname = `/api/v1/mcp/${serverId}/markdown`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/mcp/:path*"],
};
