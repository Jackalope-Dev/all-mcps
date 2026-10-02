---
title: "MCP Tool Input Schema Design for Accurate Tool Calls"
excerpt: "Design MCP tool input schemas that models can use accurately, with practical guidance on enums, required fields, property descriptions, and object shapes."
tags: ["MCP", "Developer Tools", "Guides", "Architecture"]
faq:
  - q: "What should an MCP tool input schema contain?"
    a: "An MCP tool input schema should describe an object containing the tool's named arguments. Include explicit properties, suitable JSON types, descriptions for ambiguous values, required fields for indispensable arguments, and enums for finite choices. Add constraints such as ranges or lengths when they reflect real server validation, but always validate the received arguments again at runtime."
  - q: "Should every MCP tool parameter be required?"
    a: "No. Mark a parameter as required only when the operation cannot be performed safely or unambiguously without it. Optional fields should have a documented default or omission behavior. Making every field required creates unnecessary clarification and guessing, while omitting a genuinely necessary field can cause the server to infer the wrong target."
  - q: "Why are enums useful in MCP tool schemas?"
    a: "Enums give the model an exact set of accepted values for a finite choice. They reduce variations such as descending, desc, and reverse when the server accepts only one token. Enums also help clients render controls and make validation errors clearer. Do not use them for values such as search terms or user-defined labels."
  - q: "Can MCP tool arguments be a top-level array?"
    a: "MCP tool calls use an arguments object, so tools should expose an object at the call boundary rather than designing a top-level array input. If a tool processes multiple values, put the array in a named property such as items, files, or records. This keeps each argument addressable and makes the contract clearer to models and clients."
---

MCP tool input schema design directly affects how reliably a model chooses arguments and how safely a server executes them. A good schema exposes an object with named properties, precise descriptions, enums for finite choices, and a carefully chosen required list; it avoids vague free-form objects that leave the model guessing. The schema guides tool calls, but it is not a substitute for server-side validation.

## What an MCP tool input schema does

An MCP server exposes tools with metadata that includes a name, description, and `inputSchema`. The input schema describes the arguments object expected by the tool. A client can provide that metadata to a model, render controls from it, or use it when preparing a tool call. When the model calls the tool, the call carries an arguments object whose keys correspond to the schema's properties.

A minimal definition looks like this:

```json
{
  "name": "get_weather",
  "description": "Get the current weather for a city.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "City name, such as London or Tokyo."
      }
    },
    "required": ["city"]
  }
}
```

The schema has two audiences. The model uses names, descriptions, and constraints to construct a call. The server uses the same contract to validate and interpret the received arguments. A schema can be valid JSON Schema and still be a poor model-facing interface if its fields are vague, its defaults are hidden, or its accepted values are unclear.

For broader protocol context, see [What is Model Context Protocol?](/what-is-mcp). This article focuses on argument contracts rather than discovery, transports, authentication, or tool selection.

## Expose an object at the MCP call boundary

