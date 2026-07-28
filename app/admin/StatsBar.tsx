import type { AdminStats } from '@/lib/adminStats';

export function StatsBar({ stats }: { stats: AdminStats }) {
  const cards: { label: string; value: string }[] = [
    { label: 'Pending', value: String(stats.statusCounts.pending) },
    { label: 'Active', value: String(stats.statusCounts.active) },
    { label: 'Removed', value: String(stats.statusCounts.removed) },
    { label: 'Premium', value: String(stats.premiumCount) },
    { label: 'Featured', value: String(stats.featuredCount) },
    { label: 'Unhealthy', value: String(stats.unhealthyCount) },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              marginBottom: '0.35rem',
            }}
          >
            {card.label}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{card.value}</div>
        </div>
      ))}

      <div
        style={{
          gridColumn: '1 / -1',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}
        >
          Engagement: {stats.engagement.totalViews} views · {stats.engagement.totalUpvotes} upvotes ·{' '}
          {stats.engagement.totalCopies} installs
        </div>
        {stats.topByViews.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {stats.topByViews.map((s) => (
              <span key={s.id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {s.name} ({s.views})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
