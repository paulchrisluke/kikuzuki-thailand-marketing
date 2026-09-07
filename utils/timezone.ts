import { parseDateTime } from '@internationalized/date'

const UTC_ALIASES = new Set(['UTC', 'Etc/UTC', 'Etc/GMT', 'GMT'])

export const TIMEZONE_OPTIONS = (() => {
  const options = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : []
  return options.includes('UTC') ? options : ['UTC', ...options]
})()

export function normalizeTimezone(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return UTC_ALIASES.has(trimmed) ? 'UTC' : trimmed
}

export function isValidTimezone(value: string | null | undefined): value is string {
  const normalized = normalizeTimezone(value)
  if (!normalized) return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value! })
    return true
  } catch {
    return false
  }
}

// Calendar dates and local times are civil values, never timestamp instants.
// UTC below anchors civil formatting so neither SSR nor the browser moves them.
export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const MINUTE_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
export const PRECISE_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/
export const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/
export const calendarDateSchema = { type: 'string', format: 'date', pattern: CALENDAR_DATE_PATTERN.source, description: 'Gregorian calendar date, YYYY-MM-DD. No timezone conversion.' } as const
export const minuteTimeSchema = { type: 'string', pattern: MINUTE_TIME_PATTERN.source, description: 'Local wall-clock time, HH:mm (24-hour), in the explicitly selected location timezone.' } as const
export const preciseTimeSchema = { type: 'string', pattern: PRECISE_TIME_PATTERN.source, description: 'Local wall-clock time, HH:mm:ss with optional fractional seconds. Not a UTC instant.' } as const
export const instantSchema = { type: 'string', format: 'date-time', pattern: INSTANT_PATTERN.source, description: 'RFC 3339 instant with an explicit Z or numeric UTC offset. Offsetless timestamps are invalid.' } as const
export const timezoneSchema = { type: 'string', minLength: 1, description: 'Explicit IANA timezone identifier, such as Asia/Bangkok. Missing timezone is an error, never the browser timezone.' } as const

export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function assertCalendarDate(value: unknown): asserts value is string {
  if (!isValidCalendarDate(value)) throw new Error('A valid Gregorian YYYY-MM-DD calendar date is required')
}
export function isValidInstant(value: unknown): value is string {
  return typeof value === 'string' && INSTANT_PATTERN.test(value) && isValidCalendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
}
export function instantDate(value: string | Date): Date {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('Invalid timestamp instant')
    return value
  }
  if (!isValidInstant(value)) throw new Error('Timestamp must be RFC 3339 with an explicit UTC offset')
  return new Date(value)
}
export function formatCalendarDate(value: string, locale: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  assertCalendarDate(value)
  return new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
export function formatTime(value: string, locale: string): string {
  if (!MINUTE_TIME_PATTERN.test(value) && !PRECISE_TIME_PATTERN.test(value)) throw new Error('Invalid local wall-clock time')
  const time = MINUTE_TIME_PATTERN.test(value) ? `${value}:00` : value
  const meaningfulSeconds = /[1-9]/.test(time.slice(6))
  const parts = new Intl.DateTimeFormat(locale, { calendar: 'gregory', hour: 'numeric', minute: '2-digit', ...(meaningfulSeconds ? { second: '2-digit' as const } : {}), timeZone: 'UTC' }).formatToParts(new Date(`2000-01-01T${time}Z`))
  const fraction = time.includes('.') ? time.slice(time.indexOf('.')) : ''
  return parts.map(part => part.type === 'second' ? part.value + fraction : part.value).join('')
}
export function formatTimestamp(value: string | Date, locale: string, timeZone: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  if (!isValidTimezone(timeZone)) throw new Error('A valid explicit timezone is required')
  return new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory', timeZone }).format(instantDate(value))
}
export function localPartsAt(instant: Date, timeZone: string) {
  if (!isValidTimezone(timeZone)) throw new Error('A valid explicit timezone is required')
  const parts = new Intl.DateTimeFormat('en-US', { calendar: 'gregory', numberingSystem: 'latn', timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instantDate(instant))
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) }
}
export function localDateAt(instant: Date, timeZone: string): string {
  const p = localPartsAt(instant, timeZone)
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}
export function localNow(timeZone: string, now: Date = new Date()): { date: string; time: string } {
  const p = localPartsAt(now, timeZone)
  return { date: localDateAt(now, timeZone), time: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` }
}
export function addLocalDays(value: string, days: number): string {
  assertCalendarDate(value)
  if (!Number.isInteger(days)) throw new Error('Calendar day offset must be an integer')
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Bookings must identify exactly one instant. Calendar-day boundaries explicitly
// include the whole day: the earlier repeated midnight or the end of a gap.
export function localDateTimeToInstant(date: string, time: string, timeZone: string, disambiguation: 'reject' | 'compatible' = 'reject'): Date {
  assertCalendarDate(date)
  if (!MINUTE_TIME_PATTERN.test(time) && !PRECISE_TIME_PATTERN.test(time)) throw new Error('Invalid local time')
  if (!isValidTimezone(timeZone)) throw new Error('A valid explicit timezone is required')
  return parseDateTime(`${date}T${time}`).toDate(timeZone, disambiguation)
}
