import { describe, expect, test } from 'vitest'
import {
  generateAreaWorksheet,
  maxBoxesForPuzzlesPerPage,
  maxPuzzlesForBoxesPerPuzzle,
  normalizeAreaConfig,
  validateAreaPuzzle,
  validateAreaPuzzleAfterRemovingRect,
  type AreaPuzzleConfig,
} from '../areaGenerator'

function seeds(n: number) {
  return Array.from({ length: n }, (_, i) => (i * 104729 + 2345).toString(36).toUpperCase().padStart(6, '0').slice(0, 6))
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function sharedSideLength(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  if (a.x + a.w === b.x || b.x + b.w === a.x) {
    return Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  }
  if (a.y + a.h === b.y || b.y + b.h === a.y) {
    return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  }
  return 0
}

function isSidewaysJoin(a: { x: number; w: number }, b: { x: number; w: number }) {
  return a.x + a.w === b.x || b.x + b.w === a.x
}

describe('area control constraints', () => {
  test('uses the readable density matrix', () => {
    expect(maxBoxesForPuzzlesPerPage(1)).toBe(6)
    expect(maxBoxesForPuzzlesPerPage(2)).toBe(5)
    expect(maxBoxesForPuzzlesPerPage(3)).toBe(4)
    expect(maxBoxesForPuzzlesPerPage(4)).toBe(3)
    expect(maxBoxesForPuzzlesPerPage(5)).toBe(3)
    expect(maxBoxesForPuzzlesPerPage(6)).toBe(3)
  })

  test('normalizes impossible combinations visibly', () => {
    expect(normalizeAreaConfig({ puzzlesPerPage: 6, numberSize: 2, boxesPerPuzzle: 6 })).toEqual({
      puzzlesPerPage: 6,
      numberSize: 2,
      boxesPerPuzzle: 3,
    })
    expect(maxPuzzlesForBoxesPerPuzzle(6)).toBe(1)
    expect(maxPuzzlesForBoxesPerPuzzle(5)).toBe(2)
    expect(maxPuzzlesForBoxesPerPuzzle(4)).toBe(3)
  })
})

describe('area puzzle generation', () => {
  const config: AreaPuzzleConfig = { puzzlesPerPage: 4, numberSize: 3, boxesPerPuzzle: 3 }

  test('is deterministic for the same seed and config', () => {
    const a = generateAreaWorksheet(config, 'AREA42')
    const b = generateAreaWorksheet(config, 'AREA42')
    expect(a).toEqual(b)
  })

  test('generates the selected puzzle and box counts', () => {
    const worksheet = generateAreaWorksheet({ puzzlesPerPage: 2, numberSize: 2, boxesPerPuzzle: 5 }, 'BOXES5')
    expect(worksheet.puzzles).toHaveLength(2)
    for (const puzzle of worksheet.puzzles) {
      expect(puzzle.rects).toHaveLength(5)
      expect(puzzle.dependencyOrder).toHaveLength(5)
    }
  })

  test('creates connected non-overlapping rectangle chains', () => {
    for (const seed of seeds(20)) {
      const worksheet = generateAreaWorksheet(config, seed)
      for (const puzzle of worksheet.puzzles) {
        for (let i = 0; i < puzzle.rects.length; i += 1) {
          const rect = puzzle.rects[i]
          expect(rect.w).toBeGreaterThan(1)
          expect(rect.h).toBeGreaterThan(1)
          expect(rect.area).toBe(rect.w * rect.h)
          if (i > 0) expect(sharedSideLength(puzzle.rects[i - 1], rect)).toBeGreaterThan(1)
          for (let j = i + 1; j < puzzle.rects.length; j += 1) {
            expect(rectsOverlap(rect, puzzle.rects[j])).toBe(false)
          }
        }
      }
    }
  })

  test('has exactly one hidden answer per puzzle and uses no units', () => {
    const worksheet = generateAreaWorksheet({ puzzlesPerPage: 6, numberSize: 1, boxesPerPuzzle: 3 }, 'HIDDEN')
    for (const puzzle of worksheet.puzzles) {
      const hiddenLabels = puzzle.labels.filter((label) => label.hidden)
      const hiddenAreaCount = puzzle.unknown.kind === 'area' ? 1 : 0
      expect(hiddenLabels.length + hiddenAreaCount).toBe(1)
      expect(Number.isInteger(puzzle.answer)).toBe(true)
      expect(String(puzzle.answer)).not.toContain('in')
    }
  })

  test('validates that every rectangle is required', () => {
    for (const seed of seeds(16)) {
      const worksheet = generateAreaWorksheet(config, seed)
      for (const puzzle of worksheet.puzzles) {
        expect(validateAreaPuzzle(puzzle)).toBe(true)
        expect(new Set(puzzle.dependencyOrder)).toEqual(new Set(puzzle.rects.map((rect) => rect.id)))
        for (const rect of puzzle.rects) {
          expect(validateAreaPuzzleAfterRemovingRect(puzzle, rect.id)).toBe(false)
        }
      }
    }
  })

  test('final clue forces use of the last rectangle area', () => {
    for (const seed of seeds(20)) {
      const worksheet = generateAreaWorksheet(config, seed)
      for (const puzzle of worksheet.puzzles) {
        const last = puzzle.rects[puzzle.rects.length - 1]
        const previous = puzzle.rects[puzzle.rects.length - 2]
        const finalSide =
          puzzle.unknown.kind === 'side'
            ? puzzle.labels.find((label) => label.id === (puzzle.unknown.kind === 'side' ? puzzle.unknown.labelId : ''))
            : puzzle.labels.find((label) => label.rectId === last.id)
        expect(finalSide).toBeDefined()
        const sideUsesWidth = finalSide?.side === 'top' || finalSide?.side === 'bottom'
        expect(sideUsesWidth).toBe(isSidewaysJoin(previous, last))
      }
    }
  })

  test('varies unknown type and generated layouts across a worksheet', () => {
    const worksheet = generateAreaWorksheet({ puzzlesPerPage: 6, numberSize: 4, boxesPerPuzzle: 3 }, 'VARIED')
    const unknownTypes = new Set(worksheet.puzzles.map((puzzle) => puzzle.unknown.kind))
    const layoutKeys = new Set(worksheet.puzzles.map((puzzle) => puzzle.rects.map((rect) => `${rect.x},${rect.y},${rect.w},${rect.h}`).join('|')))
    expect(unknownTypes.size).toBeGreaterThan(1)
    expect(layoutKeys.size).toBeGreaterThan(1)
  })
})
