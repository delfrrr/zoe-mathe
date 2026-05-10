import { useEffect, useMemo, useState } from 'react'
import {
  generatePuzzle as generatePuzzleLib,
  TIERS,
  type Config,
  type Op,
  type TierKey,
} from './lib/generator'
import './App.css'

type Preset = {
  key: 'starter' | 'standard' | 'expert'
  label: string
  meta: string
  config: Config
}

const PRESETS: Preset[] = [
  {
    key: 'starter',
    label: 'Starter',
    meta: '20 ops · 0-9 · +/-',
    config: { operations: 20, selfChecks: 4, tier: '0-9', ops: ['+', '-'] },
  },
  {
    key: 'standard',
    label: 'Standard',
    meta: '30 ops · 10-99 · +/-',
    config: { operations: 30, selfChecks: 3, tier: '10-99', ops: ['+', '-'] },
  },
  {
    key: 'expert',
    label: 'Expert',
    meta: '70 ops · 100-999 · +-x/',
    config: {
      operations: 70,
      selfChecks: 6,
      tier: '100-999',
      ops: ['+', '-', 'x', '/'],
    },
  },
]

const OP_LABEL: Record<Op, string> = {
  '+': '+',
  '-': '-',
  x: '×',
  '/': '÷',
}

function randomSeedCode() {
  const n = Math.floor(Math.random() * 36 ** 6)
  return n.toString(36).toUpperCase().padStart(6, '0')
}

function secondsPerStep(tier: TierKey, ops: Op[]) {
  const tierBase: Record<TierKey, number> = {
    '0-9': 5,
    '10-99': 8,
    '100-999': 12,
    '1k-9k': 16,
  }
  let sec = tierBase[tier]
  if (ops.includes('x')) sec += 2
  if (ops.includes('/')) sec += 2
  return sec
}

function formatMinutes(totalSec: number) {
  const min = Math.max(1, Math.round(totalSec / 60))
  return `≈ ${min} min`
}

