import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { repos } from "@/lib/db/schema";
import { parseRepoFullName } from "@/lib/github/names";
import { COLUMNS, CONFIDENCES, EFFORTS, IMPACTS, NEXT_ACTIONS } from "@/lib/model";
import { syncStep } from "@/lib/sync/run";
import * as triage from "@/lib/triage/service";
import { TRIAGE_PROMPT } from "./prompt";

const column = z.enum(COLUMNS);
const priority = z.enum(["p0", "p1", "p2", "p3"]);
const ref = z.string().describe('Item reference, e.g. "asyncapi/cli#123"');

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await fn();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: message }], isError: true };
  }
}

async function repoIdsFor(names: string[]): Promise<number[]> {
  const all = await db().select({ id: repos.id, owner: repos.owner, name: repos.name }).from(repos);
  return names.map((full) => {
    const parsed = parseRepoFullName(full);
    const match = parsed
      ? all.find((r) => r.owner.toLowerCase() === parsed.owner.toLowerCase() && r.name.toLowerCase() === parsed.name.toLowerCase())
      : undefined;
    if (!match) throw new triage.TriageError(`Repo "${full}" is not configured in gibit`);
    return match.id;
  });
}

export function registerGibit(server: McpServer): void {
  server.registerTool(
    "sync",
    {
      description:
        "Fetch new GitHub activity (read-only) into gibit. Each call works ~45s. If the result status is \"partial\", call sync again until it is \"done\" (stop if it reports a rate-limit pause). Optionally limit to repos given as owner/name.",
      inputSchema: z.object({ repos: z.array(z.string()).optional() }),
    },
    ({ repos: names }) =>
      run(async () =>
        syncStep({ trigger: "mcp", repoIds: names?.length ? await repoIdsFor(names) : undefined }),
      ),
  );

  server.registerTool(
    "list_repos",
    {
      description: "Repos the owner configured in gibit, with clone URLs, default branches and sync status. Clone/pull these locally for research.",
      inputSchema: z.object({}),
    },
    () => run(() => triage.listRepoSummaries()),
  );

  server.registerTool(
    "get_briefing",
    {
      description:
        "Catch-up summary since the last briefing (or `since`, ISO date): new items, threads where a non-maintainer spoke last, PRs requesting the owner's review, unanswered maintainer mentions, approved-but-unmerged PRs, and column changes. Sections list up to 25 items with full totals.",
      inputSchema: z.object({ since: z.string().optional().describe("ISO timestamp; defaults to the previous briefing") }),
    },
    ({ since }) => run(() => triage.getBriefing(since)),
  );

  server.registerTool(
    "list_items",
    {
      description: "Filter the board. Newest activity first.",
      inputSchema: z.object({
        repo: z.string().optional().describe("owner/name"),
        kind: z.enum(["issue", "pr"]).optional(),
        column: column.optional(),
        priority: priority.optional(),
        needs_reply: z.boolean().optional().describe("Open items where a non-maintainer spoke last"),
        mentions_me: z.boolean().optional().describe("Open items with an unanswered @mention of the owner"),
        review_requested: z.boolean().optional().describe("Open PRs requesting the owner's review"),
        needs_assessment: z
          .boolean()
          .optional()
          .describe("Open items with no assessment yet, or new activity since the last one"),
        limit: z.number().int().min(1).max(200).optional(),
      }),
    },
    (args) =>
      run(() =>
        triage.listItems({
          repo: args.repo,
          kind: args.kind,
          column: args.column,
          priority: args.priority,
          needsReply: args.needs_reply,
          mentionsMe: args.mentions_me,
          reviewRequested: args.review_requested,
          needsAssessment: args.needs_assessment,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "get_item",
    {
      description: "One item with its full stored thread (comments, reviews), triage state, your notes, current draft, and activity.",
      inputSchema: z.object({ ref }),
    },
    ({ ref }) => run(() => triage.getItem(ref)),
  );

  server.registerTool(
    "list_reports",
    { description: "Recent reports you saved, newest first.", inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }) },
    ({ limit }) => run(() => triage.listReports(limit)),
  );

  server.registerTool(
    "move_item",
    {
      description: "Move an item to a board column in gibit (not GitHub). `reason` is required and shown on the card.",
      inputSchema: z.object({ ref, column, reason: z.string().min(1), priority: priority.nullable().optional() }),
    },
    (args) => run(() => triage.moveItem({ ...args, actor: "claude" })),
  );

  server.registerTool(
    "add_note",
    {
      description: "Attach a markdown note to an item in gibit. Use kind \"research\" for findings.",
      inputSchema: z.object({ ref, body: z.string().min(1), kind: z.enum(["research", "note"]) }),
    },
    (args) => run(() => triage.addNote({ ...args, author: "claude" })),
  );

  server.registerTool(
    "save_draft",
    {
      description: "Save a ready-to-post reply for the owner to review and post themselves. Replaces the item's current draft. Never posts to GitHub.",
      inputSchema: z.object({ ref, body: z.string().min(1) }),
    },
    (args) => run(() => triage.saveDraft({ ...args, author: "claude" })),
  );

  server.registerTool(
    "assess_items",
    {
      description:
        "Save your assessment of 1–25 items: what the owner should do next, effort, impact, and who it's blocked by. This drives gibit's Focus page ranking. All-or-nothing: if any ref is unknown, nothing is saved and the error lists the bad refs.",
      inputSchema: z.object({
        assessments: z
          .array(
            z.object({
              ref,
              summary: z.string().min(1).max(200).describe("One-line TL;DR of the item and what's needed"),
              next_action: z.enum(NEXT_ACTIONS),
              effort: z.enum(EFFORTS).describe("xs <30min known spot · s <half day · m a day or two / design · l larger or unclear"),
              impact: z.enum(IMPACTS).describe("high: many users/regression/security/release blocker · med: real bug or useful feature · low: cosmetic/niche"),
              unblocks_others: z.boolean().optional().describe("The owner acting frees someone else's work"),
              blocked_by: z
                .object({
                  login: z.string().min(1).describe("GitHub login without @"),
                  reason: z.string().min(1),
                  ask: z.string().min(1).describe("The exact question or request to send them"),
                })
                .nullable()
                .optional(),
              why_now: z.string().max(200).nullable().optional(),
              confidence: z.enum(CONFIDENCES),
            }),
          )
          .min(1)
          .max(25),
      }),
    },
    ({ assessments }) =>
      run(() =>
        triage.assessItems(
          assessments.map((a) => ({
            ref: a.ref,
            summary: a.summary,
            nextAction: a.next_action,
            effort: a.effort,
            impact: a.impact,
            unblocksOthers: a.unblocks_others,
            blockedBy: a.blocked_by ?? null,
            whyNow: a.why_now ?? null,
            confidence: a.confidence,
          })),
          "claude",
        ),
      ),
  );

  server.registerTool(
    "save_report",
    {
      description: "Save an actionable markdown report to gibit's Reports page.",
      inputSchema: z.object({ title: z.string().min(1), body: z.string().min(1) }),
    },
    (args) => run(() => triage.saveReport(args)),
  );

  server.registerPrompt(
    "triage",
    { title: "Daily triage", description: "Sync, research, sort the board, draft replies, and write an actionable report." },
    () => ({ messages: [{ role: "user", content: { type: "text", text: TRIAGE_PROMPT } }] }),
  );
}
