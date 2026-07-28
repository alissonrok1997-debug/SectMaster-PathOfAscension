# Sect Master: Path of Ascension

A browser-based idle/incremental cultivation-sect management game (wuxia fantasy setting).

Manage a cultivation sect: assign disciples, build and upgrade your grounds, dispatch missions, craft equipment, research techniques, and navigate faction diplomacy and world events — all ticking in real time, even while you're away.

## Status

Waves 0–8 of the roadmap are built and playable:

- Core Economy & Sect Shell
- Disciples & Assignment
- Idle & Offline Loop
- Missions & Combat
- Items & Equipment
- Research & Sect Identity
- World, Events & Narrative
- Onboarding, Polish & Live-Readiness

This is a prototype/testbed for the game's design — numeric tuning (costs, durations, rates) is deliberately small-scale for fast iteration, not final balance.

## Tech Stack

- React 18 + TypeScript (strict mode)
- Zustand for state management
- Vite for build tooling
- No backend — state persists to `localStorage`

## Getting Started

```bash
npm install
npm run dev
```

Then open the local dev server URL in your browser.

Windows users can also double-click `Play Sect Master.bat`, which installs dependencies on first run and launches the game.

### Other scripts

```bash
npm run build     # type-check and build for production
npm run preview   # preview the production build
```

## Project Structure

```
src/
  game/
    types.ts        # core data model
    data/            # static definitions (buildings, missions, items, etc.)
    engine/          # pure game-logic functions
    state/           # the single Zustand store
    persistence/      # localStorage save/load
  components/        # React UI
```
