import { useEffect, useMemo, useState } from 'react'
import {
  TIERS,
  generatePuzzle,
  type Config,
  type Op,
  type Puzzle,
  type TierKey,
} from './lib/generator'
import {
  generateAreaWorksheet,
  maxBoxesForPuzzlesPerPage,
  maxPuzzlesForBoxesPerPuzzle,
  normalizeAreaConfig,
  type AreaDimensionLabel,
  type AreaNumberSize,
  type AreaPuzzle,
  type AreaPuzzleConfig,
  type AreaRect,
} from './lib/areaGenerator'
import { areaClueDisplayValue, areaStickerAnswerValue } from './lib/areaPresentation'
import './App.css'

type PuzzleFamily = 'math-flow' | 'area'

type UiConfig = Config & {
  stickerMode: boolean
  showSolutions: boolean
}

type PresetConfig = Omit<Config, 'operations'> & {
  operations?: number
}

type Preset = {
  key: 'starter' | 'standard' | 'expert' | 'tables'
  label: string
  meta: string
  config: PresetConfig
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
  {
    key: 'tables',
    label: 'Tables',
    meta: 'current ops · 2-9 · x/',
    config: { tier: '10-99', ops: ['x', '/'], drillMode: 'multiplication-table' },
  },
]

const OP_LABEL: Record<Op, string> = { '+': '+', '-': '-', x: 'x', '/': '/' }
const OP_RENDER: Record<Op, string> = { '+': '+', '-': '−', x: '×', '/': '÷' }
const AREA_SIZE_LABEL: Record<AreaNumberSize, string> = {
  1: 'Small',
  2: 'Medium',
  3: 'Large',
  4: 'XL',
}

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

