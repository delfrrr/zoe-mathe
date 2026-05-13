import { useEffect, useMemo, useState } from 'react'
import { TIERS, generatePuzzle, type Config, type Op, type Puzzle, type TierKey } from './lib/generator'
import './App.css'

type UiConfig = Config & {
  stickerMode: boolean
  showSolutions: boolean
}

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
    meta: '20 ops · 0-9 · +',
    config: { operations: 20, tier: '0-9', ops: ['+'] },
  },
  {
    key: 'standard',
    label: 'Standard',
    meta: '40 ops · 10-99 · +/-',
    config: { operations: 40, tier: '10-99', ops: ['+', '-'] },
  },
  {
    key: 'expert',
    label: 'Expert',
    meta: '70 ops · 100-999 · +-x/',
    config: { operations: 70, tier: '100-999', ops: ['+', '-', 'x', '/'] },
  },
]

const OP_LABEL: Record<Op, string> = { '+': '+', '-': '-', x: 'x', '/': '/' }
const OP_RENDER: Record<Op, string> = { '+': '+', '-': '−', x: '×', '/': '÷' }

function randomSeedCode() {
  const n = Math.floor(Math.random() * 36 ** 6)
  return n.toString(36).toUpperCase().padStart(6, '0')
}

function secondsPerStep(tier: TierKey, ops: Op[]) {
  const tierBase: Record<TierKey, number> = { '0-9': 4, '10-99': 7, '100-999': 12, '1k-9k': 18 }
  let sec = tierBase[tier]
  if (ops.includes('x')) sec += 1.5
  if (ops.includes('/')) sec += 3
  return sec
}

function estimateMinutes(operations: number, tier: TierKey, ops: Op[]) {
  return Math.max(1, Math.round((operations * secondsPerStep(tier, ops)) / 60))
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())
}

function HouseIcon({ kind, size = 44 }: { kind: 'ghost' | 'crown'; size?: number }) {
  if (kind === 'ghost') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M14 30 a18 18 0 0 1 36 0 v22 l-5 -5 -5 5 -5 -5 -5 5 -5 -5 -5 5 -5 -5 -1 -1 z"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="26" cy="29" r="1.6" fill="#1a1a1a" />
        <circle cx="38" cy="29" r="1.6" fill="#1a1a1a" />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M10 22 l8 22 h28 l8 -22 -11 8 -11 -16 -11 16 -11 -8 z"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="16" y1="48" x2="48" y2="48" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function HousesFooter() {
  return (
    <div className="houses">
      <div className="house house-left">
        <div className="house-head">
          <HouseIcon kind="ghost" />
          <div className="house-title">Not Yet</div>
        </div>
        <div className="parking-grid">
          {Array.from({ length: 4 }).map((_, idx) => (
            <span key={`left-${idx}`} className="parking-slot" />
          ))}
        </div>
      </div>
      <div className="house house-right">
        <div className="house-head">
          <HouseIcon kind="crown" />
          <div className="house-title">You Got It</div>
        </div>
        <div className="parking-grid">
          {Array.from({ length: 4 }).map((_, idx) => (
            <span key={`right-${idx}`} className="parking-slot" />
          ))}
        </div>
      </div>
    </div>
  )
}

