<template>
  <header class="sticky top-0 z-50 bg-(--ui-bg)/85 backdrop-blur-md border-b border-(--ui-border)">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6 h-16">

      <!-- Wordmark -->
      <NuxtLink to="/" class="flex items-center gap-2.5 shrink-0 group">
        <img src="/krabi-claw-logo.png" alt="KrabiClaw" class="w-8.5 h-8.5 rounded-[9px] group-hover:rotate-12 transition-transform duration-200" />
        <span class="kc-wordmark text-[19px]">
          <span class="kc-wordmark__krabi">krabi</span><span class="kc-wordmark__claw">claw</span><span class="kc-wordmark__tld">.com</span>
        </span>
      </NuxtLink>

      <!-- Pill nav -->
      <nav class="hidden md:flex items-center gap-1 bg-(--ui-bg-elevated)/50 border border-(--ui-border-muted) rounded-full px-1 py-1">
        <NuxtLink
          v-for="item in navItems"
          :key="item.label"
          :to="item.to"
          class="px-4 py-2 rounded-full text-[13.5px] font-medium text-(--ui-text-muted) transition-colors hover:text-(--ui-text) no-underline"
          :class="$route.path === item.to || ($route.path.startsWith(item.to) && item.to !== '/') ? 'bg-(--ui-bg-elevated) text-(--ui-text) shadow-[0_1px_2px_rgba(31,37,71,0.06)]' : ''"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- Right actions -->
      <div class="flex items-center gap-2 shrink-0">
        <UColorModeButton variant="ghost" color="neutral" size="sm" />
        <NuxtLink to="/login" class="hidden sm:block text-[13.5px] font-medium text-(--ui-text) px-3 py-2 hover:text-(--ui-text-muted) transition-colors no-underline">
          Login
        </NuxtLink>
        <NuxtLink
          to="/signup"
          class="inline-flex items-center gap-1.5 bg-(--ui-primary) text-(--ui-text-inverted) text-[13.5px] font-semibold px-4 py-2.5 rounded-[9px] hover:bg-(--ui-primary) transition-colors no-underline"
        >
          Start free
          <UIcon name="i-heroicons-arrow-right" class="size-3.5" />
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

<script setup>
const navItems = [
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Templates', to: '/templates' },
  { label: 'Docs', to: '/docs' },
]
</script>
