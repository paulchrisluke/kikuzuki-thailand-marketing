import type { PostEvent, PostMutation } from '~/shared/posts'

/**
 * Field-level helpers for the post editor, shared by the create form and the
 * post's own sections so the two cannot disagree about when a section is
 * finished or how a timestamp is written.
 */

export function fromTimeInput(value: string): string {
  if (!value) return ''
  return value.length === 5 ? `${value}:00` : value
}

/**
 * Whether the event carries everything its contract shape requires. Saving is
 * blocked on this rather than letting the server reject a form that looked
 * finished, and a weekly rule with no day chosen is not a weekly rule.
 */
export function postScheduleComplete(event: PostEvent | null | undefined): boolean {
  if (!event?.title.trim()) return false
  const { start_date, start_time, end_date, end_time } = event.schedule
  if (!start_date || !start_time || !end_date || !end_time) return false
  if (`${end_date}T${end_time}` < `${start_date}T${start_time}`) return false
  if (event.recurrence_info?.kind === 'weekly' && event.recurrence_info.days_of_week.length === 0) return false
  return true
}

/** A call to action that is not a phone call has to say where it goes. */
export function postActionComplete(topic: PostMutation): boolean {
  const action = topic.call_to_action
  if (!action || action.action_type === 'call') return true
  try {
    return ['http:', 'https:'].includes(new URL(action.url).protocol)
  } catch {
    return false
  }
}

/** A scheduled post has to go live in the future. */
export function postPublishingComplete(topic: PostMutation): boolean {
  if (!topic.scheduled_for) return true
  return Date.parse(topic.scheduled_for) > Date.now()
}

/** Event and offer both carry a window; only an offer calls it one. */
export function postNeedsSchedule(topic: PostMutation): boolean {
  return topic.post_type === 'event' || topic.post_type === 'offer'
}
