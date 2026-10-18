---
title: "MCP Servers for Data Analysis: Database to Chart"
excerpt: "Learn how MCP servers for data analysis connect a database, file server, and code sandbox to turn a question into a validated chart."
tags: ["MCP", "Guides", "Developer Tools", "Security"]
faq:
  - q: "Can MCP query a database and create a chart?"
    a: "Yes, an MCP host can coordinate separate client connections to a read-only database server, a file server, and a code-execution server. The database can return source rows, the file server can provide mappings or calendar definitions, and the code server can calculate metrics and save a chart. Tool names, approval flows, and output formats vary by client and server, so inspect their advertised schemas."
  - q: "How should MCP handle customers who change segments during a month?"
    a: "A monthly aggregation is only safe when segment intervals are also defined at month granularity. Require effective dates to fall on month boundaries and reject any mid-month change before analysis. If the business needs exact treatment of mid-month changes, query individual orders with their timestamps and join each order to the segment interval valid at that timestamp instead."
  - q: "How do I query spreadsheets with MCP?"
    a: "Identify the workbook, worksheet, range, header row, date column, and aggregation rule before reading data. A spreadsheet MCP server can retrieve or edit workbook data, while a code-execution server can perform repeatable calculations. Spreadsheet support differs: some servers automate Excel, some manipulate files directly, and others connect to Google Sheets."
  - q: "Is it safe to connect an MCP server to production data?"
    a: "It can be safe only when access is deliberately constrained. Use a read-only database role, restrict network and filesystem access, set query timeouts and result limits, avoid exposing secrets, and review sensitive tool calls. An MCP server should be treated as an application process with the permissions granted to it, not as a harmless natural-language interface."
---

MCP servers for data analysis let an AI host coordinate databases, files, spreadsheets, and code execution instead of treating analysis as one opaque prompt. A practical workflow is to query a restricted database for source rows, load a segment mapping and reporting calendar through a file server, execute a reproducible analysis script, and return a chart with its assumptions and validation results. This article works through that database-to-chart flow.

## What MCP adds to data analysis

The Model Context Protocol (MCP) gives an AI application a standard way to discover and invoke capabilities exposed by servers. Depending on the implementation, a server can expose tools, resources, and prompts. Tools are callable operations; resources represent addressable data or documents; prompts are reusable interaction templates.

This distinction matters for analysis. A database server might expose tools for schema discovery and bounded read-only SQL. A file server might list approved directories and read CSV or JSON files. A code-execution server might run a script in a sandbox and write output artifacts. The MCP host coordinates these server connections and passes results between them.

MCP does not define a universal SQL tool name, chart API, file layout, or permission model. Clients and servers can impose different approval flows, argument schemas, output limits, and sandbox rules. Inspect the capabilities advertised by the selected implementations rather than assuming that a familiar tool name exists.

For discovery, compare [database MCP servers](/best/databases), [data science MCP servers](/best/data-science), and [data platform MCP servers](/best/data-platforms) according to the systems you need to connect.

## The worked scenario

Assume an operations team asks:

> Which customer segments had the largest month-over-month increase in paid orders across the last six complete months, and can you show the result as a chart?

The source data is split across three places:

1. PostgreSQL contains orders, payment status, order timestamps, and customer IDs.
2. An approved local directory contains `segment_history.csv` and `reporting_calendar.csv`.
3. A controlled Python execution environment calculates changes and creates the chart.

This example deliberately uses month-granularity segment history. A customer’s segment must remain constant for each calendar month being analyzed. Every `effective_from` and `effective_to` value must be the first day of a month, and a segment change during a month is rejected rather than silently assigned to one side of the boundary. If the business needs mid-month accuracy, change the design: query individual orders, retain the exact order timestamp, and join each order against the interval valid at that timestamp before aggregating.

The desired output is a chart, a result table, the SQL and transformation rules, and enough provenance for another operator to reproduce the result.

```text
User question
     |
     v
MCP host
  |         |          |
  v         v          v
MCP client  MCP client MCP client
for DB      for files  for code
  |         |          |
  v         v          v
Database   File       Code execution
server     server     server
  |         |          |
  v         v          v
SQL rows   CSV files  table + chart
```

An MCP host can manage multiple server connections, typically using a separate MCP client instance for each server. The exact connection configuration is client-specific. Keep each server’s credentials and process permissions separate where possible.

