import { useGameStore } from '../game/state/store'
import { computeSectRank } from '../game/engine/sectRank'
import { SECT_HALL_ID } from '../game/data/buildingDefs'
import { getProvinceDef } from '../game/data/world/provinceDefs'
import { getSite } from '../game/engine/world/worldAccess'
import { getSpiritVeinDef } from '../game/data/world/spiritVeinDefs'
import { msToWorldTime } from '../game/engine/worldClock'
import { UiIcon } from './UiIcon'
import { EMBLEM_ART } from '../assets/icons'

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/**
 * The landing screen's focal point (GAME_UI_DESIGN_SYSTEM §16.1). It replaces four
 * equal-weight `.panel` boxes — rank, seat and two clocks — that gave the game no focus at
 * all and made it open like a settings page.
 *
 * **The headline is the seat, not the sect.** §16.1 asks for "sect name in the display
 * face", but the player's sect has no name anywhere in state, and inventing one would mean
 * touching types, initial state and the save format for a visual reason. `site.name` is the
 * only proper noun in the save that is the player's own, so it carries the hero; rank is
 * gold micro-text beneath it rather than §16.1's 1.5rem readout, because 1.5rem gold spent
 * on a three-value enum emphasises the least-varying field on the screen.
 *
 * Exactly one gold element (rank) and one jade element (the vein) — §2.2's accents stay
 * scarce enough to mean something.
 */
export function SectHero() {
  const sectLocation = useGameStore((s) => s.state.sectLocation)
  const world = useGameStore((s) => s.state.world)
  const hallLevel = useGameStore((s) => s.state.buildings[SECT_HALL_ID]?.level ?? 1)
  const simElapsedMs = useGameStore((s) => s.state.simClock.totalElapsedMs)
  const worldElapsedMs = useGameStore((s) => s.state.worldClock.totalElapsedMs)

  if (!sectLocation) return null

  const site = getSite(world, sectLocation.sectSiteId)
  const province = getProvinceDef(sectLocation.provinceId)
  const vein = getSpiritVeinDef(province.spiritVeinTier)
  const rank = computeSectRank(hallLevel)
  const { day, timeOfDay, progress } = msToWorldTime(worldElapsedMs)

  return (
    <header className="sect-hero">
      {/*
       * §20's atmosphere layer as SVG, not raster: two flat ridges, masked out toward the
       * top. Without it the hero is a flat fill, which is the dashboard again.
       */}
      <svg className="sect-hero-art" viewBox="0 0 480 96" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 96V62l64-26 58 30 46-16 62 30 54-24 68 28 128-34v46z" fill="var(--surface)" />
        <path d="M0 96V78l86-22 52 20 74-14 58 22 60-18 76 24 74-12v18z" fill="var(--surface-raised)" />
      </svg>

      {/*
       * The sect emblem (brief A12, §18's missing insignia), landed 2026-08-12 into the
       * drop-in point this row was built for. Decorative only — the seat name beside it
       * is the accessible label — so it carries an empty alt and stays out of the tab
       * order. `.sect-hero-crest` clips it to a circle, which is why the art ships
       * without an alpha channel.
       */}
      <div className="sect-hero-row">
        <img className="sect-hero-crest" src={EMBLEM_ART} alt="" draggable={false} />
        <div className="sect-hero-ident">
          <h1 className="sect-hero-name">{site.name}</h1>
          <p className="sect-hero-seat">
            {province.name} &middot; {province.theme} &middot; {province.climate}
          </p>
          <p className="sect-hero-rank">{rank.name}</p>
          <p className="sect-hero-vein">
            {vein.name} Spirit Vein &middot; cultivation ×{vein.cultivationMult} &middot; recruits ×
            {vein.recruitQualityMult}
          </p>
          <p className="sect-hero-meta">
            Sect Hall Lv{hallLevel} &middot; buildings cap Lv{rank.levelCap}
            {rank.nextRankAtHallLevel !== undefined && (
              <>
                {' '}
                &middot; <span className="hl">next rank at Lv{rank.nextRankAtHallLevel}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Both clocks, collapsed into one line. The stopwatch was the largest type in the game. */}
      <div className="sect-hero-chronology">
        <span className="sect-hero-phase">
          <UiIcon name={timeOfDay === 'day' ? 'sun' : 'moon'} size={16} />
          Day {day} &middot; {timeOfDay === 'day' ? 'Daytime' : 'Night'}
        </span>
        <span className="sect-hero-age">
          Since founding <span className="sect-hero-age-value">{formatElapsed(simElapsedMs)}</span>
        </span>
      </div>

      {/* The day/night cycle as the hero's own bottom rule — 2px, so it costs no height. */}
      <div className="progress-bar hairline">
        <div className={`progress-bar-fill ${timeOfDay}`} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </header>
  )
}
