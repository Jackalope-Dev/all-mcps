# Submission Upsell Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Submission Upsell" Sequenzy sequence as a disabled draft with 3 hand-written
emails, verify rendering and test-send before handing off the enable decision to the user.

**Architecture:** Entirely Sequenzy-side configuration via MCP tools — no application code, no git
commits (this piece touches no repo files). One `create_sequence` call with explicit `steps`,
followed by render/test-send verification.

**Tech Stack:** Sequenzy MCP tools (`create_sequence`, `render_email`, `send_sequence_test_email`).

## Global Constraints

- Never call `enable_sequence` — stays a disabled draft; enabling is the user's explicit decision
  (spec: "Testing").
- Merge tag syntax is `{{serverId}}` / `{{serverName}}` (bare attribute name) — `{{customAttributes.serverId}}`
  does not resolve and must not appear anywhere in step content (spec: "Why one CTA URL works").
- Every button URL is `https://allmcps.com/pricing?serverId={{serverId}}` — no other CTA path.
- Trigger `tag_added: submitted-listing`, `enrollmentMode: one_time`, stop condition
  `{ type: 'has_tag', value: 'customer' }` (spec: "Sequence configuration").
- Sender `senderProfileId: p1dmte08v6jd67cnlvz43396`, reply `replyProfileId: nmr7hkbzz2qpkq3mgs7dmhjk`.

---

### Task 1: Create the sequence draft with all 3 email steps

**Files:** None — this is a single Sequenzy MCP tool call, no repo files touched.

**Interfaces:**
- Produces: a sequence with id `<sequenceId>` (captured from the tool response), containing 3
  named email steps, consumed by Task 2 (render) and Task 3 (test send).

- [ ] **Step 1: Call `create_sequence`**

  ```
  create_sequence({
    companyId: "o9o6i6w0za04yal2c8ba7gag",
    name: "Submission Upsell",
    description: "Nudges non-paying submitters toward Priority Review, Featured Boost, or Premium. Stops automatically once the native Stripe integration tags the subscriber 'customer'.",
    trigger: "tag_added",
    tagName: "submitted-listing",
    enrollmentMode: "one_time",
    stopCondition: { type: "has_tag", value: "customer" },
    senderProfileId: "p1dmte08v6jd67cnlvz43396",
    replyProfileId: "nmr7hkbzz2qpkq3mgs7dmhjk",
    steps: [
      {
        subject: "Thanks for submitting {{serverName}}",
        previewText: "It's in our review queue — here's how to speed that up.",
        delay: { mode: "duration", hours: 2 },
        blocks: [
          { type: "heading", content: "Thanks for submitting {{serverName}}", level: 2 },
          {
            type: "text",
            variant: "paragraph",
            content: "<p>Your listing is in our review queue. Most free submissions are reviewed within a few days. If you'd rather not wait, Priority Review moves your listing to the front of the queue for $5 — same safety checks we run on every submission, just faster.</p>"
          },
          {
            type: "button",
            text: "Get priority review — $5",
            url: "https://allmcps.com/pricing?serverId={{serverId}}",
            variant: "primary"
          }
        ]
      },
      {
        subject: "Get {{serverName}} more visibility this week",
        previewText: "A 7-day featured boost puts your listing in front of more people.",
        delay: { mode: "duration", days: 3 },
        blocks: [
          { type: "heading", content: "Ready for more eyes on {{serverName}}?", level: 2 },
          {
            type: "text",
            variant: "paragraph",
            content: "<p>Once your listing is live, a Featured Boost puts it in the spotlight across AllMCPs for 7 days — a featured badge, and higher placement in homepage discovery. It's a one-time $12, and turns off automatically after a week — no subscription to cancel.</p>"
          },
          {
            type: "button",
            text: "Feature my listing — $12",
            url: "https://allmcps.com/pricing?serverId={{serverId}}",
            variant: "primary"
          }
        ]
      },
      {
        subject: "Keep the spotlight on {{serverName}}",
        previewText: "Premium keeps your listing featured, verified, and linked — for as long as you want.",
        delay: { mode: "duration", days: 4 },
        blocks: [
          { type: "heading", content: "Keep the spotlight on {{serverName}}", level: 2 },
          {
            type: "text",
            variant: "paragraph",
            content: "<p>Premium ($19/month) keeps your listing in the featured rotation continuously, adds a dofollow link back to your site, a verified/Premium badge, and visibility stats (views, installs, upvotes) so you can see what's working. Cancel anytime.</p>"
          },
          {
            type: "button",
            text: "Go Premium — $19/mo",
            url: "https://allmcps.com/pricing?serverId={{serverId}}",
            variant: "primary"
          }
        ]
      }
    ]
  })
  ```
  Note the returned sequence `id` and each step's `nodeId` from the response — needed for Tasks 2
  and 3.

