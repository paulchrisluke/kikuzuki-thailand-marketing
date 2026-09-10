import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { formatCalendarDate, formatTimestamp, localDateTimeToInstant } from '../../utils/timezone.ts'

const timezoneUrl = new URL('../../utils/timezone.ts', import.meta.url).href
function runInTimezone(expression: string, timeZone: string): string {
  return execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', `
    const { formatCalendarDate, formatTimestamp } = await import(${JSON.stringify(timezoneUrl)});
    process.stdout.write(String(${expression}));
  `], { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' })
}

test('civil dates preserve the Gregorian day across browser zones and locales', () => {
  assert.equal(runInTimezone("formatCalendarDate('2026-07-25', 'en')", 'America/Los_Angeles'), 'Jul 25, 2026')
  assert.match(formatCalendarDate('2026-07-25', 'th'), /2026/)
})

test('instants use the declared timezone independently of the runtime zone', () => {
  assert.equal(runInTimezone("formatTimestamp('2026-07-25T00:00:00Z', 'en', 'UTC', { dateStyle: 'medium' })", 'America/Los_Angeles'), 'Jul 25, 2026')
  assert.equal(formatTimestamp('2026-07-25T00:00:00Z', 'en', 'America/Los_Angeles', { dateStyle: 'medium' }), 'Jul 24, 2026')
})

test('invalid civil dates, offsetless instants, and missing zones fail explicitly', () => {
  assert.throws(() => formatCalendarDate('2026-02-30', 'en'))
  assert.throws(() => formatTimestamp('2026-07-25T00:00:00', 'en', 'UTC'))
  assert.throws(() => formatTimestamp('2026-07-25T00:00:00Z', 'en', ''))
})

test('booking wall times resolve in their location and reject DST gaps and overlaps', () => {
  assert.equal(localDateTimeToInstant('2026-07-25', '12:30', 'Asia/Bangkok').toISOString(), '2026-07-25T05:30:00.000Z')
  assert.throws(() => localDateTimeToInstant('2026-03-08', '02:30', 'America/New_York'), /No such absolute time/)
  assert.throws(() => localDateTimeToInstant('2026-11-01', '01:30', 'America/New_York'), /Multiple possible absolute times/)
})
