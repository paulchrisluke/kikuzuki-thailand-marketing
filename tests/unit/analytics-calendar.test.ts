import assert from 'node:assert/strict'
import test from 'node:test'
import { localDateBounds, parseAnalyticsRange } from '../../server/utils/analytics-calendar.ts'
import { isValidTimezone } from '../../utils/timezone.ts'

test('reporting timezone accepts IANA zones and supports explicitly selected UTC', () => {
  assert.equal(isValidTimezone('Asia/Bangkok'), true)
  assert.equal(isValidTimezone('UTC'), true)
  assert.equal(isValidTimezone('Not/A-Timezone'), false)
})

test('default report range contains exactly 30 inclusive local dates', () => {
  const range = parseAnalyticsRange({ timeZone: 'Asia/Bangkok', now: new Date('2026-08-27T20:00:00Z') })
  assert.equal(range.endDate, '2026-08-28')
  assert.equal(range.startDate, '2026-07-30')
  assert.equal(range.dates.length, 30)
  assert.equal(range.previousStartDate, '2026-06-30')
  assert.equal(range.previousEndDate, '2026-07-29')
})

test('report range accepts 365 dates and rejects 366', () => {
  assert.equal(parseAnalyticsRange({
    startDate: '2025-01-01', endDate: '2025-12-31', timeZone: 'UTC', now: new Date(),
  }).dates.length, 365)
  assert.throws(() => parseAnalyticsRange({
    startDate: '2024-01-01', endDate: '2024-12-31', timeZone: 'UTC', now: new Date(),
  }), /365-day maximum/)
})

test('invalid end dates fail before deriving a default start date', () => {
  assert.throws(() => parseAnalyticsRange({
    endDate: '2026-02-30', timeZone: 'UTC', now: new Date(),
  }), /endDate must be a valid YYYY-MM-DD date/)
})

test('DST boundaries produce 23-hour and 25-hour local days', () => {
  assert.deepEqual(localDateBounds('2026-03-08', 'America/Chicago'), {
    start: '2026-03-08T06:00:00.000Z',
    end: '2026-03-09T05:00:00.000Z',
  })
  assert.deepEqual(localDateBounds('2026-11-01', 'America/Chicago'), {
    start: '2026-11-01T05:00:00.000Z',
    end: '2026-11-02T06:00:00.000Z',
  })
})


test('reporting dates include midnight DST transitions', () => {
  assert.deepEqual(localDateBounds('2026-09-06', 'America/Santiago'), {
    start: '2026-09-06T04:00:00.000Z', end: '2026-09-07T03:00:00.000Z',
  })
  assert.deepEqual(localDateBounds('2026-11-01', 'America/Havana'), {
    start: '2026-11-01T04:00:00.000Z', end: '2026-11-02T05:00:00.000Z',
  })
})
