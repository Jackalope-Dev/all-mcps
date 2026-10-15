import { HeadSkeleton } from '../../../components/directory/DirectorySkeletons';
import { skeletonKeys } from '../../../components/directory/ServerRow';

/** Instant navigation feedback for /best/[topic]: header + ranked cards. */
export default function Loading() {
  return (
    <main className="container dir-catpage" aria-busy="true">
      <HeadSkeleton />
      <div className="dir-ranked" aria-hidden="true">
        {skeletonKeys(5).map((k, i) => (
          <div
            key={k}
            className="skeleton dir-skel-rank"
            style={{ height: i === 0 ? 196 : 172 }}
          />
        ))}
      </div>
    </main>
  );
}
