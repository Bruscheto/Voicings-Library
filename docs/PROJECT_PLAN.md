# Jazz Voicings Learning Portal — Project Blueprint

_Last updated: 2025-11-23_

## 1. Vision & Guiding Principles

- **Purpose**: Provide jazz piano learners (all levels who already read notation and know basic jazz theory) with a living voicing library that gradually branches into broader jazz concepts.
- **Most-needed workflow**: Make it effortless to find voicings for a specific chord, then pivot to related voicings/progressions/sub-structures.
- **Design mantra**: Minimal, modern 2025 aesthetic rooted in Apple/HIG clarity—clean typography, ample breathing room, subtle hardware-inspired gradients, precise micro-interactions.
- **Accessibility promise**: WCAG 2.2 AA from day one (keyboard-first navigation, high-contrast theme, semantic structures, live region callouts for audio previews and filters).
- **Data integrity**: Treat voicings/progressions as first-class entities with relational links, enabling discovery in both directions (from chords to voicings and vice versa).
- **Offline-friendly rendering**: Staff previews should be generated on-device (SVG/canvas) so browsing works without network after initial load.

## 2. User Personas & Key Jobs

| Persona                     | Goals                                                                                       | Success Metrics                                            |
| --------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Notation-ready Learner**  | Quickly locate voicings for a given chord, view them on staff, hear realistic playback.     | Finds at least one usable voicing per chord within 20–30s. |
| **Intermediate Improviser** | Explore chord substitutions, upper-structure triads, progressions; compare sub-voicings.    | Can branch from a voicing to related progressions quickly. |
| **Educator**                | Curate sets for students, explain theory context, prep lesson materials (PDF/MIDI exports). | Saves/shareable collections, exports PDFs/MIDI.            |

## 3. Information Architecture

- **Home**: Quick search, featured progressions, “how to use” micro-guide.
- **Voicings Library**
  - Filter by chord symbol, inversion, upper-structure, register, difficulty.
  - Primary task flow: search chord → see voicing list → expand to staff + pitch list + sub-voicing tree + progression usage.
  - Playback uses pre-recorded individual piano samples (single velocity) assembled client-side for realistic tone.
- **Chord Explorer**
  - Each chord page lists rootless versions, slash contexts, possible tensions.
  - Cross-links to voicings + progressions.
- **Progressions Atlas**
  - Browse standards, tagged practice drills, voice-leading walkthrough (GIF or animation between voicings).
- **Learning Hub** (future expansion)
  - Articles, video lessons, practice routines.
- **Account / Workspace** (phase 2)
  - Save voicings, annotate, share.

## 4. Experience Framework

### 4.1 Layout System

- Responsive grid with 12-column base, collapses to cards on mobile.
- Sticky left rail (≥1024px) for global navigation, right rail for contextual info (keyboard shortcuts, related theory snippets).
- Motion: subtle micro-interactions (voicing cards slide up, progression flow lines animate on hover). Prefer CSS `prefers-reduced-motion` fallbacks.

### 4.2 Component Inventory

| Component                  | Purpose                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| **Voicing Card**           | Shows staff preview (SVG), chord labels, quick tags. Click expands modal.                       |
| **Grand Staff Renderer**   | Canvas/SVG-based staff rendered offline; supports adjustable clefs/registers and text fallback. |
| **Chord Tag Panel**        | Pills for chord qualities, tensions, registries; accessible toggle buttons.                     |
| **Sub-Voicing Tree**       | Visual tree for upper structures (UST, quartal stacks).                                         |
| **Progression Timeline**   | Horizontal scroll showing chord + voicing snapshots, with voice-leading arrows.                 |
| **Search & Filter Drawer** | Typeahead (Elasticlunr/Algolia later), filter chips, saved search presets.                      |
| **Theory Callout**         | Small cards describing concepts (e.g., “What is an Upper-Structure Triad?”).                    |

### 4.4 Virtual Keyboard Strategy

