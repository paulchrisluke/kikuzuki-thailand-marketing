import { instantDate } from '~/utils/timezone'

// Better Auth adapters return Dates; JSON API responses serialize them as ISO
// instants. Database integer units belong to its adapter, never a magnitude guess.
export type BetterAuthTimestamp = Date | string

export function betterAuthTimestampToIso(value: BetterAuthTimestamp, fieldName = 'timestamp'): string {
  if (!(value instanceof Date) && typeof value !== 'string') throw new Error(`Invalid Better Auth ${fieldName}`)
  return instantDate(value).toISOString()
}
