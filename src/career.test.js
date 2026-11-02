// Run: node --test src/career.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layout, span, toIdx, totalMonths } from './career.js'

test('places pass-out and companies on one scale', () => {
  const now = toIdx('2024-01')
  const t = layout('2018-06', [
    { name: 'A', from: '2019-01', to: '2021-01' },
    { name: 'B', from: '2022-01', present: true },
  ], now)
  assert.equal(t.passOut.left, 0)
  assert.equal(t.passOut.label, 'Jun 2018')
  const [a, b] = t.jobs
  assert.equal(a.months, 24)
  assert.equal(b.months, 24) // present → now
  assert.equal(Math.round(b.left + b.width), 100)
  assert.ok(a.left + a.width < b.left) // gap between jobs stays visible
})

test('skips companies without a joining date, empty input draws nothing', () => {
  assert.equal(layout('', []), null)
  assert.equal(layout('', [{ name: 'X', from: '' }]), null)
})

test('exit before joining is clamped to zero length', () => {
  const t = layout('', [{ name: 'X', from: '2020-05', to: '2019-01' }])
  assert.equal(t.jobs[0].months, 0)
})

test('span formats months', () => {
  assert.equal(span(27), '2y 3m')
  assert.equal(span(12), '1y')
  assert.equal(span(0), '0m')
})

test('total experience adds jobs, counts overlaps once, present runs to now', () => {
  const now = toIdx('2024-01')
  assert.equal(totalMonths([{ from: '2017-09', to: '2020-03' }], now), 30)
  assert.equal(totalMonths([
    { from: '2017-09', to: '2020-03' }, // 30
    { from: '2020-06', to: '2023-01' }, // 31
    { from: '2023-04', present: true }, // 9
  ], now), 70)
  assert.equal(totalMonths([{ from: '2019-01', to: '2021-01' }, { from: '2020-01', to: '2022-01' }], now), 36)
  assert.equal(totalMonths([{ from: '2020-05', to: '2019-01' }], now), 0) // bad exit counts nothing
  assert.equal(totalMonths([{ name: 'x', from: '' }], now), null)
})
