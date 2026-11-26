import type { comments, items, mentions } from "@/lib/db/schema";
import { isMaintainerRole, type ItemState } from "@/lib/model";
import type { RawComment, RawIssue, RawPullRequest } from "./queries";

export type ItemRow = typeof items.$inferInsert;
export type CommentRow = typeof comments.$inferInsert;
export type MentionRow = typeof mentions.$inferInsert;

export interface MappedItem {
  item: ItemRow;
  comments: CommentRow[];
  mentions: MentionRow[];
}

const MENTION_RE = /(^|[^A-Za-z0-9_`./@])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)(?![A-Za-z0-9_/-])/g;

/** Unique @logins (lowercased), ignoring fenced/inline code, blockquotes, emails and @org/team. */
export function extractMentions(text: string): string[] {
  const stripped = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/^>.*$/gm, " ");
  const found: string[] = [];
  for (const match of stripped.matchAll(MENTION_RE)) {
    const login = (match[2] ?? "").toLowerCase();
    if (login && !found.includes(login)) found.push(login);
  }
  return found;
}

const login = (actor: { login: string } | null) => actor?.login ?? "ghost";
const date = (iso: string) => new Date(iso);
const optionalDate = (iso: string | null) => (iso ? new Date(iso) : null);

interface ThreadEntry {
  commentId: string | null;
  author: string;
  role: string;
  body: string;
  createdAt: Date;
}

function isTeam(author: string, role: string, ownerLower: string): boolean {
  return isMaintainerRole(role) || author.toLowerCase() === ownerLower;
}

function buildMentions(itemId: string, entries: ThreadEntry[], ownerLogin: string, extraMaintainers: string[]): MentionRow[] {
  const ownerLower = ownerLogin.toLowerCase();
  const maintainers = new Set<string>([ownerLower, ...extraMaintainers.map((l) => l.toLowerCase())]);
  for (const entry of entries) if (isMaintainerRole(entry.role)) maintainers.add(entry.author.toLowerCase());

  const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const rows: MentionRow[] = [];
  for (const entry of sorted) {
    for (const mentioned of extractMentions(entry.body)) {
      if (!maintainers.has(mentioned) || mentioned === entry.author.toLowerCase()) continue;
      const answered = sorted.some(
        (later) => later.createdAt > entry.createdAt && isTeam(later.author, later.role, ownerLower),
      );
      rows.push({
        itemId,
        commentId: entry.commentId,
        login: mentioned,
        isOwner: mentioned === ownerLower,
        isMaintainer: true,
        answered,
        createdAt: entry.createdAt,
      });
    }
  }
  return rows;
}

function commentRow(
  itemId: string,
  raw: RawComment,
  kind: CommentRow["kind"],
  reviewState: string | null = null,
): CommentRow {
  return {
    id: raw.id,
    itemId,
    author: login(raw.author),
    authorRole: raw.authorAssociation,
    kind,
    reviewState,
    body: raw.body,
    createdAt: date(raw.createdAt),
  };
}

function lastComment(rows: CommentRow[], ownerLogin: string) {
  const latest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!latest) return { lastCommentBy: null, lastCommentAt: null, lastCommentIsMaintainer: false };
  return {
    lastCommentBy: latest.author,
    lastCommentAt: latest.createdAt,
    lastCommentIsMaintainer: isTeam(latest.author, latest.authorRole, ownerLogin.toLowerCase()),
  };
}

function baseItem(raw: RawIssue | RawPullRequest, repoId: number, state: ItemState) {
  return {
    id: raw.id,
    repoId,
    number: raw.number,
    title: raw.title,
    body: raw.body,
    state,
    author: login(raw.author),
    authorRole: raw.authorAssociation,
    labels: (raw.labels?.nodes ?? []).map((l) => ({ name: l.name, color: l.color })),
    commentsCount: raw.comments.totalCount,
    reactionsCount: raw.reactions.totalCount,
    createdAt: date(raw.createdAt),
    updatedAt: date(raw.updatedAt),
    closedAt: optionalDate(raw.closedAt),
    htmlUrl: raw.url,
  };
}

function entriesFor(raw: RawIssue | RawPullRequest, rows: CommentRow[]): ThreadEntry[] {
  return [
    { commentId: null, author: login(raw.author), role: raw.authorAssociation, body: raw.body, createdAt: date(raw.createdAt) },
    ...rows.map((c) => ({ commentId: c.id, author: c.author, role: c.authorRole, body: c.body ?? "", createdAt: c.createdAt })),
  ];
}

export function mapIssue(raw: RawIssue, repoId: number, ownerLogin: string): MappedItem {
  const rows = raw.comments.nodes.map((c) => commentRow(raw.id, c, "comment"));
  return {
    item: {
      ...baseItem(raw, repoId, raw.state === "CLOSED" ? "closed" : "open"),
      kind: "issue",
      mergedAt: null,
      isDraft: false,
      reviewDecision: null,
      requestedReviewers: [],
      ...lastComment(rows, ownerLogin),
    },
    comments: rows,
    mentions: buildMentions(raw.id, entriesFor(raw, rows), ownerLogin, []),
  };
}

export function mapPullRequest(raw: RawPullRequest, repoId: number, ownerLogin: string): MappedItem {
  const state: ItemState = raw.state === "MERGED" ? "merged" : raw.state === "CLOSED" ? "closed" : "open";
  const rows: CommentRow[] = [
    ...raw.comments.nodes.map((c) => commentRow(raw.id, c, "comment")),
    ...raw.reviews.nodes.flatMap((review) => [
      commentRow(
        raw.id,
        {
          id: review.id,
          body: review.body,
          createdAt: review.createdAt,
          authorAssociation: review.authorAssociation,
          author: review.author,
        },
        "review",
        review.state,
      ),
      ...review.comments.nodes.map((c) => commentRow(raw.id, c, "review_comment")),
    ]),
  ];
  const requestedReviewers = raw.reviewRequests.nodes.flatMap(({ requestedReviewer: r }) =>
    r?.login ? [r.login] : r?.slug ? [`team:${r.slug}`] : [],
  );
  return {
    item: {
      ...baseItem(raw, repoId, state),
      kind: "pr",
      mergedAt: optionalDate(raw.mergedAt),
      isDraft: raw.isDraft,
      reviewDecision: raw.reviewDecision,
      requestedReviewers,
      ...lastComment(rows, ownerLogin),
    },
    comments: rows,
    mentions: buildMentions(
      raw.id,
      entriesFor(raw, rows),
      ownerLogin,
      requestedReviewers.filter((r) => !r.startsWith("team:")),
    ),
  };
}
