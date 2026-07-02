export type AreaNumberSize = 1 | 2 | 3 | 4

export type AreaPuzzleConfig = {
  puzzlesPerPage: number
  numberSize: AreaNumberSize
  boxesPerPuzzle: number
}

export type AreaRect = {
  id: string
  x: number
  y: number
  w: number
  h: number
  area: number
}

export type AreaDimensionLabel = {
  id: string
  rectId: string
  side: 'top' | 'right' | 'bottom' | 'left'
  value: number
  hidden: boolean
}

export type AreaPuzzle = {
  id: string
  rects: AreaRect[]
  labels: AreaDimensionLabel[]
  unknown:
    | { kind: 'side'; rectId: string; labelId: string; value: number; dependsOn: string[] }
    | { kind: 'area'; rectId: string; value: number; dependsOn: string[] }
  answer: number
  dependencyOrder: string[]
}

export type AreaPuzzleClue =
  | { id: string; kind: 'area'; rectId: string; value: number }
  | { id: string; kind: 'side'; rectId: string; labelId: string; value: number }

export type AreaWorksheet = {
  config: AreaPuzzleConfig
  puzzles: AreaPuzzle[]
}

const MAX_BOXES_BY_PUZZLES: Record<number, number> = {
  1: 6,
  2: 5,
  3: 4,
  4: 3,
  5: 3,
  6: 3,
}

const SIZE_RANGES: Record<AreaNumberSize, { min: number; max: number }> = {
  1: { min: 2, max: 8 },
  2: { min: 3, max: 12 },
  3: { min: 4, max: 18 },
  4: { min: 5, max: 24 },
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function maxBoxesForPuzzlesPerPage(puzzlesPerPage: number) {
  return MAX_BOXES_BY_PUZZLES[clamp(Math.round(puzzlesPerPage), 1, 6)] ?? 3
}

export function maxPuzzlesForBoxesPerPuzzle(boxesPerPuzzle: number) {
  const boxes = clamp(Math.round(boxesPerPuzzle), 2, 6)
  for (let puzzles = 6; puzzles >= 1; puzzles -= 1) {
    if (maxBoxesForPuzzlesPerPage(puzzles) >= boxes) return puzzles
  }
  return 1
}

export function normalizeAreaConfig(config: AreaPuzzleConfig): AreaPuzzleConfig {
  const puzzlesPerPage = clamp(Math.round(config.puzzlesPerPage), 1, 6)
  const numberSize = clamp(Math.round(config.numberSize), 1, 4) as AreaNumberSize
  const boxesPerPuzzle = clamp(Math.round(config.boxesPerPuzzle), 2, maxBoxesForPuzzlesPerPage(puzzlesPerPage))
  return { puzzlesPerPage, numberSize, boxesPerPuzzle }
}

function hashString(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function intBetween(rng: () => number, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1))
}

function pickSide(rng: () => number, index: number): 'right' | 'bottom' | 'left' | 'top' {
  const sides = index % 2 === 0 ? (['right', 'bottom', 'left', 'top'] as const) : (['bottom', 'right', 'top', 'left'] as const)
  return sides[Math.floor(rng() * sides.length)]
}

