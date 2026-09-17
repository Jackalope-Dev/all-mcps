---
title: "Multi Round-Trip Requests: Porting MCP Servers Off Server-Initiated Calls"
excerpt: "The 2026-07-28 revision removed a server's ability to send its own JSON-RPC request mid-tool-call. MRTR replaces sampling, elicitation, and roots with a resumable input_required result. Here is how to port a real server, what requestState has to carry, and how to sign it so the round trip is safe."
tags: ["MCP", "Developer Tools", "Architecture", "Guides"]
faq:
  - q: "What is a Multi Round-Trip Request (MRTR) in MCP?"
    a: "MRTR is the pattern that replaced server-initiated requests in the 2026-07-28 protocol revision. Instead of pausing mid-execution to send the client its own JSON-RPC request, a server answers the client's original request with a result whose resultType is input_required, containing an inputRequests map describing what it still needs and an opaque requestState string. The client gathers that input and retries the same original request under a new JSON-RPC id, supplying an inputResponses map plus the exact requestState it was handed."
  - q: "Which MCP requests are allowed to return input_required?"
    a: "Only tools/call, resources/read, and prompts/get. Every other method must return a complete result or an error. A server also cannot include an inputRequests entry for a capability the client did not declare on that request, so asking a client without elicitation support for an elicitation answer is a protocol violation rather than a graceful degradation."
  - q: "What is requestState and is the client allowed to read it?"
    a: "requestState is a server-minted opaque string carrying everything the server needs to resume the interrupted request. The client treats it as a blob: it stores it, echoes it back verbatim on the retry, and never parses or modifies it. Because the server encodes its own resumption state there rather than holding it in memory, a load balancer can route the retry to a completely different instance and that instance can still finish the job."
  - q: "Does MRTR mean sampling and elicitation are gone?"
    a: "No. Sampling, elicitation, and roots are deprecated as client capabilities but still function during the deprecation window, which MCP's feature lifecycle policy sets at a minimum of twelve months. What changed is the delivery mechanism: the same sampling/createMessage and elicitation/create payloads now travel inside an inputRequests map instead of as standalone server-to-client requests. Roots is the one worth retiring outright rather than porting."
  - q: "How do I keep supporting clients that still expect server-initiated requests?"
    a: "Detect the era once per server connection rather than per request. Modern clients send io.modelcontextprotocol/protocolVersion in every request's _meta; legacy clients complete an initialize handshake and never send that field. Branch at the point where your tool needs external input: emit an InputRequiredResult for modern callers and fall back to the legacy server-initiated request for the rest, with the values arriving through one shared code path either way."
---

> **TL;DR:** Under the legacy MCP handshake, a server could stop halfway through a tool call and send the client its own JSON-RPC request — `sampling/createMessage` for model reasoning, `elicitation/create` for user input, `roots/list` for workspace boundaries. The [2026-07-28 revision](/mcp-protocol-versioning) removed that ability, because it only ever worked on a stateful two-way channel. **Multi Round-Trip Requests (MRTR)** replace it: the server answers the *original* request with `resultType: "input_required"`, an `inputRequests` map, and an opaque `requestState` blob. The client collects the answers and retries the same request under a new id, carrying `inputResponses` and the untouched `requestState`. This guide covers the exchange end to end, what belongs inside `requestState`, how to port an elicitation-based and a sampling-based tool, why roots deserves deletion rather than migration, and the integrity rules that keep a resumable server from becoming a replay target.

Everything written about MCP's bidirectional primitives — including our own guides to [sampling](/blog/how-mcp-sampling-works-guide) and [elicitation](/blog/mcp-elicitation-user-input-guide) — describes the same control inversion. Your tool handler is running. It discovers it needs something it does not have. It sends the client a request, `await`s the answer inline, and continues from where it stopped.

That is a genuinely elegant model, and it is the one most SDK examples still show. It also quietly assumes something that stopped being true the moment MCP servers moved off the desktop: that there is a persistent, addressable, two-way connection the server can write to whenever it feels like it.

---

## Why Server-Initiated Requests Broke on the Way to Production

On stdio, the assumption holds perfectly. One client, one process, one pipe, both directions. The server writes a request to stdout, the client answers on stdin, and the `await` resolves inside the same function invocation that started it.

