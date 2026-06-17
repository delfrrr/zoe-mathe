import { describe, expect, test } from 'vitest'
import { generatePuzzle, type Config, type Op, TIERS } from '../generator'

function seeds(n: number) {
  const out: string[] = []
  for (let i = 0; i < n; i += 1) {
    out.push((i * 7919 + 12345).toString(36).toUpperCase().padStart(6, '0').slice(0, 6))
  }
  return out
}

function opCounts(edges: Array<{ op: Op }>) {
  const c: Record<Op, number> = { '+': 0, '-': 0, x: 0, '/': 0 }
  for (const e of edges) c[e.op] += 1
  return c
}

function isImmediateInverse(
  previous: { op: Op; operand: number },
  current: { op: Op; operand: number },
) {
  if (previous.operand !== current.operand) return false
  return (
    (previous.op === 'x' && current.op === '/') ||
    (previous.op === '/' && current.op === 'x') ||
    (previous.op === '+' && current.op === '-') ||
    (previous.op === '-' && current.op === '+')
  )
}

function countImmediateInverses(edges: Array<{ op: Op; operand: number }>) {
  let count = 0
  for (let i = 1; i < edges.length; i += 1) {
    if (isImmediateInverse(edges[i - 1], edges[i])) count += 1
  }
  return count
}

function isImmediateCancellation(
  previous: { op: Op; operand: number; result: number },
  current: { op: Op; operand: number },
) {
  if (previous.op !== 'x' || current.op !== '/') return false
  const previousInput = previous.result / previous.operand
  return current.operand === previousInput || current.operand === previous.operand
}

function countImmediateCancellations(edges: Array<{ op: Op; operand: number; result: number }>) {
  let count = 0
  for (let i = 1; i < edges.length; i += 1) {
    if (isImmediateCancellation(edges[i - 1], edges[i])) count += 1
  }
  return count
}

const tableOperandBounds: Record<Config['tier'], { min: number; max: number }> = {
  '0-9': { min: 2, max: 9 },
  '10-99': { min: 2, max: 9 },
  '100-999': { min: 10, max: 99 },
  '1k-9k': { min: 2, max: 999 },
}

function possibleTableDivisor(tier: Config['tier'], value: number) {
  const { min, max } = tableOperandBounds[tier]
  for (let d = min; d <= max; d += 1) {
    if (value % d === 0 && value !== d) return true
  }
  return false
}

describe('generator range guarantees', () => {
  test.each([
    ['0-9'],
    ['10-99'],
    ['100-999'],
    ['1k-9k'],
  ] as const)('all results stay <= selected max for tier %s', (tier) => {
    const cfg: Config = { operations: 70, tier, ops: ['+', '-', 'x', '/'] }
    for (const seed of seeds(40)) {
      const p = generatePuzzle(cfg, seed)
      const max = TIERS[tier].max
      for (const e of p.edges) {
        expect(e.result).toBeGreaterThan(0)
        expect(e.result).toBeLessThanOrEqual(max)
      }
      expect(p.startValue).toBeLessThanOrEqual(max)
      expect(p.finalValue).toBeLessThanOrEqual(max)
    }
  })

  test.each([
    ['0-9', 2, 9],
    ['10-99', 2, 9],
    ['100-999', 10, 99],
    ['1k-9k', 2, 999],
  ] as const)('x and / operands stay in tier-specific table range for %s', (tier, minOperand, maxOperand) => {
    const cfg: Config = { operations: 70, tier, ops: ['x', '/'] }
    let mulDivCount = 0
    let divCount = 0

    for (const seed of seeds(12)) {
      const p = generatePuzzle(cfg, seed)
      for (let i = 0; i < p.edges.length; i += 1) {
        const edge = p.edges[i]
        if (edge.op !== 'x' && edge.op !== '/') continue

        mulDivCount += 1
        if (edge.op === '/') {
          divCount += 1
          expect(p.pathValues[i] % edge.operand).toBe(0)
        }
        expect(edge.operand).toBeGreaterThanOrEqual(minOperand)
        expect(edge.operand).toBeLessThanOrEqual(maxOperand)
        expect(edge.operand).not.toBe(0)
        expect(edge.operand).not.toBe(1)
      }
    }

    expect(mulDivCount).toBeGreaterThan(0)
    expect(divCount).toBeGreaterThan(0)
  })

  test('mixed-operation worksheets apply table bounds only to x and /', () => {
    const cfg: Config = { operations: 70, tier: '100-999', ops: ['+', '-', 'x', '/'] }
    let mulDivCount = 0

    for (const seed of seeds(40)) {
      const p = generatePuzzle(cfg, seed)
      for (const edge of p.edges) {
        if (edge.op === 'x' || edge.op === '/') {
          mulDivCount += 1
          expect(edge.operand).toBeGreaterThanOrEqual(10)
          expect(edge.operand).toBeLessThanOrEqual(99)
        }
        expect(edge.operand).not.toBe(0)
      }
    }

    expect(mulDivCount).toBeGreaterThan(0)
  })
})