function overlaps(a: AreaRect, b: AreaRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function sharedSideLength(prev: AreaRect, next: AreaRect) {
  if (prev.x + prev.w === next.x || next.x + next.w === prev.x) {
    return Math.min(prev.y + prev.h, next.y + next.h) - Math.max(prev.y, next.y)
  }
  if (prev.y + prev.h === next.y || next.y + next.h === prev.y) {
    return Math.min(prev.x + prev.w, next.x + next.w) - Math.max(prev.x, next.x)
  }
  return 0
}

function placeNext(
  rects: AreaRect[],
  prev: AreaRect,
  width: number,
  height: number,
  side: 'right' | 'bottom' | 'left' | 'top',
  id: string,
): AreaRect | undefined {
  const candidates: AreaRect[] = []
  if (side === 'right') candidates.push({ id, x: prev.x + prev.w, y: prev.y, w: width, h: prev.h, area: width * prev.h })
  if (side === 'left') candidates.push({ id, x: prev.x - width, y: prev.y, w: width, h: prev.h, area: width * prev.h })
  if (side === 'bottom') candidates.push({ id, x: prev.x, y: prev.y + prev.h, w: prev.w, h: height, area: prev.w * height })
  if (side === 'top') candidates.push({ id, x: prev.x, y: prev.y - height, w: prev.w, h: height, area: prev.w * height })

  return candidates.find((candidate) => rects.every((rect) => !overlaps(candidate, rect)))
}

function recenter(rects: AreaRect[]) {
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  return rects.map((rect) => ({ ...rect, x: rect.x - minX, y: rect.y - minY }))
}

function makeLabel(rect: AreaRect, side: AreaDimensionLabel['side'], value: number, hidden = false): AreaDimensionLabel {
  return { id: `${rect.id}-${side}`, rectId: rect.id, side, value, hidden }
}

function chainOutputSideFor(rect: AreaRect, previous: AreaRect | undefined): AreaDimensionLabel['side'] {
  if (!previous) return 'top'
  if (previous.x + previous.w === rect.x || rect.x + rect.w === previous.x) return 'top'
  if (previous.y + previous.h === rect.y || rect.y + rect.h === previous.y) return 'left'
  return 'top'
}

function sideTouchesAnyRect(rects: AreaRect[], rect: AreaRect, side: AreaDimensionLabel['side']) {
  return rects.some((other) => {
    if (other.id === rect.id) return false
    if (side === 'right' && rect.x + rect.w === other.x) return Math.min(rect.y + rect.h, other.y + other.h) - Math.max(rect.y, other.y) > 0
    if (side === 'left' && other.x + other.w === rect.x) return Math.min(rect.y + rect.h, other.y + other.h) - Math.max(rect.y, other.y) > 0
    if (side === 'bottom' && rect.y + rect.h === other.y) return Math.min(rect.x + rect.w, other.x + other.w) - Math.max(rect.x, other.x) > 0
    if (side === 'top' && other.y + other.h === rect.y) return Math.min(rect.x + rect.w, other.x + other.w) - Math.max(rect.x, other.x) > 0
    return false
  })
}

function exposedSideFor(rects: AreaRect[], rect: AreaRect, preferred: AreaDimensionLabel['side']) {
  const sides = [preferred, 'top', 'right', 'bottom', 'left'] as const
  return sides.find((side, index, all) => all.indexOf(side) === index && !sideTouchesAnyRect(rects, rect, side)) ?? preferred
}

function exposedSideFrom(rects: AreaRect[], rect: AreaRect, sides: AreaDimensionLabel['side'][]) {
  return sides.find((side) => !sideTouchesAnyRect(rects, rect, side)) ?? sides[0]
}

function finalWorkSideFor(rects: AreaRect[], rect: AreaRect, previous: AreaRect | undefined) {
  const preferred = chainOutputSideFor(rect, previous)
  if (preferred === 'top' || preferred === 'bottom') return exposedSideFrom(rects, rect, ['top', 'bottom'])
  return exposedSideFrom(rects, rect, ['left', 'right'])
}

function sideValue(rect: AreaRect, side: AreaDimensionLabel['side']) {
  return side === 'top' || side === 'bottom' ? rect.w : rect.h
}

function sideDimension(side: AreaDimensionLabel['side']): 'w' | 'h' {
  return side === 'top' || side === 'bottom' ? 'w' : 'h'
}

function sharedDimension(prev: AreaRect, next: AreaRect): 'w' | 'h' | undefined {
  if (prev.x + prev.w === next.x || next.x + next.w === prev.x) return 'h'
  if (prev.y + prev.h === next.y || next.y + next.h === prev.y) return 'w'
  return undefined
}

export function getVisibleAreaPuzzleClues(puzzle: AreaPuzzle): AreaPuzzleClue[] {
  const sideClues: AreaPuzzleClue[] = puzzle.labels
    .filter((label) => !label.hidden)
    .map((label) => ({ id: `side:${label.id}`, kind: 'side', rectId: label.rectId, labelId: label.id, value: label.value }))

  const areaClues: AreaPuzzleClue[] = puzzle.rects
    .filter((rect) => !(puzzle.unknown.kind === 'area' && puzzle.unknown.rectId === rect.id))
    .map((rect) => ({ id: `area:${rect.id}`, kind: 'area', rectId: rect.id, value: rect.area }))

  return [...sideClues, ...areaClues]
}

export function hasLimitedRepeatedDimensions(puzzle: Pick<AreaPuzzle, 'rects'>) {
  if (puzzle.rects.length <= 2) return true
  const counts = new Map<number, number>()
  for (const rect of puzzle.rects) {
    counts.set(rect.w, (counts.get(rect.w) ?? 0) + 1)
    counts.set(rect.h, (counts.get(rect.h) ?? 0) + 1)
  }
  return [...counts.values()].every((count) => count <= 2)
}

function buildRectChain(boxCount: number, size: AreaNumberSize, rng: () => number) {
  const range = SIZE_RANGES[size]
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const rects: AreaRect[] = []
    const first: AreaRect = {
      id: 'r0',
      x: 0,
      y: 0,
      w: intBetween(rng, range.min + 1, range.max),
      h: intBetween(rng, range.min + 1, range.max),
      area: 0,
    }
    first.area = first.w * first.h
    rects.push(first)

    let ok = true
    for (let i = 1; i < boxCount; i += 1) {
      const prev = rects[i - 1]
      const verticalJoin = rng() < 0.5
      const nextW = verticalJoin ? prev.w : intBetween(rng, range.min + 1, range.max)
      const nextH = verticalJoin ? intBetween(rng, range.min + 1, range.max) : prev.h
      const preferred = pickSide(rng, i)
      const sides = [preferred, 'right', 'bottom', 'left', 'top'] as const
      const placed = sides
        .filter((side, idx, all) => all.indexOf(side) === idx)
        .map((side) => placeNext(rects, prev, nextW, nextH, side, `r${i}`))
        .find((candidate): candidate is AreaRect => Boolean(candidate))
      if (!placed || sharedSideLength(prev, placed) <= 1) {
        ok = false
        break
      }
      rects.push(placed)
    }
    const centered = ok ? recenter(rects) : []
    if (ok && hasLimitedRepeatedDimensions({ rects: centered })) return centered
  }

  return buildFallbackRectChain(boxCount, size)
}

