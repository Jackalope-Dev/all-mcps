import { ServerRowSkeleton, skeletonKeys } from './ServerRow';

/** Breadcrumb + title + lead placeholder shared by directory loading.tsx files. */
export function HeadSkeleton({ withIcon = false }: { withIcon?: boolean }) {
  return (
    <div className="dir-skel-head" aria-hidden="true">
      <div className="skeleton dir-skel-crumbs" />
      <div className="dir-skel-hero">
        {withIcon && <div className="skeleton dir-skel-icon" />}
        <div className="dir-skel-hero-text">
          <div className="skeleton dir-skel-title" />
          <div className="skeleton dir-skel-lead" />
          <div className="skeleton dir-skel-lead dir-skel-lead--short" />
        </div>
      </div>
    </div>
  );
}

/** Bordered list of placeholder server rows. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="dir-list" aria-hidden="true">
      <ServerRowSkeleton count={rows} />
    </div>
  );
}

/** Grid of placeholder cards (categories, top picks, topics). */
export function CardGridSkeleton({
  count = 9,
  height = 120,
}: {
  count?: number;
  height?: number;
}) {
  return (
    <div className="dir-grid" aria-hidden="true">
      {skeletonKeys(count).map((k) => (
        <div key={k} className="skeleton dir-card-skel" style={{ height }} />
      ))}
    </div>
  );
}
