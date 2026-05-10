export type TierKey = '0-9' | '10-99' | '100-999' | '1k-9k'
export type Op = '+' | '-' | 'x' | '/'

export type Config = {
  operations: number
  selfChecks: number
  tier: TierKey
  ops: Op[]
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
  shownValues: Record<number, number>
}

export const TIERS: Record<TierKey, { min: number; max: number; label: string }> = {
  '0-9': { min: 0, max: 9, label: '0-9' },
  '10-99': { min: 10, max: 99, label: '10-99' },
  '100-999': { min: 100, max: 999, label: '100-999' },
  '1k-9k': { min: 1000, max: 9000, label: '1k-9k' },
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

function chooseEvenlyDistributed(pathLength: number, count: number) {
  const picks = new Set<number>()
  if (count <= 0 || pathLength <= 2) return picks
  const maxMiddle = pathLength - 2
  const target = Math.min(count, maxMiddle)
  for (let i = 1; i <= target; i += 1) {
    const pos = Math.round((i * (pathLength - 1)) / (target + 1))
    const bounded = clamp(pos, 1, pathLength - 2)
    picks.add(bounded)
  }
  return picks
}

export function generatePuzzle(config: Config, seedCode: string): Puzzle {
  const nodes = config.operations + 1
  const side = clamp(Math.ceil(Math.sqrt(nodes / 0.7)), 4, 16)
  const rows = side
  const cols = side

  const seedInt = parseInt(seedCode, 36) >>> 0
  const configHash = hashString(JSON.stringify(config))
  const rng = mulberry32(seedInt ^ configHash)

  let bestPath: number[] = []
  for (let i = 0; i < 80; i += 1) {
    const trial = buildPath(rows, cols, nodes, rng)
    if (trial.length > bestPath.length) bestPath = trial
    if (bestPath.length >= nodes) break
  }

  const path = bestPath.slice(0, Math.min(nodes, bestPath.length))
  const tier = TIERS[config.tier]
  const startValue = clamp(Math.floor(rng() * (tier.max - tier.min + 1)) + tier.min, 1, 5000)

  const edges: Edge[] = []
  let running = startValue
  const MIN_RESULT = 1
  const MAX_RESULT = tier.max
  const complexityRank: Record<Op, number> = { '+': 0, '-': 1, x: 2, '/': 3 }
  const selectedSorted = [...config.ops].sort((a, b) => complexityRank[a] - complexityRank[b])
  const desiredOp = selectedSorted[selectedSorted.length - 1]
  const simplerOrEqualToDesired = (['+', '-', 'x', '/'] as Op[]).filter(
    (op) => complexityRank[op] <= complexityRank[desiredOp],
  )
  const recentWindow = 8
  const recentOperandKeys: string[] = []
  const recentResults: number[] = []
  const operandUse = new Map<string, number>()
  const resultUse = new Map<number, number>()

  const pickDiverse = (opKey: Op, candidates: number[], mkNext: (operand: number) => number) => {
    if (candidates.length === 0) return undefined
    let bestOperand = candidates[0]
    let bestScore = Number.POSITIVE_INFINITY

    for (const operand of candidates) {
      const nextVal = mkNext(operand)
      const opOperandKey = `${opKey}:${operand}`
      const recentOperandPenalty = recentOperandKeys.includes(opOperandKey) ? 12 : 0
      const recentResultPenalty = recentResults.includes(nextVal) ? 10 : 0
      const operandSeen = (operandUse.get(opOperandKey) ?? 0) * 1.5
      const resultSeen = (resultUse.get(nextVal) ?? 0) * 2
      const jitter = rng() * 0.25
      const lowFactorPenalty =
        candidates.length > 1 && operand === 2 && (opKey === 'x' || opKey === '/')
          ? 2.5
          : 0
      const score =
        recentOperandPenalty +
        recentResultPenalty +
        operandSeen +
        resultSeen +
        lowFactorPenalty +
        jitter
      if (score < bestScore) {
        bestScore = score
        bestOperand = operand
      }
    }

    return bestOperand
  }

  const bestForOp = (opKey: Op, value: number) => {
    const scoreCandidate = (operand: number, nextVal: number) => {
      const opOperandKey = `${opKey}:${operand}`
      const recentOperandPenalty = recentOperandKeys.includes(opOperandKey) ? 12 : 0
      const recentResultPenalty = recentResults.includes(nextVal) ? 10 : 0
      const operandSeen = (operandUse.get(opOperandKey) ?? 0) * 1.5
      const resultSeen = (resultUse.get(nextVal) ?? 0) * 2
      const lowFactorPenalty =
        opKey !== '+' && candidatesLength(opKey, value) > 1 && operand === 2
          ? 2.5
          : 0
      const score =
        recentOperandPenalty +
        recentResultPenalty +
        operandSeen +
        resultSeen +
        lowFactorPenalty +
        rng() * 0.25
      return score
    }

    if (opKey === '+') {
      const plusMax = Math.min(tier.max, MAX_RESULT - value)
      const plusMin = Math.min(tier.min, plusMax)
      const plusCandidates: number[] = []
      for (let n = plusMin; n <= plusMax; n += 1) plusCandidates.push(n)
      if (plusCandidates.length === 0) return undefined
      const operand =
        pickDiverse(opKey, plusCandidates, (n) => value + n) ??
        plusCandidates[Math.floor(rng() * plusCandidates.length)]
      const next = value + operand
      return { operand, next, score: scoreCandidate(operand, next) }
    }

    if (opKey === '-') {
      const safeMax = Math.min(tier.max, Math.max(tier.min, value - MIN_RESULT))
      const safeMin = Math.min(tier.min, safeMax)
      const minusCandidates: number[] = []
      for (let n = safeMin; n <= safeMax; n += 1) minusCandidates.push(n)
      if (minusCandidates.length === 0) return undefined
      const operand =
        pickDiverse(opKey, minusCandidates, (n) => value - n) ??
        minusCandidates[Math.floor(rng() * minusCandidates.length)]
      const next = value - operand
      return { operand, next, score: scoreCandidate(operand, next) }
    }

    if (opKey === 'x') {
      const factors = [2, 3, 4, 5, 6, 7, 8, 9].filter((factor) => value * factor <= MAX_RESULT)
      if (factors.length === 0) return undefined
      const operand =
        pickDiverse(opKey, factors, (n) => value * n) ??
        factors[Math.floor(rng() * factors.length)]
      const next = value * operand
      return { operand, next, score: scoreCandidate(operand, next) }
    }

    const divisors: number[] = []
    for (let d = 2; d <= 12; d += 1) {
      if (value % d === 0) {
        const quotient = value / d
        if (quotient >= MIN_RESULT && quotient <= MAX_RESULT) divisors.push(d)
      }
    }
    if (divisors.length === 0) return undefined
    const operand =
      pickDiverse(opKey, divisors, (n) => value / n) ??
      divisors[Math.floor(rng() * divisors.length)]
    const next = value / operand
    return { operand, next, score: scoreCandidate(operand, next) }
  }

  const candidatesLength = (opKey: Op, value: number) => {
    if (opKey === '+') {
      const plusMax = Math.min(tier.max, MAX_RESULT - value)
      const plusMin = Math.min(tier.min, plusMax)
      return Math.max(0, plusMax - plusMin + 1)
    }
    if (opKey === '-') {
      const safeMax = Math.min(tier.max, Math.max(tier.min, value - MIN_RESULT))
      const safeMin = Math.min(tier.min, safeMax)
      return Math.max(0, safeMax - safeMin + 1)
    }
    if (opKey === 'x') {
      return [2, 3, 4, 5, 6, 7, 8, 9].filter((factor) => value * factor <= MAX_RESULT).length
    }
    let c = 0
    for (let d = 2; d <= 12; d += 1) {
      if (value % d === 0) {
        const q = value / d
        if (q >= MIN_RESULT && q <= MAX_RESULT) c += 1
      }
    }
    return c
  }

  const isOpValid = (op: Op, value: number) => {
    if (op === '+') return value < MAX_RESULT
    if (op === '-') return value - tier.min >= MIN_RESULT
    if (op === 'x') return value >= MIN_RESULT && value * 2 <= MAX_RESULT
    for (let d = 2; d <= 12; d += 1) {
      if (value % d === 0) {
        const next = value / d
        if (next >= MIN_RESULT && next <= MAX_RESULT) return true
      }
    }
    return false
  }

  for (let i = 0; i < path.length - 1; i += 1) {
    const selectedValid = selectedSorted.filter((op) => isOpValid(op, running))
    const allowedFallback = simplerOrEqualToDesired.filter((op) => isOpValid(op, running))
    const recentTail = recentOperandKeys.slice(-5)
    const twoLoopCount = recentTail.filter((k) => k === 'x:2' || k === '/:2').length
    const xDivOnlySelection =
      config.ops.length > 0 && config.ops.every((op) => op === 'x' || op === '/')
    const loopLockActive = xDivOnlySelection && twoLoopCount >= 4

    const basePool =
      config.ops.length === 1 && config.ops[0] === '+'
        ? (['+'] as Op[])
        : selectedValid.length > 0
          ? selectedValid
          : allowedFallback.length > 0
            ? allowedFallback
            : (['+'] as Op[])
    const breakerPool = (['+', '-'] as Op[]).filter((op) => isOpValid(op, running))
    const opsPool = loopLockActive && breakerPool.length > 0
      ? Array.from(new Set<Op>([...basePool, ...breakerPool]))
      : basePool

    const candidates = opsPool
      .map((candidateOp) => {
        const choice = bestForOp(candidateOp, running)
        if (!choice) return undefined
        let preferenceBias = 0
        if (loopLockActive) {
          if (candidateOp === '+' || candidateOp === '-') preferenceBias -= 6
          if ((candidateOp === 'x' || candidateOp === '/') && choice.operand === 2) preferenceBias += 8
        }
        if (candidateOp === desiredOp) preferenceBias -= 3
        else preferenceBias += 1 + (complexityRank[desiredOp] - complexityRank[candidateOp]) * 0.6
        return { op: candidateOp, ...choice, totalScore: choice.score + preferenceBias }
      })
      .filter((x): x is { op: Op; operand: number; next: number; score: number; totalScore: number } => !!x)

    if (candidates.length === 0) {
      const backupOperand = Math.max(1, Math.floor(rng() * Math.max(1, Math.min(tier.max, MAX_RESULT - running))) + 1)
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
      const backupOperand = Math.max(1, Math.floor(rng() * Math.max(1, Math.min(tier.max, MAX_RESULT - running))) + 1)
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
    operandUse.set(usedKey, (operandUse.get(usedKey) ?? 0) + 1)
    resultUse.set(next, (resultUse.get(next) ?? 0) + 1)
    recentOperandKeys.push(usedKey)
    recentResults.push(next)
    if (recentOperandKeys.length > recentWindow) recentOperandKeys.shift()
    if (recentResults.length > recentWindow) recentResults.shift()
    running = next
  }

  const shownIndices = chooseEvenlyDistributed(path.length, config.selfChecks)
  const shownValues: Record<number, number> = { 0: startValue }
  let value = startValue
  edges.forEach((edge, edgeIdx) => {
    value = edge.result
    const pathIdx = edgeIdx + 1
    if (pathIdx === path.length - 1 || shownIndices.has(pathIdx)) {
      shownValues[pathIdx] = value
    }
  })

  const cells: Cell[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ idx: keyOf(col, row, cols), col, row })
    }
  }

  return { cols, rows, cells, path, edges, startValue, finalValue: value, shownValues }
}
