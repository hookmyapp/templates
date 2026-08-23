import type { TemplateStatus } from "./types";
import type { Result } from "./validate";

/**
 * Where a template has got to, as one word.
 *
 * Two different things decide it. Our own checks say whether it is fit to
 * submit, and they are all we know until it has been sent. After that the
 * account is the authority, and what it says wins: a template Meta has
 * approved is approved even if a later edit here would not pass, and one Meta
 * rejected stays rejected until it is submitted again.
 */
export type Stage =
  | "needs-work"
  | "ready"
  | "pending"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled"
  | "appealing";

export interface StageInfo {
  stage: Stage;
  label: string;
  /** One line about what the state means and what to do next. */
  detail: string;
  tone: "danger" | "warning" | "good" | "info" | "muted";
}

const FROM_META: Partial<Record<TemplateStatus, StageInfo>> = {
  APPROVED: {
    stage: "approved",
    label: "Approved",
    detail: "Live on the account. You can send it.",
    tone: "good",
  },
  PENDING: {
    stage: "pending",
    label: "In review",
    detail: "Submitted and waiting on Meta. Usually minutes, sometimes a day.",
    tone: "info",
  },
  REJECTED: {
    stage: "rejected",
    label: "Rejected",
    detail: "Meta refused it. Read the rejection, change it, submit again.",
    tone: "danger",
  },
  PAUSED: {
    stage: "paused",
    label: "Paused",
    detail: "Too many people blocked or reported it. Sending into a pause makes the next one longer.",
    tone: "danger",
  },
  DISABLED: {
    stage: "disabled",
    label: "Disabled",
    detail: "Paused too often and now off for good. Write a new one.",
    tone: "danger",
  },
  IN_APPEAL: {
    stage: "appealing",
    label: "In appeal",
    detail: "You have asked Meta to look again.",
    tone: "info",
  },
  PENDING_DELETION: {
    stage: "pending",
    label: "Deleting",
    detail: "Waiting to be removed from the account.",
    tone: "muted",
  },
};

/**
 * `status` is what the account last said, when it has been asked. Without it,
 * the checks are all there is to go on.
 */
export function stageOf(result: Result, status?: TemplateStatus): StageInfo {
  const fromMeta = status ? FROM_META[status] : undefined;
  if (fromMeta) return fromMeta;

  if (!result.ok) {
    return {
      stage: "needs-work",
      label: "Needs work",
      detail: `${result.errors.length} thing${result.errors.length === 1 ? "" : "s"} here would be rejected.`,
      tone: "danger",
    };
  }
  return {
    stage: "ready",
    label: "Ready to submit",
    detail: result.warnings.length
      ? `Nothing blocking, though ${result.warnings.length} thing${result.warnings.length === 1 ? " is" : "s are"} worth a look first.`
      : "Passes every check. File it for approval.",
    tone: result.warnings.length ? "warning" : "good",
  };
}

/** Tailwind text colours per tone, so every badge in the app agrees. */
export const TONE: Record<StageInfo["tone"], string> = {
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-500",
  good: "text-emerald-600 dark:text-emerald-500",
  info: "text-sky-600 dark:text-sky-400",
  muted: "text-muted-foreground",
};
