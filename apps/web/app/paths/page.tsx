import { Suspense } from 'react';
import { loadLibrary } from '../../lib/library';
import { PathBuilder } from './PathBuilder';

export const dynamic = 'force-dynamic';

export default async function PathsPage() {
  const library = await loadLibrary();
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">ii–V–I, voice-led.</h1>
        <p className="mt-3 max-w-2xl text-lg text-gray-600">
          Pick a key. The library&apos;s voicings are chained so your hand moves as little as
          possible. Swap any chord and the rest re-solve around it.
        </p>
      </header>
      <Suspense>
        <PathBuilder library={library} />
      </Suspense>
    </div>
  );
}
