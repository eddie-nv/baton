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
    <div className="rounded-lg border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink-900">{title}</p>
      {description !== undefined ? (
        <p className="mt-1 text-sm text-ink-500">{description}</p>
      ) : null}
      {hint !== undefined ? (
        <p className="mt-3 font-mono text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}
