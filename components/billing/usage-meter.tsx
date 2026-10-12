export function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const id = `usage-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-sm">
        <span id={id}>{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {limit === null ? `${used} · unlimited` : `${used} / ${limit}`}
        </span>
      </div>
      {limit !== null && (
        <div
          role="progressbar"
          aria-labelledby={id}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={used}
          className="bg-secondary h-2 overflow-hidden rounded-full"
        >
          <div
            className={pct >= 100 ? 'bg-destructive h-full' : 'bg-primary h-full'}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
