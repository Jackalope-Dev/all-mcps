---
title: "MCP Server Search: Catch Missing Results"
description: "Test MCP server search for missing results with a controlled dataset, pagination checks, and update tests before trusting an agent's answers."
author: "caden-sumner"
date: 2026-11-24
slug: "mcp-server-search-missing-results"
tags: ["Using MCP", "search completeness", "server evaluation", "AI agents"]
image: "https://app.lopebase.com/api/content/images/71ea0cb1-caf0-4499-a0ec-b35a8d795c0f/cover-cd8d20f3846868d6.png"
image_alt: "MCP Server Search: Catch Missing Results"
image_kind: "title_card"
faq: [{"q":"Does following every page prove search is complete?","a":"No. Pagination only exposes what the search operation makes retrievable. Ranking thresholds, indexing gaps, permissions, and retrieval caps can still exclude records. Compare against a known expected set and inspect the documented search contract."},{"q":"Should every MCP search server pass this test?","a":"Only require exhaustive retrieval when your task needs it. A server designed for relevant suggestions may be useful for research assistance while remaining unsuitable for an inventory of every matching record."},{"q":"Can the agent verify completeness by asking again?","a":"Repeating the same query can reproduce the same omissions. Use an independently defined expected set, source-side checks, and documented retrieval boundaries rather than treating agreement between answers as evidence."},{"q":"What if the server has no pagination?","a":"It may return the whole result set, enforce a fixed cap, or expose only top matches. Check its documentation and test beyond the initial response size. Reject it for exhaustive retrieval if you cannot establish how to obtain all required records."}]
---

Before choosing an MCP server for search, check whether your agent can retrieve every record the task requires. A convincing answer can hide missing pages, stale records, title-only search, or a result limit the agent never notices.

This evaluation targets one specific requirement: an agent that must find all matching records within an approved scope. Use a controlled dataset to distinguish a server suitable for exhaustive retrieval from one that only returns useful suggestions.

## Use this completeness test before choosing

Write the requirement as an observable outcome: “Retrieve every document containing this marker in the approved collection, excluding archived documents.” Then test the server directly before testing the agent.

| Check | Test | Evidence you need |
| --- | --- | --- |
| Search coverage | Put the marker in document bodies, outside titles | Every expected document ID appears |
| Pagination | Make the matching set larger than one response | A documented way to retrieve the remaining matches |
| Scope | Add matching documents outside the approved collection | Results stay within the requested and authorized scope |
| Updates | Add, edit, and delete controlled documents | Results reflect changes within your freshness requirement |
| Truncation | Query beyond the documented retrieval limit | The limit is detectable and compatible with the task |
| Agent behavior | Repeat the test through your intended agent | The agent retrieves the same expected set before answering |

Treat an unknown boundary as unresolved. A server that cannot explain its search coverage may still suit document discovery, but don't approve it for “find every exception” or “list all affected records.”

## Build a dataset with a known answer

Use a disposable collection in the upstream service. Don't seed evaluation records into a production collection that other agents use.

The following script generates a fixture manifest. It doesn't upload documents or configure an MCP server. Import the records through the service's supported UI or API, preserve the IDs in a searchable metadata field if possible, and record any provider-assigned IDs separately.

```python
# make_fixture.py
import json
from pathlib import Path

marker = "EVAL-COPPER-47"
records = []

for number in range(1, 13):
    records.append({
        "id": f"POL-{number:03d}",
        "title": f"Evaluation document {number:03d}",
        "body": f"Controlled search fixture. Marker: {marker}",
        "collection": "other" if number == 12 else "approved",
        "archived": number in (9, 10),
        "restricted": number == 11,
    })

Path("fixture.json").write_text(
    json.dumps(records, indent=2) + "\n",
    encoding="utf-8",
)
print("Created fixture.json")
```

Run it with:

```bash
python make_fixture.py
```

For this fixture, the expected result is `POL-001` through `POL-008`. Configure the test identity so it cannot read `POL-011`. Place `POL-012` in the other collection, and mark `POL-009` and `POL-010` as archived using the upstream service's actual fields.

The manifest fields are evaluation labels, not standard MCP configuration keys. Map them to real provider concepts. If the service has no archive state, replace that exclusion with a supported filter and update the expected set.

Keep the marker out of titles. This exposes a server that searches titles while its description leaves readers expecting full-text search. First verify through the upstream service that the test identity can access the eight expected documents.

## Inspect how the server exposes search boundaries

Search isn't a standard MCP method. A server exposes its own search tool, arguments, and result format through MCP. Inspect its tool definition and documentation before deciding how to retrieve a complete result set.

