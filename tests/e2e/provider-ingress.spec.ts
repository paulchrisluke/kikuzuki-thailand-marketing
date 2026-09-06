import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { loginAs } from './helpers/auth'
import { devLoginHeaders } from './test-env'

test('signed Stripe ingress processes one event and rejects invalid signatures', async ({ request }) => {
  const eventId = `evt_e2e_${randomUUID().replaceAll('-', '')}`
  const payload = JSON.stringify({
    id: eventId, object: 'event', type: 'customer.created',
    created: Math.floor(Date.now() / 1000), livemode: false,
    data: { object: { id: `cus_e2e_${randomUUID()}`, object: 'customer' } },
  })
  const signatureResponse = await request.post('/api/dev/stripe-signature', {
    headers: devLoginHeaders(), data: { payload },
  })
  expect(signatureResponse.status(), await signatureResponse.text()).toBe(200)
  const { signature } = await signatureResponse.json()
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await request.post('/api/auth/stripe/webhook', {
      headers: { 'content-type': 'application/json', 'stripe-signature': signature }, data: payload,
    })
    expect(response.status(), await response.text()).toBe(200)
  }
  const stateResponse = await request.get('/api/dev/billing-state', {
    headers: devLoginHeaders(), params: { organization_id: 'org-demo', stripe_event_id: eventId },
  })
  expect(stateResponse.status(), await stateResponse.text()).toBe(200)
  const state = await stateResponse.json()
  expect(state.webhook_events).toHaveLength(1)
  expect(state.webhook_events[0]).toMatchObject({ stripe_event_id: eventId, status: 'processed', attempt_count: 1 })
  const invalid = await request.post('/api/auth/stripe/webhook', {
    headers: { 'content-type': 'application/json', 'stripe-signature': `${signature}0` }, data: payload,
  })
  expect(invalid.status()).toBe(400)
})

test('compact signed email reply persists once and rejects a changed address', async ({ request, baseURL }) => {
  const name = `E5 ${randomUUID().slice(0, 12)}`
  const submitted = await request.post('/api/public/sites/site-demo/contact', {
    data: { name, email: 'paulchrisluke@gmail.com', message: 'Please confirm the continuity check.', subject: 'general' },
  })
  expect(submitted.status(), await submitted.text()).toBe(201)
  await loginAs(request, baseURL!, 'user-e2e-demo-owner')
  const listed = await request.get('/api/dashboard/sites/site-demo/guest-threads', { params: { search: name } })
  expect(listed.status(), await listed.text()).toBe(200)
  const { threads } = await listed.json()
  expect(threads).toHaveLength(1)
  const detailUrl = `/api/dashboard/sites/site-demo/guest-threads/${threads[0].id}`
  const initialResponse = await request.get(detailUrl)
  expect(initialResponse.status(), await initialResponse.text()).toBe(200)
  const { thread: initial } = await initialResponse.json()
  const data = {
    submissionType: 'contact', submissionId: initial.submissionId,
    body: `Signed guest reply ${randomUUID()}`, messageId: randomUUID(),
  }
  const received = await request.post('/api/dev/inbound-email', { headers: devLoginHeaders(), data })
  expect(received.status(), await received.text()).toBe(200)
  const { replyTo } = await received.json()
  expect(replyTo).toMatch(/^rc[0-9a-f]{56}@/)
  const duplicate = await request.post('/api/dev/inbound-email', { headers: devLoginHeaders(), data: { ...data, replyTo } })
  expect(duplicate.status(), await duplicate.text()).toBe(200)
  const [localPart, domain] = replyTo.split('@')
  for (const invalidAddress of [
    `${localPart.slice(0, -1)}${localPart.endsWith('0') ? '1' : '0'}@${domain}`,
    `${localPart}@invalid.example`,
  ]) {
    const invalid = await request.post('/api/dev/inbound-email', {
      headers: devLoginHeaders(), data: { ...data, messageId: randomUUID(), replyTo: invalidAddress },
    })
    expect(invalid.status()).toBeGreaterThanOrEqual(400)
  }
  const finalResponse = await request.get(detailUrl)
  expect(finalResponse.status(), await finalResponse.text()).toBe(200)
  const { thread: final } = await finalResponse.json()
  expect(final.entries).toHaveLength(initial.entries.length + 1)
  expect(final.entries.at(-1)).toMatchObject({ body: data.body, channel: 'email', actorKind: 'guest' })
})
