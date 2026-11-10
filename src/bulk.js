// Bulk upload: CSV text → candidate records, checked with the same rules as the profile form.
// Kept free of React/Firebase so `node --test src/bulk.test.js` can run it.
import { ADVANCE_DUE, PHASES, TECH } from './options.js'
import { applySalary } from './salary.js'
import { nowIdx, toIdx, totalMonths } from './career.js'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
const FIRST_YEAR = 2005 // the form's month/year dropdowns start here (FIRST_YEAR in Career.jsx)
const PARENT_REL = ['Father', 'Mother']
const SPOUSE_REL = ['Spouse', 'Brother', 'Sister']

// RFC 4180 CSV: quoted fields, "" inside quotes, commas/newlines inside quotes. Blank lines dropped.
export function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  text = text.replace(/^﻿/, '') // Excel's BOM
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  row.push(field); rows.push(row)
  return rows.filter((r) => r.some((v) => v.trim()))
}

const csvCell = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
export const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'

// "03-NOV-2026", "03-11-2026", "03/11/2026" (DD/MM, as Excel saves in India) or "2026-11-03" → "03-NOV-2026".
export function parseDate(v) {
  let d, m, y, mm
  if ((mm = /^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})$/.exec(v))) [d, m, y] = [mm[1], MONTHS.indexOf(mm[2].toUpperCase()) + 1, mm[3]]
  else if ((mm = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(v))) [d, m, y] = [mm[1], mm[2], mm[3]]
  else if ((mm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v))) [y, m, d] = [mm[1], mm[2], mm[3]]
  else return null
  const date = new Date(+y, +m - 1, +d)
  return m >= 1 && date.getDate() === +d && date.getMonth() === +m - 1 ? fmtDate(date) : null
}

// "2019-07", "07-2019", "07/2019", "Jul-2019" or "Jul 2019" → "2019-07"; year 2005 → this year (same as the form's dropdowns).
export function parseMonth(v, now = new Date()) {
  let m, y, mm
  if ((mm = /^(\d{4})[-/](\d{1,2})$/.exec(v))) [y, m] = [mm[1], +mm[2]]
  else if ((mm = /^(\d{1,2})[-/](\d{4})$/.exec(v))) [m, y] = [+mm[1], mm[2]]
  else if ((mm = /^([A-Za-z]{3})[a-z]*[-/ ](\d{4})$/.exec(v))) [m, y] = [MONTHS.indexOf(mm[1].toUpperCase()) + 1, mm[2]]
  else return null
  if (m < 1 || m > 12 || +y < FIRST_YEAR || +y > now.getFullYear()) return null
  return `${y}-${String(m).padStart(2, '0')}`
}

// Same as the form's phone box: digits only, a leading 91/0 dropped when longer than 10. Must end up exactly 10.
function phone(v) {
  const d = v.replace(/\D/g, '')
  const p = d.length > 10 ? d.replace(/^(91|0)/, '') : d
  return p.length === 10 ? p : null
}