The [official MCP tools specification](https://modelcontextprotocol.io/specification/latest/server/tools) defines `tools/list`, `tools/call`, and tool input schemas. Pagination of a tool catalog does not establish pagination for the documents returned by a search tool. The search tool needs its own documented retrieval mechanism.

Record what the server actually supports: the searched fields, collection filters, archive handling, result ordering, page size, continuation mechanism, and any maximum retrievable result count. Don't infer a `cursor`, `offset`, or `limit` argument from another server's interface.

If the search tool returns ranked semantic matches, determine whether it promises exhaustive retrieval at all. A top-match search can be appropriate for finding a useful document. For a compliance inventory, choose a server with documented enumeration or exhaustive filtering instead. Following every available page of ranked results still doesn't prove that all matching source records were considered.

AllMCPs helps you find, inspect, and install MCP servers. Use it to assemble candidates for this workflow, then check each candidate's own documentation for its search and enumeration guarantees. A catalog description cannot establish completeness for your dataset.

## Compare returned IDs instead of reading the answer

Call the search tool directly with the fixture marker and the supported scope filters. Collect every available page according to the server's documentation. Save each raw response separately so you can trace missing IDs back to a particular call.

Then normalize the retrieved records into this local evidence format:

```json
{
  "ids": [
    "POL-001",
    "POL-002",
    "POL-003",
    "POL-004",
    "POL-005",
    "POL-006",
    "POL-007",
    "POL-008"
  ]
}
```

This file is your test artifact, not an MCP response schema. Use a small adapter or manual extraction to map the server's actual document identifiers to the fixture IDs. Don't ask the agent to reconstruct the evidence from its own summary.

Save the file as `observed.json`, then run:

```python
# check_results.py
import json
from collections import Counter
from pathlib import Path

expected = {f"POL-{number:03d}" for number in range(1, 9)}
observed = json.loads(
    Path("observed.json").read_text(encoding="utf-8")
)["ids"]
counts = Counter(observed)

missing = sorted(expected - set(observed))
unexpected = sorted(set(observed) - expected)
duplicates = sorted(key for key, count in counts.items() if count > 1)

print("Missing:", missing)
print("Unexpected:", unexpected)
print("Duplicates:", duplicates)

raise SystemExit(1 if missing or unexpected or duplicates else 0)
```

```bash
python check_results.py
```

Duplicates deserve investigation, but their interpretation depends on the documented contract. Some retrieval systems return overlapping pages; others promise distinct records. Deduplicate by stable ID when appropriate, while keeping the raw evidence of overlap.

Machine-readable identifiers make this test easier. If a candidate exposes structured results, inspect whether its fields support reliable extraction. The [structured tool output guide](https://allmcps.com/blog/mcp-structured-tool-output) explains the MCP fields involved; structured output alone does not prove complete search coverage.

## Force pagination and expose hidden limits

The initial fixture may fit in one response. If the tool supports a configurable page size, use a supported value smaller than the expected set. Otherwise, expand the fixture until the matches exceed one documented page. Don't invent a page-size argument.

Follow continuation values exactly as the server documents. Keep the query, filters, identity, and relevant ordering unchanged between requests unless the documented contract says otherwise. Record each request alongside its response.

Check for three distinct outcomes: all expected IDs arrive, pagination ends before they arrive, or pagination cannot progress. A repeated continuation value or repeated page is evidence of a problem to investigate, not a reason to keep calling indefinitely.

Also distinguish a page size from a retrieval cap. A tool may return small pages yet permit access to only a bounded number of matches. If your production task can exceed that cap, prefer another retrieval path unless documented partitioning can cover the entire dataset without gaps.

Keep this baseline dataset unchanged during the pagination test. Concurrent writes introduce a separate question about consistency between pages. Test that later if the real task requires a stable snapshot while records change.

## Test additions, edits, and deletions separately

Once baseline retrieval passes, change one thing at a time and record the source change time and observation time. Keep the query and test identity fixed.

First add `POL-013` as an accessible, non-archived document in the approved collection, with the marker in its body. The expected set gains that ID. Next, remove the marker from `POL-003`; the expected set loses that ID. Finally, delete `POL-008`; it should disappear according to the candidate's documented deletion behavior and your freshness requirement.

Repeat the same retrieval procedure after each change. Preserve the intermediate evidence rather than checking only the final state. Otherwise, an addition failure and a deletion failure could leave the result count looking correct.

If search uses an index, ask how changes reach that index and what freshness guarantees exist. Set your acceptable delay before evaluating candidates. Don't convert an observed delay in a small test into a general service guarantee.

Treat failures separately from empty results. A timeout or upstream error leaves the answer unknown. The [MCP error handling guide](https://allmcps.com/blog/mcp-server-error-handling-protocol-tool-errors) explains how protocol and tool errors differ. Your evaluation should preserve those failures rather than recording them as “no matches.”

## Approve the retrieval path before enabling the agent

After direct tool calls pass, repeat the baseline through your intended agent. Ask it to return every matching document ID and its source reference. Compare that set with the same expected IDs.

If direct calls succeed but the agent stops after one page, investigate the agent's tool use, instructions, and continuation handling. Switching servers may be unnecessary. If direct calls omit records, changing the prompt won't establish a reliable retrieval contract.

For a remote candidate, use the [MCP Inspector acceptance checklist](https://allmcps.com/blog/mcp-inspector-remote-server-checklist) for the connection-level checks. Keep the completeness evidence as a separate approval artifact.

Record the server package revision or endpoint, test date, identity, query, filters, expected IDs, raw responses, and observed freshness. Approve a bounded use case: the dataset size, filters, and freshness requirement you tested. Rerun the fixture after a server update or a material change to search behavior.

## FAQ

### Does following every page prove search is complete?

No. Pagination only exposes what the search operation makes retrievable. Ranking thresholds, indexing gaps, permissions, and retrieval caps can still exclude records. Compare against a known expected set and inspect the documented search contract.

### Should every MCP search server pass this test?

Only require exhaustive retrieval when your task needs it. A server designed for relevant suggestions may be useful for research assistance while remaining unsuitable for an inventory of every matching record.

### Can the agent verify completeness by asking again?

Repeating the same query can reproduce the same omissions. Use an independently defined expected set, source-side checks, and documented retrieval boundaries rather than treating agreement between answers as evidence.

### What if the server has no pagination?

It may return the whole result set, enforce a fixed cap, or expose only top matches. Check its documentation and test beyond the initial response size. Reject it for exhaustive retrieval if you cannot establish how to obtain all required records.
