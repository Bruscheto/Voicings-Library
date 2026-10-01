import { Suspense } from 'react';
import { loadLibrary } from '../lib/library';
import { ChordFinder } from './finder/ChordFinder';

export const dynamic = 'force-dynamic';

export default async function FinderPage() {
  const library = await loadLibrary();
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Find the voicing.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-gray-600">
          Type a chord or play one. Every voicing in the library is shown in your key, with its
          guide tones marked.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {library.length} voicing shape{library.length === 1 ? '' : 's'}, each playable in all 12
          keys.
        </p>
      </header>
      <Suspense>
        <ChordFinder library={library} />
      </Suspense>
    </div>
  );
}
