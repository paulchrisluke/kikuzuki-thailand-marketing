<template>
  <div class="container mx-auto px-4 py-16">
    <div class="max-w-3xl mx-auto">
      <NuxtLink to="/docs" class="inline-flex items-center text-(--ui-primary) hover:text-(--ui-primary) mb-6">
        ← Back to Documentation
      </NuxtLink>

      <div v-if="loading" class="text-center py-12">
        <p class="text-(--ui-text-muted)">Loading...</p>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6">
        <p class="text-red-600">{{ error }}</p>
      </div>

      <div v-else>
        <h1 class="text-4xl font-bold text-(--ui-text) mb-6">{{ doc.title }}</h1>
        <div class="prose prose-lg max-w-none text-(--ui-text)" v-html="renderedContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'platform' })

const route = useRoute()
const doc = ref({ title: '', content: '' })
const loading = ref(true)
const error = ref('')

const renderedContent = computed(() => {
  if (!doc.value.content) return ''
  return doc.value.content
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u])/gm, '<p>')
    .replace(/(?<!>)$/gm, '</p>')
})

onMounted(async () => {
  try {
    const response = await $fetch(`/api/docs/${route.params.slug}`)
    doc.value = response
  } catch (err) {
    error.value = 'Documentation not found'
  } finally {
    loading.value = false
  }
})

useSeoMeta({
  title: computed(() => `${doc.value.title} | KrabiClaw Docs`),
  description: computed(() => `Learn about ${doc.value.title} in KrabiClaw documentation.`),
  ogImage: '/og-image.jpg',
  ogUrl: computed(() => `/docs/${route.params.slug}`)
})
</script>
