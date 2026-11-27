---
title: "MCP Servers for Data Warehouses Compared"
description: "Compare MCP servers for data warehouses by setup, authentication, query access, and limits, then connect BigQuery with a read-only configuration."
author: "caden-sumner"
date: 2026-11-27
slug: "mcp-servers-for-data-warehouses"
tags: ["Using MCP", "data warehouses", "SQL", "BigQuery"]
image: "https://app.lopebase.com/api/content/images/5ff7be2e-69a2-42ab-9451-43982ba08243/cover-e14e93f2874b2884.png"
image_alt: "MCP Servers for Data Warehouses Compared"
image_kind: "title_card"
faq: [{"q":"Which MCP server should I choose for my warehouse?","a":"Start with the matching implementation in the comparison table. Prefer the managed Snowflake or Databricks path when you want the vendor to operate the endpoint. Prefer Toolbox for the BigQuery setup shown here, or the official ClickHouse package for ClickHouse. Compare permissions and query behavior before considering broader tool coverage."},{"q":"Can a read-only warehouse connection still be expensive?","a":"Yes. A read-only query can scan substantial data. In BigQuery, adding LIMIT to a query over a non-clustered table doesn’t reduce the bytes read. Review filters and selected columns, and apply warehouse-side controls appropriate to your deployment. Google’s cost guidance covers query estimates and limits."},{"q":"Do I need a semantic layer to query a warehouse through MCP?","a":"Direct SQL doesn’t require one, but business questions need agreed definitions. For Snowflake business applications, the vendor recommends a Cortex Agent as the client-facing tool and a separate server for direct SQL. Use that separation when business users must stay within curated definitions. Snowflake’s guidance explains why."}]
---

Choose an MCP server for the warehouse you already use, then check how it executes SQL and whose permissions it uses. Start with Snowflake’s managed server, MCP Toolbox for BigQuery, Databricks SQL MCP, or ClickHouse’s official server. Their deployment models and write controls differ; the comparison below links to each implementation’s documentation.

For an initial deployment, use one curated dataset, read-only access, and a known query. Expand access after the agent returns the expected answer and fails the permission checks you’ve defined.

## Pick the server that matches your warehouse