describe('generator structural guarantees', () => {
  test('deterministic for same config + seed', () => {
    const cfg: Config = { operations: 30, tier: '10-99', ops: ['+', '-', 'x', '/'] }
    const a = generatePuzzle(cfg, 'SO048S')
    const b = generatePuzzle(cfg, 'SO048S')
    expect(a.path).toEqual(b.path)
    expect(a.edges).toEqual(b.edges)
    expect(a.startValue).toBe(b.startValue)
    expect(a.finalValue).toBe(b.finalValue)
  })

  test('edge count equals path transitions', () => {
    const cfg: Config = { operations: 70, tier: '100-999', ops: ['+', '-', 'x', '/'] }
    for (const seed of seeds(40)) {
      const p = generatePuzzle(cfg, seed)
      expect(p.edges.length).toBe(Math.max(0, p.path.length - 1))
    }
  })

  test('path does not revisit cells', () => {
    const cfg: Config = { operations: 60, tier: '10-99', ops: ['+', '-', 'x', '/'] }
    for (const seed of seeds(40)) {
      const p = generatePuzzle(cfg, seed)
      const unique = new Set(p.path)
      expect(unique.size).toBe(p.path.length)
    }
  })

  test('division operations always produce integer and stay in range', () => {
    const cfg: Config = { operations: 50, tier: '10-99', ops: ['x', '/'] }
    for (const seed of seeds(60)) {
      const p = generatePuzzle(cfg, seed)
      let running = p.startValue
      for (const e of p.edges) {
        if (e.op === '/') {
          expect(running % e.operand).toBe(0)
        }
        running = e.result
        expect(running).toBeGreaterThan(0)
        expect(running).toBeLessThanOrEqual(TIERS[cfg.tier].max)
      }
    }
  })
})

