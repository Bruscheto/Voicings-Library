import Link from 'next/link';
import { prisma } from 'data-model';
import { ChordSymbol } from '../components/ChordSymbol';

export default async function HomePage() {
  const [voicingCount, chordCount, recent] = await Promise.all([
    prisma.voicing.count(),
    prisma.chord.count(),
    prisma.voicing.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: { chords: { include: { chord: true } } },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <section className="mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Jazz Piano · Voicings Library
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Find the voicing,<br />hear it, learn it.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-gray-600">
            A curated library of jazz piano voicings — searchable by chord,
            rendered on a grand staff, played back with real piano samples.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/voicings"
              className="rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-gray-700"
            >
              Browse Library
            </Link>
            <span className="text-sm text-gray-500">
              {voicingCount} voicing{voicingCount === 1 ? '' : 's'} ·{' '}
              {chordCount} chord{chordCount === 1 ? '' : 's'}
            </span>
          </div>
        </section>

        {recent.length > 0 && (
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Recently added
              </h2>
              <Link
                href="/voicings"
                className="text-sm text-gray-500 transition hover:text-gray-900"
              >
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {recent.map((v) => {
                const pitches = v.pitches;
                const chord = v.chords[0]?.chord;
                return (
                  <Link
                    key={v.id}
                    href={`/voicings/${v.id}`}
                    className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                  >
                    <h3 className="text-xl font-semibold text-gray-900">
                      {chord ? (
                        <ChordSymbol
                          root={chord.root}
                          quality={chord.quality}
                          tensions={chord.tensions}
                          slashBass={v.slashBass}
                        />
                      ) : (
                        '—'
                      )}
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {pitches.slice(0, 6).map((p, i) => (
                        <span
                          key={`${p}-${i}`}
                          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700"
                        >
                          {p}
                        </span>
                      ))}
                      {pitches.length > 6 && (
                        <span className="px-1.5 py-0.5 text-[11px] text-gray-400">
                          +{pitches.length - 6}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