Now put that same server behind a load balancer, which is what [deploying a remote MCP server](/blog/deploying-remote-mcp-servers-production-guide) actually looks like:

- The tool call arrives at instance A, which begins executing.
- Instance A needs a confirmation from the user, so it holds an open promise and its entire in-memory execution state — half-built query, open transaction, fetched intermediate results — waiting for a reply.
- The reply is a new HTTP interaction. It lands on instance B.
- Instance B has never heard of this request. Instance A is still holding a promise that will now never resolve, along with everything attached to it.

The workarounds were all bad in the same way. Sticky sessions pin a conversation to one box and turn every deploy into dropped work. Shared session state in Redis means every server author hand-rolls a distributed resumption layer. Long-lived SSE streams keep a socket open per in-flight call and fall apart the first time a proxy decides sixty seconds is long enough — the same class of failure covered in the [progress notifications guide](/blog/mcp-progress-notifications-subscriptions-guide), except unrecoverable rather than merely ugly.

The revision's answer was to stop treating "I need more input" as a pause in an ongoing computation, and start treating it as a complete, honest reply that happens to say *not yet*.

---

## The Exchange, End to End

MRTR is three messages instead of one, and the server holds nothing between them.

### 1. The Original Request

Nothing special. A normal `tools/call` carrying the per-request `_meta` the revision requires:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "deploy_service",
    "arguments": { "service": "checkout-api" },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": { "elicitation": {} },
      "io.modelcontextprotocol/clientInfo": { "name": "ExampleClient", "version": "2.1.0" }
    }
  }
}
```

The `clientCapabilities` field is the part server authors keep skipping. It is per-request now, not per-session, and it is the only thing that tells you whether asking for an elicitation answer is legal on this particular call.

### 2. The InputRequiredResult

The server cannot finish, so it replies — a real JSON-RPC result, not an error, not a stream:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "target_env": {
        "method": "elicitation/create",
        "params": {
          "message": "Deploy checkout-api — which environment?",
          "requestedSchema": {
            "type": "object",
            "properties": {
              "environment": {
                "type": "string",
                "enum": ["staging", "production"],
                "description": "Deployment target"
              }
            },
            "required": ["environment"]
          }
        }
      }
    },
    "requestState": "v1.eyJzdGVwIjoiYXdhaXRpbmdfZW52IiwiZXhwIjoxNzk...<mac>"
  }
}
```

The `params` inside each `inputRequests` entry are byte-for-byte the payloads you already know. An elicitation request is still a message plus a flat, primitive-only `requestedSchema`. A sampling request is still `messages`, `maxTokens`, and `modelPreferences`. The envelope changed; the payloads did not.

### 3. The Retry