| Warehouse and server | Setup and authentication | Read versus write access | Main tradeoff |
| --- | --- | --- | --- |
| Snowflake-managed MCP server | Remote server object inside Snowflake; Snowflake OAuth or configured External OAuth | SQL execution defaults to read-only; underlying role permissions still apply | No separate server process, but you must configure the server object and grants. [Documentation](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp) |
| BigQuery through MCP Toolbox for Databases | Run Toolbox locally or deploy it; the local setup uses Application Default Credentials | Enable `BIGQUERY_READONLY=true`; restrict IAM permissions too | You control the server process and must configure its identity. [BigQuery setup](https://docs.cloud.google.com/bigquery/docs/pre-built-tools-with-mcp-toolbox) and [read-only controls](https://mcp-toolbox.dev/v1.15.0/documentation/configuration/security/read-only/) |
| Databricks SQL MCP server | Managed remote endpoint with OAuth and Unity Catalog permissions | Supports reads and writes; the Unity Gateway policy can disallow writes | Direct SQL control, but queries require asynchronous polling. [Documentation](https://docs.databricks.com/aws/en/agents/mcp-tools/databricks-sql) |
| ClickHouse MCP Server | Run the official package locally or host it; configure ClickHouse credentials | Read-only by default; writes require explicit configuration | You operate the process and its database connection. [Repository](https://github.com/ClickHouse/mcp-clickhouse/blob/main/README.md) |

Use the [AllMCPs data platforms hub](https://allmcps.com/best/data-platforms) to find and compare warehouse servers. Before installing one, check its own documentation for the warehouse connection, supported authentication, and write controls. Similar names don’t establish equivalent access boundaries.

## Compare the warehouse servers in practice

### Snowflake-managed MCP server

Snowflake’s managed server exposes selected Snowflake capabilities without a separate deployment. Its tools can include direct SQL, Cortex Analyst, and Cortex Agents. Authentication and access remain tied to Snowflake’s configuration and role permissions. [Snowflake’s overview](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp) describes these options.

It fits teams that want the connection managed inside their existing Snowflake account.

**Best for:** Snowflake deployments where administrators can create the server object and assign a dedicated querying role.

For direct SQL, this example uses Snowflake’s documented server specification. Replace the database, schema, and warehouse with existing objects:

```sql
CREATE MCP SERVER ANALYTICS.MCP.WAREHOUSE_READER
  FROM SPECIFICATION $$
    tools:
      - name: "warehouse_sql"
        title: "Warehouse SQL"
        type: "SYSTEM_EXECUTE_SQL"
        description: "Query approved analytics data."
        config:
          read_only: true
          query_timeout: 60
          warehouse: "AGENT_WH"
  $$;
```

The object definition follows the [CREATE MCP SERVER syntax](https://docs.snowflake.com/en/en/sql-reference/sql/create-mcp-server); the SQL tool’s `read_only`, `query_timeout`, and `warehouse` settings are documented in the [managed server guide](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp).

For governed business questions, follow Snowflake’s recommendation to expose a Cortex Agent separately from unrestricted direct SQL. Otherwise, the client can bypass the agent’s semantic views and verified queries. That distinction should drive your server choice before you configure the connection. [Snowflake explains the separation](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp).

### BigQuery through MCP Toolbox for Databases

MCP Toolbox is an open-source server with a prebuilt BigQuery toolset. Google documents tools for dataset discovery, table metadata, and SQL execution. Its local setup uses Application Default Credentials. [Google’s BigQuery connection guide](https://docs.cloud.google.com/bigquery/docs/pre-built-tools-with-mcp-toolbox) covers the prerequisites and client configuration.

It fits developers who want to run the connection process themselves and explicitly select the Google Cloud project.

**Best for:** BigQuery teams that want a local starting point with project-specific configuration.

A useful first request is:

> List the tables in the approved reporting dataset, inspect the daily revenue table, and propose a query for revenue by date. Don’t execute the query yet.

The concrete advantage is metadata discovery before SQL execution. The tradeoff is that you must manage the Toolbox process and its credentials. Set `BIGQUERY_PROJECT` explicitly and enable `BIGQUERY_READONLY=true` for an exploration-only connection. Those variables are documented in the [BigQuery server README](https://github.com/googleapis/mcp-toolbox/blob/main/docs/BIGQUERY_README.md).

### Databricks SQL MCP server

Databricks SQL MCP runs agent-generated SQL against Unity Catalog tables. It supports both reading and writing, subject to permissions and applicable server policy. Execution is asynchronous: the client starts a statement and polls its status. [Databricks documents the execution model](https://docs.databricks.com/aws/en/agents/mcp-tools/databricks-sql).

It fits SQL development, schema inspection, and validation of queries whose exact text matters.

**Best for:** Databricks engineering workflows that need direct control over executed SQL.

For a new Unity Gateway integration, use the workspace-specific endpoint described in the [Databricks connection instructions](https://docs.databricks.com/aws/en/agents/mcp-tools/databricks-sql). Substitute your actual workspace hostname when configuring the client; the documented URL pattern is a template, not a public page.

It uses the `ai-gateway` OAuth scope and requires the relevant account preview to be enabled. The server exposes `execute_sql`, `execute_sql_read_only`, and `poll_sql_result`; `disallow_writes` controls write access through its policy. [Connection and policy details](https://docs.databricks.com/aws/en/agents/mcp-tools/databricks-sql).

Start with `SELECT 1 AS result`, then inspect a known reporting table. The tradeoff is explicit SQL control without built-in business definitions: Databricks says this server doesn’t resolve metric meanings or table relationships. [Documented limitations](https://docs.databricks.com/aws/en/agents/mcp-tools/databricks-sql).

### ClickHouse MCP Server

The official ClickHouse server connects an MCP client to a ClickHouse instance and provides database discovery and SQL execution. It runs read-only by default. Local process execution and hosted operation are both documented in the [official repository](https://github.com/ClickHouse/mcp-clickhouse/blob/main/README.md).

It fits teams querying ClickHouse Cloud or a self-managed ClickHouse deployment.

**Best for:** ClickHouse users who want control over the connection process and database identity.

Configure the documented `CLICKHOUSE_HOST`, `CLICKHOUSE_USER`, and `CLICKHOUSE_PASSWORD` variables, then keep `CLICKHOUSE_ALLOW_WRITE_ACCESS=false`. Use a dedicated database user. The repository notes that read-only access still permits cancellation of that user’s own queries, including queries from other connections sharing the identity. [Configuration and access behavior](https://github.com/ClickHouse/mcp-clickhouse/blob/main/README.md).

For an illustrative table named `analytics.events`, a bounded first task could be:

```sql
SELECT event_type, count() AS event_count
FROM analytics.events
WHERE event_date = toDate('2026-11-01')
GROUP BY event_type
ORDER BY event_count DESC
LIMIT 20;
```

Replace those identifiers with your schema. Choose this server when ClickHouse is the target; don’t introduce another database connector merely to reach the same tables.

## Connect BigQuery with a read-only client config

Here’s a complete starting configuration for Claude Desktop using the standalone Toolbox binary. First, download the binary for your operating system from the installation instructions in [Google’s BigQuery guide](https://docs.cloud.google.com/bigquery/docs/pre-built-tools-with-mcp-toolbox). The Google Cloud project needs billing, the BigQuery API, and permissions to create query jobs and read the intended data.

For local development, configure Application Default Credentials:

```bash
gcloud auth application-default login
```

This is the documented command for credentials used by local Google client libraries. A regular `gcloud` sign-in and ADC are separate credential configurations. [Google’s ADC documentation](https://docs.cloud.google.com/docs/authentication/application-default-credentials) explains the distinction.

Open Claude Desktop’s developer configuration and add this entry. Replace the executable path and project ID:

```json
{
  "mcpServers": {
    "bigquery-reporting": {
      "command": "/absolute/path/to/toolbox",
      "args": ["--prebuilt", "bigquery", "--stdio"],
      "env": {
        "BIGQUERY_PROJECT": "your-analytics-project",
        "BIGQUERY_READONLY": "true"
      }
    }
  }
}
```

The launch arguments follow [Google’s client configuration](https://docs.cloud.google.com/bigquery/docs/pre-built-tools-with-mcp-toolbox). The additional environment variable activates Toolbox’s [documented BigQuery read-only mode](https://mcp-toolbox.dev/v1.15.0/documentation/configuration/security/read-only/).

Restart the client. Ask it to execute `SELECT 1 AS connection_ok`, then inspect one approved table’s metadata. Don’t start with a request to explore every dataset.

Keep the authenticated identity’s permissions narrow even with read-only mode enabled. For differences between client JSON formats, use the [configuration templates](https://allmcps.com/blog/mcp-server-configuration-json).

## Keep warehouse queries bounded and useful

Define the allowed query surface before giving the agent a business question. Start with a reporting dataset or schema and write down which views contain approved metrics. For each view, supply its grain, date column, join keys, and important exclusions. Treat that information as part of your warehouse connection’s acceptance criteria.

For example, replace “analyze revenue” with:

> Query the approved daily revenue view for November 1 through November 7, 2026. Return date, currency, and total revenue. Keep currencies separate and show the SQL used.

That request gives you something testable. You can compare the result with a known warehouse query rather than judge whether the explanation sounds plausible.

Separate response size from query work. Google explicitly warns that `LIMIT` doesn’t reduce bytes read for non-clustered BigQuery tables. Select the required columns and use appropriate partition filters; don’t treat a short result as proof of a cheap query. [BigQuery’s cost-control documentation](https://docs.cloud.google.com/bigquery/docs/best-practices-costs) explains the distinction.

Prefer aggregation inside the warehouse over returning raw records to the agent. Databricks documents result truncation for large tool responses, so an apparently successful query can still produce an incomplete result for the model. [Databricks SQL MCP limitations](https://docs.databricks.com/aws/en/agents/mcp-tools/databricks-sql) recommend fewer rows, fewer columns, or aggregation.

## Check the connection against real warehouse tasks

Before widening access, run this acceptance sequence against a small dataset with known answers:

1. **Confirm execution.** Run `SELECT 1 AS connection_ok`. Check the actual tool result rather than accepting an answer generated without a query.
2. **Check discovery.** Ask for the columns and types of one approved table. Compare them with the warehouse catalog.
3. **Check calculation.** Run a reviewed aggregate over a fixed date range. Compare totals, null handling, and currency treatment.
4. **Check denied access.** Attempt a harmless read from a test table the identity must not access. Require an access-denied result.
5. **Check the query boundary.** Ask the agent to propose a write statement without executing it. Verify the connection’s configured write controls separately in a disposable test environment.
6. **Check incomplete results.** Use a deliberately bounded query and confirm the agent can distinguish returned rows from the full population.

Save the approved SQL and expected results alongside the connection configuration. Repeat these checks when you change the server, identity, grants, or reporting views. Your release criterion should be a correct answer over approved data and a failed read outside that boundary.

## FAQ

### Which MCP server should I choose for my warehouse?

Start with the matching implementation in the comparison table. Prefer the managed Snowflake or Databricks path when you want the vendor to operate the endpoint. Prefer Toolbox for the BigQuery setup shown here, or the official ClickHouse package for ClickHouse. Compare permissions and query behavior before considering broader tool coverage.

### Can a read-only warehouse connection still be expensive?

Yes. A read-only query can scan substantial data. In BigQuery, adding `LIMIT` to a query over a non-clustered table doesn’t reduce the bytes read. Review filters and selected columns, and apply warehouse-side controls appropriate to your deployment. [Google’s cost guidance](https://docs.cloud.google.com/bigquery/docs/best-practices-costs) covers query estimates and limits.

### Do I need a semantic layer to query a warehouse through MCP?

Direct SQL doesn’t require one, but business questions need agreed definitions. For Snowflake business applications, the vendor recommends a Cortex Agent as the client-facing tool and a separate server for direct SQL. Use that separation when business users must stay within curated definitions. [Snowflake’s guidance](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-agents-mcp) explains why.
