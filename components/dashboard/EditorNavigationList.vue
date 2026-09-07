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
        <component
          :is="item.to ? NuxtLink : 'button'"
          v-for="item in group.items"
          :key="item.id"
          v-bind="item.to ? { to: item.to } : { type: 'button' }"
          class="block w-full rounded-2xl bg-elevated p-5 text-left transition-colors hover:bg-accented focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="item.id === activeItem ? 'ring-2 ring-primary' : ''"
          :aria-current="item.id === activeItem ? 'page' : undefined"
          @click="item.to ? undefined : $emit('select', item.id)"
        >
          <span class="block text-[15px] font-semibold text-highlighted">{{ item.label }}</span>
          <span v-if="item.summary" class="mt-1 line-clamp-2 block text-sm text-muted">{{ item.summary }}</span>

          <!--
            A card for the thing a tenant opens most shows what is inside it,
            the way the listing editor's photo card shows the photographs. Text
            alone makes the most important row look like the least.
          -->
          <span v-if="item.previews?.length" class="mt-4 flex gap-2">
            <span
              v-for="(preview, index) in item.previews.slice(0, 4)"
              :key="index"
              class="aspect-[20/19] w-full max-w-24 overflow-hidden rounded-xl bg-default"
            >
              <img :src="preview" alt="" class="size-full object-cover" loading="lazy" decoding="async">
            </span>
          </span>
        </component>
      </div>

      <!-- Rows: settings, where the chevron marks a push into a deeper screen. -->
      <UCard
        v-else
        variant="subtle"
        class="overflow-hidden rounded-2xl"
        :ui="{ body: 'p-0! sm:p-0!' }"
      >
        <component
          :is="item.to ? NuxtLink : 'button'"
          v-for="(item, index) in group.items"
          :key="item.id"
          v-bind="item.to ? { to: item.to } : { type: 'button' }"
          class="group flex min-h-20 w-full items-center gap-4 text-left px-5 py-4 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          :class="[
            index > 0 ? 'border-t border-default' : '',
            item.id === activeItem ? 'bg-elevated' : '',
          ]"
          :aria-current="item.id === activeItem ? 'page' : undefined"
        >
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-highlighted">{{ item.label }}</span>
            <span
              v-if="item.summary"
              class="mt-1 line-clamp-2 block text-sm"
              :class="item.placeholder ? 'italic text-dimmed' : 'text-muted'"
            >{{ item.summary }}</span>
          </span>
          <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
        </component>
      </UCard>
    </section>
  </div>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

export interface EditorNavigationItem {
  id: string
  label: string
  summary?: string
  icon?: string
  /**
   * Where the row goes. Omitted where the row opens a sheet in place — a Move
   * flow changes which parent a record belongs to rather than pushing into a
   * deeper editor.
   */
  to?: string
  /** Renders the summary as absent rather than as a value. */
  placeholder?: boolean
  /** Thumbnails of what the section holds. Cards variant only. */
  previews?: string[]
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

defineEmits<{
  /** Emitted by a row with no `to`, carrying the item id. */
  select: [id: string]
}>()
</script>
