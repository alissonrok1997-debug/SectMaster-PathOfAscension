import { useMemo, useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getFoundingOptions } from '../game/engine/world/founding'
import { getProvinceDef } from '../game/data/world/provinceDefs'
import { getSectSiteDef } from '../game/data/world/sectSiteDefs'
import { SpiritVeinBadge } from './SpiritVeinBadge'
import { ModifierBundleList } from './ModifierBundleList'
import { ProvinceSelectStep } from './ProvinceSelectStep'
import { SectSiteSelectStep } from './SectSiteSelectStep'

type Step = 'province' | 'site' | 'confirm'

/**
 * Pre-game founding flow (WORLD_MAP_DESIGN §12.2). Rendered by App instead of the
 * game shell while `state.sectLocation` is undefined. Which step the player is on
 * is LOCAL React state, never GameState — persisting UI navigation into the save
 * is a classic save-version-churn source (§12.1). The only game-state write is
 * the final foundSect() call.
 */
export function FoundingScreen() {
  const foundSect = useGameStore((s) => s.foundSect)
  const options = useMemo(() => getFoundingOptions(), [])

  const [step, setStep] = useState<Step>('province')
  const [provinceId, setProvinceId] = useState<string | undefined>(undefined)
  const [sectSiteId, setSectSiteId] = useState<string | undefined>(undefined)

  const selectedOption = options.find((o) => o.province.id === provinceId)

  return (
    <div className="founding-screen">
      <header className="founding-header">
        <h1>Found Your Sect</h1>
        <p className="panel-hint">
          Where your sect takes root shapes the entire path of ascension. This choice is permanent for this save.
        </p>
        <ol className="founding-steps">
          <li className={step === 'province' ? 'active' : provinceId ? 'done' : ''}>1 · Province</li>
          <li className={step === 'site' ? 'active' : sectSiteId ? 'done' : ''}>2 · Sect Site</li>
          <li className={step === 'confirm' ? 'active' : ''}>3 · Confirm</li>
        </ol>
      </header>

      {step === 'province' && (
        <section className="panel">
          <h2>Choose a Province</h2>
          <p className="panel-hint">
            The Spirit Vein sets your ceiling; difficulty and hostile control are the price of a richer one.
          </p>
          <ProvinceSelectStep
            options={options}
            selectedProvinceId={provinceId}
            onSelect={(id) => {
              setProvinceId(id)
              // A different province invalidates a previously-picked site.
              setSectSiteId(undefined)
            }}
          />
          <div className="founding-nav">
            <button disabled={!provinceId} onClick={() => setStep('site')}>
              Next: Sect Site
            </button>
          </div>
        </section>
      )}

      {step === 'site' && selectedOption && (
        <section className="panel">
          <h2>Choose a Sect Site in {selectedOption.province.name}</h2>
          <p className="panel-hint">Same Spirit Vein — pick the shape of your trade-offs.</p>
          <SectSiteSelectStep sites={selectedOption.sites} selectedSiteId={sectSiteId} onSelect={setSectSiteId} />
          <div className="founding-nav">
            <button className="secondary" onClick={() => setStep('province')}>
              Back
            </button>
            <button disabled={!sectSiteId} onClick={() => setStep('confirm')}>
              Next: Confirm
            </button>
          </div>
        </section>
      )}

      {step === 'confirm' && provinceId && sectSiteId && (
        <section className="panel">
          <h2>Confirm Your Founding</h2>
          {(() => {
            const province = getProvinceDef(provinceId)
            const site = getSectSiteDef(sectSiteId)
            return (
              <div className="founding-confirm">
                <p>
                  <strong>{site.name}</strong>, in the <strong>{province.name}</strong>.
                </p>
                <p>
                  <SpiritVeinBadge tier={province.spiritVeinTier} />
                </p>
                <p className="panel-hint">
                  {site.buildingSlots} building slots · travel offset {site.travelUnitOffset >= 0 ? '+' : ''}
                  {site.travelUnitOffset}
                </p>
                <ModifierBundleList bundle={site.modifiers} />
                <p className="founding-warning">
                  ⚠ This choice is <strong>permanent</strong> for this save. It cannot be changed once confirmed.
                </p>
                <div className="founding-nav">
                  <button className="secondary" onClick={() => setStep('site')}>
                    Back
                  </button>
                  <button onClick={() => foundSect(provinceId, sectSiteId)}>Found the Sect</button>
                </div>
              </div>
            )
          })()}
        </section>
      )}
    </div>
  )
}