function buildFallbackRectChain(boxCount: number, size: AreaNumberSize) {
  const range = SIZE_RANGES[size]
  const valueAt = (index: number) => range.min + 1 + (index % Math.max(1, range.max - range.min))
  const firstW = valueAt(0)
  const firstH = valueAt(1)
  const rects: AreaRect[] = [{ id: 'r0', x: 0, y: 0, w: firstW, h: firstH, area: firstW * firstH }]

  for (let i = 1; i < boxCount; i += 1) {
    const prev = rects[i - 1]
    const joinsSideways = i % 2 === 1
    if (joinsSideways) {
      const w = valueAt(i + 1)
      rects.push({ id: `r${i}`, x: prev.x + prev.w, y: prev.y, w, h: prev.h, area: w * prev.h })
    } else {
      const h = valueAt(i + 1)
      rects.push({ id: `r${i}`, x: prev.x, y: prev.y + prev.h, w: prev.w, h, area: prev.w * h })
    }
  }

  return recenter(rects)
}

function buildPuzzle(seedCode: string, config: AreaPuzzleConfig, index: number): AreaPuzzle {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const rng = mulberry32(
      (parseInt(seedCode, 36) >>> 0) ^
        hashString(JSON.stringify(config)) ^
        Math.imul(index + 1, 2654435761) ^
        Math.imul(attempt + 1, 1597334677),
    )
    const rects = buildRectChain(config.boxesPerPuzzle, config.numberSize, rng)
    const last = rects[rects.length - 1]
    const previous = rects[rects.length - 2]
    const unknownKind = (index + attempt + Math.floor(rng() * 7)) % 2 === 0 ? 'side' : 'area'
    const dependencyOrder = rects.map((rect) => rect.id)
    const labels: AreaDimensionLabel[] = []

    const firstSide = exposedSideFor(rects, rects[0], rng() < 0.5 ? 'top' : 'left')
    labels.push(makeLabel(rects[0], firstSide, sideValue(rects[0], firstSide)))

    let puzzle: AreaPuzzle
    if (unknownKind === 'side') {
      const side = finalWorkSideFor(rects, last, previous)
      const value = sideValue(last, side)
      const hiddenLabel = makeLabel(last, side, value, true)
      labels.push(hiddenLabel)
      puzzle = {
        id: `area-${index + 1}`,
        rects,
        labels,
        unknown: { kind: 'side', rectId: last.id, labelId: hiddenLabel.id, value, dependsOn: dependencyOrder },
        answer: value,
        dependencyOrder,
      }
    } else {
      const knownSide = finalWorkSideFor(rects, last, previous)
      labels.push(makeLabel(last, knownSide, sideValue(last, knownSide)))
      puzzle = {
        id: `area-${index + 1}`,
        rects,
        labels,
        unknown: { kind: 'area', rectId: last.id, value: last.area, dependsOn: dependencyOrder },
        answer: last.area,
        dependencyOrder,
      }
    }

    if (validateAreaPuzzle(puzzle)) return puzzle
  }

  return buildValidatedFallbackPuzzle(config, index)
}

