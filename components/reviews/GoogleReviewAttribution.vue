<template>
  <div class="mt-3 space-y-2 text-xs text-muted">
    <p translate="no" class="whitespace-nowrap font-normal not-italic">Google Maps</p>
    <div class="flex flex-wrap items-center gap-3">
      <img v-if="metadata?.author_photo_uri" :src="metadata.author_photo_uri" alt="Google Maps author avatar" class="size-8 rounded-full" loading="lazy" referrerpolicy="no-referrer" />
      <a v-if="metadata?.author_uri" :href="metadata.author_uri" target="_blank" rel="noopener noreferrer" class="underline">Author profile</a>
      <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener noreferrer" class="underline">View review on Google Maps</a>
      <a v-if="metadata?.flag_content_uri" :href="metadata.flag_content_uri" target="_blank" rel="noopener noreferrer" class="underline">Report review</a>
    </div>
    <p>Approved reviews are ordered by publish date. Google supplies reviews selected by relevance.</p>
    <p v-if="metadata?.visit_date">Visited {{ metadata.visit_date.year }}-{{ String(metadata.visit_date.month).padStart(2, '0') }}</p>
    <details v-if="metadata?.original_text && metadata.original_language_code !== metadata.language_code">
      <summary class="cursor-pointer">Translated review · View original ({{ metadata.original_language_code }})</summary>
      <p class="mt-2 whitespace-pre-line" :lang="metadata.original_language_code ?? undefined">{{ metadata.original_text }}</p>
    </details>
  </div>
</template>

<script setup lang="ts">
import type { GoogleReviewMetadata } from '~/shared/google-review'
defineProps<{ metadata: GoogleReviewMetadata | null; sourceUrl: string | null }>()
</script>
