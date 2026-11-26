import { isMaintainerRole } from "@/lib/model";
import type { ItemSummary } from "./types";

/** Whether the most recent speaker (last commenter, else the author) is the owner or a maintainer. */
export function lastSpeakerIsTeam(s: ItemSummary, owner: string): boolean {
  if (s.lastCommentBy) return s.lastCommentIsMaintainer;
  return isMaintainerRole(s.authorRole) || s.author.toLowerCase() === owner.toLowerCase();
}

/** Open item where someone outside the team spoke last. */
export function needsReply(s: ItemSummary, owner: string): boolean {
  return s.state === "open" && !lastSpeakerIsTeam(s, owner);
}

/** Open PR whose requested reviewers include the owner. */
export function isReviewRequested(s: ItemSummary, owner: string): boolean {
  const me = owner.toLowerCase();
  return s.kind === "pr" && s.state === "open" && s.requestedReviewers.some((r) => r.toLowerCase() === me);
}
