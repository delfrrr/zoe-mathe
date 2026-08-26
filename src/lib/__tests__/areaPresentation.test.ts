import { describe, expect, test } from 'vitest'
import { areaClueDisplayValue, areaStickerAnswerValue } from '../areaPresentation'

describe('area puzzle presentation', () => {
  test('renders hidden in-picture values as question marks on worksheets', () => {
    expect(areaClueDisplayValue(72, true, false)).toBe('?')
  })

  test('keeps visible in-picture clues numeric', () => {
    expect(areaClueDisplayValue(48, false, false)).toBe('48')
  })

  test('can reveal hidden in-picture values for non-worksheet diagnostics', () => {
    expect(areaClueDisplayValue(72, true, true)).toBe('72')
  })

  test('prints the real answer inside the separate sticker target', () => {
    expect(areaStickerAnswerValue(36)).toBe('36')
  })
})
