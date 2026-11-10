// Run: node --test src/bulk.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLE_CSV, markDuplicates, parseCsv, readCandidates } from './bulk.js'

const now = new Date(2026, 10, 3) // 03-NOV-2026

test('parses quoted CSV fields with commas, quotes and newlines', () => {
  assert.deepEqual(parseCsv('a,"b, c","say ""hi"""\r\n\r\n"x\ny",2,\n'), [['a', 'b, c', 'say "hi"'], ['x\ny', '2', '']])
})

test('sample CSV imports with no errors and fills derived fields like the form', () => {
  const { rows, unknown } = readCandidates(SAMPLE_CSV, now)
  assert.deepEqual(unknown, [])
  assert.deepEqual(rows.map((r) => r.errors), [[], [], []])
  const [rahul, sneha] = rows.map((r) => r.record)
  assert.equal(rahul.ctc, '650000')
  assert.equal(rahul.fixPay, '600000') // CTC − variable
  assert.equal(rahul.inHand, '49800') // fixed / 12 − PT
  assert.equal(rahul.phase, 'confirmed')
  assert.deepEqual(rahul.tech, ['JAVA', 'ReactJS'])
  assert.equal(rahul.companies[1].present, true)
  assert.equal(rahul.expYears, '7') // Jul 2019 → Nov 2026, from company dates
  assert.equal(sneha.passOut, '2021-06')
  assert.equal(sneha.expYears, '3') // no companies: typed value kept
  assert.equal(rows[2].record.tech[0], 'DevOps (AWS, GCP, AZURE)')
  assert.equal(rows[2].record.phase, 'selected')
})

test('reports wrong cells per row, accepts Excel-style dates and +91 phones', () => {
  const csv = [
    'name,phone,visit date,phase,career technology,companies,Experience Months,Foo',
    'A,+91 98765 43210,03/11/2026,enquiry,java,,,x',
    ',12345,31-02-2026,pending,Rust,"X (2022-05 to 2021-01)",12,',
  ].join('\n')
  const { rows, unknown } = readCandidates(csv, now)
  assert.deepEqual(unknown, ['Foo'])
  assert.deepEqual(rows[0].errors, [])
  assert.equal(rows[0].record.phone, '9876543210')
  assert.equal(rows[0].record.visitDate, '03-NOV-2026')
  assert.equal(rows[0].record.phase, 'inquiry')
  assert.equal(rows[1].line, 3)
  assert.equal(rows[1].errors.length, 7) // phone, date, phase, tech, companies, months, name
})

test('file without a Name column is rejected', () => {
  assert.match(readCandidates('phone\n9876543210', now).error, /Name/)
})

test('duplicates: by phone, or by name when there is no phone; saved records and earlier rows', () => {
  const csv = 'name,phone\nRahul Patil,9876543210\nNew Person,9000000001\nSAME  phone,9000000001\nsneha joshi,\nWalk In,\nwalk in,\nBad,123'
  const { rows } = readCandidates(csv, now)
  markDuplicates(rows, [{ name: 'Rahul P', phone: '9876543210' }, { name: 'Sneha Joshi', phone: '' }])
  assert.deepEqual(rows.map((r) => r.duplicate ?? (r.errors.length ? 'error' : 'ok')), [
    'phone already saved for Rahul P',
    'ok',
    'same phone as row 3 in this file',
    'name already saved',
    'ok',
    'same name, no phone as row 6 in this file',
    'error', // bad rows are reported as errors, not duplicates
  ])
})
