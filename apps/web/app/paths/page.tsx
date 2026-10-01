import { Suspense } from 'react';
import { loadLibrary } from '../../lib/library';
import { PathBuilder } from './PathBuilder';

export const dynamic = 'force-dynamic';

export default async function PathsPage() {
  const library = await loadLibrary();
  return (
    <div className="page-shell">
      <header className="page-heading">
        <h1>ii–V–I, voice-led.</h1>
        <p>
          Pick a key and connect three chords with less hand movement. Swap a voicing to hear
          another route.
        </p>
      </header>
      <Suspense>
        <PathBuilder library={library} />
      </Suspense>
    </div>
  );
}
