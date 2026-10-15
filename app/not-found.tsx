import type { Metadata } from 'next';
import { StatusScreen } from '../components/StatusScreen';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    // h2, not h1: Next serializes this tree into every page's RSC payload, and
    // audit tools that scan it report a second h1 on otherwise-clean pages.
    <StatusScreen
      code="404"
      titleAs="h2"
      title="We couldn’t find that page"
      description="The page or MCP server you were looking for may have been renamed or removed. Try a search, or jump back in below."
    />
  );
}
