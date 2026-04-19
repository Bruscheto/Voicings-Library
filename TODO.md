# Current Focus — Sampler & Staff Polish

- [ ] Capture/provide real piano samples (or re-run the placeholder generator) so the `Sampler` can load local assets under `apps/admin/public/samples/piano/`.
- [ ] Update `packages/sampler` to prefer local samples with CDN + oscillator fallback, and handle status messaging in the admin UI.
- [ ] Enhance `packages/music-engine` renderer to accept clef/register hints from the schema so voicings display in the right staff automatically.
- [ ] Add a short testing checklist covering `npm run seed:dry-run`, `npm run seed:import`, and `apps/admin` playback to document Step 3 validation.
