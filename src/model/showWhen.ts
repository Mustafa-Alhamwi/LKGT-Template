import type { ShowWhen } from './types'

/** هل يظهر عنصر بحسب الإجابة الحالية للتصميم */
export function showWhenOk(sw: ShowWhen | undefined, answer: 'a' | 'b' | null | undefined): boolean {
  switch (sw) {
    case 'question':
      return !answer
    case 'reveal':
      return !!answer
    case 'a':
      return answer === 'a'
    case 'b':
      return answer === 'b'
    default:
      return true
  }
}

export const SHOW_WHEN_LABELS: { value: ShowWhen; label: string }[] = [
  { value: 'always', label: 'دائماً' },
  { value: 'question', label: 'في السؤال فقط' },
  { value: 'reveal', label: 'عند كشف الإجابة' },
  { value: 'a', label: 'عندما الإجابة الأولى' },
  { value: 'b', label: 'عندما الإجابة الثانية' },
]
