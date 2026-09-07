import { defineHandler } from 'nitro'
import { readBody } from 'nitro/h3'
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { assertDevRouteAllowed } from '~/server/utils/dev-route-auth'
import {
  buildReplyToAddress, type SubmissionType, } from '~/server/utils/submission-messages'
import { receiveGuestEmail } from '~/server/domain/guest-threads/inbound-email'
import { parseReplyToAddress } from '~/server/utils/submission-messages'

export default defineHandler(async (event) => {
  assertDevRouteAllowed(event)
  const env = cloudflareEnv(event)
  const db = env.DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const body = await readBody(event) as {
    submissionType?: SubmissionType
    submissionId?: string
    from?: string
    body?: string
    messageId?: string
    replyTo?: string
  }

  if (!body.submissionType || !body.submissionId || !body.body?.trim()) {
    return jsonResponse({ error: 'submissionType, submissionId, and body are required' }, { status: 400 })
  }

  const replyTo = await buildReplyToAddress(env, body.submissionType, body.submissionId)
  if (!replyTo) {
    return jsonResponse({ error: 'EMAIL_REPLY_SECRET is not configured' }, { status: 400 })
  }

  const reply = parseReplyToAddress(env, body.replyTo ?? replyTo)
  if (!reply) {
    return jsonResponse({ error: 'Unrecognized reply address' }, { status: 400 })
  }
  const messageId = body.messageId?.trim() || crypto.randomUUID()
  await receiveGuestEmail(env, {
    submissionType: reply.submissionType,
    submissionId: reply.submissionId,
    token: reply.token,
    body: body.body.trim(),
    messageId,
  })

  return jsonResponse({ received: true, replyTo, messageId })
})
