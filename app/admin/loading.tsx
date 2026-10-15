import { PageShell } from '../../components/PageShell';

/** Admin-console-shaped placeholder while the moderation queues load. */
export default function Loading() {
  return (
    <PageShell variant="default" className="adm">
      <div className="acct-skel-head">
        <div className="skeleton acct-skel-title" />
        <div className="skeleton acct-skel-lead" />
      </div>
      <div className="acct-skel-grid">
        <div className="skeleton acct-skel-tile" />
        <div className="skeleton acct-skel-tile" />
        <div className="skeleton acct-skel-tile" />
        <div className="skeleton acct-skel-tile" />
      </div>
      <div className="skeleton adm-skel-tabs" />
      <div className="skeleton acct-skel-card" />
    </PageShell>
  );
}
