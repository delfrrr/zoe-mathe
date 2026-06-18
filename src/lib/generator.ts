export type TierKey = '0-9' | '10-99' | '100-999' | '1k-9k'
export type Op = '+' | '-' | 'x' | '/'
export type DrillMode = 'standard' | 'multiplication-table'

export type Config = {
  operations: number
  tier: TierKey
  ops: Op[]
  drillMode?: DrillMode
}

export type Cell = { idx: number; col: number; row: number }
export type Edge = {
  from: number
  to: number
  op: Op
  operand: number
  result: number
}

export type Puzzle = {
  cols: number
  rows: number
  cells: Cell[]
  path: number[]
  edges: Edge[]
  startValue: number
  finalValue: number
  pathValues: number[]
  checkpointPathIndices: number[]
}

export const TIERS: Record<TierKey, { min: number; max: number; label: string }> = {
  '0-9': { min: 0, max: 9, label: '0-9' },
  '10-99': { min: 10, max: 99, label: '10-99' },
  '100-999': { min: 100, max: 999, label: '100-999' },
  '1k-9k': { min: 1000, max: 9000, label: '1k-9k' },
}

function range(min: number, max: number) {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

function tableOperandsForTier(tierKey: TierKey) {
  if (tierKey === '100-999') return range(10, 99)
  if (tierKey === '1k-9k') return range(2, 999)
  return range(2, 9)
}

const TABLE_FACTORS = range(2, 9)
const TABLE_FACTOR_SET = new Set(TABLE_FACTORS)
const TABLE_PRODUCTS = new Set(TABLE_FACTORS.flatMap((a) => TABLE_FACTORS.map((b) => a * b)))

export function isMultiplicationTableFactor(value: number) {
  return TABLE_FACTOR_SET.has(value)
}

export function isMultiplicationTableProduct(value: number) {
  return TABLE_PRODUCTS.has(value)
}

export function isMultiplicationTableMultiplicationFact(left: number, right: number) {
  return isMultiplicationTableFactor(left) && isMultiplicationTableFactor(right)
}

export function isMultiplicationTableDivisionFact(value: number, divisor: number) {
  if (!isMultiplicationTableProduct(value) || !isMultiplicationTableFactor(divisor)) return false
  return value % divisor === 0 && isMultiplicationTableFactor(value / divisor)
}

function tableFactKey(a: number, b: number) {
  return `${Math.min(a, b)}x${Math.max(a, b)}`
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

function hashString(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function keyOf(col: number, row: number, cols: number) {
  return row * cols + col
}

function buildPath(rows: number, cols: number, targetNodes: number, rng: () => number): number[] {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const startCol = Math.floor(rng() * cols)
  const startRow = Math.floor(rng() * rows)
  const start = keyOf(startCol, startRow, cols)
  const visited = new Set<number>([start])
  const path = [start]

  const freeExitCount = (k: number, additionalVisited: Set<number>) => {
    const col = k % cols
    const row = Math.floor(k / cols)
    let count = 0
    for (const [dx, dy] of dirs) {
      const nc = col + dx
      const nr = row + dy
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const nk = keyOf(nc, nr, cols)
      if (!additionalVisited.has(nk)) count += 1
    }
    return count
  }

  const dfs = (): boolean => {
    if (path.length >= targetNodes) return true
    const current = path[path.length - 1]
    const col = current % cols
    const row = Math.floor(current / cols)
    const neighbors: number[] = []
    for (const [dx, dy] of dirs) {
      const nc = col + dx
      const nr = row + dy
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const nk = keyOf(nc, nr, cols)
      if (!visited.has(nk)) neighbors.push(nk)
    }

    neighbors.sort((a, b) => {
      const av = freeExitCount(a, visited)
      const bv = freeExitCount(b, visited)
      if (bv !== av) return bv - av
      return rng() - 0.5
    })

    for (const next of neighbors) {
      visited.add(next)
      path.push(next)
      if (dfs()) return true
      path.pop()
      visited.delete(next)
    }
    return false
  }

  dfs()
  return path
}

function pickCheckpointIndices(pathLength: number, count: number): number[] {
  if (count <= 0 || pathLength <= 1) return []
  const requested = Math.min(count, pathLength - 1)
  const picks = new Set<number>()

  // Final cell is always a checkpoint in sticker mode.
  picks.add(pathLength - 1)

  const interiorTarget = Math.max(0, requested - 1)
  if (interiorTarget > 0 && pathLength > 2) {
    for (let i = 1; i <= interiorTarget; i += 1) {
      const pos = Math.round((i * (pathLength - 1)) / (interiorTarget + 1))
      const bounded = clamp(pos, 1, pathLength - 2)
      picks.add(bounded)
    }
  }

  return Array.from(picks).sort((a, b) => a - b).slice(0, requested)
}

export function generatePuzzle(config: Config, seedCode: string, checkpointCount = 0): Puzzle {
  const nodes = config.operations + 1
  const side = clamp(Math.ceil(Math.sqrt(nodes / 0.7)), 4, 16)
  const rows = side
  const cols = side

  const seedInt = parseInt(seedCode, 36) >>> 0
  const drillMode = config.drillMode ?? 'standard'
  const hashConfig =
    drillMode === 'standard'
      ? { operations: config.operations, tier: config.tier, ops: config.ops }
      : { operations: config.operations, tier: config.tier, ops: config.ops, drillMode }
  const configHash = hashString(JSON.stringify(hashConfig))
  const rng = mulberry32(seedInt ^ configHash)

  let bestPath: number[] = []
  for (let i = 0; i < 80; i += 1) {
    const trial = buildPath(rows, cols, nodes, rng)
    if (trial.length > bestPath.length) bestPath = trial
    if (bestPath.length >= nodes) break
  }

  const path = bestPath.slice(0, Math.min(nodes, bestPath.length))
  const tier = TIERS[config.tier]
  const isTableDrill = drillMode === 'multiplication-table'
  const startValue = isTableDrill ? TABLE_FACTORS[Math.floor(rng() * TABLE_FACTORS.length)] : 1

  const edges: Edge[] = []
  let running = startValue
  const MIN_RESULT = 1
  const MAX_RESULT = isTableDrill ? 81 : tier.max
  const complexityRank: Record<Op, number> = { '+': 0, '-': 1, x: 2, '/': 3 }
  const selectedSorted = [...config.ops].sort((a, b) => complexityRank[a] - complexityRank[b])
  const desiredOp = selectedSorted[selectedSorted.length - 1]
  const tableOperands = isTableDrill ? TABLE_FACTORS : tableOperandsForTier(config.tier)
  const simplerOrEqualToDesired = (['+', '-', 'x', '/'] as Op[]).filter(
    (op) => complexityRank[op] <= complexityRank[desiredOp],
  )
  const recentWindow = 8
  const recentOperandKeys: string[] = []
  const recentResults: number[] = []
  const operandUse = new Map<string, number>()
  const resultUse = new Map<number, number>()
  const tableOperandUse = new Map<number, number>()
  const tableFactUse = new Map<string, number>()
  const tableProductUse = new Map<number, number>()

  const tableFactFor = (opKey: Op, value: number, operand: number, nextVal: number) => {
    if (!isTableDrill || (opKey !== 'x' && opKey !== '/')) return undefined
    if (opKey === 'x') {
      if (!isMultiplicationTableMultiplicationFact(value, operand)) return undefined
      return { key: tableFactKey(value, operand), product: nextVal }
    }
    if (!isMultiplicationTableDivisionFact(value, operand)) return undefined
    return { key: tableFactKey(operand, nextVal), product: value }
  }

  const hasAlternateTableDivision = (product: number, blockedA: number, blockedB: number) =>
    TABLE_FACTORS.some((factor) => {
      if (factor === blockedA || factor === blockedB) return false
      return isMultiplicationTableDivisionFact(product, factor)
    })

  const pickDiverse = (
    opKey: Op,
    value: number,
    candidates: number[],
    mkNext: (operand: number) => number,
  ) => {
    if (candidates.length === 0) return undefined
    let bestOperand = candidates[0]
    let bestScore = Number.POSITIVE_INFINITY

    for (const operand of candidates) {
      const nextVal = mkNext(operand)
      const opOperandKey = `${opKey}:${operand}`
      const previousEdge = edges[edges.length - 1]
      const recentOperandPenalty = recentOperandKeys.includes(opOperandKey) ? 12 : 0
      const recentResultPenalty = recentResults.includes(nextVal) ? 10 : 0
      const operandSeen = (operandUse.get(opOperandKey) ?? 0) * 1.5
      const resultSeen = (resultUse.get(nextVal) ?? 0) * 2
      const tableOperandSeen = opKey === 'x' || opKey === '/' ? (tableOperandUse.get(operand) ?? 0) * 1.25 : 0
      const tableFact = tableFactFor(opKey, value, operand, nextVal)
      const tableFactSeen = tableFact ? (tableFactUse.get(tableFact.key) ?? 0) * 14 : 0
      const tableProductSeen = tableFact ? (tableProductUse.get(tableFact.product) ?? 0) * 4 : 0
      const deadEndProductPenalty =
        isTableDrill && opKey === 'x' && !hasAlternateTableDivision(nextVal, value, operand) ? 18 : 0
      const offTableEscapePenalty =
        isTableDrill && (opKey === '+' || opKey === '-') && !isMultiplicationTableFactor(nextVal) && !isMultiplicationTableProduct(nextVal)
          ? 30
          : 0
      const identityPenalty = isTrivialStep(opKey, nextVal, value, operand) ? 80 : 0
      const inversePenalty = previousEdge && isImmediateInverse(previousEdge, opKey, operand) ? 90 : 0
      const jitter = rng() * 0.25
      const lowFactorPenalty =
        candidates.length > 1 && operand === 2 && (opKey === 'x' || opKey === '/') ? 2.5 : 0
      const score =
        recentOperandPenalty +
        recentResultPenalty +
        operandSeen +
        resultSeen +
        tableOperandSeen +
        tableFactSeen +
        tableProductSeen +
        deadEndProductPenalty +
        offTableEscapePenalty +
        identityPenalty +
        inversePenalty +
        lowFactorPenalty +
        jitter
      if (score < bestScore) {
        bestScore = score
        bestOperand = operand
      }
    }

    return bestOperand
  }

  const isImmediateInverse = (previousEdge: Edge, opKey: Op, operand: number) => {
    if (previousEdge.operand !== operand) return false
    return (
      (previousEdge.op === 'x' && opKey === '/') ||
      (previousEdge.op === '/' && opKey === 'x') ||
      (previousEdge.op === '+' && opKey === '-') ||
      (previousEdge.op === '-' && opKey === '+')
    )
  }

  const isTrivialStep = (opKey: Op, nextVal: number, value: number, operand: number) => {
    if (operand === 0 || operand === 1) return true
    if (opKey === '/' && value === operand && nextVal === 1) return true
    return false
  }

  const isImmediateCancellation = (previousEdge: Edge | undefined, opKey: Op, operand: number) => {
    if (!previousEdge || previousEdge.op !== 'x' || opKey !== '/') return false
    const previousInput = previousEdge.result / previousEdge.operand
    return operand === previousInput || operand === previousEdge.operand
  }

  const bestForOp = (opKey: Op, value: number) => {
    const scoreCandidate = (operand: number, nextVal: number, candidateCount: number) => {
      const opOperandKey = `${opKey}:${operand}`
      const previousEdge = edges[edges.length - 1]
      const recentOperandPenalty = recentOperandKeys.includes(opOperandKey) ? 12 : 0
      const recentResultPenalty = recentResults.includes(nextVal) ? 10 : 0
      const operandSeen = (operandUse.get(opOperandKey) ?? 0) * 1.5
      const resultSeen = (resultUse.get(nextVal) ?? 0) * 2
      const tableOperandSeen = opKey === 'x' || opKey === '/' ? (tableOperandUse.get(operand) ?? 0) * 1.25 : 0
      const tableFact = tableFactFor(opKey, value, operand, nextVal)
      const tableFactSeen = tableFact ? (tableFactUse.get(tableFact.key) ?? 0) * 14 : 0
      const tableProductSeen = tableFact ? (tableProductUse.get(tableFact.product) ?? 0) * 4 : 0
      const deadEndProductPenalty =
        isTableDrill && opKey === 'x' && !hasAlternateTableDivision(nextVal, value, operand) ? 18 : 0
      const offTableEscapePenalty =
        isTableDrill && (opKey === '+' || opKey === '-') && !isMultiplicationTableFactor(nextVal) && !isMultiplicationTableProduct(nextVal)
          ? 30
          : 0
      const identityPenalty = isTrivialStep(opKey, nextVal, value, operand) ? 80 : 0
      const inversePenalty = previousEdge && isImmediateInverse(previousEdge, opKey, operand) ? 90 : 0
      const cancellationPenalty = isImmediateCancellation(previousEdge, opKey, operand) ? 90 : 0
      const lowFactorPenalty = opKey !== '+' && candidateCount > 1 && operand === 2 ? 2.5 : 0
      const score =
        recentOperandPenalty +
        recentResultPenalty +
        operandSeen +
        resultSeen +
        tableOperandSeen +
        tableFactSeen +
        tableProductSeen +
        deadEndProductPenalty +
        offTableEscapePenalty +
        identityPenalty +
        inversePenalty +
        cancellationPenalty +
        lowFactorPenalty +
        rng() * 0.25
      return score
    }

    if (opKey === '+') {
      const plusMax = Math.min(tier.max, MAX_RESULT - value)
      const plusMin = isTableDrill ? 1 : Math.min(tier.min, plusMax)
      const plusCandidates: number[] = []
      for (let n = Math.max(1, plusMin); n <= plusMax; n += 1) plusCandidates.push(n)
      if (plusCandidates.length === 0) return undefined
      const operand =
        pickDiverse(opKey, value, plusCandidates, (n) => value + n) ??
        plusCandidates[Math.floor(rng() * plusCandidates.length)]
      const next = value + operand
      return { operand, next, score: scoreCandidate(operand, next, plusCandidates.length) }
    }

    if (opKey === '-') {
      const safeMin = isTableDrill ? 1 : Math.max(1, tier.min)
      const safeMax = Math.min(tier.max, value - MIN_RESULT)
      const minusCandidates: number[] = []
      for (let n = safeMin; n <= safeMax; n += 1) minusCandidates.push(n)
      if (minusCandidates.length === 0) return undefined
      const operand =
        pickDiverse(opKey, value, minusCandidates, (n) => value - n) ??
        minusCandidates[Math.floor(rng() * minusCandidates.length)]
      const next = value - operand
      return { operand, next, score: scoreCandidate(operand, next, minusCandidates.length) }
    }

    if (opKey === 'x') {
      const factors = tableOperands.filter((factor) => {
        if (isTableDrill && !isMultiplicationTableFactor(value)) return false
        return value * factor <= MAX_RESULT
      })
      if (factors.length === 0) return undefined
      const operand =
        pickDiverse(opKey, value, factors, (n) => value * n) ?? factors[Math.floor(rng() * factors.length)]
      const next = value * operand
      return { operand, next, score: scoreCandidate(operand, next, factors.length) }
    }

    const divisors: number[] = []
    for (const d of tableOperands) {
      if (value % d === 0) {
        const quotient = value / d
        if (isTableDrill) {
          if (isMultiplicationTableDivisionFact(value, d)) divisors.push(d)
        } else if (quotient >= MIN_RESULT && quotient <= MAX_RESULT) divisors.push(d)
      }
    }
    const previousEdge = edges[edges.length - 1]
    const usableDivisors = divisors.filter(
      (d) => !isTrivialStep('/', value / d, value, d) && !isImmediateCancellation(previousEdge, '/', d),
    )
    if (usableDivisors.length === 0) return undefined
    const operand =
      pickDiverse(opKey, value, usableDivisors, (n) => value / n) ??
      usableDivisors[Math.floor(rng() * usableDivisors.length)]
    const next = value / operand
    return { operand, next, score: scoreCandidate(operand, next, usableDivisors.length) }
  }

  const isOpValid = (op: Op, value: number) => {
    if (op === '+') return value < MAX_RESULT
    if (op === '-') {
      const minOperand = isTableDrill ? 1 : Math.max(1, tier.min)
      return Math.min(tier.max, value - MIN_RESULT) >= minOperand
    }
    if (op === 'x') {
      if (isTableDrill && !isMultiplicationTableFactor(value)) return false
      return value >= MIN_RESULT && value * 2 <= MAX_RESULT
    }
    const previousEdge = edges[edges.length - 1]
    for (const d of tableOperands) {
      if (value % d === 0) {
        const next = value / d
        if (
          (isTableDrill ? isMultiplicationTableDivisionFact(value, d) : next >= MIN_RESULT && next <= MAX_RESULT) &&
          !isTrivialStep('/', next, value, d) &&
          !isImmediateCancellation(previousEdge, '/', d)
        ) {
          return true
        }
      }
    }
    return false
  }

  for (let i = 0; i < path.length - 1; i += 1) {
    const selectedValid = selectedSorted.filter((op) => isOpValid(op, running))
    const allowedFallback = simplerOrEqualToDesired.filter((op) => isOpValid(op, running))
    const xDivOnlySelection =
      config.ops.includes('x') && config.ops.includes('/') && config.ops.every((op) => op === 'x' || op === '/')

    const basePool =
      config.ops.length === 1 && config.ops[0] === '+'
        ? (['+'] as Op[])
        : selectedValid.length > 0
          ? selectedValid
          : allowedFallback.length > 0
            ? allowedFallback
            : (['+'] as Op[])
    const breakerPool = (['+', '-'] as Op[]).filter((op) => isOpValid(op, running))
    const opsPool = xDivOnlySelection ? Array.from(new Set<Op>([...basePool, ...breakerPool])) : basePool

    const candidates = opsPool
      .map((candidateOp) => {
        const choice = bestForOp(candidateOp, running)
        if (!choice) return undefined
        let preferenceBias = 0
        if (xDivOnlySelection) {
          if (candidateOp === '+' || candidateOp === '-') preferenceBias += isTableDrill ? 80 : 2
          if (isTrivialStep(candidateOp, choice.next, running, choice.operand)) preferenceBias += 60
          if (edges.length > 0 && isImmediateInverse(edges[edges.length - 1], candidateOp, choice.operand)) {
            preferenceBias += 70
          }
        }
        if (candidateOp === desiredOp) preferenceBias -= 3
        else preferenceBias += 1 + (complexityRank[desiredOp] - complexityRank[candidateOp]) * 0.6
        return { op: candidateOp, ...choice, totalScore: choice.score + preferenceBias }
      })
      .filter((x): x is { op: Op; operand: number; next: number; score: number; totalScore: number } => !!x)

    if (candidates.length === 0) {
      const backupOperand =
        Math.max(1, Math.floor(rng() * Math.max(1, Math.min(tier.max, MAX_RESULT - running))) + 1)
      const backupResult = running + backupOperand
      edges.push({ from: path[i], to: path[i + 1], op: '+', operand: backupOperand, result: backupResult })
      const usedKey = `+:${backupOperand}`
      operandUse.set(usedKey, (operandUse.get(usedKey) ?? 0) + 1)
      resultUse.set(backupResult, (resultUse.get(backupResult) ?? 0) + 1)
      recentOperandKeys.push(usedKey)
      recentResults.push(backupResult)
      if (recentOperandKeys.length > recentWindow) recentOperandKeys.shift()
      if (recentResults.length > recentWindow) recentResults.shift()
      running = backupResult
      continue
    }

    candidates.sort((a, b) => a.totalScore - b.totalScore)
    const picked = candidates[0]
    const op = picked.op
    const operand = picked.operand
    const next = picked.next

    if (next <= 0 || next > MAX_RESULT) {
      const backupOperand =
        Math.max(1, Math.floor(rng() * Math.max(1, Math.min(tier.max, MAX_RESULT - running))) + 1)
      const backupResult = running + backupOperand
      edges.push({ from: path[i], to: path[i + 1], op: '+', operand: backupOperand, result: backupResult })
      const usedKey = `+:${backupOperand}`
      operandUse.set(usedKey, (operandUse.get(usedKey) ?? 0) + 1)
      resultUse.set(backupResult, (resultUse.get(backupResult) ?? 0) + 1)
      recentOperandKeys.push(usedKey)
      recentResults.push(backupResult)
      if (recentOperandKeys.length > recentWindow) recentOperandKeys.shift()
      if (recentResults.length > recentWindow) recentResults.shift()
      running = backupResult
      continue
    }

    edges.push({ from: path[i], to: path[i + 1], op, operand, result: next })
    const usedKey = `${op}:${operand}`
    const usedTableFact = tableFactFor(op, running, operand, next)
    operandUse.set(usedKey, (operandUse.get(usedKey) ?? 0) + 1)
    if (op === 'x' || op === '/') tableOperandUse.set(operand, (tableOperandUse.get(operand) ?? 0) + 1)
    if (usedTableFact) {
      tableFactUse.set(usedTableFact.key, (tableFactUse.get(usedTableFact.key) ?? 0) + 1)
      tableProductUse.set(usedTableFact.product, (tableProductUse.get(usedTableFact.product) ?? 0) + 1)
    }
    resultUse.set(next, (resultUse.get(next) ?? 0) + 1)
    recentOperandKeys.push(usedKey)
    recentResults.push(next)
    if (recentOperandKeys.length > recentWindow) recentOperandKeys.shift()
    if (recentResults.length > recentWindow) recentResults.shift()
    running = next
  }

  const pathValues = [startValue]
  for (const edge of edges) pathValues.push(edge.result)

  const cells: Cell[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ idx: keyOf(col, row, cols), col, row })
    }
  }

  const checkpointPathIndices = pickCheckpointIndices(path.length, checkpointCount)

  return {
    cols,
    rows,
    cells,
    path,
    edges,
    startValue,
    finalValue: running,
    pathValues,
    checkpointPathIndices,
  }
}
