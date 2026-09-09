<template>
  <nav aria-label="Documentation">
    <PlatformCommandSearchTrigger
      surface="docs"
      label="Search docs, blog, help..."
      aria-label="Open documentation search"
      class="mb-3"
    />

    <!-- Inside a category the sidebar scopes to that category's pages plus a
         back link, the same drill-down the dashboard uses. -->
    <NuxtLink
      v-if="drilledCategory"
      to="/docs"
      class="mb-3 flex items-center gap-2 px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-default transition-colors no-underline"
      @click="emit('navigate')"
    >
      <PlatformIcon name="arrow-left" class="size-4 shrink-0" />
      <span class="truncate">Back to Docs</span>
    </NuxtLink>

    <div v-for="section in sections" :key="section.categorySlug" class="mb-4 last:mb-0">
      <p class="mb-1.5 px-2.5 text-xs font-semibold uppercase tracking-wide text-dimmed">{{ section.category }}</p>
      <ul class="flex flex-col gap-0.5">
        <li v-for="page in section.pages" :key="page.path">
          <NuxtLink
            :to="page.path"
            class="block truncate rounded-md px-2.5 py-1.5 text-sm no-underline transition-colors"
            :class="route.path === page.path ? 'bg-elevated text-primary font-medium' : 'text-muted hover:text-default hover:bg-muted'"
            @click="emit('navigate')"
          >
            {{ page.title }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script setup lang="ts">
import PlatformCommandSearchTrigger from '~/components/platform/search/PlatformCommandSearchTrigger.vue'

const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()
const { categories } = await useDocsPages()

const drilledCategory = computed(() => {
  const [, root, categorySlug] = route.path.split('/')
  return root === 'docs' && categorySlug ? categorySlug : null
})

const sections = computed(() => drilledCategory.value
  ? categories.value.filter(section => section.categorySlug === drilledCategory.value)
  : categories.value)
</script>