MCP tool arguments should be represented as an object or map of named arguments. A standalone JSON Schema can describe many JSON shapes, including an array, but that does not make a top-level array an appropriate MCP tool input design. Put collections inside a named property instead:

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "description": "Workspace-relative files to process.",
      "items": {
        "type": "string",
        "description": "Path to one file."
      },
      "minItems": 1
    }
  },
  "required": ["items"]
}
```

This shape gives each argument a stable name and lets the model distinguish a list of files from other inputs such as an output format or processing mode. It also gives client interfaces a predictable object to inspect. The array belongs inside `items`; it should not be the entire tool input.

Use explicit properties for ordinary operations:

```json
{
  "type": "object",
  "properties": {
    "repository": {
      "type": "string",
      "description": "Repository in owner/name form, for example octo/example."
    },
    "issue_number": {
      "type": "integer",
      "description": "Issue number, not a pull request URL."
    },
    "include_comments": {
      "type": "boolean",
      "description": "Whether to include issue comments in the result."
    }
  },
  "required": ["repository", "issue_number"]
}
```

Named properties reduce ambiguity. The model can distinguish an issue number from a URL, a repository identifier from a local path, and a boolean preference from a natural-language instruction. Developers can also inspect and log the arguments without reverse-engineering a positional or opaque value.

## Write descriptions for the decision the model must make

Property descriptions are model-facing documentation, not decorative comments. They supply context at the point where the model decides what value belongs in a field. Describe the expected meaning, representation, units, and important boundaries.

A weak schema leaves too many decisions implicit:

```json
{
  "properties": {
    "path": { "type": "string" },
    "format": { "type": "string" },
    "limit": { "type": "integer" }
  }
}
```

A more useful schema explains the decisions:

```json
{
  "properties": {
    "path": {
      "type": "string",
      "description": "Workspace-relative path to the file to parse; absolute paths are not accepted."
    },
    "format": {
      "type": "string",
      "description": "Output representation requested by the caller."
    },
    "limit": {
      "type": "integer",
      "description": "Maximum number of records to return; defaults to 100 when omitted."
    }
  }
}
```

A useful description answers questions that a type alone cannot answer:

- Is an identifier a name, URL, UUID, or provider-specific ID?
- Is a path absolute, relative, or URI-encoded?
- Are timestamps ISO 8601 strings, Unix seconds, or milliseconds?
- Is a number a count, percentage, currency amount, or byte size?
- What does omission mean?
- Does an empty string differ from an omitted property?
- Does the field identify a target, or merely filter results?

Put the operational distinction in the description rather than repeating the property name. For example, “Sort order” is less useful than “Order results by relevance, newest creation time, or oldest creation time.” Keep the description consistent with the implementation. If the server accepts both an ID and a URL, document both forms or expose separate fields.

Tool-level descriptions help a model choose between tools, while property descriptions help it fill in the selected tool. The guide to [writing MCP tool descriptions](/blog/writing-mcp-tool-descriptions-that-work) covers selection-oriented wording; use it alongside a precise argument contract.

## Use enums for finite, stable choices

An enum is appropriate when the server accepts a closed set of stable values:

```json
{
  "type": "object",
  "properties": {
    "sort": {
      "type": "string",
      "enum": ["relevance", "newest", "oldest"],
      "description": "Result ordering. Use relevance unless the user requests a time-based order."
    },
    "visibility": {
      "type": "string",
      "enum": ["public", "private", "all"],
      "description": "Repository visibility categories to include."
    }
  },
  "required": ["sort"]
}
```

Enums improve tool-call accuracy because the model can copy an allowed protocol token instead of inventing a synonym. They reduce spelling variations, make validation errors actionable, and may allow a client to render a select control. Pair the enum with a description explaining what the choices do; the tokens alone may not communicate their operational difference.

Do not use an enum for an open-ended value such as a search term, branch name, user-defined label, or query expression. An enum that becomes stale is worse than no enum: it tells the model that valid values are impossible even after the backend has expanded.

Use stable machine values and human-readable descriptions. For example, `production` and `staging` are generally clearer than numeric mode codes. If the accepted values change frequently, consider whether a separate discovery tool or resource is more appropriate than embedding a volatile list in every schema.

## Choose required fields deliberately

The `required` array names properties that must be present in the arguments object. It does not guarantee that a string is non-empty or that a number is within an operationally safe range. Those conditions require additional schema constraints and runtime checks.

Require values needed to identify the operation or remove meaningful ambiguity:

```json
{
  "type": "object",
  "properties": {
    "environment": {
      "type": "string",
      "enum": ["staging", "production"]
    },
    "service": {
      "type": "string",
      "description": "Deployable service name."
    },
    "version": {
      "type": "string",
      "description": "Immutable release tag or commit SHA."
    },
    "dry_run": {
      "type": "boolean",
      "description": "Show planned changes without applying them; defaults to true."
    }
  },
  "required": ["environment", "service", "version"]
}
```

Do not require a field merely because the implementation has a default. A `dry_run` flag with a documented default can be optional. Requiring it adds friction and may cause the model to guess a value the user never specified.

The opposite mistake is leaving a necessary field optional and hoping the server will infer it. If a tool needs a target account, workspace, or resource ID, require it unless there is exactly one safe and well-defined default. Ambiguous defaults can produce a valid-looking call against the wrong resource.

Presence is not the same as user intent. A model may supply a default-looking value even when the user did not state it. For destructive operations, combine required fields with authorization, confirmation, and runtime checks. [MCP tool annotations](/blog/mcp-tool-annotations-readonly-destructive-hints) explains how read-only and destructive hints communicate additional semantics to clients.

## Avoid free-form objects for known operations

A free-form input often looks like this:

```json
{
  "type": "object",
  "additionalProperties": true
}
```

Or it omits `properties` and accepts arbitrary key-value pairs. That can be appropriate for a genuine metadata bag, pass-through configuration, or extensibility boundary. It is a poor default for a tool whose operation is known in advance.

Free-form inputs force the model to infer which keys exist, which keys are required, what each value means, and whether values are strings, numbers, arrays, or nested objects. The result may be syntactically valid but semantically unusable. A misspelled sensitive field can also be silently ignored and trigger an unsafe fallback.

Prefer explicit properties for the stable part of the contract:

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search expression."
    },
    "filters": {
      "type": "object",
      "description": "Optional filters supported by the search backend.",
      "properties": {
        "language": { "type": "string" },
        "updated_after": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    }
  },
  "required": ["query"],
  "additionalProperties": false
}
```

Setting `additionalProperties` to `false` makes typos visible and creates a tighter contract. However, compatibility requirements vary by client, validator, and schema evolution strategy. Some integrations may send fields introduced by a newer version, so test the complete client path before enforcing a closed object. Regardless of the setting, the server should have a documented policy for unknown keys and should not silently reinterpret them.

A useful compromise for evolving tools is to keep the primary operation explicit while placing genuinely extensible data under one named property, such as `metadata`. Validate that extension area separately rather than making every argument free-form.

