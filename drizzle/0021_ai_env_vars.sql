-- Required environment variables extracted from a listing's README/setup instructions
-- by the AI content pipeline (see lib/aiContent.ts, app/api/cron/ai-content). JSON array
-- of UPPER_SNAKE_CASE names (e.g. ["OPENAI_API_KEY"]). Null = not generated yet.
ALTER TABLE `servers` ADD `ai_env_vars` text;