function buildValidatedFallbackPuzzle(config: AreaPuzzleConfig, index: number): AreaPuzzle {
  const rects = buildFallbackRectChain(config.boxesPerPuzzle, config.numberSize)
  const last = rects[rects.length - 1]
  const previous = rects[rects.length - 2]
  const dependencyOrder = rects.map((rect) => rect.id)
  const labels: AreaDimensionLabel[] = [makeLabel(rects[0], 'left', rects[0].h)]
  const side = finalWorkSideFor(rects, last, previous)
  const value = sideValue(last, side)
  const hiddenLabel = makeLabel(last, side, value, true)
  labels.push(hiddenLabel)

  const puzzle: AreaPuzzle = {
    id: `area-${index + 1}`,
    rects,
    labels,
    unknown: { kind: 'side', rectId: last.id, labelId: hiddenLabel.id, value, dependsOn: dependencyOrder },
    answer: value,
    dependencyOrder,
  }

  return puzzle
}

export function solveAreaPuzzle(puzzle: AreaPuzzle, removedRectIdOrOptions?: string | { removedRectId?: string; removedClueId?: string }) {
  const removedRectId = typeof removedRectIdOrOptions === 'string' ? removedRectIdOrOptions : removedRectIdOrOptions?.removedRectId
  const removedClueId = typeof removedRectIdOrOptions === 'string' ? undefined : removedRectIdOrOptions?.removedClueId
  const available = new Set(puzzle.rects.map((rect) => rect.id))
  if (removedRectId) available.delete(removedRectId)

  const known = new Map<string, { w?: number; h?: number }>()
  for (const rect of puzzle.rects) {
    if (available.has(rect.id)) known.set(rect.id, {})
  }

  for (const label of puzzle.labels) {
    if (label.hidden || !available.has(label.rectId) || removedClueId === `side:${label.id}`) continue
    const dims = known.get(label.rectId)
    if (dims) dims[sideDimension(label.side)] = label.value
  }

  let changed = true
  while (changed) {
    changed = false
    for (const rect of puzzle.rects) {
      if (!available.has(rect.id)) continue
      const dims = known.get(rect.id)
      const areaKnown = !(puzzle.unknown.kind === 'area' && puzzle.unknown.rectId === rect.id) && removedClueId !== `area:${rect.id}`
      if (!dims || !areaKnown) continue
      if (dims.w !== undefined && dims.h === undefined && rect.area % dims.w === 0) {
        dims.h = rect.area / dims.w
        changed = true
      }
      if (dims.h !== undefined && dims.w === undefined && rect.area % dims.h === 0) {
        dims.w = rect.area / dims.h
        changed = true
      }
    }

    for (let i = 1; i < puzzle.rects.length; i += 1) {
      const prev = puzzle.rects[i - 1]
      const next = puzzle.rects[i]
      if (!available.has(prev.id) || !available.has(next.id)) continue
      const dim = sharedDimension(prev, next)
      if (!dim) continue
      const prevDims = known.get(prev.id)
      const nextDims = known.get(next.id)
      if (!prevDims || !nextDims) continue
      if (prevDims[dim] !== undefined && nextDims[dim] === undefined) {
        nextDims[dim] = prevDims[dim]
        changed = true
      }
      if (nextDims[dim] !== undefined && prevDims[dim] === undefined) {
        prevDims[dim] = nextDims[dim]
        changed = true
      }
    }
  }

  let answer: number | undefined
  if (puzzle.unknown.kind === 'area') {
    const dims = known.get(puzzle.unknown.rectId)
    if (available.has(puzzle.unknown.rectId) && dims?.w !== undefined && dims.h !== undefined) {
      answer = dims.w * dims.h
    }
  } else {
    const rect = puzzle.rects.find((candidate) => candidate.id === puzzle.unknown.rectId)
    const labelId = puzzle.unknown.labelId
    const label = puzzle.labels.find((candidate) => candidate.id === labelId)
    const dims = known.get(puzzle.unknown.rectId)
    if (rect && label && available.has(rect.id) && dims && removedClueId !== `area:${rect.id}`) {
      const targetDim = sideDimension(label.side)
      const knownDim = targetDim === 'w' ? dims.h : dims.w
      if (knownDim !== undefined && rect.area % knownDim === 0) {
        answer = rect.area / knownDim
        dims[targetDim] = answer
      }
    }
  }

  const usedRectIds = puzzle.rects
    .filter((rect) => {
      const dims = known.get(rect.id)
      return dims?.w !== undefined && dims.h !== undefined
    })
    .map((rect) => rect.id)

  return {
    solved: answer === puzzle.answer,
    answer,
    usedRectIds,
  }
}

