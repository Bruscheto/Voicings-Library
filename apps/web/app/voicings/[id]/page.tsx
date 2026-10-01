import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from 'data-model';
import { VoicingView } from './VoicingView';

const COLLECTION_TAG_PREFIX = 'collection:';

function parseRoot(value: string | undefined): number | null {
  const root = Number(value);
  return Number.isInteger(root) && root >= 0 && root < 12 ? root : null;
}

export default async function VoicingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ root?: string }>;
}) {
  const [{ id }, { root }] = await Promise.all([params, searchParams]);
  const voicing = await prisma.voicing.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      intervals: true,
      bassMidi: true,
      structure: true,
      source: true,
      readings: {
        select: {
          rootOffset: true,
          quality: true,
          tensions: true,
          rootless: true,
          isPrimary: true,
        },
      },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!voicing) notFound();

  const { tags, source, ...shape } = voicing;
  const tagNames = tags.map((t) => t.tag.name);
  return (
    <div className="page-shell !max-w-5xl">
      <nav className="mb-6">
        <Link href="/voicings" className="text-sm text-gray-500 transition hover:text-gray-900">
          ← Library
        </Link>
      </nav>
      <VoicingView
        voicing={shape}
        initialRoot={parseRoot(root)}
        collections={tagNames
          .filter((t) => t.startsWith(COLLECTION_TAG_PREFIX))
          .map((t) => t.slice(COLLECTION_TAG_PREFIX.length))}
        tags={tagNames.filter((t) => !t.startsWith(COLLECTION_TAG_PREFIX))}
        source={source}
      />
    </div>
  );
}
