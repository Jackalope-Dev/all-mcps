-- API access logs: track which LLMs/agents hit your MCP endpoints
CREATE TABLE api_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT,
  endpoint TEXT NOT NULL,
  method_or_tool TEXT,
  user_agent TEXT,
  caller_class TEXT NOT NULL DEFAULT 'unknown',
  ip_country TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_access_server ON api_access_logs(server_id);
CREATE INDEX idx_access_created ON api_access_logs(created_at);
CREATE INDEX idx_access_caller ON api_access_logs(caller_class);

-- Impression logs: track where listings appear on the site
CREATE TABLE impression_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  session_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_impression_server ON impression_logs(server_id);
CREATE INDEX idx_impression_created ON impression_logs(created_at);
CREATE INDEX idx_impression_surface ON impression_logs(surface);
