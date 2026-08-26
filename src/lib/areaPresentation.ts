export function areaClueDisplayValue(value: number, hidden: boolean, showAnswers = false) {
  return showAnswers || !hidden ? String(value) : '?'
}

export function areaStickerAnswerValue(answer: number) {
  return String(answer)
}