## Step 1: Define the analysis contract

Before calling a tool, turn the natural-language question into explicit definitions:

- The reporting timezone and calendar determine month boundaries.
- The window is the six most recent complete calendar months approved by the reporting calendar.
- The measure is the count of orders whose payment status is paid.
- Segment membership is month-granular. Each customer has exactly one valid segment interval for an analyzed month.
- Mid-month segment changes are invalid input for this workflow and must stop the run.
- A segment-month pair must meet a minimum paid-order threshold in both months of a comparison.
- Every adjacent pair within the six-month window is calculated, not only the final pair.
- The output contains monthly counts, percentage changes, qualifying sample sizes, and a chart of the largest qualifying increases.

For example, set `MIN_ORDERS = 100` only after confirming that this threshold is meaningful for the business. The threshold should be visible in the output metadata, not hidden in a prompt.

This contract prevents the model from silently changing “paid orders” to revenue, using current segment membership for historical orders, treating a mid-month change as a whole-month assignment, or comparing a partial month with a complete one.

If the request concerns a spreadsheet, apply the same discipline. “Query spreadsheets with MCP” should identify the workbook, worksheet, range, header row, date column, and aggregation rule. Do not ask a model to infer all of those from an entire workbook when a specific range can be selected.

## Step 2: Inspect the database schema

Start with schema discovery, not a guessed query. A database MCP server should expose some way to inspect tables, columns, relationships, or documented views. The returned metadata might identify `orders` and `customers`, but names and tool schemas vary by server.

A PostgreSQL-focused option in the directory is [andyWang1688/sql-query-mcp](/mcp/andywang1688-sql-query-mcp), which is described as supporting schema discovery and bounded read-only SQL across PostgreSQL, MySQL, and Hive. For PostgreSQL-specific choices, see the [PostgreSQL MCP server listings](/best/postgres).

Ask the database server for metadata with a constrained scope:

```text
Inspect tables and columns related to orders, customers, payment status,
order timestamps, and customer IDs. Return metadata only. Do not execute
data-changing statements.
```

Resolve these questions before querying:

- Is the order timestamp stored in UTC, local time, or a business timezone?
- Is payment status current or historical?
- Can one order have multiple payment records?
- Is `customer_id` stable across the source system?
- Are deleted, refunded, or test orders represented by flags?

Use a read-only database role. If the server supports limits, timeouts, query allowlists, or query-plan inspection, configure them before analysis. A prompt saying “do not modify data” expresses intent, but it is not an authorization boundary.

## Step 3: Run a complete, controlled source query

Return enough information for the file-based segment join, but no more. Because this example requires month-granularity segment intervals, the query can aggregate to customer-month while preserving `customer_id` and the order month. It must not be used when segment membership changes within a month.

A representative PostgreSQL query is:

```sql
SELECT
  o.customer_id,
  date_trunc('month', o.paid_at AT TIME ZONE 'UTC')::date AS month,
  COUNT(*) AS paid_orders
FROM orders AS o
WHERE o.status = 'paid'
  AND o.paid_at >= DATE '2026-04-01'
  AND o.paid_at <  DATE '2026-10-01'
  AND COALESCE(o.is_test, false) = false
GROUP BY 1, 2
ORDER BY 1, 2;
```

The dates are illustrative. The host should calculate the actual six-month range from the approved reporting calendar and the business timezone. If a local reporting timezone is required, apply its conversion consistently rather than substituting this UTC expression.

Date filtering alone does not guarantee a bounded or complete result. The selected database server and client must enforce a statement timeout and a maximum result size, and the host must fail if the server reports truncation, cancellation, or an incomplete result. Configuration names are implementation-specific; an illustrative host-side policy is:

```json
{
  "readOnly": true,
  "statementTimeoutMs": 30000,
  "maxResultRows": 100000,
  "onTruncatedResult": "fail"
}
```

Do not treat this JSON as a universal MCP field schema. Apply equivalent settings through the database driver, server configuration, or client policy supported by the selected implementation. If the server cannot report whether a result was truncated, use a query-specific completeness check, such as an expected count or a server-side aggregate, before accepting the data. Otherwise, do not describe the result as bounded and complete.