- **Range & Layout**: Present roughly 4–5 octaves centered on middle C with octave shift buttons; desktop can show the full span while mobile collapses into a scrollable strip.
- **Input Mechanics**: Clicking/tapping toggles a pitch in the active voicing (highlighted state). Support “logic keyboard” mappings: `Z`/`X` shift octaves down/up, while the `A W S E D F T G Y H U J` keys map to a chromatic octave from C upward—so internalizing voicings from the computer keyboard mirrors playing the virtual piano.
- **Instant Feedback**: Each toggle immediately updates the grand staff, pitch-name list, and triggers the corresponding recorded key sample at fixed velocity for realism.
- **Visual Cues**: Use subtle color coding to distinguish roles (root, tensions, upper structures). Tooltips expose pitch names and MIDI numbers for precision.
- **Accessibility**: Treat every key as a semantic button with ARIA labels (e.g., “Key C4”), provide focus states, and include a parallel list-based selector for screen-reader users.
- **Component API**: Expose events like `onNoteToggle(pitch)` so the staff renderer, sampler, and data model remain decoupled; this also makes the component reusable for future MIDI-import editing.

### 4.3 Accessibility Checklist

- Semantic HTML5, ARIA landmarks.
- `prefers-reduced-motion` + `prefers-color-scheme` support.
- Visible focus states, 3:1 minimum contrast on UI chrome, 4.5:1 for body text.
- Staff renderer exports text alternatives (pitch list) for screen readers.
- Keyboard playable chord audio trigger.

## 5. Data & Domain Model

```
Chord
  id (UUID)
  symbol (e.g., Cmaj7#11)
  quality (enum)
  root (PitchClass)
  tensions [PitchClass]
  common_names []
  tags []

Voicing
  id
  name / shorthand
  pitches [Pitch]  // e.g., E3, G3, B3, D4, F#4
  midi_numbers [int]
  register_range (low/high)
  clef_hint (treble/bass/grand)
  descriptor (text)
  audio_sample_map { pitch: sampleId }  // ties into recorded key samples

VoicingChord
  voicing_id FK → Voicing
  chord_id FK → Chord
  usage_context enum (rootless, slash, drop2, etc.)

SubVoicing
  id
  parent_voicing_id FK → Voicing
  label (e.g., "US triad", "quartal stack")
  pitches_subset []
  theory_note

Progression
  id
  title
  description
  key_center
  tempo_hint
  tags []

ProgressionChord
  progression_id FK → Progression
  order_index
  chord_id FK → Chord
  preferred_voicing_id FK → Voicing  (nullable)
  alt_voicing_ids []
```

- **Pitch representation**: use `PitchClass (0–11)` + `Octave`, ensure enharmonic spellings stored for theory accuracy.
- **Database choice**: PostgreSQL for relational consistency + JSONB for metadata. Expose read replicas for heavy search.
- **Search layer**: start with Postgres full-text; plan for Algolia/Meilisearch if scale demands.
- **Authoring**: initial admin-only UI operated by creator; long-term plan for user-contributed voicings gated by moderation.

## 6. Tech Stack Proposal

| Layer           | Choice                                                       | Notes                                                        |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Frontend        | Next.js 15 (App Router) + TypeScript + Tailwind              | SSR for SEO, rapid prototyping, design tokens.               |
| UI Kit          | Radix Primitives + custom tokens                             | Accessibility-friendly base.                                 |
| State/data      | TanStack Query + server actions                              | Smooth data fetching, optimistic updates for saved voicings. |
| Music rendering | VexFlow (staff) + custom sampler (recorded key samples)      | fallback static SVG server-side; minimal Tone.js usage.      |
| Backend         | Next.js API routes (Phase 1) → NestJS microservice (Phase 2) | Start simple, scale later.                                   |
| Database        | PostgreSQL (Supabase or Neon)                                | Manage via Prisma schema.                                    |
| Auth (Phase 2)  | NextAuth + Magic Link                                        | keep friction low.                                           |
| File storage    | Supabase storage / S3 for audio samples.                     |
| Analytics       | PostHog (self-host mode optional).                           |

## 7. API Sketch

```
GET /api/voicings?chord=Cmaj7&register=mid
GET /api/voicings/{id}
GET /api/chords/{symbol}/voicings
GET /api/progressions?voicingId=UUID
POST /api/voicings   // admin only
POST /api/progressions
```

Response payload example:

```json
{
	"id": "uuid",
	"pitches": ["E3", "G3", "B3", "D4"],
	"midi": [52, 55, 59, 62],
	"staff": {
		"clefs": ["bass", "treble"],
		"svg": "<svg>…</svg>"
	},
	"chords": ["Cmaj9", "Am7/C"],
	"subVoicings": [
		{
			"label": "UST",
			"pitches": ["G3", "B3", "D4"],
			"note": "Major triad over E"
		}
	],
	"progressions": [
		{ "id": "uuid2", "title": "Autumn Leaves A Section", "order": 3 }
	]
}
```

## 8. Content Authoring Workflow

