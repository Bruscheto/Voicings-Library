import Link from 'next/link';
import { prisma } from 'data-model';

type VoicingContext = {
  slashBass: string | null;
  tags: string[];
};

function parseContext(raw: string | null | undefined): VoicingContext {
  if (!raw) return { slashBass: null, tags: [] };
  const out: VoicingContext = { slashBass: null, tags: [] };
  for (const part of raw.split(';')) {
    const [key, val] = part.split(':');
    if (!val) continue;
    if (key === 'slash') out.slashBass = val;
    if (key === 'tags') out.tags = val.split('|').filter(Boolean);
  }
  return out;
}

function safeParseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default async function VoicingsListPage() {
  const voicings = await prisma.voicing.findMany({
    include: {
      chords: {
        include: { chord: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Voicings Library</h1>
            <p className="mt-1 text-sm text-gray-500">
              {voicings.length} voicing{voicings.length === 1 ? '' : 's'}
            </p>
          </div>
        </header>

        {voicings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <p className="text-gray-500">No voicings yet. Add some via the admin tool.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {voicings.map((v) => {
              const pitches = safeParseJsonArray(v.pitches);
              const primaryVc = v.chords[0];
              const symbol = primaryVc?.chord.symbol ?? '—';
              const { tags } = parseContext(primaryVc?.context);
              const showAltName = v.name && v.name !== symbol;

              return (
                <Link
                  key={v.id}
                  href={`/voicings/${v.id}`}
                  className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                >
                  <h2 className="text-2xl font-semibold text-gray-900">{symbol}</h2>
                  {showAltName && (
                    <p className="mt-1 text-sm text-gray-500">{v.name}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {pitches.map((p, i) => (
                      <span
                        key={`${p}-${i}`}
                        className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700"
                      >
                        {p}
                      </span>
                    ))}
                  </div>

                  {tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