describe('operation preference rules', () => {
  test('single + means only + is used', () => {
    const cfg: Config = { operations: 40, tier: '10-99', ops: ['+'] }
    for (const seed of seeds(40)) {
      const p = generatePuzzle(cfg, seed)
      expect(p.edges.every((e) => e.op === '+')).toBe(true)
    }
  })

  test('for + and -, minus dominates globally with fallback + only', () => {
    const cfg: Config = { operations: 50, tier: '10-99', ops: ['+', '-'] }
    let plus = 0
    let minus = 0
    for (const seed of seeds(60)) {
      const p = generatePuzzle(cfg, seed)
      const c = opCounts(p.edges)
      plus += c['+']
      minus += c['-']
      expect(c.x).toBe(0)
      expect(c['/']).toBe(0)
    }
    expect(minus).toBeGreaterThan(plus)
  })

  test('for x and /, preferred op (/) appears often, fallback is simpler only', () => {
    const cfg: Config = { operations: 50, tier: '10-99', ops: ['x', '/'] }
    let div = 0
    let mul = 0
    let plus = 0
    let minus = 0
    for (const seed of seeds(80)) {
      const p = generatePuzzle(cfg, seed)
      const c = opCounts(p.edges)
      div += c['/']
      mul += c.x
      plus += c['+']
      minus += c['-']
    }
    expect(div).toBeGreaterThan(0)
    expect(mul).toBeGreaterThan(0)
    expect(plus + minus).toBeGreaterThanOrEqual(0)
  })

  test('single x: uses x whenever x is valid at that step', () => {
    const cfg: Config = { operations: 40, tier: '10-99', ops: ['x'] }
    let opportunities = 0
    let usedOnOpportunity = 0
    for (const seed of seeds(80)) {
      const p = generatePuzzle(cfg, seed)
      let running = p.startValue
      for (const e of p.edges) {
        const xValid = running >= 1 && running * 2 <= TIERS[cfg.tier].max
        if (xValid) {
          opportunities += 1
          if (e.op === 'x') usedOnOpportunity += 1
        }
        expect(e.op === '+' || e.op === '-' || e.op === 'x').toBe(true)
        running = e.result
      }
    }
    expect(opportunities).toBeGreaterThan(0)
    expect(usedOnOpportunity / opportunities).toBeGreaterThanOrEqual(0.95)
  })

  test('single /: uses division whenever division is valid at that step', () => {
    const cfg: Config = { operations: 40, tier: '10-99', ops: ['/'] }
    let opportunities = 0
    let usedOnOpportunity = 0
    for (const seed of seeds(80)) {
      const p = generatePuzzle(cfg, seed)
      let running = p.startValue
      for (const e of p.edges) {
        const divValid = possibleTableDivisor(cfg.tier, running)
        if (divValid) {
          opportunities += 1
          if (e.op === '/') usedOnOpportunity += 1
        }
        expect(e.op === '+' || e.op === '-' || e.op === 'x' || e.op === '/').toBe(true)
        running = e.result
      }
    }
    expect(opportunities).toBeGreaterThan(0)
    expect(usedOnOpportunity / opportunities).toBeGreaterThanOrEqual(0.9)
  })
})