// Same as the Money box: "₹ 6,50,000" → 650000; a small number is LPA ("6.5" or "6.5 LPA" → 650000).
function money(v) {
  const s = v.replace(/[₹,\s]|lpa|rs\.?/gi, '')
  if (!/^\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  return String(Math.round(n < 100 ? n * 100000 : n))
}

const pick = (list) => (v) => list.find((o) => o.toLowerCase() === v.toLowerCase()) ?? null

// "Infosys (2019-07 to 2022-03); TCS (2022-04 to Present)" → companies; throws with the reason when a part is wrong.
function companies(v, now) {
  const fail = (msg) => { throw new Error(msg) }
  const out = []
  for (const part of v.split(';').map((s) => s.trim()).filter(Boolean)) {
    const m = /^(.+?)\s*\(\s*([^()]+?)\s+to\s+([^()]+?)\s*\)$/i.exec(part)
    if (!m) fail(`"${part}" should look like Company (2019-07 to 2022-03)`)
    const from = parseMonth(m[2], now)
    if (!from) fail(`${m[1]}: joining "${m[2]}" is not a month between ${FIRST_YEAR} and now`)
    const present = /^present$/i.test(m[3])
    const to = present ? '' : parseMonth(m[3], now)
    if (!present && !to) fail(`${m[1]}: exit "${m[3]}" is not a month between ${FIRST_YEAR} and now (or "Present")`)
    if (!present && toIdx(to) < toIdx(from)) fail(`${m[1]}: exit date is before the joining date`)
    out.push({ name: m[1], from, to, present })
  }
  if (out.filter((c) => c.present).length > 1) fail('Only one company can be "Present"')
  return out
}

// One entry per CSV column, in sheet order: header, form key, help text for the rules table, example values, parser.
// parse(cell, now) returns the value to save, or null when the cell is wrong (blank cells are never parsed).
export const COLUMNS = [
  { header: 'Name', key: 'name', required: true, rule: 'Candidate full name.', parse: (v) => v },
  { header: 'Phone', key: 'phone', rule: '10-digit mobile. +91 / 0 prefix is removed. Must not already exist.', parse: phone },
  { header: 'Visit Date', key: 'visitDate', rule: 'DD-MMM-YYYY (03-NOV-2026). DD-MM-YYYY, DD/MM/YYYY and YYYY-MM-DD also work. Blank = today.', parse: parseDate },
  { header: 'Reference', key: 'reference', rule: 'Who referred the candidate.', parse: (v) => v },
  { header: 'Parents No', key: 'parentsNo', rule: '10-digit mobile.', parse: phone },
  { header: 'Parents Relation', key: 'parentsRel', rule: PARENT_REL.join(' / '), parse: pick(PARENT_REL) },
  { header: 'Spouse/Sibling No', key: 'spouseNo', rule: '10-digit mobile.', parse: phone },
  { header: 'Spouse/Sibling Relation', key: 'spouseRel', rule: SPOUSE_REL.join(' / '), parse: pick(SPOUSE_REL) },
  { header: 'Career Technology', key: 'tech', rule: `One or more, separated by ";". Allowed: ${TECH.join(' · ')}`,
    parse: (v) => { const t = v.split(';').map((s) => s.trim()).filter(Boolean).map(pick(TECH)); return t.includes(null) ? null : [...new Set(t)] } },
  { header: 'Experience Years', key: 'expYears', rule: '0 – 50. Ignored when Companies are given (worked out from dates).', parse: (v) => (/^\d{1,2}$/.test(v) && +v <= 50 ? String(+v) : null) },
  { header: 'Experience Months', key: 'expMonths', rule: '0 – 11. Ignored when Companies are given.', parse: (v) => (/^\d{1,2}$/.test(v) && +v <= 11 ? String(+v) : null) },
  { header: 'CTC', key: 'ctc', rule: 'Yearly, in ₹ (650000) or LPA (6.5). Fixed / In-hand are worked out when left blank, like the form.', parse: money },
  { header: 'Variable Pay', key: 'varPay', rule: 'Yearly, ₹ or LPA.', parse: money },
  { header: 'Fixed Pay', key: 'fixPay', rule: 'Yearly, ₹ or LPA.', parse: money },
  { header: 'In-hand', key: 'inHand', rule: 'Monthly, in ₹. Blank = Fixed ÷ 12 − ₹200 PT.', parse: (v) => { const s = v.replace(/[₹,\s]/g, ''); return /^\d+$/.test(s) ? s : null } },
  { header: 'Advance Paid', key: 'advanceAmount', rule: `₹ paid towards the ₹${ADVANCE_DUE.toLocaleString('en-IN')} advance. 0 / blank = Unpaid, less = Partial, ${ADVANCE_DUE} = Fully Paid.`,
    parse: (v) => { const s = v.replace(/[₹,\s]/g, ''); return /^\d{1,6}$/.test(s) ? String(+s) : null } },
  { header: 'Phase', key: 'phase', rule: `${PHASES.map(([, l]) => l).join(' / ')} (Enquiry also accepted). Blank = Inquiry.`,
    parse: (v) => (/^(inquiry|enquiry)$/i.test(v) ? 'inquiry' : /^selected$/i.test(v) ? 'selected' : /^confirmed$/i.test(v) ? 'confirmed' : null) },
  { header: 'Pass-out', key: 'passOut', rule: `Month & year: 2019-06, 06-2019 or Jun-2019 (${FIRST_YEAR} onwards).`, parse: parseMonth },
  { header: 'Companies', key: 'companies', rule: 'Company (YYYY-MM to YYYY-MM), several separated by ";". Use "Present" for the current job.', parse: companies },
  { header: 'Sign Date', key: 'signDate', rule: 'Same formats as Visit Date. Blank = today.', parse: parseDate },
]

const SAMPLE_ROWS = [
  ['Rahul Patil', '9876543210', '15-OCT-2026', 'Amit Shah', '9822001122', 'Father', '', '', 'JAVA; ReactJS', '', '', '6.5', '50000', '', '', '20000', 'Confirmed', '2019-06', 'Infosys (2019-07 to 2022-03); TCS (2022-04 to Present)', '15-OCT-2026'],
  ['Sneha Joshi', '9123456780', '02-NOV-2026', 'Walk-in', '', '', '9988776655', 'Spouse', 'Python; Data Engg', '3', '6', '900000', '', '', '', '5000', 'Inquiry', 'Jun-2021', '', ''],
  ['Kiran More', '9000011111', '28-OCT-2026', '', '', '', '', '', 'DevOps (AWS, GCP, AZURE)', '1', '0', '', '', '', '', '', 'Selected', '', '', ''],
]
export const SAMPLE_CSV = toCsv([COLUMNS.map((c) => c.header), ...SAMPLE_ROWS])

const norm = (h) => h.toLowerCase().replace(/[^a-z]/g, '')

// CSV text → { error } when the file itself is unusable, else { rows: [{ line, record, errors }] }.
// `record` matches what the profile form saves (no signature: that is drawn by the candidate).
export function readCandidates(text, now = new Date()) {
  const [head, ...body] = parseCsv(text)
  if (!head) return { error: 'The file is empty.' }
  const index = head.map((h) => COLUMNS.find((c) => norm(c.header) === norm(h)))
  if (!index.some((c) => c?.key === 'name')) return { error: 'No "Name" column found. Start from the sample CSV so the headings match.' }
  const unknown = head.filter((h, i) => h.trim() && !index[i])
  const today = fmtDate(now)
  const rows = body.map((cells, n) => {
    const errors = []
    const r = {
      name: '', phone: '', visitDate: today, reference: '', parentsNo: '', parentsRel: '', spouseNo: '', spouseRel: '',
      tech: [], expYears: '', expMonths: '', ctc: '', varPay: '', fixPay: '', inHand: '', advanceAmount: '',
      phase: 'inquiry', passOut: '', companies: [], signature: '', signedAt: '', signDate: today,
    }
    const given = new Set()
    index.forEach((col, i) => {
      const v = (cells[i] ?? '').trim()
      if (!col || !v) return
      let val
      try { val = col.parse(v, now) } catch (e) { return errors.push(`${col.header}: ${e.message}`) }
      if (val === null) errors.push(`${col.header}: "${v}" is not valid. ${col.rule}`)
      else { r[col.key] = val; given.add(col.key) }
    })
    if (!r.name) errors.push('Name is required')
    // Salary: fill the blanks the way the form does when you type into one box.
    const typedInHand = r.inHand
    if (given.has('varPay')) Object.assign(r, applySalary(r, 'varPay', r.varPay))
    else if (given.has('fixPay')) Object.assign(r, applySalary(r, 'fixPay', r.fixPay))
    else if (given.has('ctc')) Object.assign(r, applySalary(r, 'ctc', r.ctc))
    if (typedInHand) r.inHand = typedInHand
    // Experience comes from company dates when there are any, same as the form.
    const m = totalMonths(r.companies, nowIdx(now))
    if (m !== null) Object.assign(r, { expYears: String(Math.floor(m / 12)), expMonths: String(m % 12) })
    return { line: n + 2, record: r, errors }
  })
  return { rows, unknown }
}

// Duplicates are skipped, never merged into the saved record. Rows with a phone are matched by phone; rows without one
// by name (ignoring case and extra spaces), against saved candidates and earlier rows of the same file.
const nameKey = (n) => n.trim().replace(/\s+/g, ' ').toLowerCase()
export function markDuplicates(rows, saved) {
  const byPhone = new Map(saved.filter((c) => c.phone).map((c) => [c.phone, `phone already saved for ${c.name || 'another candidate'}`]))
  const byName = new Map(saved.filter((c) => c.name).map((c) => [nameKey(c.name), `name already saved${c.phone ? ` (phone ${c.phone})` : ''}`]))
  for (const r of rows) {
    if (r.errors.length) continue
    const { phone, name } = r.record
    const [map, key, what] = phone ? [byPhone, phone, 'phone'] : [byName, nameKey(name), 'name, no phone']
    if (map.has(key)) r.duplicate = map.get(key)
    else map.set(key, `same ${what} as row ${r.line} in this file`)
  }
}
