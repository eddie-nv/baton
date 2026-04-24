import type { JSX } from "react";

type Tone = "in_progress" | "blocked" | "merged" | "abandoned" | "neutral";

const TONES: Record<Tone, string> = {
  in_progress: "bg-amber-50 text-amber-900 border border-amber-200",
  blocked: "bg-rose-50 text-rose-900 border border-rose-200",
  merged: "bg-emerald-50 text-emerald-900 border border-emerald-200",
  abandoned: "bg-ink-100 text-ink-500 border border-ink-200",
  neutral: "bg-ink-100 text-ink-700 border border-ink-200",
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps): JSX.Element {
  return <span className={`pill ${TONES[tone]}`}>{children}</span>;
}
