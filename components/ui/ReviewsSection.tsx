import { Star } from 'lucide-react';
import type { ReviewSummary } from '../../lib/servers';
import { ReviewComposer } from './ReviewComposer';

/**
 * Server-rendered "what other users think" section for /mcp/[id] — the
 * aggregate + approved comments come from the page's own data-loading
 * Promise.all (a plain DB read, safe under ISR), while the composer itself
 * is a client component that self-checks sign-in state (see ReviewComposer).
 */
export function ReviewsSection({
  serverId,
  summary,
}: {
  serverId: string;
  summary: ReviewSummary;
}) {
  const { avgRating, count, distribution, comments } = summary;

  return (
    <section
      id="reviews"
      className="surface"
      style={{ padding: '1.75rem', marginTop: '2rem' }}
    >
      <h2
        style={{
          fontSize: '1.35rem',
          margin: '0 0 1.25rem',
          color: 'var(--text-primary)',
        }}
      >
        Reviews{' '}
        {count > 0 && (
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
            ({count})
          </span>
        )}
      </h2>

      {count > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '2rem',
            flexWrap: 'wrap',
            marginBottom: '1.75rem',
            paddingBottom: '1.75rem',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ textAlign: 'center', minWidth: 100 }}>
            <div
              style={{
                fontSize: '2.25rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1,
              }}
            >
              {avgRating.toFixed(1)}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 2,
                justifyContent: 'center',
                margin: '0.4rem 0',
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={14}
                  fill={n <= Math.round(avgRating) ? '#fbbf24' : 'none'}
                  color={
                    n <= Math.round(avgRating)
                      ? '#fbbf24'
                      : 'var(--border-strong)'
                  }
                />
              ))}
            </div>
            <div
              style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}
            >
              {count} {count === 1 ? 'rating' : 'ratings'}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            {([5, 4, 3, 2, 1] as const).map((n) => {
              const c = distribution[n];
              const pct = count > 0 ? (c / count) * 100 : 0;
              return (
                <div
                  key={n}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.78rem',
                  }}
                >
                  <span style={{ width: 12, color: 'var(--text-secondary)' }}>
                    {n}
                  </span>
                  <Star
                    size={11}
                    fill="#fbbf24"
                    color="#fbbf24"
                    style={{ flexShrink: 0 }}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--bg-muted)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: '#fbbf24',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      width: 24,
                      textAlign: 'right',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {c}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {comments.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}
        >
          {comments.map((c, i) => (
            <div
              key={i}
              style={{
                padding: '1rem 1.1rem',
                borderRadius: 12,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-muted)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', gap: 1 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={12}
                      fill={n <= c.rating ? '#fbbf24' : 'none'}
                      color={n <= c.rating ? '#fbbf24' : 'var(--border-strong)'}
                    />
                  ))}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {c.reviewerLabel} &middot;{' '}
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                }}
              >
                {c.comment}
              </p>
            </div>
          ))}
        </div>
      )}

      {count === 0 && (
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
          }}
        >
          No reviews yet — be the first to share how this listing worked for
          you.
        </p>
      )}

      <ReviewComposer serverId={serverId} />
    </section>
  );
}
