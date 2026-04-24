import type { JSX } from "react";

type Tone = "in_progress" | "blocked" | "merged" | "abandoned" | "neutral";

const TONES: Record<Tone, string> = {
  in_progress: "border-evt-decision/40 bg-evt-decision/10 text-evt-decision",
  blocked: "border-evt-error/40 bg-evt-error/10 text-evt-error",
  merged: "border-evt-merged/40 bg-evt-merged/10 text-evt-merged",
  abandoned: "border-edge text-ink-500",
  neutral: "border-edge text-ink-300",
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps): JSX.Element {
  return <span className={`pill border ${TONES[tone]}`}>{children}</span>;
}
