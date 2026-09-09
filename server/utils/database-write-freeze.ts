import type { MessageBatch } from '@cloudflare/workers-types'

/**
 * Two switches for a database rebaseline, set as plain vars on a maintenance
 * deployment of the release candidate:
 *
 * - `DB_WRITE_FROZEN="true"`: the export phase. Reads keep serving from the old
 *   schema; every mutating HTTP request, scheduled task, queue batch and inbound
 *   email is refused so the export is a consistent point.
 * - `DB_MAINTENANCE="true"`: the reset and load phase. Nothing can be served
 *   while tables are dropped and reloaded, so every request gets 503.
 */
export interface DatabaseWriteFreezeEnv {
  DB_WRITE_FROZEN?: string
  DB_MAINTENANCE?: string
}

export const isDatabaseInMaintenance = (env: DatabaseWriteFreezeEnv | undefined): boolean =>
  env?.DB_MAINTENANCE === 'true'

export const isDatabaseWriteFrozen = (env: DatabaseWriteFreezeEnv | undefined): boolean =>
  env?.DB_WRITE_FROZEN === 'true' || isDatabaseInMaintenance(env)

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** True when this request must be refused under the current switches. */
export function isRequestFrozen(env: DatabaseWriteFreezeEnv | undefined, method: string): boolean {
  if (isDatabaseInMaintenance(env)) return true
  return isDatabaseWriteFrozen(env) && !READ_METHODS.has(method.toUpperCase())
}

export function retryFrozenQueueBatch(
  env: DatabaseWriteFreezeEnv | undefined,
  batch: Pick<MessageBatch, 'retryAll'>,
): boolean {
  if (!isDatabaseWriteFrozen(env)) return false

  // Keep the batch out of D1 while the rebaseline runs. The delay also avoids
  // a hot retry loop during the short maintenance window.
  batch.retryAll({ delaySeconds: 300 })
  return true
}
