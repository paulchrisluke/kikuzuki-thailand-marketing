<template>
  <nav aria-label="Breadcrumb" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <ol class="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
      <li v-for="(crumb, i) in crumbs" :key="crumb.to" class="flex items-center gap-1.5">
        <NuxtLink
          v-if="i < crumbs.length - 1"
          :to="crumb.to"
          class="inline-flex items-center rounded-full bg-elevated/50 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur-sm transition-all hover:bg-elevated hover:text-highlighted"
        >
          {{ crumb.label }}
        </NuxtLink>
        <span v-else class="inline-flex items-center rounded-full bg-elevated px-3 py-1.5 text-xs font-semibold text-highlighted shadow-sm" aria-current="page">
          {{ crumb.label }}
        </span>
        <span v-if="i < crumbs.length - 1" class="text-dimmed" aria-hidden="true">
          <UIcon name="i-heroicons-chevron-right" class="size-3.5" />
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
defineProps({
  crumbs: {
    type: Array,
    required: true
  }
})
</script>
