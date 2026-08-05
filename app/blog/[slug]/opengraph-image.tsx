import { ImageResponse } from 'next/og';
import { getPostBySlug } from '../../../lib/blog';
import { truncateTitle, truncateDescription } from '../../../lib/ogHelpers';

export const alt = 'AllMCPs Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const resolvedParams = await params;
  const post = getPostBySlug(resolvedParams?.slug || '');

  const rawTitle = post ? post.title : 'AllMCPs Blog';
  const rawDesc = post
    ? post.excerpt
    : 'Articles, tutorials, and guides on Model Context Protocol and AI integration.';

  const displayTitle = truncateTitle(rawTitle, 75);
  const displayDesc = truncateDescription(rawDesc, 145);
  const primaryTag = (post && post.tags && post.tags.length > 0) ? post.tags[0].toUpperCase() : 'BLOG ARTICLE';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px',
          background: 'linear-gradient(135deg, #030712 0%, #080f24 40%, #0d1936 80%, #030712 100%)',
          position: 'relative',
          fontFamily: 'sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Ambient Glowing Radial Gradients */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-100px',
            width: '650px',
            height: '650px',
            background: 'radial-gradient(circle, rgba(0, 229, 255, 0.22) 0%, rgba(0, 123, 255, 0.06) 45%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-120px',
            left: '-100px',
            width: '650px',
            height: '650px',
            background: 'radial-gradient(circle, rgba(0, 123, 255, 0.20) 0%, rgba(99, 102, 241, 0.05) 50%, transparent 75%)',
            display: 'flex',
          }}
        />

        {/* Geometric Grid Pattern Overlay */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '630px',
            opacity: 0.06,
          }}
        >
          <defs>
            <pattern id="grid-pattern-blog" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00E5FF" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1200" height="630" fill="url(#grid-pattern-blog)" />
        </svg>

        {/* Glassmorphic Inner Frame Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '44px 52px',
            borderRadius: '24px',
            background: 'rgba(15, 23, 42, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            position: 'relative',
          }}
        >
          {/* Header Row: Logo & Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="56" height="56" viewBox="0 0 1024 1024" style={{ marginRight: '18px' }}>
                <defs>
                  <linearGradient id="cyanGradBlog" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00E5FF" />
                    <stop offset="100%" stopColor="#007BFF" />
                  </linearGradient>
                </defs>
                <path
                  d="M 269 323.277 C 265.090 325.064, 258.583 332.135, 257.229 336.071 C 255.439 341.273, 255.439 682.727, 257.229 687.929 C 258.639 692.027, 265.181 698.995, 269.297 700.784 C 271.365 701.683, 284.709 702, 320.520 702 L 368.946 702 373.223 699.643 C 378.967 696.477, 383.975 689.094, 384.080 683.637 C 384.124 681.362, 384.236 646.575, 384.330 606.334 C 384.423 566.092, 384.861 532.806, 385.301 532.365 C 385.742 531.924, 395.193 540.774, 406.302 552.032 C 472.579 619.190, 498.326 645, 499.045 645 C 499.492 645, 500.477 645.620, 501.235 646.378 C 503.648 648.791, 511.893 649.986, 517.483 648.732 C 523.152 647.461, 517.517 652.868, 603.020 566.646 L 647.500 521.792 647.755 604.146 C 647.969 673.157, 648.243 686.986, 649.442 689.500 C 650.949 692.658, 656.953 698.638, 660.736 700.751 C 663.907 702.522, 750.635 702.552, 754.703 700.784 C 758.819 698.995, 765.361 692.027, 766.771 687.929 C 768.561 682.727, 768.561 341.273, 766.771 336.071 C 765.361 331.973, 758.819 325.005, 754.703 323.216 C 750.254 321.282, 678.301 321.504, 674.372 323.464 C 671.998 324.649, 592.424 404.437, 525.255 472.983 L 512.010 486.500 490.755 464.979 C 479.065 453.143, 443.178 416.784, 411.006 384.181 C 378.835 351.578, 351.203 324.250, 349.603 323.452 C 347.206 322.256, 340.057 322.012, 309.096 322.068 C 283.177 322.114, 270.724 322.490, 269 323.277 M 296 512 L 296 662 320 662 L 344 662 344.015 570.750 C 344.031 475.022, 343.974 476.322, 348.411 469.709 C 353.740 461.766, 367.433 459.347, 376.054 464.825 C 378.499 466.378, 382.016 469.416, 383.869 471.575 C 389.945 478.654, 454.129 543, 455.114 543 C 456.035 543, 482.229 516.634, 482.754 515.178 C 482.894 514.791, 469.844 501.144, 453.754 484.852 C 437.664 468.560, 418.660 449.216, 411.523 441.865 C 404.385 434.514, 383.725 413.538, 365.612 395.250 L 332.679 362 314.339 362 L 296 362 296 512 M 657.048 396.423 C 638.164 415.355, 622.378 431.388, 621.968 432.051 C 621.558 432.715, 590.460 464.289, 552.861 502.217 C 515.263 540.145, 484.356 571.569, 484.180 572.048 C 484.004 572.527, 490.163 579.306, 497.866 587.111 L 511.871 601.303 537.058 575.902 C 565.171 547.549, 599.284 512.991, 651.717 459.750 C 671.080 440.087, 687.166 424, 687.462 424 C 687.758 424, 688 477.550, 688 543 L 688 662 708 662 L 728 662 728 512 L 728 362 709.691 362 L 691.383 362 657.048 396.423"
                  stroke="none"
                  fill="url(#cyanGradBlog)"
                  fillRule="evenodd"
                />
              </svg>
              <span style={{ fontSize: '40px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                AllMCPs<span style={{ color: '#00E5FF' }}>.com</span>
              </span>
            </div>

            {/* Pill Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 20px',
                borderRadius: '9999px',
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.35)',
                color: '#00E5FF',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {primaryTag}
            </div>
          </div>

          {/* Main Title & Description Container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              margin: '20px 0',
              flex: 1,
              maxHeight: '300px',
              overflow: 'hidden',
            }}
          >
            <h1
              style={{
                fontSize: '60px',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.15,
                marginBottom: '16px',
                letterSpacing: '-0.025em',
                maxWidth: '980px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {displayTitle}
            </h1>

            <p
              style={{
                fontSize: '28px',
                color: '#E2E8F0',
                lineHeight: 1.45,
                maxWidth: '960px',
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {displayDesc}
            </p>
          </div>

          {/* Footer Highlights */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <span style={{ fontSize: '18px', color: '#94A3B8', fontWeight: 600 }}>
                📖 AllMCPs Official Blog & Engineering Guide
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', color: '#00E5FF', fontWeight: 700 }}>
                Read on AllMCPs.com
              </span>
            </div>
          </div>
        </div>

        {/* Decorative Bottom Multi-stop Gradient Border */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '8px',
            background: 'linear-gradient(90deg, #00E5FF 0%, #007BFF 50%, #6366F1 100%)',
            display: 'flex',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