## Model optionality, defaults, and null values

An omitted property and a property set to `null` are different JSON inputs. Support both only when they have distinct, intentional meanings. If `null` is not meaningful, do not imply that it is accepted merely because the field is optional.

Document defaults in descriptions and implement the same defaults on the server:

```json
{
  "type": "object",
  "properties": {
    "page_size": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "description": "Number of results to return; defaults to 25 when omitted."
    },
    "include_archived": {
      "type": "boolean",
      "description": "Include archived records; defaults to false."
    }
  }
}
```

Be especially careful with optional booleans and numbers. The values `false` and `0` are meaningful and must not be treated as absent by implementation code. Prefer explicit presence checks over truthiness checks when applying defaults.

Constraints such as `minimum`, `maximum`, `minLength`, `pattern`, and `format` can improve guidance and validation. Support and enforcement vary across JSON Schema implementations and clients, so treat them as part of a layered contract rather than assuming every consumer enforces them.

## Validate every call at the server boundary

A model can produce arguments that do not satisfy the schema. A client can transform or ignore parts of the schema. A direct caller can bypass the model entirely. Validate arguments immediately before business logic or side effects.

A robust validation path checks:

1. The arguments value is an object when the tool expects an object.
2. Required properties are present.
3. Primitive types match the implementation.
4. Strings are non-empty where required and follow identifier rules.
5. Numeric values stay within safe operational bounds.
6. Enum values are supported by the current server version.
7. Paths, URLs, resource IDs, and account identifiers are authorized.
8. Unknown properties are rejected or handled according to a documented policy.

Return an actionable tool error instead of silently applying a fallback to an unintended target. Identify the invalid field and accepted shape, but do not expose credentials, internal paths, or sensitive policy details.

JSON Schema also cannot express every security rule. It cannot decide whether a caller may access a repository, whether a deployment is authorized, or whether a particular resource belongs to the current tenant. Enforce those rules after structural validation and before the operation runs. See [securing remote MCP servers](/blog/securing-remote-mcp-servers-authentication-guide) for authentication and authorization concerns, and [architecting production-ready MCP servers](/blog/architecting-production-mcp-servers) for broader server design patterns.

## Test accuracy, not just schema validity

A schema validator can confirm that a JSON document has the right shape, but it cannot tell you whether a model will choose the right resource or interpret a description correctly. Test the complete path from user request to generated arguments to server result.

Include cases for:

- A clear request that should produce one valid call
- A request missing a genuinely required value
- Ambiguous identifiers such as a name versus a URL
- Every enum option
- An omitted optional property
- Explicit `false`, `0`, and empty-string values
- An invalid enum token
- An unknown property
- A boundary number and an over-limit number
- A request that should trigger clarification rather than guessing
- A valid-looking identifier that belongs to the wrong account or environment

Inspect both the generated arguments and the server response. When a model repeatedly chooses the wrong value, first ask whether the field name, description, enum, or required list makes the intended decision explicit. Splitting a multi-mode tool into two focused tools can be more effective than adding another conditional property.

Use the [MCP config validator](/tools/config-validator) where it applies to your configuration workflow, and follow the patterns in [testing and debugging MCP servers](/blog/testing-and-debugging-mcp-servers) for inspection and CI. Test with each target client because schema rendering and enforcement are client-dependent.

## A practical schema review checklist

Before publishing a tool, ask:

- Is the MCP call boundary an object with named properties?
- Are lists nested under a descriptive property such as `items` or `files`?
- Does every property have the correct type and a useful description?
- Are finite choices represented with exact enum values?
- Are only truly necessary fields in `required`?
- Are defaults documented and implemented consistently?
- Are paths, IDs, units, timestamps, and formats unambiguous?
- Is a free-form object genuinely necessary?
- Have unknown properties and null values been considered?
- Are schema constraints backed by runtime validation?
- Could a valid-looking value still target the wrong resource?
- Have calls been tested with the clients that will expose the tool?

Small, explicit schemas are usually easier for models and developers than flexible schemas with many conditional fields. If a tool has unrelated modes, consider splitting it into focused tools so each input contract is narrower and the model has clearer choices. For larger catalogs, consistent names and shapes also make tools easier to compare and discover; [SonAIengine graph-tool-call](/mcp/sonaiengine-graph-tool-call) is one example of a directory listing focused on contract-aware tool retrieval and dependency resolution.

## Next steps

Review the schemas of the MCP servers you operate and replace ambiguous fields with named properties, descriptions, and enums where appropriate. Then test representative calls through your target clients and add server-side validation for every side-effecting operation. For broader implementation guidance, read [production MCP server architecture](/blog/architecting-production-mcp-servers), inspect specialized listings such as [n8n-mcp](/mcp/n8n-mcp) and [Diagrams MCP](/mcp/diagrams-mcp), and compare MCP server options in the [MCP directory](/what-is-mcp).
