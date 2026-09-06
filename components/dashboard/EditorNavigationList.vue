<template>
  <div class="space-y-8">
    <section v-for="group in groups" :key="group.id" class="space-y-3">
      <h2 v-if="group.label" class="px-1 text-sm font-semibold text-muted">
        {{ group.label }}
      </h2>

      <!--
        Cards: one surface per item, stacked, no chevron and no icon. A hub is
        read by scanning what each thing currently holds, and a column of
        chevrons adds a repeated mark to every row that says only "this is a
        link" — which the whole list already says.
      -->
      <div v-if="variant === 'cards'" class="space-y-3">
        <NuxtLink
          v-for="item in group.items"
          :key="item.id"
          :to="item.to"
          class="block rounded-2xl bg-elevated p-5 transition-colors hover:bg-accented focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="item.id === activeItem ? 'ring-2 ring-primary' : ''"
          :aria-current="item.id === activeItem ? 'page' : undefined"
        >
          <span class="block text-[15px] font-semibold text-highlighted">{{ item.label }}</span>
          <span v-if="item.summary" class="mt-1 line-clamp-2 block text-sm text-muted">{{ item.summary }}</span>
        </NuxtLink>
      </div>

      <!-- Rows: settings, where the chevron marks a push into a deeper screen. -->
      <UCard
        v-else
        variant="subtle"
        class="overflow-hidden rounded-2xl"
        :ui="{ body: 'p-0! sm:p-0!' }"
      >
        <NuxtLink
          v-for="(item, index) in group.items"
          :key="item.id"
          :to="item.to"
          class="group flex min-h-20 items-center gap-4 px-5 py-4 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          :class="[
            index > 0 ? 'border-t border-default' : '',
            item.id === activeItem ? 'bg-elevated' : '',
          ]"
          :aria-current="item.id === activeItem ? 'page' : undefined"
        >
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-highlighted">{{ item.label }}</span>
            <span v-if="item.summary" class="mt-1 line-clamp-2 block text-sm text-muted">{{ item.summary }}</span>
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
        </NuxtLink>
      </UCard>
    </section>
  </div>
</template>

<script setup lang="ts">
export interface EditorNavigationItem {
  id: string
  label: string
  summary?: string
  icon?: string
  to: string
}

export interface EditorNavigationGroup {
  id: string
  label?: string
  items: EditorNavigationItem[]
}

withDefaults(defineProps<{
  groups: EditorNavigationGroup[]
  activeItem?: string | null
  /** 'cards' for an editor hub, 'rows' for a settings list. */
  variant?: 'cards' | 'rows'
}>(), { variant: 'rows' })
</script>