Preserve the SQL, database identifier, row count, truncation status, and query timestamp as provenance. A response might contain rows like this:

```json
[
  {"customer_id": 17, "month": "2026-04-01", "paid_orders": 8},
  {"customer_id": 17, "month": "2026-05-01", "paid_orders": 11},
  {"customer_id": 42, "month": "2026-04-01", "paid_orders": 3}
]
```

Do not assume every server returns exactly this JSON shape. Some clients expose structured content, text content, resource links, or server-specific result envelopes. Normalize the actual response after inspecting it.

## Step 4: Use the file server for mappings and calendar rules

The file server supplies the two inputs that make the analysis historically and temporally correct:

- `segment_history.csv` maps `customer_id` to `segment`, `effective_from`, and optionally `effective_to`.
- `reporting_calendar.csv` identifies approved complete reporting months, for example with `month` and `is_complete` columns.

A typical file-server sequence is:

1. List an approved analysis directory.
2. Select the known mapping and calendar files.
3. Read metadata and content for only those files.
4. Confirm delimiter, encoding, headers, date formats, and version or modification time.
5. Copy immutable snapshots into the code-execution workspace.

The [file systems MCP server listings](/best/file-systems) help compare servers for local files and controlled directory access. For a narrower local-data workflow, [reading-plus-ai/mcp-server-data-exploration](/mcp/reading-plus-ai-mcp-server-data-exploration) is described as supporting local CSV exploration, DataFrame loading, and Python script execution.

The historical join must use month-granular intervals. For example, an interval beginning on `2026-04-01` and ending on `2026-07-01` applies to April, May, and June when the end is exclusive. An `effective_from` of `2026-04-15` is invalid for this workflow, even if it appears to provide more precise data, because the database result has already combined the customer’s April orders.

A file server should not receive unrestricted access to a home directory merely because the client needs one CSV. Configure an allowed root, reject path traversal, and avoid unexpected symlinks unless the implementation explicitly handles them safely.

## Step 5: Validate intervals before joining

Validate the complete segment-history file before filtering it to the six-month reporting window. This is important because checking only source rows can miss malformed intervals or overlaps outside the selected months that will affect a later run.

The validation rules are:

- `effective_from` is present and falls on the first day of a month.
- When present, `effective_to` falls on the first day of a month.
- `effective_from < effective_to` for every closed interval.
- Intervals for one customer are ordered and do not overlap.
- At most one interval is open-ended for a customer, and it is the final interval.
- Every customer-month used by the database result maps to exactly one interval.

A simple validation pass can sort each customer’s intervals and compare each start with the previous end. Reject the file before the analysis if any rule fails. The later customer-month match is still useful: it catches missing mappings and confirms that every source row has exactly one applicable interval, but it is not a substitute for validating the full file.

## Step 6: Calculate month-over-month changes

Pass the complete database result and the approved file snapshots to the code-execution server. The execution environment should have an explicit working directory, input files, output directory, time limit, and dependency set.

The following example includes full interval validation before the join. It assumes `effective_to` is exclusive and that open-ended intervals are allowed only as the final interval for a customer:

