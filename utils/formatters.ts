import { getDateIntervals, isOpenNow, localNow, closureOnDate, fmt12Hour, toTimeString, shiftDate, type OpeningHours, type SpecialHours, type Closure } from '../shared/reservation-hours.ts'
/** Derives up to 2 uppercase initials from a display name, for UAvatar's `text` fallback. */
export function getInitials(name: string | null | undefined): string {
  const value = name?.trim()
  if (!value) return ''
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '—'
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return '—'

  if (isDateOnly) {
    const [year, month, day] = dateString.split('-').map(Number)
    const parsedYear = d.getUTCFullYear()
    const parsedMonth = d.getUTCMonth() + 1
    const parsedDay = d.getUTCDate()
    if (year !== parsedYear || month !== parsedMonth || day !== parsedDay) {
      return '—'
    }
  }

  // Always format in UTC, not the runtime's local timezone — this must render
  // identically during SSR (server runs in UTC) and client-side hydration
  // (the visitor's browser may be in any timezone), or Vue's hydration
  // mismatch check flags every date on the page.
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  })
}

export const getActiveSpecialClosure = (hours: SpecialHours, timezone?: string | null, date?: string): Closure | undefined => {
  if (!date && !timezone) return undefined
  return closureOnDate(hours, date ?? localNow(timezone!).date)
}
export const formatClosureMessage = (closure: Closure | null | undefined): string | null => {
  if (!closure) return null
  if (closure.note) return closure.note
  return closure.ends_on ? `Temporarily closed. Reopening ${formatDate(shiftDate(closure.ends_on, 1))}` : 'Temporarily closed until further notice'
}
export const formatOpeningHours = (hours: OpeningHours, locale = 'en', closedLabel = 'Closed', timezone?: string | null) => {
  if (hours === null) return []
  const today = timezone ? localNow(timezone).date : null
  const todayDay = today ? new Date(`${today}T00:00:00Z`).getUTCDay() : null
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate('2024-01-01', index)
    const periods = getDateIntervals(hours, null, date) ?? []
    return {
      day: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)),
      today: (index + 1) % 7 === todayDay,
      hours: periods.length ? periods.map(p => `${fmt12Hour(toTimeString(Math.max(0, p.start)), locale)} to ${fmt12Hour(toTimeString(Math.min(p.end, 1440)), locale)}`).join(', ') : closedLabel,
    }
  })
}
export const getIsOpenNow = (hours: OpeningHours, timezone?: string | null, special: SpecialHours = null): boolean | undefined => isOpenNow(hours, timezone, new Date(), special)

/**
 * Returns '#ffffff' or '#000000' based on the luminance of the provided hex color.
 */
export const getContrastColor = (hex?: string | null) => {
  if (!hex || !hex.startsWith('#')) return '#ffffff'
  
  // Remove hash if present
  const color = hex.replace('#', '')
  
  // Convert 3-digit hex to 6-digits
  const r = parseInt(color.length === 3 ? color.slice(0, 1).repeat(2) : color.slice(0, 2), 16)
  const g = parseInt(color.length === 3 ? color.slice(1, 2).repeat(2) : color.slice(2, 4), 16)
  const b = parseInt(color.length === 3 ? color.slice(2, 3).repeat(2) : color.slice(4, 6), 16)
  
  // Luminance formula (YIQ)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
  
  return (yiq >= 128) ? '#000000' : '#ffffff'
}
