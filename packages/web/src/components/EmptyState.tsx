interface EmptyStateProps {
  title: string;
  description?: string;
  hint?: string;
}

export function EmptyState({
  title,
  description,
  hint,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-edge bg-canvas-raised px-6 py-10 text-center">
      <p className="font-mono text-2xs uppercase tracking-widest text-ink-50">
        {title}
      </p>
      {description !== undefined ? (
        <p className="mt-2 text-sm text-ink-300">{description}</p>
      ) : null}
      {hint !== undefined ? (
        <p className="mt-3 font-mono text-xs text-signal">{hint}</p>
      ) : null}
    </div>
  );
}
