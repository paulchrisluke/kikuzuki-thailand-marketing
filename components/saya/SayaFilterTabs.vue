<template>
  <div class="sticky top-0 z-40 border-b border-default bg-default">
    <div class="mx-auto flex h-11 max-w-7xl items-center justify-center gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8 scrollbar-none">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="[
          'shrink-0 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all',
          modelValue === tab.key
            ? 'bg-default-inverted text-inverted'
            : 'text-muted hover:bg-muted hover:text-default'
        ]"
        @click="handleClick(tab.key)"
      >
        {{ tab.label }}
      </button>
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tab {
  key: string
  label: string
  sectionId?: string
}

const props = defineProps<{
  tabs: Tab[]
  modelValue: string
  enableScrollDetection?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

let observer: IntersectionObserver | null = null

function handleClick(key: string) {
  emit('update:modelValue', key)
  const tab = props.tabs.find(t => t.key === key)
  if (tab?.sectionId) {
    const element = document.getElementById(tab.sectionId)
    if (element) {
      const navHeight = 44
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      window.scrollTo({ top: elementPosition - navHeight, behavior: 'smooth' })
    }
  }
}

onMounted(() => {
  if (!props.enableScrollDetection) return

  const sections = props.tabs
    .map(t => t.sectionId ? document.getElementById(t.sectionId) : null)
    .filter(Boolean) as HTMLElement[]

  if (sections.length > 0) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const tab = props.tabs.find(t => t.sectionId === entry.target.id)
            if (tab) emit('update:modelValue', tab.key)
          }
        })
      },
      {
        rootMargin: '-44px 0px -60% 0px',
        threshold: 0
      }
    )

    sections.forEach((section) => observer?.observe(section))
  }
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>
