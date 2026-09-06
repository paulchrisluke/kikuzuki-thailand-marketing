<template>
  <USelect
    v-if="siteId && language.languages.value.length > 1"
    :model-value="selectedValue"
    :items="items"
    value-key="value"
    label-key="label"
    aria-label="Site content language"
    class="min-w-32"
    :disabled="language.loading.value"
    @update:model-value="select"
  />
</template>

<script setup lang="ts">
const dashboard = useDashboardSite()
const language = useDashboardContentLanguage()
const siteId = computed(() => dashboard.siteId.value)
const selectedValue = computed(() => language.locale.value === null ? undefined : language.locale.value)
const items = computed(() => language.languages.value.map(item => ({
  value: item.locale,
  label: item.source ? `${item.label} · Primary` : item.label,
})))

watch(siteId, (value) => {
  if (value) void language.load(value)
}, { immediate: true })

function select(locale: string) {
  if (!siteId.value) return
  language.select(siteId.value, locale)
}
</script>