function HousesFooter({ slotCount = 4 }: { slotCount?: number }) {
  const slots = Math.max(1, Math.min(6, slotCount))
  return (
    <div className="houses">
      <div className="house house-left">
        <div className="house-head">
          <HouseIcon kind="ghost" />
          <div className="house-title">Not Yet</div>
        </div>
        <div className="parking-grid">
          {Array.from({ length: slots }).map((_, idx) => (
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
          {Array.from({ length: slots }).map((_, idx) => (
            <span key={`right-${idx}`} className="parking-slot" />
          ))}
        </div>
      </div>
    </div>
  )
}

function AreaAnswerTarget({ puzzle }: { puzzle: AreaPuzzle }) {
  return (
    <div className="area-answer-target" data-area-answer-target={puzzle.id} aria-label={`Answer sticker target for ${puzzle.id}`}>
      <span className="area-answer-value">{areaStickerAnswerValue(puzzle.answer)}</span>
      <svg className="area-answer-sticker" viewBox="0 0 64 64" aria-hidden="true">
        <circle className="sticker-disc" cx="32" cy="32" r="29" fill="#f7b918" />
      </svg>
    </div>
  )
}

function rectSidePosition(rect: AreaRect, label: AreaDimensionLabel, scale: number, ox: number, oy: number) {
  const x = ox + rect.x * scale
  const y = oy + rect.y * scale
  const w = rect.w * scale
  const h = rect.h * scale
  const gap = 18
  const tick = 7
  if (label.side === 'top') {
    const ly = y - gap
    return { x1: x, y1: ly, x2: x + w, y2: ly, tx: x + w / 2, ty: ly - 7, ticks: [[x, ly - tick, x, ly + tick], [x + w, ly - tick, x + w, ly + tick]] }
  }
  if (label.side === 'bottom') {
    const ly = y + h + gap
    return { x1: x, y1: ly, x2: x + w, y2: ly, tx: x + w / 2, ty: ly + 15, ticks: [[x, ly - tick, x, ly + tick], [x + w, ly - tick, x + w, ly + tick]] }
  }
  if (label.side === 'left') {
    const lx = x - gap
    return { x1: lx, y1: y, x2: lx, y2: y + h, tx: lx - 10, ty: y + h / 2 + 4, ticks: [[lx - tick, y, lx + tick, y], [lx - tick, y + h, lx + tick, y + h]] }
  }
  const lx = x + w + gap
  return { x1: lx, y1: y, x2: lx, y2: y + h, tx: lx + 10, ty: y + h / 2 + 4, ticks: [[lx - tick, y, lx + tick, y], [lx - tick, y + h, lx + tick, y + h]] }
}

function AreaPuzzleSVG({ puzzle, showAnswers, compact = false }: { puzzle: AreaPuzzle; showAnswers: boolean; compact?: boolean }) {
  const minX = Math.min(...puzzle.rects.map((rect) => rect.x))
  const minY = Math.min(...puzzle.rects.map((rect) => rect.y))
  const maxX = Math.max(...puzzle.rects.map((rect) => rect.x + rect.w))
  const maxY = Math.max(...puzzle.rects.map((rect) => rect.y + rect.h))
  const widthUnits = maxX - minX
  const heightUnits = maxY - minY
  const scale = Math.min(430 / Math.max(1, widthUnits), (compact ? 180 : 250) / Math.max(1, heightUnits), 24)
  const drawingW = widthUnits * scale
  const drawingH = heightUnits * scale
  const ox = 80 - minX * scale + (430 - drawingW) / 2
  const oy = 48 - minY * scale + ((compact ? 180 : 250) - drawingH) / 2
  const viewH = compact ? 290 : 360

  return (
    <svg className="area-puzzle-svg" viewBox={`0 0 590 ${viewH}`} aria-label="Area puzzle">
      {puzzle.rects.map((rect) => {
        const x = ox + rect.x * scale
        const y = oy + rect.y * scale
        const w = rect.w * scale
        const h = rect.h * scale
        const isUnknownArea = puzzle.unknown.kind === 'area' && puzzle.unknown.rectId === rect.id
        return (
          <g key={rect.id}>
            <rect className="area-box" x={x} y={y} width={w} height={h} />
            <text className="area-label" x={x + w / 2} y={y + h / 2 + 5} textAnchor="middle">
              {areaClueDisplayValue(rect.area, isUnknownArea, showAnswers)}
            </text>
          </g>
        )
      })}

      {puzzle.labels.map((label) => {
        const rect = puzzle.rects.find((candidate) => candidate.id === label.rectId)
        if (!rect) return null
        const pos = rectSidePosition(rect, label, scale, ox, oy)
        const isVertical = label.side === 'left' || label.side === 'right'
        return (
          <g key={label.id} className="area-dimension">
            <line x1={pos.x1} y1={pos.y1} x2={pos.x2} y2={pos.y2} />
            {pos.ticks.map((tick, idx) => (
              <line key={`${label.id}-tick-${idx}`} x1={tick[0]} y1={tick[1]} x2={tick[2]} y2={tick[3]} />
            ))}
            <text className="area-side-label" x={pos.tx} y={pos.ty} textAnchor={isVertical && label.side === 'left' ? 'end' : isVertical ? 'start' : 'middle'}>
              {areaClueDisplayValue(label.value, label.hidden, showAnswers)}
            </text>
          </g>
        )
      })}
    </svg>
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
  const [puzzleFamily, setPuzzleFamily] = useState<PuzzleFamily>('math-flow')
  const [activePreset, setActivePreset] = useState<Preset['key']>('standard')
  const [config, setConfig] = useState<UiConfig>({
    operations: 40,
    tier: '10-99',
    ops: ['+', '-'],
    stickerMode: true,
    showSolutions: false,
  })
  const [areaConfig, setAreaConfig] = useState<AreaPuzzleConfig>({
    puzzlesPerPage: 2,
    numberSize: 2,
    boxesPerPuzzle: 3,
  })
  const [seed, setSeed] = useState(() => {
    const url = new URL(window.location.href)
    const s = (url.searchParams.get('seed') || '').toUpperCase()
    if (/^[A-Z0-9]{6}$/.test(s)) return s
    return randomSeedCode()
  })

  const coreConfig: Config = useMemo(
    () => ({
      operations: config.operations,
      tier: config.tier,
      ops: config.ops,
      ...(config.drillMode ? { drillMode: config.drillMode } : {}),
    }),
    [config.operations, config.tier, config.ops, config.drillMode],
  )

  const puzzle = useMemo(
    () => generatePuzzle(coreConfig, seed, config.stickerMode ? 4 : 0),
    [coreConfig, seed, config.stickerMode],
  )

  const normalizedAreaConfig = useMemo(() => normalizeAreaConfig(areaConfig), [areaConfig])
  const areaWorksheet = useMemo(
    () => generateAreaWorksheet(normalizedAreaConfig, seed),
    [normalizedAreaConfig, seed],
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
    setConfig((prev) => ({
      ...prev,
      ...preset.config,
      operations: preset.config.operations ?? prev.operations,
      drillMode: preset.config.drillMode,
    }))
  }

  const updateOps = (op: Op) => {
    setActivePreset('standard')
    setConfig((prev) => {
      const has = prev.ops.includes(op)
      if (has && prev.ops.length === 1) return prev
      const nextOps = has ? prev.ops.filter((o) => o !== op) : [...prev.ops, op]
      return { ...prev, ops: nextOps, drillMode: undefined }
    })
  }

  const updateAreaConfig = (patch: Partial<AreaPuzzleConfig>) => {
    setAreaConfig((prev) => {
      const next = normalizeAreaConfig({ ...prev, ...patch })
      if (patch.boxesPerPuzzle !== undefined) {
        const maxPuzzles = maxPuzzlesForBoxesPerPuzzle(patch.boxesPerPuzzle)
        return normalizeAreaConfig({ ...next, puzzlesPerPage: Math.min(next.puzzlesPerPage, maxPuzzles) })
      }
      return next
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
            <h3>Puzzle type</h3>
            <div className="segmented two-col">
              <button
                type="button"
                className={puzzleFamily === 'math-flow' ? 'seg active' : 'seg'}
                onClick={() => setPuzzleFamily('math-flow')}
              >
                Math-Flow
              </button>
              <button
                type="button"
                className={puzzleFamily === 'area' ? 'seg active' : 'seg'}
                onClick={() => setPuzzleFamily('area')}
              >
                Area
              </button>
            </div>
          </section>

          {puzzleFamily === 'math-flow' && (
            <>
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
                  setActivePreset((preset) => (preset === 'tables' ? 'tables' : 'standard'))
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
                    setConfig((p) => ({ ...p, tier, drillMode: undefined }))
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
            </>
          )}

          {puzzleFamily === 'area' && (
            <>
              <section className="panel">
                <div className="panel-head">
                  <h3>Area setup</h3>
                  <span className="badge">{areaWorksheet.puzzles.length} puzzles</span>
                </div>
                <label className="field">
                  <div className="row between">
                    <span>Puzzles per page</span>
                    <span className="mono">{normalizedAreaConfig.puzzlesPerPage}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={maxPuzzlesForBoxesPerPuzzle(normalizedAreaConfig.boxesPerPuzzle)}
                    value={normalizedAreaConfig.puzzlesPerPage}
                    onChange={(e) => updateAreaConfig({ puzzlesPerPage: Number(e.target.value) })}
                  />
                  <small>Readable range changes with boxes per puzzle.</small>
                </label>
                <label className="field">
                  <div className="row between">
                    <span>Number size</span>
                    <span className="mono">{AREA_SIZE_LABEL[normalizedAreaConfig.numberSize]}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    value={normalizedAreaConfig.numberSize}
                    onChange={(e) => updateAreaConfig({ numberSize: Number(e.target.value) as AreaNumberSize })}
                  />
                  <small>Controls side lengths and derived areas.</small>
                </label>
                <label className="field">
                  <div className="row between">
                    <span>Boxes per puzzle</span>
                    <span className="mono">{normalizedAreaConfig.boxesPerPuzzle}</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={maxBoxesForPuzzlesPerPage(normalizedAreaConfig.puzzlesPerPage)}
                    value={normalizedAreaConfig.boxesPerPuzzle}
                    onChange={(e) => updateAreaConfig({ boxesPerPuzzle: Number(e.target.value) })}
                  />
                  <small>Control prevents combinations that would be too dense to read.</small>
                </label>
              </section>

            </>
          )}

          <section className="panel stats">
            <div className="panel-head">
              <h3>Generated</h3>
              <span className="badge mono">#{seed.toLowerCase()}</span>
            </div>
            {puzzleFamily === 'math-flow' ? (
              <>
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
              </>
            ) : (
              <>
                <div className="stat-row">
                  <span>Puzzles</span>
                  <strong>{normalizedAreaConfig.puzzlesPerPage}</strong>
                </div>
                <div className="stat-row">
                  <span>Boxes</span>
                  <strong>{normalizedAreaConfig.boxesPerPuzzle}</strong>
                </div>
                <div className="stat-row">
                  <span>Numbers</span>
                  <strong>{AREA_SIZE_LABEL[normalizedAreaConfig.numberSize]}</strong>
                </div>
              </>
            )}
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
                <h1>{puzzleFamily === 'math-flow' ? 'Math-Flow Quest' : 'Area Puzzles'}</h1>
                <p>
                  {puzzleFamily === 'area'
                    ? 'Use area facts and shared rectangle sides to find the hidden number. Peel the sticker to check.'
                    : config.stickerMode
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
                {puzzleFamily === 'math-flow' ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <span>
                      Puzzles <b>{normalizedAreaConfig.puzzlesPerPage}</b>
                    </span>
                    <span>
                      Boxes <b>{normalizedAreaConfig.boxesPerPuzzle}</b>
                    </span>
                    <span>
                      Numbers <b>{AREA_SIZE_LABEL[normalizedAreaConfig.numberSize]}</b>
                    </span>
                  </>
                )}
                {(config.stickerMode || puzzleFamily === 'area') && (
                  <span className="legend-hint">
                    <span className="legend-hint-dot" />
                    Cover the hidden answers with stickers
                  </span>
                )}
              </div>

              {puzzleFamily === 'math-flow' ? (
                <div className="puzzle-wrap">
                  <PuzzleSVG puzzle={puzzle} showAnswers={false} stickerMode={config.stickerMode} />
                </div>
              ) : (
                <div className={`area-sheet area-count-${normalizedAreaConfig.puzzlesPerPage}`}>
                  {areaWorksheet.puzzles.map((areaPuzzle) => (
                    <div className="area-task" key={areaPuzzle.id}>
                      <AreaPuzzleSVG puzzle={areaPuzzle} showAnswers={false} compact={normalizedAreaConfig.puzzlesPerPage >= 4} />
                      <AreaAnswerTarget puzzle={areaPuzzle} />
                    </div>
                  ))}
                </div>
              )}

              {(config.stickerMode || puzzleFamily === 'area') && (
                <HousesFooter slotCount={puzzleFamily === 'area' ? normalizedAreaConfig.puzzlesPerPage : 4} />
              )}
            </div>

          </div>

          {puzzleFamily === 'math-flow' && config.showSolutions && (
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
