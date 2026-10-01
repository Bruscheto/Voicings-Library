import Link from 'next/link';
import { prisma, realizeVoicing } from 'data-model';
import { KeyboardPreview } from '../../components/KeyboardPreview';
import { isBaseQuality, mod12 } from 'harmony';
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

export default async function VoicingsListPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const where = buildVoicingWhere(params);

  const [voicings, totalCount, qualityRows, allTags] = await Promise.all([
    prisma.voicing.findMany({
      where,
      include: {
        readings: true,
        tags: { include: { tag: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.voicing.count(),
    prisma.voicingReading.findMany({
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
    <div>
      <div className="page-shell">
        <header className="page-heading">
          <div>
            <h1>Voicings Library</h1>
            <p className="page-meta">
              {isFiltered
                ? `${voicings.length} of ${totalCount} voicings`
                : `${totalCount} voicing${totalCount === 1 ? '' : 's'}`}
            </p>
          </div>
        </header>

        <FilterBar qualities={qualities} tags={allTags} />

        {noResults ? (
          <div className="empty-state">
            <p className="text-gray-500">
              {isFiltered
                ? 'No voicings match these filters.'
                : 'No voicings yet. Add some via the admin tool.'}
            </p>
            {isFiltered && (
              <Link href="/voicings" className="secondary-button mt-5">
                Reset filters
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {voicings.map((v) => {
              const { pitches, midi, primary: chord } = realizeVoicing(v);
              const reading = v.readings.find((r) => r.isPrimary) ?? v.readings[0];
              const symbol = chord?.symbol ?? 'Unnamed chord';
              const tags = v.tags.map((vt) => vt.tag);
              const showAltName = v.name && v.name !== symbol;

              return (
                <Link key={v.id} href={`/voicings/${v.id}`} className="voicing-card group">
                  <h2 className="voicing-card-title">
                    {chord ? (
                      <ChordSymbol
                        root={chord.root}
                        quality={chord.quality}
                        tensions={chord.tensions}
                        slashBass={chord.slashBass}
                      />
                    ) : (
                      'Unnamed chord'
                    )}
                  </h2>
                  {showAltName && <p className="text-sm text-gray-500">{v.name}</p>}

                  <div className="keyboard-preview">
                    <KeyboardPreview
                      notes={midi}
                      chord={
                        chord && isBaseQuality(chord.quality)
                          ? {
                              rootPc: mod12(v.bassMidi + (reading?.rootOffset ?? 0)),
                              quality: chord.quality,
                            }
                          : null
                      }
                      className="h-16 w-full max-w-[280px]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <span
                          key={t.id}
                          className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                        >
                          {t.name.replace(/^collection:/, '')}
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