export function validateAreaPuzzle(puzzle: AreaPuzzle) {
  const rectIds = new Set(puzzle.rects.map((rect) => rect.id))
  const deps = new Set(puzzle.dependencyOrder)
  const allRectsIncluded = puzzle.rects.every((rect) => deps.has(rect.id))
  const hasOnlyKnownRects = puzzle.dependencyOrder.every((id) => rectIds.has(id))
  const noOnes = puzzle.rects.every((rect) => rect.w > 1 && rect.h > 1 && rect.area > 1)
  const connected = puzzle.rects.slice(1).every((rect, index) => sharedSideLength(puzzle.rects[index], rect) > 1)
  const singleUnknown = puzzle.unknown.value === puzzle.answer
  const solved = solveAreaPuzzle(puzzle)
  const allRectsUsed = puzzle.rects.every((rect) => solved.usedRectIds.includes(rect.id))
  const everyClueRequired = getVisibleAreaPuzzleClues(puzzle).every((clue) => !solveAreaPuzzle(puzzle, { removedClueId: clue.id }).solved)
  return allRectsIncluded && hasOnlyKnownRects && noOnes && connected && singleUnknown && solved.solved && allRectsUsed && hasLimitedRepeatedDimensions(puzzle) && everyClueRequired
}

export function validateAreaPuzzleAfterRemovingRect(puzzle: AreaPuzzle, rectId: string) {
  if (!puzzle.rects.some((rect) => rect.id === rectId)) return false
  return solveAreaPuzzle(puzzle, rectId).solved
}

export function generateAreaWorksheet(config: AreaPuzzleConfig, seedCode: string): AreaWorksheet {
  const normalized = normalizeAreaConfig(config)
  return {
    config: normalized,
    puzzles: Array.from({ length: normalized.puzzlesPerPage }, (_, index) => buildPuzzle(seedCode, normalized, index)),
  }
}
