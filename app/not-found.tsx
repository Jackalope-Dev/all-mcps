import type { Metadata } from 'next';
import { EmptyState } from '../components/EmptyState';
import { PageShell } from '../components/PageShell';
import { Button } from '../components/ui/Button';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <PageShell variant="status" panel className="animate-fade-in">
      <EmptyState
        code="404"
        title="Page Not Found"
        description="We couldn't find the page or MCP server tool you were looking for. It may have been moved or removed."
        actions={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button href="/browse" variant="primary">
              Browse Directory
            </Button>
            <Button href="/categories" variant="secondary">
              Categories
            </Button>
            <Button href="/tools" variant="secondary">
              Free Tools
            </Button>
            <Button href="/guides" variant="secondary">
              Guides
            </Button>
            <Button href="/blog" variant="secondary">
              Blog
            </Button>
          </div>
        }
      />
    </PageShell>
  );
}
