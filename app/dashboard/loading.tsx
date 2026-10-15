import { PageShell } from '../../components/PageShell';

/** Instant feedback while the dashboard loads listings and analytics. */
export default function Loading() {
  return (
    <PageShell variant="default" className="acct-dash">
      <div className="acct-skel-head">
        <div className="skeleton acct-skel-title" />
        <div className="skeleton acct-skel-lead" />
      </div>
      <div className="skeleton acct-skel-strip" />
      <div className="skeleton acct-skel-card" />
      <div className="skeleton acct-skel-card" />
    </PageShell>
  );
}