The client renders the form, gets an answer, and re-sends **the same request** — same method, same arguments — under a new `id`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "deploy_service",
    "arguments": { "service": "checkout-api" },
    "inputResponses": {
      "target_env": {
        "action": "accept",
        "content": { "environment": "staging" }
      }
    },
    "requestState": "v1.eyJzdGVwIjoiYXdhaXRpbmdfZW52IiwiZXhwIjoxNzk...<mac>",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": { "elicitation": {} }
    }
  }
}
```

The keys in `inputResponses` match the keys the server chose in `inputRequests`. That is the whole correlation mechanism — no request ids to track, no promise map, no timers.

The rules worth memorising:

| Rule | Detail |
| :--- | :--- |
| **Eligible methods** | Only `tools/call`, `resources/read`, and `prompts/get` may return `input_required`. |
| **Capability gate** | A server must not request an input type the client did not declare on *that* request. |
| **Round count** | Not limited to two. A server may return `input_required` again after a retry, as long as each round makes progress. |
| **State ownership** | `requestState` is minted by the server, opaque to the client, and echoed back unread. |
| **Idempotency** | Side effects belong *after* the last input arrives. A retried request must not double-charge, double-send, or double-deploy. |

---

## What requestState Actually Has to Carry

This is where ports go wrong. `requestState` is not a session id — if it were, you would be back to shared session storage and nothing would have improved. It is a self-contained continuation: everything the next instance needs, travelling with the request.

In practice that means four things:

1. **A resume point.** Which step of your handler was interrupted. A small enum or step name, not a serialized closure.
2. **Work already completed.** The expensive results you do not want to recompute — a resolved account id, a validated payload, a row count. Keep it small; this string crosses the wire twice per round.
3. **A binding to the original request.** A hash of the method, tool name, and arguments. Without it, a client can hand you state minted for `delete_records` while calling `deploy_service`.
4. **An expiry.** A continuation that is valid forever is a token that is valid forever.

What must *not* go in there is anything you would not hand to the user, because you effectively are. `requestState` transits a client you do not control, and the spec is explicit that servers must treat it as attacker-controlled input on the way back. No raw credentials, no unsigned authorization decisions, no internal hostnames you would rather not publish. If it influences who can do what, it needs integrity protection — the same trust-boundary reasoning that governs [remote MCP authentication](/blog/securing-remote-mcp-servers-authentication-guide).

A workable shape, framework-agnostic:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

const STATE_SECRET = process.env.MCP_STATE_SECRET!; // 32+ random bytes
const STATE_TTL_MS = 5 * 60 * 1000;

type Continuation = {
  step: string;
  bind: string; // hash of method + tool name + arguments
  data: Record<string, unknown>;
  exp: number;
};

function sign(payload: Continuation): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', STATE_SECRET).update(body).digest('base64url');
  return `v1.${body}.${mac}`;
}

function verify(state: string, expectedBind: string): Continuation {
  const [version, body, mac] = state.split('.');
  if (version !== 'v1' || !body || !mac) throw new Error('Malformed requestState');

  const expected = createHmac('sha256', STATE_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('requestState signature mismatch');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Continuation;
  if (Date.now() > payload.exp) throw new Error('requestState expired');
  if (payload.bind !== expectedBind) throw new Error('requestState bound to a different request');

  return payload;
}
```

