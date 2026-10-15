import {
  CardGridSkeleton,
  HeadSkeleton,
} from '../../components/directory/DirectorySkeletons';
import { PageShell } from '../../components/PageShell';

/** Instant navigation feedback for /categories: header, filter bar, card grid. */
export default function Loading() {
  return (
    <PageShell>
      <HeadSkeleton />
      <div className="skeleton dir-skel-search dir-skel-search--sm" />
      <CardGridSkeleton count={12} height={122} />
    </PageShell>
  );
}
