import {
  CardGridSkeleton,
  HeadSkeleton,
  ListSkeleton,
} from '../../../components/directory/DirectorySkeletons';

/** Instant navigation feedback for /categories/[slug]: hero, top picks, list. */
export default function Loading() {
  return (
    <main className="container dir-catpage" aria-busy="true">
      <HeadSkeleton withIcon />
      <div className="dir-section">
        <CardGridSkeleton count={3} height={178} />
      </div>
      <div className="dir-section">
        <ListSkeleton rows={8} />
      </div>
    </main>
  );
}
