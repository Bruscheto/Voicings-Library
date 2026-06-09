import Link from 'next/link';
import { prisma } from 'data-model';
import FilterBar from './FilterBar';
import { buildVoicingWhere, hasActiveVoicingFilters } from './filterQuery';
import { ChordSymbol } from '../../components/ChordSymbol';

type SearchParams = Promise<{
  q?: string;
  quality?: string;
  tag?: string | string[];
  tension?: string | string[];
  tensionMode?: string;
}>;

export default async function VoicingsListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const where = buildVoicingWhere(params);

  const [voicings, totalCount, qualityRows, allTags] = await Promise.all([
    prisma.voicing.findMany({
      where,
      include: {
        chords: { include: { chord: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.voicing.count(),
    prisma.chord.findMany({
      select: { quality: true },
      distinct: ['quality'],
      orderBy: { quality: 'asc' },
    }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const qualities = qualityRows.map((r) => r.quality);
  const isFiltered = hasActiveVoicingFilters(params);
  const noResults = voicings.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Voicings Library</h1>
            <p className="mt-1 text-sm text-gray-500">
              {isFiltered
                ? `${voicings.length} of ${totalCount} voicings`
                : `${totalCount} voicing${totalCount === 1 ? '' : 's'}`}
            </p>
          </div>
        </header>

        <FilterBar qualities={qualities} tags={allTags} />

        {noResults ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
            <p className="text-gray-500">
              {isFiltered
                ? 'No voicings match these filters.'
                : 'No voicings yet. Add some via the admin tool.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {voicings.map((v) => {
              const pitches = v.pitches;
              const primaryVc = v.chords[0];
              const chord = primaryVc?.chord;
              const symbol = chord?.symbol ?? '—';
              const tags = v.tags.map((vt) => vt.tag);
              const showAltName = v.name && v.name !== symbol;

              return (
                <Link
                  key={v.id}
                  href={`/voicings/${v.id}`}
                  className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
                >
                  <h2 className="text-2xl font-semibold text-gray-900">
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
                  </h2>
                  {showAltName && <p className="mt-1 text-sm text-gray-500">{v.name}</p>}

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
                          key={t.id}
                          className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                        >
                          {t.name}
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
