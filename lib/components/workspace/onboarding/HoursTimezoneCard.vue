<template>
  <div class="space-y-6">
    <UFormField label="Timezone" required>
      <USelectMenu v-model="form.timezone" :items="TIMEZONE_OPTIONS" placeholder="Select timezone" :search-input="{ placeholder: 'Search by city, e.g. Bangkok' }" class="w-full" size="xl" />
    </UFormField>
    <UFormField label="Regular opening hours">
      <USelect :model-value="mode" :items="modes" class="w-full" @update:model-value="setMode" />
    </UFormField>
    <template v-if="mode === 'periods'">
      <div v-for="(period, index) in form.hours?.periods" :key="index" class="space-y-3 rounded-xl border border-default p-4">
        <template v-if="period.close">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Opening day"><USelect v-model="period.open.day" :items="days" class="w-full" /></UFormField>
            <UFormField label="Opening time"><UInput :model-value="pointTime(period.open)" type="time" class="w-full" @update:model-value="setPointTime(period.open, String($event))" /></UFormField>
            <UFormField label="Closing day"><USelect v-model="period.close.day" :items="days" class="w-full" /></UFormField>
            <UFormField label="Closing time"><UInput :model-value="pointTime(period.close)" type="time" class="w-full" @update:model-value="setPointTime(period.close, String($event))" /></UFormField>
          </div>
          <UButton color="neutral" variant="ghost" label="Remove period" @click="form.hours?.periods.splice(index, 1)" />
        </template>
      </div>
      <UButton color="neutral" variant="outline" label="Add opening period" @click="addPeriod" />
    </template>
    <div class="space-y-4 border-t border-default pt-6">
      <p class="font-semibold">Closures and date exceptions</p>
      <div v-for="(entry, index) in form.specialHours" :key="index" class="space-y-3 rounded-xl border border-default p-4">
        <template v-if="entry.kind === 'closure'">
          <UFormField label="Closed from"><UInput v-model="entry.starts_on" type="date" /></UFormField>
          <UFormField label="Last closed date" help="Leave empty for an indefinite closure."><UInput :model-value="entry.ends_on ?? ''" type="date" @update:model-value="entry.ends_on = String($event) || null" /></UFormField>
        </template>
        <template v-else>
          <UFormField label="Date"><UInput v-model="entry.date" type="date" /></UFormField>
          <p class="text-sm text-muted">These hours replace regular hours for this date. No periods means closed.</p>
          <div v-for="(period, periodIndex) in entry.periods" :key="periodIndex" class="grid grid-cols-2 gap-3">
            <UFormField label="Open"><UInput v-model="period.open_time" type="time" /></UFormField>
            <UFormField label="Close"><UInput v-model="period.close_time" type="time" /></UFormField>
            <UCheckbox :model-value="period.close_day_offset === 1" label="Closes next day" @update:model-value="period.close_day_offset = $event === true ? 1 : 0" />
            <UButton color="neutral" variant="ghost" label="Remove period" @click="entry.periods.splice(periodIndex, 1)" />
          </div>
          <UButton color="neutral" variant="outline" label="Add period" @click="entry.periods.push({ open_time: '09:00', close_time: '17:00', close_day_offset: 0 })" />
        </template>
        <UFormField label="Guest message"><UInput :model-value="entry.note ?? ''" class="w-full" @update:model-value="entry.note = String($event) || null" /></UFormField>
        <UButton color="neutral" variant="ghost" label="Remove exception" @click="form.specialHours?.splice(index, 1)" />
      </div>
      <div class="flex gap-3">
        <UButton color="neutral" variant="outline" label="Add closure" @click="addException('closure')" />
        <UButton color="neutral" variant="outline" label="Add date hours" @click="addException('hours')" />
      </div>
    </div>
    <p v-if="validationError" class="text-sm text-error">{{ validationError }}</p>
    <UButton v-if="actionLabel" :label="mode === 'unknown' ? 'Continue without hours' : actionLabel" :loading="loading" :disabled="disabled || Boolean(validationError)" block size="xl" @click="$emit('submit')" />
  </div>
</template>

<script setup lang="ts">
import { TIMEZONE_OPTIONS, localNow } from '~/utils/timezone'
import { WEEKDAYS, parseOpeningHours, parseSpecialHours, toTimeString, toMinutes, type OpeningHours, type SpecialHours, type WeekPoint } from '~/shared/reservation-hours'
export type HoursTimezoneForm = { timezone: string; hours: OpeningHours; specialHours: SpecialHours }
const form = defineModel<HoursTimezoneForm>('form', { required: true })
defineProps<{ actionLabel?: string; loading?: boolean; disabled?: boolean }>()
defineEmits<{ submit: [] }>()
const modes = [{ value: 'unknown', label: 'Hours not set' }, { value: 'closed', label: 'Closed all week' }, { value: 'always', label: 'Open 24 hours every day' }, { value: 'periods', label: 'Set opening periods' }]
const mode = computed(() => form.value.hours === null ? 'unknown' : form.value.hours.periods.some(p => !p.close) ? 'always' : form.value.hours.periods.length ? 'periods' : editingPeriods.value ? 'periods' : 'closed')
const editingPeriods = ref(false)
const days = WEEKDAYS.map((day, value) => ({ value, label: day[0]!.toUpperCase() + day.slice(1) }))
function setMode(value: string) {
  editingPeriods.value = value === 'periods'
  form.value.hours = value === 'unknown' ? null : value === 'always' ? { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] } : { periods: [] }
}
function addPeriod() { form.value.hours?.periods.push({ open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 17, minute: 0 } }) }
const pointTime = (point: WeekPoint) => toTimeString(point.hour * 60 + point.minute)
function setPointTime(point: WeekPoint, value: string) { const minutes = toMinutes(value); point.hour = Math.floor(minutes / 60); point.minute = minutes % 60 }
function addException(kind: 'closure' | 'hours') {
  const date = form.value.timezone ? localNow(form.value.timezone).date : ''
  form.value.specialHours ??= []
  form.value.specialHours.push(kind === 'closure' ? { kind, starts_on: date, ends_on: null, note: null } : { kind, date, periods: [], note: null })
}
const validationError = computed(() => {
  try {
    if (!form.value.timezone) return 'Choose the location timezone.'
    parseOpeningHours(form.value.hours)
    parseSpecialHours(form.value.specialHours)
    return null
  } catch (error) { return error instanceof Error ? error.message : 'Invalid hours' }
})
</script>
