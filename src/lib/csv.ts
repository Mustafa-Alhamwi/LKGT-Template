/* قارئ جداول بسيط: CSV / TSV / لصق من Excel — يدعم الاقتباس والفواصل العربية */

export interface Table {
  rows: string[][]
}

export function parseTable(text: string): Table {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  if (!lines.length) return { rows: [] }
  const first = lines[0]
  const count = (ch: string) => (first.match(new RegExp(ch === '\t' ? '\\t' : `\\${ch}`, 'g')) ?? []).length
  const cands: [string, number][] = [
    ['\t', count('\t')],
    [',', count(',')],
    [';', count(';')],
    ['،', count('،')],
    ['|', count('|')],
  ]
  cands.sort((a, b) => b[1] - a[1])
  const delim = cands[0][1] > 0 ? cands[0][0] : ''
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const pushCell = () => {
    row.push(cell.trim())
    cell = ''
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell === '') q = true
    else if (delim && ch === delim) pushCell()
    else if (ch === '\n') {
      pushCell()
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  pushCell()
  if (row.some((c) => c !== '')) rows.push(row)
  return { rows }
}

export function toCsv(rows: string[][]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')
}
