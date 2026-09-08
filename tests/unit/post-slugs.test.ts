import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePostInput, postActionUrl, postEventDescription, type PostRecurrence } from '../../shared/posts.ts'
import { normalizePostSlug, postPublicPath } from '../../utils/post-slugs.ts'

describe('post slug helpers', () => {
  test('normalizes owner post titles into stable URL slugs', () => {
    assert.equal(normalizePostSlug(' Fresh Clay & Sunset: July Workshop! '), 'fresh-clay-and-sunset-july-workshop')
    assert.equal(normalizePostSlug(''), 'post')
    assert.equal(normalizePostSlug(null), 'post')
  })

  test('builds encoded public post paths', () => {
    assert.equal(postPublicPath('fresh-clay'), '/posts/fresh-clay')
    assert.equal(postPublicPath('legacy id'), '/posts/legacy%20id')
  })
})



test('canonical post topics validate schedules, recurrence and action invariants', () => {
  const event = {
    title: 'Late workshop',
    schedule: { start_date: '2026-09-06', start_time: '23:30:00.123456789', end_date: '2026-09-07', end_time: '01:00:00' },
  }

  {
    const offer = parsePostInput({ body: 'Workshop offer', post_type: 'offer', event, offer: {} })
    assert.deepEqual(offer.event, event)
    assert.deepEqual(offer.offer, {})
    const standard = parsePostInput({ post_type: 'standard' }, offer)
    assert.deepEqual([standard.event, standard.offer, standard.alert_type], [null, null, null])
    assert.throws(() => parsePostInput({ body: 'Text', post_type: 'update' }))
    assert.throws(() => parsePostInput({ body: 'Text', cta_type: 'book' }))
    assert.throws(() => parsePostInput({ body: 'Offer', post_type: 'offer', offer: {} }), /event/)
    assert.throws(() => parsePostInput({ body: 'Offer', post_type: 'offer', event, call_to_action: { action_type: 'book', url: 'https://example.com' } }))
  }

  {
    for (const start_date of ['2026-02-29', '2026-13-01']) {
      assert.throws(() => parsePostInput({ body: 'Event', post_type: 'event', event: { ...event, schedule: { ...event.schedule, start_date } } }))
    }
    assert.throws(() => parsePostInput({ body: 'Event', post_type: 'event', event: { ...event, schedule: { ...event.schedule, end_date: '2026-09-06', end_time: '23:30:00.123456788' } } }), /end must not precede/)
  }

  {
    const rules: PostRecurrence[] = [
      { kind: 'daily' },
      { kind: 'weekly', days_of_week: [] },
      { kind: 'weekly', days_of_week: ['monday', 'friday'] },
      { kind: 'monthly', day_of_month: 31 },
      { kind: 'monthly', day_of_week_occurrence: 'last', series_end_time: '2027-01-01T00:00:00.123456789Z' },
    ]
    for (const recurrence_info of rules) {
      const input = { ...event, recurrence_info }
      const post = parsePostInput({ body: 'Recurring event', post_type: 'event', event: input })
      assert.deepEqual(post.event, input)
      assert.ok(postEventDescription(input).includes('11:30:00.123456789'))
    }
    assert.match(postEventDescription({ ...event, recurrence_info: { kind: 'weekly', days_of_week: [] } }), /Sunday/)
    for (const recurrence_info of [
      { kind: 'monthly', day_of_month: 31, day_of_week_occurrence: 'last' },
      { kind: 'weekly', days_of_week: ['monday', 'monday'] },
      { kind: 'daily', series_end_time: '2026-02-30T00:00:00Z' },
    ]) assert.throws(() => parsePostInput({ body: 'Event', post_type: 'event', event: { ...event, recurrence_info } }))
  }

  {
    assert.equal(postActionUrl({ action_type: 'call' }, '+66123456789'), 'tel:+66123456789')
    assert.equal(postActionUrl({ action_type: 'call' }, null), null)
    assert.throws(() => parsePostInput({ body: 'Call', call_to_action: { action_type: 'call', url: 'https://example.com' } }))
    assert.throws(() => parsePostInput({ body: 'Call', call_to_action: { action_type: 'book', url: '/book' } }))
    assert.throws(() => parsePostInput({ body: 'Alert', post_type: 'alert', alert_type: 'covid_19', media: [{ asset_id: 'asset', slot: 'cover' }] }))
  }

})