Use AEAD (`crypto.createCipheriv` with `aes-256-gcm`, or your platform's sealed-box primitive) instead of a plain HMAC when the continuation carries anything the user should not read. An HMAC proves you minted it; it does nothing to hide it.

---

## Porting an Elicitation Tool

Here is the legacy shape, the one from the [elicitation guide](/blog/mcp-elicitation-user-input-guide) — a single function that stops in the middle:

```typescript
// Legacy: still supported during the deprecation window, but not where new code starts.
const answer = await server.elicitInput({
  message: `Deploy "${service}" — which environment?`,
  requestedSchema: { /* ... */ },
});
if (answer.action !== 'accept') return declined();
const result = await runDeploy(service, answer.content.environment);
```

The MRTR version is the same logic turned inside out: one handler, entered twice, branching on whether the answer is already present.

```typescript
async function deployService(args: { service: string }, ctx: RequestContext) {
  const bind = bindHash('tools/call', 'deploy_service', args);
  const answer = ctx.inputResponses?.target_env;

  // First pass: no answer yet, so ask for one and hand back a continuation.
  if (!answer) {
    if (!ctx.clientCapabilities.elicitation) {
      return text(
        'This client cannot show a confirmation form. Ask the user which environment ' +
          `(staging or production) to deploy "${args.service}" to, then call deploy_service ` +
          'again with an "environment" argument.',
      );
    }

    const plan = await buildDeployPlan(args.service); // the expensive part, done once

    return {
      resultType: 'input_required' as const,
      inputRequests: {
        target_env: {
          method: 'elicitation/create',
          params: {
            message: `Deploy "${args.service}" — which environment?`,
            requestedSchema: {
              type: 'object',
              properties: {
                environment: {
                  type: 'string',
                  enum: ['staging', 'production'],
                  description: 'Deployment target',
                },
              },
              required: ['environment'],
            },
          },
        },
      },
      requestState: sign({
        step: 'awaiting_env',
        bind,
        data: { planId: plan.id, digest: plan.digest },
        exp: Date.now() + STATE_TTL_MS,
      }),
    };
  }

  // Second pass: verify the continuation before trusting a single field of it.
  const cont = verify(ctx.requestState ?? '', bind);
  if (cont.step !== 'awaiting_env') throw new Error('Unexpected continuation step');

  if (answer.action !== 'accept') {
    return text(`Deployment ${answer.action === 'decline' ? 'declined' : 'cancelled'} by user.`);
  }

  const { environment } = answer.content as { environment: string };
  if (environment !== 'staging' && environment !== 'production') {
    return text('Unrecognised environment. Nothing was deployed.');
  }

  const result = await runDeploy(args.service, environment, cont.data.planId as string);
  return text(`Deployed ${args.service} to ${environment}: ${result.url}`);
}
```

Four things carried over from the legacy version, and they all still matter:

- The **capability check** happens before the request is built, not after it fails.
- All three actions — `accept`, `decline`, `cancel` — get distinct handling. A dismissed dialog is still not consent, and MRTR does nothing to change that.
- The returned `content` is **validated**, because it arrives from outside your process.
- The side effect (`runDeploy`) happens strictly after the last answer lands, so a duplicated retry cannot deploy twice.

What is new is `bind` and the step check. In the legacy model, the execution context *was* the proof that these two halves belonged together. Now that proof has to be explicit and cryptographic, because the two halves may run on different machines minutes apart.

---

## Porting a Sampling Tool

Sampling ports the same way, and Python's structural pattern matching suits it well. The thing to watch is size: sampling results can be large, so resist the urge to stuff one into the next `requestState`.

```python
import time
from dataclasses import dataclass


@dataclass
class Continuation:
    step: str
    bind: str
    data: dict
    exp: float


async def summarize_incidents(args: dict, ctx) -> dict:
    bind = bind_hash("tools/call", "summarize_incidents", args)
    reply = (ctx.input_responses or {}).get("summary")

    if reply is None:
        incidents = await fetch_incidents(args["since"])
        if not incidents:
            return text("No incidents in that window.")

        if "sampling" not in ctx.client_capabilities:
            # Degrade instead of failing: hand back the raw data and let the host model work.
            return text(render_incident_digest(incidents))

        return {
            "resultType": "input_required",
            "inputRequests": {
                "summary": {
                    "method": "sampling/createMessage",
                    "params": {
                        "messages": [
                            {
                                "role": "user",
                                "content": {
                                    "type": "text",
                                    "text": render_incident_digest(incidents),
                                },
                            }
                        ],
                        "systemPrompt": "Summarise these incidents in three bullets. No preamble.",
                        "maxTokens": 400,
                    },
                }
            },
            "requestState": sign(
                Continuation(
                    step="awaiting_summary",
                    bind=bind,
                    # An id, not the payload. The digest is rebuildable; the blob is not free.
                    data={"digest_key": cache_digest(incidents)},
                    exp=time.time() + 300,
                )
            ),
        }

    cont = verify(ctx.request_state, bind)
    if cont.step != "awaiting_summary":
        raise ValueError("Unexpected continuation step")

    match reply:
        case {"action": "accept", "content": {"text": str(summary)}}:
            await record_summary(cont.data["digest_key"], summary)
            return text(summary)
        case {"action": "decline"} | {"action": "cancel"}:
            return text("Summary not generated. The raw incident list is still available.")
        case _:
            return text("Unusable sampling response. Nothing was recorded.")
```

Note the fallback in the first branch. A client without sampling support does not get an error — it gets the raw data and lets its own model do the work. That degradation path was good practice under the legacy protocol and is close to mandatory now, since capabilities are declared per request and can legitimately differ between two calls from the same client.

---

## Roots: Delete It Rather Than Port It

Sampling and elicitation ask for things nothing else can supply — model reasoning, and a human decision. Roots never did. It answered "which directories am I allowed to touch?", and the revision's guidance is not to migrate it but to retire it: pass directories and files as ordinary tool arguments, as resource URIs, or as server configuration.

That is a better design regardless of protocol version, for a reason that has nothing to do with statelessness. A root fetched at runtime is an *authorization* answer sourced from the caller. A path supplied as a tool argument is an ordinary parameter you validate like any other — canonicalise it, confirm it sits under an allowlist you configured, reject traversal — which is exactly the least-privilege posture [production MCP architecture](/blog/architecting-production-mcp-servers) calls for anyway.

If you genuinely need workspace context, take it as configuration at startup:

```json
{
  "mcpServers": {
    "repo-tools": {
      "command": "npx",
      "args": ["-y", "repo-tools-mcp"],
      "env": { "ALLOWED_ROOTS": "/Users/me/work/api,/Users/me/work/web" }
    }
  }
}
```

The server now knows its boundaries before the first request, needs no round trip to discover them, and cannot be talked into widening them mid-call.

---

## Asking for Several Things at Once

`inputRequests` is a map, not a single entry, and that is deliberate. If your tool needs three answers, ask for all three in one result rather than burning three round trips:

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "target_env": { "method": "elicitation/create", "params": { "message": "Which environment?" } },
    "changelog": { "method": "sampling/createMessage", "params": { "maxTokens": 300 } }
  },
  "requestState": "v1.eyJzdGVwIjoiYXdhaXRpbmdfYm90aCJ9...<mac>"
}
```

The client resolves both — a form and a completion — and returns both keys in `inputResponses`. Ask for everything you can determine you need at the same decision point, and save additional rounds for genuine dependencies, where the second question only makes sense once you know the answer to the first.

Treat partial responses as normal, too. A client may return `accept` for one key and `cancel` for another. Handle each key on its own terms instead of testing whether the map is non-empty.

---

## Supporting Both Eras

Most servers will need to answer legacy and modern callers for a while. Detect once, per connection, not per call — the detection rules for [stdio and Streamable HTTP](/mcp-protocol-versioning) are the reliable ones, and the result should be cached for the life of the process or origin.

The structure that keeps this from doubling your code is to isolate the *asking*, not the tool:

```typescript
type Asked<T> = { kind: 'answered'; value: T } | { kind: 'pending'; result: unknown };

