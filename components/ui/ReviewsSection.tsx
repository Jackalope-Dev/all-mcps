import { Star } from 'lucide-react';
import type { ReviewSummary } from '../../lib/servers';
import { ReviewComposer } from './ReviewComposer';

function Stars({ value, size }: { value: number; size: number }) {
  return (
    <span className="lst-stars" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          className={n <= value ? 'is-on' : undefined}
        />
      ))}
    </span>
  );
}

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
    <section id="reviews" className="lst-section" aria-labelledby="reviews-h">
      <header className="lst-section-head">
        <h2 id="reviews-h">
          Reviews
          {count > 0 && <span className="lst-section-count">{count}</span>}
        </h2>
        {count === 0 && (
          <p>No reviews yet — be the first to share how it worked for you.</p>
        )}
      </header>

      {count > 0 && (
        <div className="lst-card lst-review-summary">
          <div className="lst-review-score">
            <span className="lst-review-avg tabular">
              {avgRating.toFixed(1)}
            </span>
            <Stars value={Math.round(avgRating)} size={14} />
            <span className="lst-muted-sm">
              {count} {count === 1 ? 'rating' : 'ratings'}
            </span>
          </div>
          <div className="lst-review-dist">
            {([5, 4, 3, 2, 1] as const).map((n) => {
              const c = distribution[n];
              const pct = count > 0 ? (c / count) * 100 : 0;
              return (
                <div key={n} className="lst-review-bar">
                  <span className="tabular">{n}</span>
                  <span className="lst-review-track">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="tabular lst-review-n">{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {comments.length > 0 && (
        <ul className="lst-review-list">
          {comments.map((c) => (
            <li
              key={`${c.createdAt}|${c.reviewerLabel}`}
              className="lst-card lst-review"
            >
              <div className="lst-review-meta">
                <Stars value={c.rating} size={12} />
                <span className="lst-muted-sm">
                  {c.reviewerLabel} &middot;{' '}
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p>{c.comment}</p>
            </li>
          ))}
        </ul>
      )}

      <ReviewComposer serverId={serverId} />
    </section>
  );
}
