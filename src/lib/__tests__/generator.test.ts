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
        const divValid = Array.from({ length: 11 }, (_, i) => i + 2).some((d) => running % d === 0)
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
