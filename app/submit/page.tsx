import { Metadata } from 'next';
import { SubmitForm } from '../../components/forms/SubmitForm';
import { PageShell, PageHeader } from '../../components/PageShell';

export const metadata: Metadata = {
  title: 'Submit an MCP Server',
  description: 'Submit your Model Context Protocol server to the AllMCPs directory.',
};

export default function SubmitPage() {
  return (
    <PageShell variant="content" panel>
      <PageHeader
        title="Submit an MCP Server"
        description={
          <>
            Have you built an incredible MCP server? Submit it below to get it listed in our
            directory. You can add a website (nofollow on free listings; dofollow for premium) and
            claim ownership after approval via GitHub badge, site badge, or DNS.
          </>
        }
      />
      <SubmitForm />
    </PageShell>
  );
}