- [ ] **Step 2: Confirm it saved as a disabled draft**

  ```
  list_sequences({ companyId: "o9o6i6w0za04yal2c8ba7gag", search: "Submission Upsell" })
  ```
  Expected: one result, `effectiveStatus: "draft"`. Do not call `enable_sequence` at any point in
  this plan.

---

### Task 2: Verify rendering and merge tags for all 3 steps

**Files:** None.

**Interfaces:**
- Consumes: sequence `id` and each step's `nodeId` from Task 1.

- [ ] **Step 1: Render each step with a sample subscriber**

  For each of the 3 `nodeId`s:
  ```
  render_email({
    sequenceId: "<id from Task 1>",
    nodeId: "<step nodeId>",
    subscriber: { email: "plan-verify-render@example.com", customAttributes: { serverId: "test-mcp", serverName: "Test MCP" } }
  })
  ```
  Expected for every step: the rendered HTML contains `Test MCP` (not a literal `{{serverName}}`)
  and the button's `href` is exactly `https://allmcps.com/pricing?serverId=test-mcp` (not a literal
  `{{serverId}}`, and not empty — confirms the earlier `{{customAttributes.serverId}}` mistake
  didn't creep back in).

- [ ] **Step 2: Fix and re-render if any merge tag didn't resolve**

  If a tag renders literally or blank, it means a block's `content`/`url` used the wrong tag
  syntax. Use `update_sequence_node` to correct that step's blocks, then re-run Step 1 for that
  node until it resolves correctly.

---

### Task 3: Test-send all 3 steps to a real inbox

**Files:** None.

**Interfaces:**
- Consumes: sequence `id` from Task 1.

- [ ] **Step 1: Send a test email for each step**

  ```
  send_sequence_test_email({ sequenceId: "<id from Task 1>", nodeId: "<step nodeId>", email: "cadenjsumner@gmail.com" })
  ```
  Repeat for all 3 `nodeId`s.

- [ ] **Step 2: Manual visual check**

  Confirm in the inbox: subject lines match the spec exactly, sender shows as
  `hello@hello.allmcps.com`, reply-to is `cadenjsumner@gmail.com`, the button is clickable and
  points at `https://allmcps.com/pricing?serverId=test-mcp` (or whatever sample id the test-send
  used), and the layout looks reasonable on both desktop and mobile-width preview (most email
  clients' preview pane, or resize the browser if viewing webmail).

---

## Self-Review Notes

- **Spec coverage:** sequence config (trigger/stop condition/enrollment/sender) in Task 1 Step 1;
  all 3 emails' exact subject/preview/body/button copy in Task 1 Step 1; merge tag correctness
  verification in Task 2; test-send verification in Task 3; `enable_sequence` deliberately never
  called anywhere in this plan, per spec.
- **Type consistency:** `nodeId`/`id` references in Tasks 2-3 point back to Task 1's output: no
  new identifiers invented.
- **No placeholders:** every step is a literal, fully-parameterized tool call or a concrete
  described check — no "verify it looks right" without stating exactly what "right" means.
