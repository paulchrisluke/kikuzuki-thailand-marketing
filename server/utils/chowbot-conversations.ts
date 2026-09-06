export type JsonSerializable = string | number | boolean | null | { [key: string]: JsonSerializable } | JsonSerializable[]

import { execute, queryFirst, type DbClient } from '~/server/db'

export type ChowBotChannel = 'dashboard' | 'whatsapp'

function nowIso() {
  return new Date().toISOString()
}

function jsonOrNull(value: JsonSerializable | null | undefined): string | null {
  return value == null ? null : JSON.stringify(value)
}

export async function getChannelState(
  db: DbClient,
  userId: string,
  channel: ChowBotChannel
): Promise<{
  user_id: string
  channel: ChowBotChannel
  pending_confirmation: string | null
  last_inbound_id: string | null
  updated_at: string
} | null> {
  const result = await queryFirst<{
    user_id: string
    channel: ChowBotChannel
    pending_confirmation: string | null
    last_inbound_id: string | null
    updated_at: string
  }>(db, `
    SELECT user_id, channel, pending_confirmation, last_inbound_id, updated_at
      FROM chowbot_channel_state
     WHERE user_id = ? AND channel = ? LIMIT 1
  `, [userId, channel])
  return result ?? null
}

export async function upsertChannelState(
  db: DbClient,
  opts: {
    userId: string
    channel: ChowBotChannel
    pendingConfirmation?: JsonSerializable | null
    lastInboundId?: string | null
  }
): Promise<void> {
  const updateFields: string[] = []
  if ('pendingConfirmation' in opts) updateFields.push('pending_confirmation = excluded.pending_confirmation')
  if ('lastInboundId' in opts) updateFields.push('last_inbound_id = excluded.last_inbound_id')
  updateFields.push('updated_at = excluded.updated_at')

  await execute(db, `
    INSERT INTO chowbot_channel_state
      (user_id, channel, pending_confirmation, last_inbound_id, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, channel) DO UPDATE SET
      ${updateFields.join(',\n      ')}
  `, [
    opts.userId,
    opts.channel,
    jsonOrNull(opts.pendingConfirmation),
    opts.lastInboundId ?? null,
    nowIso(),
  ])
}
