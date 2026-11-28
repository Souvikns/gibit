import { EFFORT_LABELS, IMPACT_LABELS, NEXT_ACTION_LABELS } from "@/lib/focus";
import type { Impact, NextAction } from "@/lib/model";
import type { Assessment } from "@/lib/triage/types";

const ACTION_CLASS: Record<NextAction, string> = {
  fix: "bg-card-tint-mint text-ink",
  unblock: "bg-card-tint-peach text-ink",
  review: "bg-card-tint-sky text-ink",
  reply: "bg-card-tint-lavender text-ink",
  decide: "bg-card-tint-yellow text-ink",
  close: "bg-card-tint-gray text-charcoal",
  wait: "bg-surface text-stone",
};

const IMPACT_CLASS: Record<Impact, string> = {
  high: "text-semantic-error",
  med: "text-charcoal",
  low: "text-stone",
};

export function ActionBadge({ action }: { action: NextAction }) {
  return (
    <span className={`whitespace-nowrap rounded-xs px-1.5 py-0.5 text-micro font-medium uppercase tracking-wide ${ACTION_CLASS[action]}`}>
      {NEXT_ACTION_LABELS[action]}
    </span>
  );
}

/** "XS · high impact" */
export function EffortImpact({ assessment }: { assessment: Pick<Assessment, "effort" | "impact"> }) {
  return (
    <span className="whitespace-nowrap text-micro text-stone">
      {EFFORT_LABELS[assessment.effort]} · <span className={IMPACT_CLASS[assessment.impact]}>{IMPACT_LABELS[assessment.impact]}</span>
    </span>
  );
}