1. **Capture**: Creator plays notes on a virtual piano keyboard (or inputs MIDI), which updates the grand staff preview live; chord label is manually entered/edited for accuracy.
2. **Enrich**: Tag with chord qualities, register, fingerings, sub-voicings; attach theory notes or practice tips.
3. **Preview**: Render staff (offline SVG), assemble playback via recorded key samples, show voice-leading suggestions.
4. **Publish**: Save to DB, trigger search index update + CDN cache purge.
5. **Bundle**: (Phase 2) Create progression packages, export PDF/MIDI for practice.

## 9. Roadmap

| Phase | Milestone              | Scope                                                            |
| ----- | ---------------------- | ---------------------------------------------------------------- |
| 0     | Discovery              | Validate data model, gather 50 seed voicings + 10 progressions.  |
| 1     | MVP Library            | Landing page, voicing search, chord detail, read-only API.       |
| 2     | Progression Atlas      | Add progression explorer, voice-leading animations.              |
| 3     | Accounts & Collections | User workspaces, favorites, custom notes.                        |
| 4     | Learning Hub           | Articles, exercises, spaced repetition drills.                   |
| 5     | MIDI Song Import Lab   | Upload MIDI, detect sections with notable voicings/progressions. |

## 11. Next Steps

1. Finalize design system tokens + moodboard (Figma, Apple-inspired references).
2. Build seed data spreadsheet aligning with schema.
3. Prototype staff renderer + offline audio sampler using recorded key samples.
4. Set up monorepo (Next.js + shared packages).
5. ~~Implement authenticated admin capture tool with virtual piano input.~~ ✅ _Voicing input workflow complete as of Nov 2025; capture tool now stable._
6. Spike on MIDI import parsing pipeline (analysis-only) for future “Song Import Lab”.

**Upcoming focus (post-admin milestone):**

- Polish sampler + staff renderer for production readiness (Steps 3 & 4).
- Stand up the public voicings library pages powered by the captured data.
- Prepare Prisma/Postgres schema + initial seed to persist new entries.

## 12. Hobby-Friendly Execution Track

- **Essentials only**: Stick with Node 20 + PNPM (or npm) and a Turborepo/PNPM workspace if shared packages make life easier; skip heavier tooling until it hurts.
- **Loose design guardrails**: Quick sketches for library/detail/admin views plus a trimmed Tailwind palette/typography set keep visuals cohesive without a full system.
- **SQLite-first data**: Draft the Prisma schema (Users, Voicings, Tags, Exercises) and back it with local SQLite; point to Postgres/Supabase once things stabilize.
- **Music core spike**: Build a single-page playground proving the sampler + VexFlow stack before broader UI work so the riskiest part is solved early.
- **Light ops**: `.env.local`, Vercel deploy for the web app, optional Supabase for auth/DB; add Sentry/PostHog only if you’ll actually check the dashboards.
- **Mini backlog**: Keep a living todo list (repo README or GitHub Issues) with Sprint 0 tasks—repo setup, sampler spike, notation renderer, basic UI scaffold—to stay oriented without heavyweight PM tooling.

## 13. Proposed Repository Structure

```
Voicings/
├─ PROJECT_PLAN.md                # Living blueprint (this file)
├─ README.md                      # High-level overview & quickstart
├─ apps/
│  ├─ web/                        # Public Next.js experience (voicings library, explorer)
│  └─ admin/                      # Internal capture/authoring tool (virtual keyboard input)
├─ packages/
│  ├─ ui/                         # Shared design system components + Tailwind tokens
│  ├─ music-engine/               # Staff renderer wrappers (VexFlow) + playback orchestrator
│  ├─ sampler/                    # Recorded piano sample loader & audio graph utilities
│  ├─ data-model/                 # Prisma schema, validation, shared TypeScript types
│  └─ config/                     # ESLint, Tailwind, tsconfig, shared scripts
├─ docs/
│  ├─ design/                     # Wireframes, moodboards, accessibility audits
│  └─ data/                       # Seed spreadsheets, chord/voicing specs, MIDI import notes
├─ scripts/                       # Dev tooling (db seeders, migration helpers, sample processing)
└─ infra/                         # Deployment configs (Supabase/Neon, CI pipelines, IaC later)
```

This layout keeps feature apps isolated while sharing a single source of truth for UI tokens, music rendering logic, and database schema. It also anticipates future services (MIDI lab, analytics) without forcing premature complexity.

---

This document will evolve with each milestone; keep it versioned within the repo for traceability.