async function askEnvironment(ctx: RequestContext, service: string): Promise<Asked<string>> {
  if (ctx.era === 'legacy') {
    const answer = await ctx.server.elicitInput({ /* same payload */ });
    return answer.action === 'accept'
      ? { kind: 'answered', value: answer.content.environment as string }
      : { kind: 'answered', value: '' };
  }

  const supplied = ctx.inputResponses?.target_env;
  if (supplied) {
    return {
      kind: 'answered',
      value: supplied.action === 'accept' ? (supplied.content.environment as string) : '',
    };
  }
  return { kind: 'pending', result: buildInputRequired(ctx, service) };
}
```

One asking function, two transports, one tool body reading `kind`. When the deprecation window closes, you delete the legacy branch and nothing above it changes.

---

## Migration Checklist

Before shipping a server on the modern revision:

- [ ] **Eligible methods only:** `input_required` is returned exclusively from `tools/call`, `resources/read`, and `prompts/get`.
- [ ] **Capabilities read per request:** every `inputRequests` entry corresponds to something declared in that request's `_meta`.
- [ ] **requestState is integrity-protected:** HMAC or AEAD, with an expiry and a binding to the original method and arguments.
- [ ] **requestState is verified before use:** signature, expiry, and binding all checked on every retry, before any field is trusted.
- [ ] **No secrets in the continuation:** nothing in there you would not show the user.
- [ ] **Side effects come last:** a duplicated retry cannot deploy, charge, or send twice.
- [ ] **All three actions handled:** `accept`, `decline`, and `cancel` have distinct, safe behaviour on every input key.
- [ ] **Fallbacks exist:** a client lacking elicitation or sampling gets a useful degraded result, not an error.
- [ ] **Roots retired:** filesystem boundaries come from configuration or validated arguments, not a runtime request.
- [ ] **Both eras tested:** exercised against a modern client and a legacy one, with the detection result cached per server.

The honest summary is that MRTR asks server authors to give up something comfortable — an `await` in the middle of a function — and to write down explicitly what that `await` used to hold implicitly. In exchange, the same handler runs unchanged on a laptop over stdio and across a fleet of stateless workers behind a load balancer, which is where MCP servers ended up going.

Browse servers already shipping against the current revision in the [AllMCPs directory](/browse), start a new one with the [MCP Server Starter Guide](/build-mcp-server), or work through the rest of the [MCP guides](/guides) if a client is still refusing to connect.
