// Run: node --test src/options.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advance } from './options.js'

test('advance status from amount paid, old "Paid" tick counts as full', () => {
  assert.deepEqual(advance({ advanceAmount: '' }), { paid: 0, due: 20000, status: 'unpaid' })
  assert.deepEqual(advance({ advanceAmount: '5000' }), { paid: 5000, due: 15000, status: 'partial' })
  assert.deepEqual(advance({ advanceAmount: '20000' }), { paid: 20000, due: 0, status: 'paid' })
  assert.equal(advance({ advanceAmount: '25000' }).status, 'paid')
  assert.equal(advance({ advancePaid: true }).status, 'paid') // legacy record
  assert.equal(advance({}).status, 'unpaid')
  assert.equal(advance({ advancePaid: true, advanceAmount: '0' }).status, 'unpaid') // amount wins once set
})
