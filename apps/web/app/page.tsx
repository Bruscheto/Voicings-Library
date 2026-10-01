import { Suspense } from 'react';
import { loadLibrary } from '../lib/library';
import { ChordFinder } from './finder/ChordFinder';

export const dynamic = 'force-dynamic';

export default async function FinderPage() {
  const library = await loadLibrary();
  return (
    <div className="page-shell">
      <header className="page-heading">
        <h1>Find the voicing.</h1>
        <p>
          Type a chord or play one. Explore its voicings, hear the difference, and find your sound.
        </p>
        <p className="page-meta">
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
