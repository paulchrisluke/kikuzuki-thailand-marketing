import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeLocationNotificationPhone } from '../../server/utils/location-management.ts'


test('normalizeLocationNotificationPhone: null/undefined/empty all normalize to null', () => {
  assert.equal(normalizeLocationNotificationPhone(null), null)
  assert.equal(normalizeLocationNotificationPhone(undefined), null)
  assert.equal(normalizeLocationNotificationPhone(''), null)
  assert.equal(normalizeLocationNotificationPhone('   '), null)
})

test('normalizeLocationNotificationPhone: valid Thai national-format input normalizes to E.164', () => {
  assert.equal(normalizeLocationNotificationPhone('081 234 5678'), '+66812345678')
})

test('normalizeLocationNotificationPhone: already-E.164 input is idempotent', () => {
  assert.equal(normalizeLocationNotificationPhone('+66812345678'), '+66812345678')
})

test('normalizeLocationNotificationPhone: valid non-Thai E.164 input is preserved', () => {
  assert.equal(normalizeLocationNotificationPhone('+14155552671'), '+14155552671')
})

test('normalizeLocationNotificationPhone: invalid/impossible input throws instead of storing raw value', () => {
  assert.throws(() => normalizeLocationNotificationPhone('not a phone number'), /valid phone number/)
  assert.throws(() => normalizeLocationNotificationPhone('123'), /valid phone number/)
})
