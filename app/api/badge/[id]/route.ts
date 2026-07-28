import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../../../../data/mcp-servers.json';

type Theme = 'dark' | 'light';
type Style = 'featured' | 'directory';

function parseTheme(value: string | null): Theme {
  return value === 'light' ? 'light' : 'dark';
}

function parseStyle(value: string | null): Style {
  return value === 'directory' ? 'directory' : 'featured';
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildFeaturedBadge(theme: Theme, accent: string) {
  const isLight = theme === 'light';
  const bg = isLight ? '#ffffff' : '#121212';
  const muted = isLight ? '#64748b' : '#a1a1aa';
  const wordmark = isLight ? '#0f172a' : '#ffffff';
  const border = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.15)';
  const rightTint = isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.03)';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="32" viewBox="0 0 240 32" fill="none">
    <rect width="240" height="32" rx="8" fill="${bg}" />
    <rect width="240" height="32" rx="8" fill="url(#grad)" opacity="${isLight ? '0.08' : '0.15'}" />
    <path d="M120 0h112a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-112V0z" fill="${rightTint}"/>
    <rect x="5" y="3" width="26" height="26" rx="6" fill="url(#logoGrad)" />
    <svg x="7" y="5" width="22" height="22" viewBox="220 280 600 460">
      <path d="M 269 323.277 C 265.090 325.064, 258.583 332.135, 257.229 336.071 C 255.439 341.273, 255.439 682.727, 257.229 687.929 C 258.639 692.027, 265.181 698.995, 269.297 700.784 C 271.365 701.683, 284.709 702, 320.520 702 L 368.946 702 373.223 699.643 C 378.967 696.477, 383.975 689.094, 384.080 683.637 C 384.124 681.362, 384.236 646.575, 384.330 606.334 C 384.423 566.092, 384.861 532.806, 385.301 532.365 C 385.742 531.924, 395.193 540.774, 406.302 552.032 C 472.579 619.190, 498.326 645, 499.045 645 C 499.492 645, 500.477 645.620, 501.235 646.378 C 503.648 648.791, 511.893 649.986, 517.483 648.732 C 523.152 647.461, 517.517 652.868, 603.020 566.646 L 647.500 521.792 647.755 604.146 C 647.969 673.157, 648.243 686.986, 649.442 689.500 C 650.949 692.658, 656.953 698.638, 660.736 700.751 C 663.907 702.522, 750.635 702.552, 754.703 700.784 C 758.819 698.995, 765.361 692.027, 766.771 687.929 C 768.561 682.727, 768.561 341.273, 766.771 336.071 C 765.361 331.973, 758.819 325.005, 754.703 323.216 C 750.254 321.282, 678.301 321.504, 674.372 323.464 C 671.998 324.649, 592.424 404.437, 525.255 472.983 L 512.010 486.500 490.755 464.979 C 479.065 453.143, 443.178 416.784, 411.006 384.181 C 378.835 351.578, 351.203 324.250, 349.603 323.452 C 347.206 322.256, 340.057 322.012, 309.096 322.068 C 283.177 322.114, 270.724 322.490, 269 323.277 M 296 512 L 296 662 320 662 L 344 662 344.015 570.750 C 344.031 475.022, 343.974 476.322, 348.411 469.709 C 353.740 461.766, 367.433 459.347, 376.054 464.825 C 378.499 466.378, 382.016 469.416, 383.869 471.575 C 389.945 478.654, 454.129 543, 455.114 543 C 456.035 543, 482.229 516.634, 482.754 515.178 C 482.894 514.791, 469.844 501.144, 453.754 484.852 C 437.664 468.560, 418.660 449.216, 411.523 441.865 C 404.385 434.514, 383.725 413.538, 365.612 395.250 L 332.679 362 314.339 362 L 296 362 296 512 M 657.048 396.423 C 638.164 415.355, 622.378 431.388, 621.968 432.051 C 621.558 432.715, 590.460 464.289, 552.861 502.217 C 515.263 540.145, 484.356 571.569, 484.180 572.048 C 484.004 572.527, 490.163 579.306, 497.866 587.111 L 511.871 601.303 537.058 575.902 C 565.171 547.549, 599.284 512.991, 651.717 459.750 C 671.080 440.087, 687.166 424, 687.462 424 C 687.758 424, 688 477.550, 688 543 L 688 662 708 662 L 728 662 728 512 L 728 362 709.691 362 L 691.383 362 657.048 396.423" stroke="none" fill="white" fill-rule="evenodd"/>
    </svg>
    <text x="68" y="16" dominant-baseline="central" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="12" font-weight="500" fill="${muted}" text-anchor="middle">Featured on</text>
    <text x="175" y="16" dominant-baseline="central" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="12.5" font-weight="800" letter-spacing="-0.2" fill="${wordmark}" text-anchor="middle">allmcps.com</text>
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="240" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#3b82f6" />
        <stop offset="1" stop-color="${accent}" />
      </linearGradient>
      <linearGradient id="logoGrad" x1="5" y1="3" x2="31" y2="29" gradientUnits="userSpaceOnUse">
        <stop stop-color="#00E5FF" />
        <stop offset="1" stop-color="#007BFF" />
      </linearGradient>
    </defs>
    <rect x="0.5" y="0.5" width="239" height="31" rx="7.5" stroke="${border}" />
  </svg>`;
}

/** Directory-style badge (Product Hunt / Awesome-list vibe) with light & dark themes. */
function buildDirectoryBadge(theme: Theme, claimed: boolean) {
  const isLight = theme === 'light';
  const bg = isLight ? '#f8fafc' : '#0b1220';
  const border = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)';
  const label = isLight ? '#64748b' : '#94a3b8';
  const title = isLight ? '#0f172a' : '#f8fafc';
  const pillBg = claimed
    ? isLight
      ? 'rgba(16,185,129,0.12)'
      : 'rgba(16,185,129,0.15)'
    : isLight
      ? 'rgba(59,130,246,0.1)'
      : 'rgba(59,130,246,0.15)';
  const pillFg = claimed ? '#059669' : isLight ? '#2563eb' : '#60a5fa';
  const status = claimed ? 'Verified' : 'Listed';
  const width = 210;
  const height = 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
    <rect width="${width}" height="${height}" rx="10" fill="${bg}" stroke="${border}"/>
    <rect x="8" y="8" width="24" height="24" rx="6" fill="url(#logoGradDir)"/>
    <svg x="10" y="10" width="20" height="20" viewBox="220 280 600 460">
      <path d="M 269 323.277 C 265.090 325.064, 258.583 332.135, 257.229 336.071 C 255.439 341.273, 255.439 682.727, 257.229 687.929 C 258.639 692.027, 265.181 698.995, 269.297 700.784 C 271.365 701.683, 284.709 702, 320.520 702 L 368.946 702 373.223 699.643 C 378.967 696.477, 383.975 689.094, 384.080 683.637 C 384.124 681.362, 384.236 646.575, 384.330 606.334 C 384.423 566.092, 384.861 532.806, 385.301 532.365 C 385.742 531.924, 395.193 540.774, 406.302 552.032 C 472.579 619.190, 498.326 645, 499.045 645 C 499.492 645, 500.477 645.620, 501.235 646.378 C 503.648 648.791, 511.893 649.986, 517.483 648.732 C 523.152 647.461, 517.517 652.868, 603.020 566.646 L 647.500 521.792 647.755 604.146 C 647.969 673.157, 648.243 686.986, 649.442 689.500 C 650.949 692.658, 656.953 698.638, 660.736 700.751 C 663.907 702.522, 750.635 702.552, 754.703 700.784 C 758.819 698.995, 765.361 692.027, 766.771 687.929 C 768.561 682.727, 768.561 341.273, 766.771 336.071 C 765.361 331.973, 758.819 325.005, 754.703 323.216 C 750.254 321.282, 678.301 321.504, 674.372 323.464 C 671.998 324.649, 592.424 404.437, 525.255 472.983 L 512.010 486.500 490.755 464.979 C 479.065 453.143, 443.178 416.784, 411.006 384.181 C 378.835 351.578, 351.203 324.250, 349.603 323.452 C 347.206 322.256, 340.057 322.012, 309.096 322.068 C 283.177 322.114, 270.724 322.490, 269 323.277 M 296 512 L 296 662 320 662 L 344 662 344.015 570.750 C 344.031 475.022, 343.974 476.322, 348.411 469.709 C 353.740 461.766, 367.433 459.347, 376.054 464.825 C 378.499 466.378, 382.016 469.416, 383.869 471.575 C 389.945 478.654, 454.129 543, 455.114 543 C 456.035 543, 482.229 516.634, 482.754 515.178 C 482.894 514.791, 469.844 501.144, 453.754 484.852 C 437.664 468.560, 418.660 449.216, 411.523 441.865 C 404.385 434.514, 383.725 413.538, 365.612 395.250 L 332.679 362 314.339 362 L 296 362 296 512 M 657.048 396.423 C 638.164 415.355, 622.378 431.388, 621.968 432.051 C 621.558 432.715, 590.460 464.289, 552.861 502.217 C 515.263 540.145, 484.356 571.569, 484.180 572.048 C 484.004 572.527, 490.163 579.306, 497.866 587.111 L 511.871 601.303 537.058 575.902 C 565.171 547.549, 599.284 512.991, 651.717 459.750 C 671.080 440.087, 687.166 424, 687.462 424 C 687.758 424, 688 477.550, 688 543 L 688 662 708 662 L 728 662 728 512 L 728 362 709.691 362 L 691.383 362 657.048 396.423" stroke="none" fill="white" fill-rule="evenodd"/>
    </svg>
    <text x="40" y="16" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="9" font-weight="600" fill="${label}" letter-spacing="0.4">${escapeXml(status.toUpperCase())} ON</text>
    <text x="40" y="30" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="13" font-weight="800" fill="${title}" letter-spacing="-0.2">AllMCPs</text>
    <rect x="138" y="10" width="62" height="20" rx="10" fill="${pillBg}"/>
    <text x="169" y="24" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif" font-size="10" font-weight="700" fill="${pillFg}">${escapeXml(status)}</text>
    <defs>
      <linearGradient id="logoGradDir" x1="8" y1="8" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#00E5FF" />
        <stop offset="1" stop-color="#007BFF" />
      </linearGradient>
    </defs>
  </svg>`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const theme = parseTheme(url.searchParams.get('theme'));
  const style = parseStyle(url.searchParams.get('style'));

  let isOfficial = false;

  try {
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.id, id)).limit(1);
      if (dbServers.length > 0) {
        isOfficial = dbServers[0].isOfficial || false;
      }
    } else {
      const server = serversData.find((s: any) => s.id === id);
      if (server) {
        isOfficial = server.isOfficial || false;
      }
    }
  } catch (e) {
    const server = serversData.find((s: any) => s.id === id);
    if (server) {
      isOfficial = server.isOfficial || false;
    }
  }

  const accent = isOfficial ? '#10b981' : '#8b5cf6';
  const svg =
    style === 'directory'
      ? buildDirectoryBadge(theme, isOfficial)
      : buildFeaturedBadge(theme, accent);

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