describe('diversity checks under constrained scenario', () => {
  test('regression: seed VWSNZR avoids trivial division and immediate undo pairs', () => {
    const cfg: Config = { operations: 40, tier: '10-99', ops: ['x', '/'] }
    const p = generatePuzzle(cfg, 'VWSNZR')
    const trivialDivisions = p.edges.filter(
      (e, i) => e.op === '/' && p.pathValues[i] === e.operand && e.result === 1,
    )
    const mulDivEdges = p.edges.filter((e) => e.op === 'x' || e.op === '/')

    expect(trivialDivisions).toHaveLength(0)
    expect(countImmediateInverses(p.edges)).toBe(0)
    expect(mulDivEdges.length).toBeGreaterThanOrEqual(20)
  })

  test('regression: single division avoids n divided by n when alternatives exist', () => {
    const cfg: Config = { operations: 10, tier: '100-999', ops: ['/'] }
    const p = generatePuzzle(cfg, '0009IX')

    expect(
      p.edges.some((e, i) => e.op === '/' && p.pathValues[i] === e.operand && e.result === 1),
    ).toBe(false)
    expect(countImmediateInverses(p.edges)).toBe(0)
  })

  test('regression: seed ADDZ6S avoids immediate multiplication cancellation', () => {
    const cfg: Config = { operations: 30, tier: '10-99', ops: ['x', '/'] }
    const p = generatePuzzle(cfg, 'ADDZ6S')

    expect(countImmediateCancellations(p.edges)).toBe(0)
  })

  test('x and / in 10-99 keep broad table coverage without identity loops', () => {
    const cfg: Config = { operations: 40, tier: '10-99', ops: ['x', '/'] }

    for (const seed of seeds(70)) {
      const p = generatePuzzle(cfg, seed)
      const factorCounts = new Map<number, number>()
      let mulDivCount = 0

      for (let i = 0; i < p.edges.length; i += 1) {
        const edge = p.edges[i]
        expect(edge.operand).not.toBe(0)
        expect(edge.operand).not.toBe(1)
        expect(edge.result).toBeGreaterThan(0)
        if (edge.op === '/') expect(p.pathValues[i] === edge.operand && edge.result === 1).toBe(false)
        if (edge.op === 'x' || edge.op === '/') {
          mulDivCount += 1
          factorCounts.set(edge.operand, (factorCounts.get(edge.operand) ?? 0) + 1)
        }
      }

      const mostUsedFactor = Math.max(0, ...factorCounts.values())
      expect(mulDivCount).toBeGreaterThanOrEqual(20)
      expect(mostUsedFactor / Math.max(1, mulDivCount)).toBeLessThanOrEqual(0.2)
      expect(countImmediateInverses(p.edges)).toBe(0)
      expect(countImmediateCancellations(p.edges)).toBe(0)
    }
  })

  test('all-operation worksheets avoid zero operands and limit immediate undo pairs', () => {
    const cfg: Config = { operations: 40, tier: '10-99', ops: ['+', '-', 'x', '/'] }

    for (const seed of seeds(60)) {
      const p = generatePuzzle(cfg, seed)
      expect(p.edges.every((edge) => edge.operand !== 0)).toBe(true)
      expect(countImmediateInverses(p.edges)).toBeLessThanOrEqual(1)
    }
  })

  test('0-9 addition/subtraction worksheets avoid zero operands where alternatives exist', () => {
    const cfg: Config = { operations: 30, tier: '0-9', ops: ['+', '-'] }

    for (const seed of seeds(80)) {
      const p = generatePuzzle(cfg, seed)
      expect(p.edges.every((edge) => edge.operand !== 0)).toBe(true)
      expect(p.edges.every((edge) => edge.result > 0)).toBe(true)
    }
  })

  test('single - in 0-9 falls back instead of generating -0 loops', () => {
    const cfg: Config = { operations: 20, tier: '0-9', ops: ['-'] }

    for (const seed of seeds(40)) {
      const p = generatePuzzle(cfg, seed)
      expect(p.edges.every((edge) => edge.operand !== 0)).toBe(true)
      expect(p.edges.every((edge) => edge.result > 0)).toBe(true)
    }
  })

  test('regression: seed SO048S does not degenerate into almost-all 2s for x and /', () => {
    const cfg: Config = { operations: 30, tier: '10-99', ops: ['x', '/'] }
    const p = generatePuzzle(cfg, 'SO048S')
    const twos = p.edges.filter((e) => (e.op === 'x' || e.op === '/') && e.operand === 2).length
    const ratio = p.edges.length === 0 ? 1 : twos / p.edges.length
    expect(ratio).toBeLessThan(0.9)
  })

  test('x and / in 10-99 should not collapse to nearly all operand=2', () => {
    const cfg: Config = { operations: 30, tier: '10-99', ops: ['x', '/'] }
    let totalMulDiv = 0
    let twos = 0

    for (const seed of seeds(90)) {
      const p = generatePuzzle(cfg, seed)
      for (const e of p.edges) {
        if (e.op === 'x' || e.op === '/') {
          totalMulDiv += 1
          if (e.operand === 2) twos += 1
        }
      }
    }

    const ratio = totalMulDiv === 0 ? 1 : twos / totalMulDiv
    expect(ratio).toBeLessThan(0.8)
  })

  test('no long repetitive op-operand runs unless forced', () => {
    const cfg: Config = { operations: 40, tier: '10-99', ops: ['x', '/'] }

    for (const seed of seeds(70)) {
      const p = generatePuzzle(cfg, seed)
      let longest = 1
      let cur = 1
      for (let i = 1; i < p.edges.length; i += 1) {
        const prev = `${p.edges[i - 1].op}:${p.edges[i - 1].operand}`
        const now = `${p.edges[i].op}:${p.edges[i].operand}`
        if (prev === now) {
          cur += 1
          longest = Math.max(longest, cur)
        } else {
          cur = 1
        }
      }
      expect(longest).toBeLessThanOrEqual(6)
    }
  })

  test('very constrained tier still avoids extreme repetition where alternatives exist', () => {
    const cfg: Config = { operations: 30, tier: '0-9', ops: ['x', '/'] }
    let repeated = 0
    let total = 0
    for (const seed of seeds(60)) {
      const p = generatePuzzle(cfg, seed)
      for (let i = 1; i < p.edges.length; i += 1) {
        total += 1
        const prev = `${p.edges[i - 1].op}:${p.edges[i - 1].operand}`
        const now = `${p.edges[i].op}:${p.edges[i].operand}`
        if (prev === now) repeated += 1
      }
    }
    const repeatRatio = total === 0 ? 0 : repeated / total
    expect(repeatRatio).toBeLessThan(0.55)
  })
})
