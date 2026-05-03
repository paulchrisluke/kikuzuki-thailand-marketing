<template>
  <div class="min-h-screen bg-white">
    <AppHero :title="getField('hero.title', 'Our Menu')" :subtitle="getField('hero.subtitle', 'Authentic Japanese Robatayaki Izakaya')" size="page" :establishment-year="googleBusiness.value?.business?.establishmentYear" />
    <AppSection v-if="getField('description', '')" bg="gray" padding="default">
      <div v-html="getField('description', '')" class="prose prose-lg max-w-3xl mx-auto text-center text-gray-700" />
    </AppSection>
    <AppSection v-if="googleProducts.length" bg="white" padding="default">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Products &amp; Services</h2>
      <p class="text-gray-500 mb-8">From Google Business Profile</p>
      <div class="divide-y divide-gray-100">
        <div v-for="product in googleProducts" :key="product.name" class="p-6">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ product.title || product.name }}</h3>
              <p v-if="product.description" class="text-gray-600 mb-2">{{ product.description }}</p>
              <p v-if="product.price" class="text-lg font-bold text-gray-900">{{ product.price }}</p>
            </div>
            <div v-if="product.photoUrls?.[0]" class="ml-6"><img :src="product.photoUrls[0]" :alt="product.title || product.name" class="w-24 h-24 object-cover rounded-lg"></div>
          </div>
        </div>
      </div>
    </AppSection>
    <template v-else>
      <MenuCategoryNav :categories="menuData.categories" :active="activeCategory" @select="activeCategory = $event" />
      <AppSection v-for="category in menuData.categories" :key="category.id" :id="category.id" bg="white" padding="default">
        <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ category.name }}</h2>
        <p v-if="category.description && !category.description.includes('PLACEHOLDER')" class="text-gray-500 mb-8">{{ category.description }}</p>
        <div class="divide-y divide-gray-100">
          <MenuItemCard v-for="item in category.items" :key="item.id" :item="item" />
        </div>
      </AppSection>
    </template>
  </div>
</template>
<script setup>
import { menuData } from '~/data/menu'
import { usePageContent } from '~/composables/usePageContent'
const { getField } = usePageContent('menu')
const activeCategory = ref(menuData.categories[0]?.id ?? '')
const { data: googleBusiness } = await useFetch('/api/google-business/public', { key: 'google-business-public', default: () => ({ products: [] }) })
const googleProducts = computed(() => googleBusiness.value?.products || [])
useSeoMeta({ title: 'Menu | Take Me Away by KIKUZUKI | Japanese Robatayaki Izakaya', description: 'Explore our complete menu at Take Me Away by KIKUZUKI in Krabi, Thailand.', ogImage: '/og-image.jpg', ogUrl: 'https://www.kikuzuki-thailand.com/menu' })
</script>
