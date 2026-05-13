import { describe, expect, test } from 'vitest'
import { generatePuzzle, type Config } from '../generator'

type EdgeGeom = {
  from: number
  to: number
  x1: number
  y1: number
  x2: number
  y2: number
  mx: number
  my: number
}

function computeLayout(config: Config, seed: string) {
  const puzzle = generatePuzzle(config, seed, 4)
  const cellById = new Map(puzzle.cells.map((c) => [c.idx, c]))
  const usableW = 640
  const usableH = 700
  const stepX = usableW / Math.max(1, puzzle.cols - 1)
  const stepY = usableH / Math.max(1, puzzle.rows - 1)
  const radius = Math.max(14, Math.min(stepX, stepY) * 0.28)

  const toXY = (idx: number) => {
    const cell = cellById.get(idx)
    if (!cell) return { x: 0, y: 0 }
    return {
      x: 80 + cell.col * stepX,
      y: 70 + cell.row * stepY,
    }
  }

  const circles = puzzle.path.slice(0, 8).map((idx, i) => {
    const { x, y } = toXY(idx)
    return {
      pathIndex: i,
      idx,
      x,
      y,
    }
  })

  const edges: EdgeGeom[] = puzzle.edges.slice(0, 8).map((edge) => {
    const a = toXY(edge.from)
    const b = toXY(edge.to)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.max(1, Math.hypot(dx, dy))
    const ux = dx / len
    const uy = dy / len
    const x1 = a.x + ux * (radius + 2)
    const y1 = a.y + uy * (radius + 2)
    const x2 = b.x - ux * (radius + 4)
    const y2 = b.y - uy * (radius + 4)
    const mx = x1 + (x2 - x1) * 0.4
    const my = y1 + (y2 - y1) * 0.4
    return { from: edge.from, to: edge.to, x1, y1, x2, y2, mx, my }
  })

  return {
    seed,
    cols: puzzle.cols,
    rows: puzzle.rows,
    radius,
    stepX,
    stepY,
    checkpoints: puzzle.checkpointPathIndices,
    circles,
    edges,
  }
}

const round = (n: number) => Number(n.toFixed(4))
const deepRound = <T,>(value: T): T => JSON.parse(JSON.stringify(value, (_, v) => (typeof v === 'number' ? round(v) : v))) as T

describe('puzzle layout regression', () => {
  test('locks exact circle and arrow geometry for seed 4PDWL4', () => {
    const config: Config = {
      operations: 40,
      tier: '10-99',
      ops: ['+', '-'],
    }

    const layout = deepRound(computeLayout(config, '4PDWL4'))

    expect(layout).toMatchInlineSnapshot(`
      {
        "checkpoints": [
          10,
          20,
          30,
          40,
        ],
        "circles": [
          {
            "idx": 51,
            "pathIndex": 0,
            "x": 354.2857,
            "y": 670,
          },
          {
            "idx": 50,
            "pathIndex": 1,
            "x": 262.8571,
            "y": 670,
          },
          {
            "idx": 42,
            "pathIndex": 2,
            "x": 262.8571,
            "y": 570,
          },
          {
            "idx": 34,
            "pathIndex": 3,
            "x": 262.8571,
            "y": 470,
          },
          {
            "idx": 35,
            "pathIndex": 4,
            "x": 354.2857,
            "y": 470,
          },
          {
            "idx": 36,
            "pathIndex": 5,
            "x": 445.7143,
            "y": 470,
          },
          {
            "idx": 28,
            "pathIndex": 6,
            "x": 445.7143,
            "y": 370,
          },
          {
            "idx": 20,
            "pathIndex": 7,
            "x": 445.7143,
            "y": 270,
          },
        ],
        "cols": 8,
        "edges": [
          {
            "from": 51,
            "mx": 312.9943,
            "my": 670,
            "to": 50,
            "x1": 326.6857,
            "x2": 292.4571,
            "y1": 670,
            "y2": 670,
          },
          {
            "from": 50,
            "mx": 262.8571,
            "my": 625.28,
            "to": 42,
            "x1": 262.8571,
            "x2": 262.8571,
            "y1": 642.4,
            "y2": 599.6,
          },
          {
            "from": 42,
            "mx": 262.8571,
            "my": 525.28,
            "to": 34,
            "x1": 262.8571,
            "x2": 262.8571,
            "y1": 542.4,
            "y2": 499.6,
          },
          {
            "from": 34,
            "mx": 304.1486,
            "my": 470,
            "to": 35,
            "x1": 290.4571,
            "x2": 324.6857,
            "y1": 470,
            "y2": 470,
          },
          {
            "from": 35,
            "mx": 395.5771,
            "my": 470,
            "to": 36,
            "x1": 381.8857,
            "x2": 416.1143,
            "y1": 470,
            "y2": 470,
          },
          {
            "from": 36,
            "mx": 445.7143,
            "my": 425.28,
            "to": 28,
            "x1": 445.7143,
            "x2": 445.7143,
            "y1": 442.4,
            "y2": 399.6,
          },
          {
            "from": 28,
            "mx": 445.7143,
            "my": 325.28,
            "to": 20,
            "x1": 445.7143,
            "x2": 445.7143,
            "y1": 342.4,
            "y2": 299.6,
          },
          {
            "from": 20,
            "mx": 487.0057,
            "my": 270,
            "to": 21,
            "x1": 473.3143,
            "x2": 507.5429,
            "y1": 270,
            "y2": 270,
          },
        ],
        "radius": 25.6,
        "rows": 8,
        "seed": "4PDWL4",
        "stepX": 91.4286,
        "stepY": 100,
      }
    `)
  })
})