```python
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter

MIN_ORDERS = 100

orders = pd.read_json("inputs/customer_monthly_paid_orders.json")
segments = pd.read_csv(
    "inputs/segment_history.csv",
    parse_dates=["effective_from", "effective_to"],
)
calendar = pd.read_csv(
    "inputs/reporting_calendar.csv",
    parse_dates=["month"],
)

for column in ["effective_from", "effective_to"]:
    values = segments[column].dropna()
    if not (values.dt.day == 1).all():
        raise ValueError(f"{column} must contain month boundaries")

bad_order = (
    segments["effective_to"].notna()
    & (segments["effective_from"] >= segments["effective_to"])
)
if bad_order.any():
    raise ValueError("Segment intervals must have effective_from before effective_to")

segments = segments.sort_values(["customer_id", "effective_from"])
for customer_id, group in segments.groupby("customer_id", sort=False):
    if group["effective_from"].duplicated().any():
        raise ValueError(f"Duplicate segment starts for customer {customer_id}")
    closed = group["effective_to"].notna()
    if group.loc[~closed].shape[0] > 1:
        raise ValueError(f"Multiple open-ended intervals for customer {customer_id}")
    if (~closed).any() and not group.index[-1] in group.index[~closed]:
        raise ValueError(f"Open-ended interval is not final for customer {customer_id}")
    previous_end = group["effective_to"].shift(1)
    overlap = previous_end.notna() & (group["effective_from"] < previous_end)
    if overlap.any():
        raise ValueError(f"Overlapping segment intervals for customer {customer_id}")

orders["month"] = (
    pd.to_datetime(orders["month"])
      .dt.to_period("M")
      .dt.to_timestamp()
)
calendar["month"] = (
    calendar["month"]
      .dt.to_period("M")
      .dt.to_timestamp()
)
segments["effective_from"] = (
    segments["effective_from"]
      .dt.to_period("M")
      .dt.to_timestamp()
)
segments["effective_to"] = (
    segments["effective_to"]
      .dt.to_period("M")
      .dt.to_timestamp()
)

complete = (
    calendar.loc[calendar["is_complete"], "month"]
            .sort_values()
            .drop_duplicates()
)
expected = complete.tail(6).tolist()
if len(expected) != 6:
    raise ValueError("Fewer than six complete reporting months are available")
if any(
    expected[i + 1] != expected[i] + pd.offsets.MonthBegin(1)
    for i in range(len(expected) - 1)
):
    raise ValueError("The six complete reporting months are not consecutive")

orders = orders[orders["month"].isin(expected)].copy()
if orders["month"].nunique() != len(expected):
    raise ValueError("The database result is missing an expected month")

joined = orders.merge(
    segments,
    on="customer_id",
    how="left",
    validate="many_to_many",
)
valid = (
    (joined["month"] >= joined["effective_from"])
    & (
        joined["effective_to"].isna()
        | (joined["month"] < joined["effective_to"])
    )
)
matches = joined.loc[valid].copy()

match_counts = matches.groupby(["customer_id", "month"]).size()
source_keys = orders.set_index(["customer_id", "month"]).index
match_counts = match_counts.reindex(source_keys, fill_value=0)
if not match_counts.eq(1).all():
    raise ValueError("Every source customer-month needs exactly one segment")
if len(matches) != len(orders):
    raise ValueError("Segment matching changed the source row count")

monthly = (
    matches.groupby(["month", "segment"], as_index=False)["paid_orders"]
           .sum()
)
all_segments = monthly["segment"].unique()
full_index = pd.MultiIndex.from_product(
    [expected, all_segments], names=["month", "segment"]
)
monthly = (
    monthly.set_index(["month", "segment"])
           .reindex(full_index, fill_value=0)
           .reset_index()
)

monthly["previous_month"] = monthly.groupby("segment")["paid_orders"].shift(1)
monthly["previous_period"] = monthly.groupby("segment")["month"].shift(1)
monthly["eligible"] = (
    (monthly["previous_period"] == monthly["month"] - pd.offsets.MonthBegin(1))
    & monthly["previous_month"].ge(MIN_ORDERS)
    & monthly["paid_orders"].ge(MIN_ORDERS)
    & monthly["previous_month"].ne(0)
)
monthly["pct_change"] = pd.NA
monthly.loc[monthly["eligible"], "pct_change"] = (
    monthly.loc[monthly["eligible"], "paid_orders"]
    / monthly.loc[monthly["eligible"], "previous_month"] - 1
)

changes = monthly.loc[monthly["eligible"]].sort_values(
    "pct_change", ascending=False
)
changes.to_csv("outputs/all_monthly_segment_changes.csv", index=False)

top = changes.head(10).sort_values("pct_change")
ax = top.plot(
    x="segment", y="pct_change", kind="barh", legend=False, figsize=(9, 5)
)
ax.set_xlabel("Month-over-month change in paid orders (%)")
ax.set_ylabel("Segment")
ax.xaxis.set_major_formatter(PercentFormatter(1.0))
ax.set_title("Largest qualifying month-over-month increases")
plt.tight_layout()
plt.savefig("outputs/segment_changes.png", dpi=160)
```

The code validates interval structure across the entire file, then validates the relationship for every source customer-month. It constructs a complete six-month calendar for every segment, so a missing segment-month becomes an explicit zero rather than causing `shift()` to compare nonconsecutive rows. It rejects a missing reporting month, excludes pairs below the minimum threshold, and leaves changes with a zero prior count undefined.

