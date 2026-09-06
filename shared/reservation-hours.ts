// Shared opening-hours normalization, open-now display, and reservation slots.
// Accept the CMS/Google hours contract without inventing availability.

export interface StructuredOpeningHoursEntry {
  openDay: string
  openTime: string
  closeTime: string
}

const WEEKDAY_BY_INDEX = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isStructuredOpeningHours(value: unknown): value is StructuredOpeningHoursEntry[] {
  return Array.isArray(value) && value.every(entry =>
    entry && typeof entry === 'object'
    && typeof (entry as StructuredOpeningHoursEntry).openDay === 'string'
    && TIME_PATTERN.test((entry as StructuredOpeningHoursEntry).openTime)
    && TIME_PATTERN.test((entry as StructuredOpeningHoursEntry).closeTime)
  )
}

// Normalize the hours contract accepted by the CMS and Google Places once for
// public display and reservation availability. No invented default time slots.
export function normalizeOpeningHours(value: unknown): StructuredOpeningHoursEntry[] {
  if (isStructuredOpeningHours(value)) return value
  if (!value || typeof value !== 'object') return []
  const record = value as { weekdayDescriptions?: unknown; periods?: unknown }
  const periods = Array.isArray(value) ? value : record.periods
  if (Array.isArray(periods) && periods.length) {
    return periods.flatMap((period) => {
      const time = (v: unknown): string | null => {
        if (typeof v === 'string') return TIME_PATTERN.test(v) ? v : null
        if (!v || typeof v !== 'object' || !('hours' in v)) return null
        const hours = v.hours
        const minutes = 'minutes' in v ? v.minutes : 0
        if (typeof hours !== 'number' || typeof minutes !== 'number') return null
        const result = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        return TIME_PATTERN.test(result) ? result : null
      }
      const openTime = time(period?.openTime)
      const closeTime = time(period?.closeTime)
      return typeof period?.openDay === 'string' && openTime && closeTime
        ? [{ openDay: period.openDay, openTime, closeTime }] : []
    })
  }
  if (!Array.isArray(record.weekdayDescriptions)) return []
  const normalized: StructuredOpeningHoursEntry[] = []
  for (const line of record.weekdayDescriptions) {
    if (typeof line !== 'string') continue
    const day = line.split(':', 1)[0]?.trim().toUpperCase() ?? ''
    if (!WEEKDAY_BY_INDEX.includes(day)) continue
    const range = line.replace(/^[^:]+:\s*/, '').trim()
    if (/^closed$/i.test(range)) continue
    if (/^open 24 hours$/i.test(range)) {
      normalized.push({ openDay: day, openTime: '00:00', closeTime: '00:00' })
      continue
    }
    for (const singleRangeStr of range.split(',')) {
      const parts = singleRangeStr.trim().split(/\s*[–—-]\s*/)
      if (parts.length !== 2) continue
      const parseAmPm = (s: string): { hour: number; minute: number; ampm: string | null } | null => {
        const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i)
        if (!m) return null
        const h = parseInt(m[1] ?? '0', 10)
        const min = parseInt(m[2] ?? '0', 10)
        const ampm = m[3]?.toUpperCase() || null
        if (h > 23 || min > 59 || (ampm && (h < 1 || h > 12))) return null
        return { hour: h, minute: min, ampm }
      }

      const openParsed = parseAmPm(parts[0] ?? '')
      const closeParsed = parseAmPm(parts[1] ?? '')
      if (!openParsed || !closeParsed) continue


      const toMins = (h: number, min: number, ampm: string | null): number => {
        let hour = h
        if (ampm === 'PM' && hour < 12) hour += 12
        else if (ampm === 'AM' && hour === 12) hour = 0
        return hour * 60 + min
      }

      // Infer AM/PM using hour-based inference
      let openAmpm = openParsed.ampm
      let closeAmpm = closeParsed.ampm

      if (!openAmpm && !closeAmpm) {
        // Try both AM, start AM end PM, start PM end AM
        const assignments = [
          { open: 'AM', close: 'AM' },
          { open: 'AM', close: 'PM' },
          { open: 'PM', close: 'AM' },
          { open: 'PM', close: 'PM' },
        ]
        let bestAssignment: typeof assignments[0] | null = null
        let bestDuration = -1

        for (const assignment of assignments) {
          const openMins = toMins(openParsed.hour, openParsed.minute, assignment.open)
          const closeMins = toMins(closeParsed.hour, closeParsed.minute, assignment.close)
          let duration = closeMins - openMins
          if (duration < 0) duration += 24 * 60 // Handle midnight crossing

          // Prefer positive duration <= 12h, with preference for same-day daytime spans (AM→PM)
          if (duration > 0 && duration <= 12 * 60) {
            if (bestDuration < 0 || duration < bestDuration || (assignment.open === 'AM' && assignment.close === 'PM')) {
              bestAssignment = assignment
              bestDuration = duration
            }
          }
        }

        if (bestAssignment) {
          openAmpm = bestAssignment.open
          closeAmpm = bestAssignment.close
        }
      } else if (!openAmpm && closeAmpm) {
        // Try assigning open the same marker as close
        openAmpm = closeAmpm
        const openMins = toMins(openParsed.hour, openParsed.minute, openAmpm)
        const closeMins = toMins(closeParsed.hour, closeParsed.minute, closeAmpm)
        let duration = closeMins - openMins
        if (duration < 0) duration += 24 * 60

        // If duration is negative or implausibly long (>12h), flip the inferred marker
        if (duration <= 0 || duration > 12 * 60) {
          openAmpm = closeAmpm === 'AM' ? 'PM' : 'AM'
        }
      } else if (!closeAmpm && openAmpm) {
        // Try assigning close the same marker as open
        closeAmpm = openAmpm
        const openMins = toMins(openParsed.hour, openParsed.minute, openAmpm)
        const closeMins = toMins(closeParsed.hour, closeParsed.minute, closeAmpm)
        let duration = closeMins - openMins
        if (duration < 0) duration += 24 * 60

        // If duration is negative or implausibly long (>12h), flip the inferred marker
        if (duration <= 0 || duration > 12 * 60) {
          closeAmpm = openAmpm === 'AM' ? 'PM' : 'AM'
        }
      }

      const openMins = toMins(openParsed.hour, openParsed.minute, openAmpm)
      const closeMins = toMins(closeParsed.hour, closeParsed.minute, closeAmpm)

      normalized.push({ openDay: day, openTime: toTimeString(openMins), closeTime: toTimeString(closeMins) })
    }
  }
  return normalized
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number) as [number, number]
  return h * 60 + m
}