function PuzzleSVG({ puzzle, showAnswers, stickerMode }: { puzzle: Puzzle; showAnswers: boolean; stickerMode: boolean }) {
  const pathIndexByCell = new Map(puzzle.path.map((idx, pathIdx) => [idx, pathIdx]))
  const checkpointSet = new Set(puzzle.checkpointPathIndices)
  const cellById = new Map(puzzle.cells.map((c) => [c.idx, c]))
  const usableW = 640
  const usableH = 700
  const stepX = usableW / Math.max(1, puzzle.cols - 1)
  const stepY = usableH / Math.max(1, puzzle.rows - 1)
  const R = Math.max(14, Math.min(stepX, stepY) * 0.28)
  const STROKE = 2.2
  const steps = Math.max(0, puzzle.path.length - 1)
  const densityScale = steps >= 70 ? 0.82 : steps >= 45 ? 0.9 : 1
  const arrowOpFont = Math.round(14 * densityScale)
  const arrowNumFont = Math.round(13 * densityScale)

  const toXY = (idx: number) => {
    const cell = cellById.get(idx)
    if (!cell) return { x: 0, y: 0 }
    return {
      x: 80 + cell.col * stepX,
      y: 70 + cell.row * stepY,
    }
  }

  return (
    <svg className="puzzle-svg" viewBox="0 0 800 850" aria-label="Math flow puzzle">
      <defs>
        <marker id="arrowHead" markerWidth="3.4" markerHeight="3.4" refX="2.8" refY="1.7" orient="auto">
          <path d="M0 0 L3.4 1.7 L0 3.4 z" fill="#1a1a1a" />
        </marker>
        <filter id="stickerShadow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" />
          <feOffset dx="1" dy="4" result="offsetBlur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.55" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {puzzle.edges.map((edge, i) => {
        const a = toXY(edge.from)
        const b = toXY(edge.to)
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.max(1, Math.hypot(dx, dy))
        const ux = dx / len
        const uy = dy / len
        const x1 = a.x + ux * (R + 2)
        const y1 = a.y + uy * (R + 2)
        const x2 = b.x - ux * (R + 4)
        const y2 = b.y - uy * (R + 4)
        const mx = x1 + (x2 - x1) * 0.4
        const my = y1 + (y2 - y1) * 0.4
        const isHoriz = Math.abs(dx) > 0.1

        return (
          <g key={`edge-${i}`}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#1a1a1a"
              strokeWidth={STROKE}
              markerEnd="url(#arrowHead)"
            />
            {isHoriz ? (
              <g transform={`translate(${mx} ${my})`}>
                <text
                  x={0}
                  y={-12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="svg-op"
                  style={{ fontSize: arrowOpFont, fontWeight: 600 }}
                >
                  {OP_RENDER[edge.op]}
                </text>
                <text
                  x={0}
                  y={14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="svg-operand"
                  style={{ fontSize: arrowNumFont, fontWeight: 600 }}
                >
                  {edge.operand}
                </text>
              </g>
            ) : (
              <g transform={`translate(${mx - 2} ${my})`}>
                <text
                  x={-9}
                  y={4}
                  textAnchor="end"
                  className="svg-op"
                  style={{ fontSize: arrowOpFont, fontWeight: 600 }}
                >
                  {OP_RENDER[edge.op]}
                </text>
                <text
                  x={9}
                  y={4}
                  textAnchor="start"
                  className="svg-operand"
                  style={{ fontSize: arrowNumFont, fontWeight: 600 }}
                >
                  {edge.operand}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {puzzle.cells.map((cell) => {
        const { x, y } = toXY(cell.idx)
        const pathIdx = pathIndexByCell.get(cell.idx)
        const onPath = pathIdx !== undefined
        if (!onPath) return null
        const isStart = pathIdx === 0
        const isCheckpoint = pathIdx !== undefined && checkpointSet.has(pathIdx)

        const fill = isStart ? '#1a1a1a' : isCheckpoint ? '#ececec' : '#fefcf6'
        const showValue =
          isStart ||
          (onPath && showAnswers) ||
          (stickerMode && !showAnswers && isCheckpoint)

        return (
          <g key={`cell-${cell.idx}`}>
            <circle
              cx={x}
              cy={y}
              r={R}
              fill={fill}
              stroke="#1a1a1a"
              strokeWidth={STROKE}
              opacity={1}
            />
            {showValue && pathIdx !== undefined && (
              <text x={x} y={y + 5} textAnchor="middle" className="svg-value" fill={isStart ? '#fff' : '#1a1a1a'}>
                {puzzle.pathValues[pathIdx]}
              </text>
            )}
            {stickerMode && !showAnswers && isCheckpoint && !isStart && (
              <circle
                className="sticker-disc"
                cx={x}
                cy={y}
                r={R * 1.25}
                fill="#f7b918"
                opacity="0.98"
                filter="url(#stickerShadow)"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function App() {
  const [activePreset, setActivePreset] = useState<Preset['key']>('standard')
  const [config, setConfig] = useState<UiConfig>({
    ...PRESETS[1].config,
    stickerMode: true,
    showSolutions: false,
  })
  const [seed, setSeed] = useState(() => {
    const url = new URL(window.location.href)
    const s = (url.searchParams.get('seed') || '').toUpperCase()
    if (/^[A-Z0-9]{6}$/.test(s)) return s
    return randomSeedCode()
  })

  const coreConfig: Config = useMemo(
    () => ({ operations: config.operations, tier: config.tier, ops: config.ops }),
    [config.operations, config.tier, config.ops],
  )

  const puzzle = useMemo(
    () => generatePuzzle(coreConfig, seed, config.stickerMode ? 4 : 0),
    [coreConfig, seed, config.stickerMode],
  )

  const timeLabel = useMemo(
    () => `≈ ${estimateMinutes(config.operations, config.tier, config.ops)} min`,
    [config.operations, config.tier, config.ops],
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

  const applyPreset = (preset: Preset) => {
    setActivePreset(preset.key)
    setConfig((prev) => ({ ...prev, ...preset.config }))
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

        <div className="sidebar-scroll">
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
          </section>

          <section className="panel">
            <h3>Mode</h3>
            <div className="segmented two-col">
              <button
                type="button"
                className={config.stickerMode ? 'seg active' : 'seg'}
                onClick={() => setConfig((p) => ({ ...p, stickerMode: true }))}
              >
                Sticker
              </button>
              <button
                type="button"
                className={!config.stickerMode ? 'seg active' : 'seg'}
                onClick={() => setConfig((p) => ({ ...p, stickerMode: false }))}
              >
                Classic
              </button>
            </div>
          <small className="mode-help">
            {config.stickerMode
              ? '4 answers are hidden under stickers along the path. Your child writes a guess on top, peeks to check, then moves the sticker to You Got It or Not Yet.'
              : 'No intermediate answers. Solve end-to-end.'}
          </small>
          <div className="solution-toggle">
            <div>
              <div className="toggle-label">Print answer key</div>
              <small>Adds a second page with all values filled in.</small>
              </div>
              <input
                type="checkbox"
                className="switch"
                checked={config.showSolutions}
                onChange={(e) => setConfig((p) => ({ ...p, showSolutions: e.target.checked }))}
              />
            </div>
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
                  {OP_RENDER[op]}
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
            <div className="stat-row">
              <span>Steps</span>
              <strong>{Math.max(0, puzzle.path.length - 1)}</strong>
            </div>
            <div className="stat-row">
              <span>Time est.</span>
              <strong>{timeLabel}</strong>
            </div>
            <div className="stat-row">
              <span>Final value</span>
              <strong>{puzzle.finalValue}</strong>
            </div>
          </section>
        </div>

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
        <div className="preview-stage">
          <div className="paper">
            <header className="paper-header">
              <div>
                <h1>Math-Flow Quest</h1>
                <p>
                  {config.stickerMode
                    ? 'Solve each circle. Peek under the sticker to check. Park it on the right if you got it — on the left if not.'
                    : 'Start at the filled circle. Follow each arrow and apply its operation to the previous answer.'}
                </p>
              </div>
              <div className="meta mono">
                <div>
                  <span>Date</span>
                  <b>{todayLabel()}</b>
                </div>
                <div>
                  <span>Seed</span>
                  <b>{seed}</b>
                </div>
              </div>
            </header>

            <div className="paper-body">
              <div className="legend mono">
                <span>
                  Steps <b>{Math.max(0, puzzle.path.length - 1)}</b>
                </span>
                <span>
                  Range <b>{config.tier}</b>
                </span>
                <span>
                  Ops <b>{config.ops.map((o) => OP_LABEL[o]).join(' ')}</b>
                </span>
                <span>
                  Time <b>{timeLabel.replace('≈ ', '≈ ')}</b>
                </span>
                {config.stickerMode && (
                  <span className="legend-hint">
                    <span className="legend-hint-dot" />
                    Cover the grey circles with stickers
                  </span>
                )}
              </div>

              <div className="puzzle-wrap">
                <PuzzleSVG puzzle={puzzle} showAnswers={false} stickerMode={config.stickerMode} />
              </div>

              {config.stickerMode && <HousesFooter />}
            </div>

          </div>

          {config.showSolutions && (
            <div className="paper solutions-page">
              <header className="paper-header">
                <div>
                  <h1>Answer key</h1>
                  <p>Solutions for the worksheet above. Keep this page for the parent.</p>
                </div>
                <div className="meta mono">
                  <div>
                    <span>Seed</span>
                    <b>{seed}</b>
                  </div>
                </div>
              </header>
              <div className="paper-body">
                <div className="puzzle-wrap">
                  <PuzzleSVG puzzle={puzzle} showAnswers={true} stickerMode={false} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
