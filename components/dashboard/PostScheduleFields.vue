<template>
  <div class="space-y-5">
    <UFormField :label="isOffer ? 'Offer name' : 'Event name'" required>
      <UInput v-model="event.title" class="w-full" />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField :label="isOffer ? 'Starts' : 'Start date'" required>
        <UInput v-model="event.schedule.start_date" type="date" class="w-full" />
      </UFormField>
      <UFormField label="Start time" required>
        <UInput
          :model-value="toTimeInput(event.schedule.start_time)"
          type="time"
          class="w-full"
          @update:model-value="event.schedule.start_time = fromTimeInput(String($event))"
        />
      </UFormField>
      <UFormField :label="isOffer ? 'Ends' : 'End date'" required>
        <UInput v-model="event.schedule.end_date" type="date" class="w-full" />
      </UFormField>
      <UFormField label="End time" required>
        <UInput
          :model-value="toTimeInput(event.schedule.end_time)"
          type="time"
          class="w-full"
          @update:model-value="event.schedule.end_time = fromTimeInput(String($event))"
        />
      </UFormField>
    </div>
    <p class="text-xs text-muted">Dates and times use this location's local time.</p>

    <UFormField label="Repeats">
      <USelect
        :model-value="event.recurrence_info?.kind ?? 'none'"
        :items="RECURRENCE_OPTIONS"
        value-key="value"
        label-key="label"
        class="w-full"
        @update:model-value="setRecurrence"
      />
    </UFormField>

    <UFormField
      v-if="event.recurrence_info?.kind === 'weekly'"
      label="Repeats on"
      required
      help="Pick at least one day."
    >
      <div class="flex flex-wrap gap-3">
        <UCheckbox
          v-for="day in POST_WEEKDAYS"
          :key="day"
          :label="weekdayLabel(day)"
          :model-value="event.recurrence_info.days_of_week.includes(day)"
          @update:model-value="toggleWeekday(day, $event === true)"
        />
      </div>
    </UFormField>

    <template v-if="event.recurrence_info?.kind === 'monthly'">
      <UFormField label="Repeats by">
        <USelect
          :model-value="'day_of_month' in event.recurrence_info ? 'date' : 'weekday'"
          :items="MONTHLY_OPTIONS"
          value-key="value"
          label-key="label"
          class="w-full"
          @update:model-value="setMonthlyRule"
        />
      </UFormField>
      <UFormField v-if="'day_of_month' in event.recurrence_info" label="Day of the month">
        <UInputNumber v-model="event.recurrence_info.day_of_month" :min="1" :max="31" class="w-full" />
      </UFormField>
      <UFormField v-else label="Which week">
        <USelect
          v-model="event.recurrence_info.day_of_week_occurrence"
          :items="OCCURRENCE_OPTIONS"
          value-key="value"
          label-key="label"
          class="w-full"
        />
      </UFormField>
    </template>

    <UFormField
      v-if="event.recurrence_info"
      label="Stops repeating on"
      help="Optional. Leave empty to repeat until you remove it."
    >
      <UInput
        :model-value="toLocalDateTimeInput(event.recurrence_info.series_end_time)"
        type="datetime-local"
        class="w-full"
        @update:model-value="setSeriesEnd(String($event))"
      />
    </UFormField>
  </div>
</template>

<script setup lang="ts">
import { POST_WEEKDAYS, type PostEvent } from '~/shared/posts'
import { fromLocalDateTimeInput, fromTimeInput, toLocalDateTimeInput, toTimeInput } from '~/utils/post-fields'

const event = defineModel<PostEvent>({ required: true })

defineProps<{
  /** An offer's window is the same shape as an event's; only its wording differs. */
  isOffer?: boolean
}>()

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
]
const MONTHLY_OPTIONS = [
  { value: 'date', label: 'Day of the month' },
  { value: 'weekday', label: 'Day of the week' },
]
const OCCURRENCE_OPTIONS = ['first', 'second', 'third', 'fourth', 'last'].map(value => ({
  value,
  label: value[0]!.toUpperCase() + value.slice(1),
}))

function weekdayLabel(day: typeof POST_WEEKDAYS[number]) {
  return day[0]!.toUpperCase() + day.slice(1, 3)
}

function setRecurrence(value: string) {
  if (value === 'none') {
    const { recurrence_info: _dropped, ...rest } = event.value
    event.value = rest
    return
  }
  event.value.recurrence_info = value === 'daily'
    ? { kind: 'daily' }
    : value === 'weekly'
      ? { kind: 'weekly', days_of_week: [] }
      : { kind: 'monthly', day_of_month: 1 }
}

function toggleWeekday(day: typeof POST_WEEKDAYS[number], checked: boolean) {
  const rule = event.value.recurrence_info
  if (rule?.kind !== 'weekly') return
  rule.days_of_week = checked
    ? [...rule.days_of_week, day]
    : rule.days_of_week.filter(value => value !== day)
}

function setMonthlyRule(value: string) {
  event.value.recurrence_info = value === 'date'
    ? { kind: 'monthly', day_of_month: 1 }
    : { kind: 'monthly', day_of_week_occurrence: 'first' }
}

function setSeriesEnd(value: string) {
  const rule = event.value.recurrence_info
  if (!rule) return
  const iso = fromLocalDateTimeInput(value)
  if (iso) {
    rule.series_end_time = iso
    return
  }
  const { series_end_time: _dropped, ...rest } = rule
  event.value.recurrence_info = rest as typeof rule
}
</script>