const toTimeString = (minutes: number) => {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

// Resolves the current weekday and minutes-since-midnight in the location's own timezone.
// The server (Cloudflare Workers) runs in UTC, so comparing UTC wall-clock time against a
// location's local opening_hours produces wrong open/closed results.
function nowInTimezone(timezone: string | null | undefined, now: Date): { weekdayName: string; nowMinutes: number } {
  if (!timezone) return { weekdayName: WEEKDAY_BY_INDEX[now.getDay()]!, nowMinutes: now.getHours() * 60 + now.getMinutes() }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
    const weekday = parts.find(p => p.type === 'weekday')?.value?.toUpperCase()
    const hour = Number(parts.find(p => p.type === 'hour')?.value)
    const minute = Number(parts.find(p => p.type === 'minute')?.value)
    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) throw new Error('invalid parts')
    return { weekdayName: weekday, nowMinutes: hour * 60 + minute }
  } catch {
    return { weekdayName: WEEKDAY_BY_INDEX[now.getDay()]!, nowMinutes: now.getHours() * 60 + now.getMinutes() }
  }
}

/**
 * Generates reservation time options for a given calendar date from a location's structured
 * opening hours, at a fixed interval, stopping `lastSeatingBufferMinutes` before closing so the
 * last slot still allows a full seating. Returns [] if the location is closed that day.
 */
export function generateReservationTimes(
  openingHours: StructuredOpeningHoursEntry[],
  dateStr: string,
  { intervalMinutes = 30, lastSeatingBufferMinutes = 60 } = {},
): string[] {
  const weekdayIndex = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  const weekdayName = WEEKDAY_BY_INDEX[weekdayIndex]!
  const todaysHours = openingHours.filter(entry => entry.openDay.toUpperCase() === weekdayName)
  if (todaysHours.length === 0) return []

  const slots: string[] = []
  for (const { openTime, closeTime } of todaysHours) {
    const open = toMinutes(openTime)
    const close = toMinutes(closeTime) <= open ? toMinutes(closeTime) + 1440 : toMinutes(closeTime)
    const lastSeating = close - lastSeatingBufferMinutes
    for (let t = open; t <= lastSeating; t += intervalMinutes) {
      if (t < 1440) slots.push(toTimeString(t))
    }
  }
  return [...new Set(slots)].sort()
}

/** "HH:MM" (24h) → "3:00 PM" / "3:30 PM" (12h, no leading hour zero, always show minutes). */
export const fmt12Hour = (timeStr: string): string => {
  const [hStr, mStr] = timeStr.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/**
 * Today's opening hours as a display label (e.g. "11:30 AM – 10:30 PM"), or the provided
 * closedLabel when the location has structured hours but isn't open today. Returns null when
 * the location has no structured opening_hours to read (e.g. Google Places free-text hours).
 */
export function getTodayHoursLabel(openingHours: unknown, closedLabel: string, timezone?: string | null, now = new Date()): string | null {
  if (!isStructuredOpeningHours(openingHours)) return null
  const { weekdayName } = nowInTimezone(timezone, now)
  const todaysEntry = openingHours.find(entry => entry.openDay.toUpperCase() === weekdayName)
  if (!todaysEntry) return closedLabel
  return `${fmt12Hour(todaysEntry.openTime)} – ${fmt12Hour(todaysEntry.closeTime)}`
}

/**
 * Whether the location is open right now, based on structured opening_hours. Returns false
 * (rather than throwing) when hours aren't structured — callers should treat that as "unknown"
 * and avoid rendering an open/closed badge at all rather than trusting a false negative.
 * Handles overnight hours by treating ranges where closeTime <= openTime as spanning midnight.
 */
export function isOpenNow(openingHours: unknown, timezone?: string | null, now = new Date()): boolean {
  if (!isStructuredOpeningHours(openingHours)) return false
  const { weekdayName, nowMinutes } = nowInTimezone(timezone, now)
  const weekdayIndex = WEEKDAY_BY_INDEX.indexOf(weekdayName)
  const previousWeekdayName = WEEKDAY_BY_INDEX[(weekdayIndex + 6) % 7]!
  return openingHours.some(entry => {
    const open = toMinutes(entry.openTime)
    const close = toMinutes(entry.closeTime)
    const entryDay = entry.openDay.toUpperCase()
    // Overnight hours: close time is earlier than or equal to open time. An entry opening
    // yesterday (e.g. Monday 22:00-02:00) is still active after midnight into today.
    if (close <= open) {
      if (entryDay === weekdayName && nowMinutes >= open) return true
      if (entryDay === previousWeekdayName && nowMinutes < close) return true
      return false
    }
    if (entryDay !== weekdayName) return false
    return nowMinutes >= open && nowMinutes < close
  })
}
