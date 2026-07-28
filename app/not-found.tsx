import { Button } from '../components/ui/Button';
import { PageShell } from '../components/PageShell';
import { EmptyState } from '../components/EmptyState';

export default function NotFound() {
  return (
    <PageShell variant="status" panel className="animate-fade-in">
      <EmptyState
        code="404"
        title="Page Not Found"
        description="We couldn't find the page or MCP server tool you were looking for. It may have been moved or removed."
        actions={
          <>
            <Button href="/browse" variant="primary">
              Browse Directory
            </Button>
            <Button href="/categories" variant="secondary">
              Browse Categories
            </Button>
          </>
        }
      />
    </PageShell>
  );
}
