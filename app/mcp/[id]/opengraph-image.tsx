import { ImageResponse } from 'next/og';
import { drizzle } from 'drizzle-orm/d1';
import { servers as serversTable } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import serversData from '../../../data/mcp-servers.json';

export const alt = 'AllMCPs - Tool Directory';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function getServer(rawId: string) {
  const id = rawId ? decodeURIComponent(rawId).replace(/^-+/, '') : '';
  if (!id) return null;

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const dbServers = await db.select().from(serversTable).where(eq(serversTable.id, id)).limit(1);
      if (dbServers.length > 0) return dbServers[0];

      // Try with rawId as fallback
      const altServers = await db.select().from(serversTable).where(eq(serversTable.id, rawId)).limit(1);
      if (altServers.length > 0) return altServers[0];
    }
  } catch (e) {}

  const servers = serversData as { id: string; name: string; description: string }[];
  return servers.find((s) => s.id === id || s.id === rawId);
}

export default async function Image({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = await params;
  const server = await getServer(resolvedParams?.id || '');
  
  // Format title and repo name cleanly
  const rawTitle = server ? server.name : 'Model Context Protocol Server';
  const cleanTitle = rawTitle.includes('/') ? rawTitle.split('/').pop()?.replace(/[-_]+/g, ' ') || rawTitle : rawTitle;
  const displayTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  const desc = server ? server.description : 'Discover, filter, and install MCP tools on AllMCPs.com';

  return new ImageResponse(
    (
      <div
        style={{
          background: '#030712',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Brand Header with Official Vector Logo */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '44px' }}>
          <svg width="60" height="60" viewBox="0 0 1024 1024" style={{ marginRight: '20px' }}>
            <defs>
              <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="100%" stopColor="#007BFF" />
              </linearGradient>
            </defs>
            <path
              d="M 269 323.277 C 265.090 325.064, 258.583 332.135, 257.229 336.071 C 255.439 341.273, 255.439 682.727, 257.229 687.929 C 258.639 692.027, 265.181 698.995, 269.297 700.784 C 271.365 701.683, 284.709 702, 320.520 702 L 368.946 702 373.223 699.643 C 378.967 696.477, 383.975 689.094, 384.080 683.637 C 384.124 681.362, 384.236 646.575, 384.330 606.334 C 384.423 566.092, 384.861 532.806, 385.301 532.365 C 385.742 531.924, 395.193 540.774, 406.302 552.032 C 472.579 619.190, 498.326 645, 499.045 645 C 499.492 645, 500.477 645.620, 501.235 646.378 C 503.648 648.791, 511.893 649.986, 517.483 648.732 C 523.152 647.461, 517.517 652.868, 603.020 566.646 L 647.500 521.792 647.755 604.146 C 647.969 673.157, 648.243 686.986, 649.442 689.500 C 650.949 692.658, 656.953 698.638, 660.736 700.751 C 663.907 702.522, 750.635 702.552, 754.703 700.784 C 758.819 698.995, 765.361 692.027, 766.771 687.929 C 768.561 682.727, 768.561 341.273, 766.771 336.071 C 765.361 331.973, 758.819 325.005, 754.703 323.216 C 750.254 321.282, 678.301 321.504, 674.372 323.464 C 671.998 324.649, 592.424 404.437, 525.255 472.983 L 512.010 486.500 490.755 464.979 C 479.065 453.143, 443.178 416.784, 411.006 384.181 C 378.835 351.578, 351.203 324.250, 349.603 323.452 C 347.206 322.256, 340.057 322.012, 309.096 322.068 C 283.177 322.114, 270.724 322.490, 269 323.277 M 296 512 L 296 662 320 662 L 344 662 344.015 570.750 C 344.031 475.022, 343.974 476.322, 348.411 469.709 C 353.740 461.766, 367.433 459.347, 376.054 464.825 C 378.499 466.378, 382.016 469.416, 383.869 471.575 C 389.945 478.654, 454.129 543, 455.114 543 C 456.035 543, 482.229 516.634, 482.754 515.178 C 482.894 514.791, 469.844 501.144, 453.754 484.852 C 437.664 468.560, 418.660 449.216, 411.523 441.865 C 404.385 434.514, 383.725 413.538, 365.612 395.250 L 332.679 362 314.339 362 L 296 362 296 512 M 657.048 396.423 C 638.164 415.355, 622.378 431.388, 621.968 432.051 C 621.558 432.715, 590.460 464.289, 552.861 502.217 C 515.263 540.145, 484.356 571.569, 484.180 572.048 C 484.004 572.527, 490.163 579.306, 497.866 587.111 L 511.871 601.303 537.058 575.902 C 565.171 547.549, 599.284 512.991, 651.717 459.750 C 671.080 440.087, 687.166 424, 687.462 424 C 687.758 424, 688 477.550, 688 543 L 688 662 708 662 L 728 662 728 512 L 728 362 709.691 362 L 691.383 362 657.048 396.423"
              stroke="none"
              fill="url(#cyanGrad)"
              fillRule="evenodd"
            />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '40px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1 }}>
              AllMCPs<span style={{ color: '#00E5FF' }}>.com</span>
            </span>
          </div>
        </div>
        
        <h1 style={{ fontSize: '72px', fontWeight: 900, color: '#ffffff', lineHeight: 1.15, marginBottom: '20px', letterSpacing: '-0.03em', maxWidth: '1040px' }}>
          {displayTitle}
        </h1>
        
        <p style={{ fontSize: '32px', color: '#9ca3af', lineHeight: 1.4, maxWidth: '980px' }}>
          {desc}
        </p>

        {/* Decorative Gradient Border */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8px', background: 'linear-gradient(90deg, #00E5FF, #007BFF)', display: 'flex' }} />
      </div>
    ),
    { ...size }
  );
}
