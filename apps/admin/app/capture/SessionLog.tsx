export type SessionEntry = {
  id: string;
  symbol: string;
  pitches: string[];
  outcome: 'created' | 'updated';
};

/** Voicings saved in this sitting, newest first, so a batch can be reviewed. */
export function SessionLog({ entries }: { entries: SessionEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
        This session · {entries.length} saved
      </h2>
      <ol className="flex flex-col divide-y divide-gray-100">
        {entries.map((entry, i) => (
          <li key={`${entry.id}-${i}`} className="flex items-baseline gap-3 py-1.5 text-sm">
            <span className="font-semibold text-gray-900">{entry.symbol}</span>
            <span className="font-mono text-xs text-gray-500">{entry.pitches.join(' ')}</span>
            <span className="ml-auto text-xs text-gray-500">
              {entry.outcome === 'created' ? 'new' : 'added to existing'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
