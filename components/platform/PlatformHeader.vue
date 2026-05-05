<template>
  <UHeader class="bg-white/80 backdrop-blur-md border-b border-stone-200">
    <template #left>
      <NuxtLink to="/" class="flex items-center gap-2 group">
        <div class="w-8 h-8 bg-black rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
          <span class="text-white font-bold italic text-lg">K</span>
        </div>
        <span class="text-xl font-bold tracking-tight text-stone-900">KrabiClaw</span>
      </NuxtLink>
    </template>
    <template #center>
      <UNavigationMenu :items="platformNavItems" />
    </template>
    <template #right>
      <UButton to="/signup" color="neutral" size="sm">Start Free</UButton>
      <UButton to="/login" variant="link" color="neutral" size="sm">Login</UButton>
    </template>
  </UHeader>
</template>

<script setup>
const platformNavItems = [
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Templates', to: '/templates' },
  { label: 'Login', to: '/login' }
]
</script>
