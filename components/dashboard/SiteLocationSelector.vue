<template>
  <!-- Kept as a utility class, not scoped CSS, so the loading skeleton in
       SitesPage can reserve exactly this layout. -->
  <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,34rem),1fr))] gap-6">
    <NuxtLink
      v-for="item in items"
      :key="item.id"
      :to="item.to"
      :aria-label="item.label"
      class="group min-w-0"
    >
      <div>
        <img
          v-if="item.imageUrl"
          :src="item.imageUrl"
          :alt="`${item.label} preview`"
          class="aspect-[4/3] w-full rounded-2xl bg-elevated object-cover shadow-sm transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg sm:aspect-[16/10]"
          loading="lazy"
          decoding="async"
        >
        <!-- Not a placeholder standing in for the image: the image is genuinely
             absent, and this says so. The caller supplies the reason because a
             site and a location are missing different things — a generated
             social card versus a photo the tenant uploads. -->
        <div
          v-else
          class="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-2xl bg-elevated px-4 text-center shadow-sm sm:aspect-[16/10]"
          data-testid="selector-missing-social-image"
        >
          <UIcon name="i-lucide-image-off" class="size-6 text-error" />
          <p class="text-sm font-medium text-highlighted">{{ missingImageLabel }} for {{ item.label }}</p>
          <p class="text-xs text-muted">{{ missingImageHint }}</p>
        </div>
        <div class="px-1 pt-4">
          <h2 class="text-base font-semibold text-highlighted">{{ item.label }}</h2>
          <!-- Sites are identified by vertical and domain, locations by address
               alone. The separator belongs to the eyebrow rather than sitting
               between the two unconditionally, so a card with one line does not
               render a leading dot. -->
          <p class="mt-1 text-sm text-muted">
            <template v-if="item.eyebrow">{{ item.eyebrow }}<span aria-hidden="true"> · </span></template>{{ item.summary }}
          </p>
        </div>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
export interface SiteLocationSelectorItem {
  id: string
  label: string
  imageUrl: string | null
  eyebrow: string
  summary: string
  to: string
}

withDefaults(defineProps<{
  items: SiteLocationSelectorItem[]
  /** Names what is missing, e.g. "No social image" or "No photo". */
  missingImageLabel?: string
  /** Says why it is missing and what fixes it. */
  missingImageHint?: string
}>(), {
  missingImageLabel: 'No social image',
  missingImageHint: 'Its social card has not been generated.',
})
</script>
