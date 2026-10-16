import {
  HeadSkeleton,
  ListSkeleton,
} from '../../components/directory/DirectorySkeletons';
import { PageShell } from '../../components/PageShell';

/**
 * Instant navigation feedback for /browse. Without it a tap on a homepage
 * "Popular" chip showed nothing until the search finished, which on a busy
 * D1 took up to ~55s and read as a dead link on mobile.
 */
export default function Loading() {
  return (
    <PageShell>
      <HeadSkeleton />
      <div className="skeleton dir-skel-search" />
      <ListSkeleton rows={10} />
    </PageShell>
  );
}
