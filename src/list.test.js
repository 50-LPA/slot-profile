// Run: node --test src/list.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FILTERS, filterRows, gapOf, paginate, lastVisit, sortRows, stats, visitNum } from './list.js'

const rows = [
  { id: 'a', name: 'Asha', visitDates: ['05-OCT-2026', '12-SEP-2026'], phase: 'confirmed', advanceAmount: '20000', ctc: '900000', tech: ['JAVA'],
    passOut: '2019-06', companies: [{ from: '2019-07', to: '2022-03' }, { from: '2022-06', present: true }], updatedAt: { toDate: () => new Date(2026, 9, 1) } },
  { id: 'b', name: 'bharat', visitDate: '20-NOV-2026', phase: 'selected', advanceAmount: '5000', tech: ['JAVA', 'PHP'], updatedAt: { toDate: () => new Date(2026, 10, 2) } },
  { id: 'c', name: 'Chetan', visitDate: '', expYears: '3', advanceAmount: '' }, // old record: no phase, no date
]
const f = (over) => ({ ...DEFAULT_FILTERS, ...over })
const ids = (rs) => rs.map((r) => r.id).join('')

test('visit dates read as sortable numbers', () => {
  assert.equal(visitNum('05-OCT-2026'), 20261005)
  assert.equal(visitNum('5-oct-2026'), 20261005)
  assert.equal(visitNum(''), null)
  assert.equal(lastVisit(rows[0]), '05-OCT-2026') // latest, not last entered
  assert.equal(lastVisit(rows[1]), '20-NOV-2026') // old single visitDate
  assert.equal(lastVisit(rows[2]), '')
})

test('filters: phase (old records and dropped "selected" = inquiry), gap', () => {
  assert.equal(ids(filterRows(rows, f({}))), 'a') // default: Confirmed
  assert.equal(ids(filterRows(rows, f({ phase: 'all' }))), 'abc')
  assert.equal(ids(filterRows(rows, f({ phase: 'inquiry' }))), 'bc')
  assert.equal(ids(filterRows(rows, f({ phase: 'confirmed' }))), 'a')
  assert.equal(gapOf(rows[0]), 2) // Apr–May 2022
  assert.equal(gapOf(rows[1]), null) // no career data
  assert.equal(ids(filterRows(rows, f({ phase: 'all', gap: 'any' }))), 'a')
  assert.equal(ids(filterRows(rows, f({ phase: 'all', gap: '6' }))), '')
  assert.equal(ids(filterRows(rows, f({ phase: 'all', q: 'BHA' }))), 'b')
})

test('sorting puts blanks last in both directions, names ignore case', () => {
  assert.equal(ids(sortRows(rows, 'name', 'asc')), 'abc')
  assert.equal(ids(sortRows(rows, 'name', 'desc')), 'cba')
  assert.equal(ids(sortRows(rows, 'visit', 'asc')), 'abc')
  assert.equal(ids(sortRows(rows, 'visit', 'desc')), 'bac')
  assert.equal(ids(sortRows(rows, 'ctc', 'desc')), 'abc')
  assert.equal(ids(sortRows(rows, 'phase', 'desc')), 'abc')
  assert.equal(ids(sortRows(rows, 'updated', 'desc')), 'bac')
})

test('pagination clamps the page and reports the range', () => {
  const list = Array.from({ length: 53 }, (_, i) => i)
  assert.deepEqual({ ...paginate(list, 3, 25), items: undefined }, { items: undefined, page: 3, pages: 3, first: 51, last: 53 })
  assert.equal(paginate(list, 9, 25).page, 3)
  assert.deepEqual({ ...paginate([], 1, 25), items: undefined }, { items: undefined, page: 1, pages: 1, first: 0, last: 0 })
})

test('home stats', () => {
  const s = stats(rows, new Date(2026, 10, 3))
  assert.deepEqual(s.byPhase, { inquiry: 2, confirmed: 1 })
  assert.deepEqual(s.advance, { collected: 25000, paid: 1, partial: 1, unpaid: 1, pending: 0 }) // inquiry's due not counted
  assert.equal(s.visits, 1) // November
  assert.deepEqual(s.topTech, [['JAVA', 2], ['PHP', 1]])
  assert.equal(s.recent[0].id, 'b')
})