For a workflow with mid-month changes, this code is not sufficient. Query at order level, use an interval join against the exact order timestamp, verify one segment match per order, and only then aggregate to month and segment.

## Step 7: Validate the chart before presenting it

A chart is an output, not proof. Validate it against the analysis contract:

- Do the six months match the approved complete-month calendar?
- Are all months consecutive?
- Do database totals reconcile with an independent count?
- Did every customer-month receive exactly one historical segment?
- Are both months in each comparison above the minimum threshold?
- Are zero denominators excluded rather than displayed as misleading percentages?
- Does the axis show percentage change rather than absolute order change?
- Does the output avoid personal or confidential information?

For a high-stakes report, run a second simpler check. Compare the latest-month total with a separate count query, inspect several historical segment assignments manually, and review the highest-ranked changes against the output table. Keep the SQL, file versions or hashes, script, package environment, and generated table with the chart.

If the deliverable must be an Excel workbook, a spreadsheet server may be more appropriate for the final presentation step. [sbroenne/mcp-server-excel](/mcp/sbroenne-mcp-server-excel) is described as automating Microsoft Excel on Windows, including formulas and charts, while [haris-musa/excel-mcp-server](/mcp/haris-musa-excel-mcp-server) is described as manipulating workbooks without requiring Microsoft Excel. For Google Sheets workflows, [freema/mcp-gsheets](/mcp/freema-mcp-gsheets) lists reading, editing, formatting, and chart operations. These servers have different runtime and output assumptions, so treat spreadsheet creation as a separate deployment choice from statistical computation.

## Designing the tool boundary

The cleanest architecture gives each server one responsibility:

- Database server: schema inspection and restricted reads.
- File server: approved input discovery and retrieval.
- Code server: joins, calculations, validation, and artifact generation.
- Spreadsheet server, if needed: workbook presentation and distribution.

This separation creates handoff points where the host can verify each result before continuing. The trade-off is orchestration complexity: the host must manage identifiers, file locations, response formats, approvals, and failures across server connections.

Do not expose every server to every user. An analyst may need database views and a code sandbox but not write access to shared files. A reporting process may need to write a workbook but should not be able to execute arbitrary networked code. Use separate service accounts and server configurations for those cases.

MCP clients differ in how they display tool approvals and whether they support multiple server connections, elicitation, sampling, or resource subscriptions. Build workflows around capabilities the selected host, client connections, and servers actually support. For destructive, externally visible, expensive, or sensitive operations, require explicit human approval even if automatic invocation is technically possible.

## Common failure modes

### The model guesses the schema

A plausible SQL query can still use the wrong timestamp, join, or status. Require schema inspection and show selected columns in the analysis record.

### A monthly query hides a mid-month change

Aggregating to customer-month before applying a precise historical mapping loses the information needed to assign orders correctly. Either require month-boundary segment intervals and validate them, as this workflow does, or retain order-level timestamps until after the interval join.

### Interval validation is limited to the current extract

Checking only matched rows can miss malformed intervals or overlaps outside the reporting window. Validate the complete mapping file before filtering it, then perform the source-row match check as a second safeguard.

### The result is called bounded without a truncation check

A date predicate limits the logical time range but does not necessarily limit rows or prove completeness. Configure a result limit and statement timeout through the selected implementation, and fail when truncation or cancellation is reported. If completeness cannot be established, stop rather than presenting a partial chart.

### The calendar is treated as documentation

A calendar file is useful only when it controls the expected month range. Load it in code, select the six approved complete months, check continuity, and reject missing source months.

### The chart hides a denominator problem

Percentage growth from zero is undefined, and a small segment can show a large percentage change from a trivial count. Display counts alongside percentages and apply an explicit minimum-volume rule to both months.

### The generated artifact is not reproducible

A screenshot without the underlying table and calculation rules is difficult to review. Save the script, SQL, file versions, thresholds, input references, result-limit status, and generated table with the chart.

## Next steps

Start by comparing [database MCP servers](/best/databases) and [code execution MCP servers](/best/code-execution), then choose a restricted integration from the [file systems category](/best/file-systems). For PostgreSQL deployments, review the [PostgreSQL MCP server listings](/best/postgres). If the final output belongs in a workbook, compare the spreadsheet-oriented listings and test the complete path from source selection to validated chart in a non-production environment.
