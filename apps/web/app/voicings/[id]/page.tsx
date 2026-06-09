import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from 'data-model';
import VoicingDetailClient from './VoicingDetailClient';
import { ChordSymbol } from '../../../components/ChordSymbol';

function noteToVexFlow(note: string): string {
  const match = note.match(/([A-G][#b]?)(\d)/);
  if (!match) return note;
  return `${match[1].toLowerCase()}/${match[2]}`;
}

export default async function VoicingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const voicing = await prisma.voicing.findUnique({
    where: { id },
    include: {
      chords: { include: { chord: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!voicing) {
    notFound();
  }

  const pitches = voicing.pitches;
  const vfNotes = pitches.map(noteToVexFlow);
  const primaryVc = voicing.chords[0];
  const symbol = primaryVc?.chord.symbol ?? '—';
  const tags = voicing.tags.map((vt) => vt.tag);
  const showAltName = voicing.name && voicing.name !== symbol;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <nav className="mb-8">
          <Link
            href="/voicings"
            className="text-sm text-gray-500 transition hover:text-gray-900"
          >
            ← Library
          </Link>
        </nav>

        <header className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              {primaryVc?.chord ? (
                <ChordSymbol
                  root={primaryVc.chord.root}
                  quality={primaryVc.chord.quality}
                  tensions={primaryVc.chord.tensions}
                  slashBass={voicing.slashBass}
                />
              ) : (
                '—'
              )}
            </h1>
            {showAltName && (
              <p className="mt-1 text-base text-gray-500">{voicing.name}</p>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </header>

        <VoicingDetailClient vfNotes={vfNotes} pitches={pitches} />

        {primaryVc?.chord && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Root" value={primaryVc.chord.root} />
            <Field label="Quality" value={primaryVc.chord.quality} />
            <Field
              label="Tensions"
              value={
                primaryVc.chord.tensions.length > 0
                  ? primaryVc.chord.tensions.join(', ')
                  : '—'
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-gray-900">{value}</p>
    </div>
  );
}