function App() {
  const [activePreset, setActivePreset] = useState<Preset['key']>('standard')
  const [config, setConfig] = useState<Config>(PRESETS[1].config)
  const [seed, setSeed] = useState(() => {
    const url = new URL(window.location.href)
    const s = (url.searchParams.get('seed') || '').toUpperCase()
    if (/^[A-Z0-9]{6}$/.test(s)) return s
    return randomSeedCode()
  })

  const puzzle = useMemo(() => generatePuzzleLib(config, seed), [config, seed])

  const timeSec = config.operations * secondsPerStep(config.tier, config.ops)
  const timeLabel = formatMinutes(timeSec)
  const displayDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    [],
  )

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('seed', seed)
    window.history.replaceState({}, '', url.toString())
  }, [seed])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const key = e.key.toLowerCase()
      if (key === 'r') {
        e.preventDefault()
        setSeed(randomSeedCode())
      }
      if (key === 'p') {
        e.preventDefault()
        window.print()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const pathSet = useMemo(() => new Set(puzzle.path), [puzzle.path])
  const pathIndexByCell = useMemo(
    () => new Map(puzzle.path.map((idx, pathIndex) => [idx, pathIndex])),
    [puzzle.path],
  )
  const cellMap = useMemo(() => new Map(puzzle.cells.map((c) => [c.idx, c])), [puzzle.cells])

  const usableW = 640
  const usableH = 700
  const stepX = usableW / Math.max(1, puzzle.cols - 1)
  const stepY = usableH / Math.max(1, puzzle.rows - 1)
  const radius = Math.max(14, Math.min(stepX, stepY) * 0.28)

  const toXY = (idx: number) => {
    const cell = cellMap.get(idx)
    if (!cell) return { x: 0, y: 0 }
    return {
      x: 80 + cell.col * stepX,
      y: 70 + cell.row * stepY,
    }
  }

  const densityScale = config.operations >= 70 ? 0.82 : config.operations >= 45 ? 0.9 : 1
  const arrowOpFont = Math.round(14 * densityScale)
  const arrowNumFont = Math.round(13 * densityScale)

  const applyPreset = (preset: Preset) => {
    setActivePreset(preset.key)
    setConfig(preset.config)
  }

  const updateOps = (op: Op) => {
    setActivePreset('standard')
    setConfig((prev) => {
      const has = prev.ops.includes(op)
      if (has && prev.ops.length === 1) return prev
      const nextOps = has ? prev.ops.filter((o) => o !== op) : [...prev.ops, op]
      return { ...prev, ops: nextOps }
    })
  }

  return (
    <div className="app-root">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="logo">✣</div>
          <div>
            <div className="brand-name">Pathwise</div>
            <div className="brand-sub">Math-flow worksheets</div>
          </div>
        </div>

        <section className="panel">
          <h3>Difficulty</h3>
          <div className="preset-grid">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                className={preset.key === activePreset ? 'preset active' : 'preset'}
                onClick={() => applyPreset(preset)}
                type="button"
              >
                <span>{preset.label}</span>
                <small>{preset.meta}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Generation</h3>
            <span className="badge">{timeLabel}</span>
          </div>

          <label className="field">
            <div className="row between">
              <span>Number of operations</span>
              <span className="mono">{config.operations}</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              value={config.operations}
              onChange={(e) => {
                setActivePreset('standard')
                setConfig((p) => ({ ...p, operations: Number(e.target.value) }))
              }}
            />
            <small>Time to complete {timeLabel}</small>
          </label>

          <label className="field">
            <div className="row between">
              <span>Self-check values</span>
              <span className="mono">{config.selfChecks}</span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              value={config.selfChecks}
              onChange={(e) => {
                setActivePreset('standard')
                setConfig((p) => ({ ...p, selfChecks: Number(e.target.value) }))
              }}
            />
            <small>Start and final value are always shown</small>
          </label>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Numbers</h3>
            <span className="badge">{TIERS[config.tier].label}</span>
          </div>
          <div className="segmented">
            {(Object.keys(TIERS) as TierKey[]).map((tier) => (
              <button
                type="button"
                key={tier}
                className={config.tier === tier ? 'seg active' : 'seg'}
                onClick={() => {
                  setActivePreset('standard')
                  setConfig((p) => ({ ...p, tier }))
                }}
              >
                {tier}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>Operations</h3>
          <div className="ops">
            {(['+', '-', 'x', '/'] as Op[]).map((op) => (
              <button
                key={op}
                type="button"
                className={config.ops.includes(op) ? 'op-pill active' : 'op-pill'}
                onClick={() => updateOps(op)}
              >
                {OP_LABEL[op]}
              </button>
            ))}
          </div>
          <small>At least one operation must stay enabled</small>
        </section>

        <section className="panel stats">
          <div className="panel-head">
            <h3>Generated</h3>
            <span className="badge mono">#{seed.toLowerCase()}</span>
          </div>
          <div className="stat-row"><span>Steps</span><strong>{Math.max(0, puzzle.path.length - 1)}</strong></div>
          <div className="stat-row"><span>Time est.</span><strong>{timeLabel}</strong></div>
          <div className="stat-row"><span>Final value</span><strong>{puzzle.finalValue}</strong></div>
        </section>

        <div className="actions no-print">
          <button className="btn" type="button" onClick={() => setSeed(randomSeedCode())}>
            Regenerate <span className="kbd">R</span>
          </button>
          <button className="btn primary" type="button" onClick={() => window.print()}>
            Print worksheet <span className="kbd">P</span>
          </button>
        </div>
      </aside>

      <main className="preview">
        <div className="paper">
          <header className="paper-header">
            <div>
              <h1>Math-Flow Quest</h1>
              <p>
                Start at the filled circle. Follow each arrow and apply its operation to
                the previous answer.
              </p>
            </div>
            <div className="meta mono">
              <div><span>Date</span><b>{displayDate}</b></div>
              <div><span>Seed</span><b>{seed}</b></div>
            </div>
          </header>

          <div className="paper-body">
            <div className="legend mono">
              <span>Steps <b>{Math.max(0, puzzle.path.length - 1)}</b></span>
              <span>Range <b>{config.tier}</b></span>
              <span>
                Ops <b>{config.ops.map((o) => OP_LABEL[o]).join(' ')}</b>
              </span>
              <span>Time <b>{timeLabel.replace('≈ ', '')}</b></span>
            </div>

            <svg className="puzzle" viewBox="0 0 800 850" aria-label="Math flow puzzle">
              <defs>
                <marker
                  id="arrowHead"
                  markerWidth="3.4"
                  markerHeight="3.4"
                  refX="2.8"
                  refY="1.7"
                  orient="auto"
                >
                  <path d="M0 0 L3.4 1.7 L0 3.4 z" fill="#181818" />
                </marker>
              </defs>

              {puzzle.edges.map((edge, i) => {
                const a = toXY(edge.from)
                const b = toXY(edge.to)
                const dx = b.x - a.x
                const dy = b.y - a.y
                const len = Math.max(1, Math.hypot(dx, dy))
                const ux = dx / len
                const uy = dy / len
                const sx = a.x + ux * (radius + 2)
                const sy = a.y + uy * (radius + 2)
                const ex = b.x - ux * (radius + 4)
                const ey = b.y - uy * (radius + 4)
                const mx = sx + (ex - sx) * 0.4
                const my = sy + (ey - sy) * 0.4
                const horiz = Math.abs(dx) > 0.1

                return (
                  <g key={i}>
                    <line
                      x1={sx}
                      y1={sy}
                      x2={ex}
                      y2={ey}
                      stroke="#1a1a1a"
                      strokeWidth={2.2}
                      markerEnd="url(#arrowHead)"
                    />
                    {horiz ? (
                      <g transform={`translate(${mx} ${my})`}>
                        <text
                          className="edge-op mono"
                          x={0}
                          y={-12}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ fontSize: arrowOpFont, fontWeight: 600 }}
                        >
                          {OP_LABEL[edge.op]}
                        </text>
                        <text
                          className="edge-val mono"
                          x={0}
                          y={14}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ fontSize: arrowNumFont, fontWeight: 600 }}
                        >
                          {edge.operand}
                        </text>
                      </g>
                    ) : (
                      <g transform={`translate(${mx - 2} ${my})`}>
                        <text
                          className="edge-op mono"
                          x={-9}
                          y={4}
                          textAnchor="end"
                          style={{ fontSize: arrowOpFont, fontWeight: 600 }}
                        >
                          {OP_LABEL[edge.op]}
                        </text>
                        <text
                          className="edge-val mono"
                          x={9}
                          y={4}
                          textAnchor="start"
                          style={{ fontSize: arrowNumFont, fontWeight: 600 }}
                        >
                          {edge.operand}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}

              {puzzle.cells.filter((cell) => pathSet.has(cell.idx)).map((cell) => {
                const { x, y } = toXY(cell.idx)
                const pathIndex = pathIndexByCell.get(cell.idx) ?? -1
                const isStart = pathIndex === 0
                const shown = pathIndex >= 0 ? puzzle.shownValues[pathIndex] : undefined

                return (
                  <g key={cell.idx}>
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={isStart ? '#121212' : 'transparent'}
                      stroke="#282828"
                      strokeWidth={2.2}
                    />
                    {shown !== undefined && (
                      <text
                        x={x}
                        y={y + 5}
                        className="cell-value mono"
                        fill={isStart ? '#fff' : '#111'}
                        textAnchor="middle"
                        style={{ fontSize: arrowNumFont, fontWeight: 600 }}
                      >
                        {shown}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          <footer className="paper-footer mono">
            <span>Pathwise Worksheet</span>
            <span>Final value sanity check: {puzzle.finalValue}</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
