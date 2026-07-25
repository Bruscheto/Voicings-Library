import type { SampleLoadSummary } from 'sampler';

export function describePlaybackStatus(
  { total, loaded, failed }: SampleLoadSummary,
  activationFailed: boolean,
): string {
  if (activationFailed) return 'Audio Unavailable';
  if (loaded === 0) return 'Synth Fallback';
  if (failed > 0) return `Piano Partial · ${loaded}/${total} Samples`;
  return 'Piano Ready';
}

export function canContinuePlayback(
  requestedGeneration: number,
  currentGeneration: number,
  isMounted: boolean,
): boolean {
  return isMounted && requestedGeneration === currentGeneration;
}
