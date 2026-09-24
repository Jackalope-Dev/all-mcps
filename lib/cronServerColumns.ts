import { getTableColumns } from 'drizzle-orm';
import { servers } from '../db/schema';

/**
 * `servers` columns for batch crons (health, enrich) that never read the
 * LLM-generated content layer. A bare `db.select()` pulls ai_doc / ai_faq /
 * ai_overview etc. for every row in the batch, and because the scheduled
 * handler runs these crons in the same isolate that serves live traffic, that
 * heap spike blew the Worker memory limit and 503'd concurrent page requests.
 */
const {
  aiSummary: _aiSummary,
  aiOverview: _aiOverview,
  aiUseCases: _aiUseCases,
  aiFeatures: _aiFeatures,
  aiFaq: _aiFaq,
  aiDoc: _aiDoc,
  aiEnvVars: _aiEnvVars,
  pendingRevision: _pendingRevision,
  ...cronServerColumns
} = getTableColumns(servers);

export { cronServerColumns };
