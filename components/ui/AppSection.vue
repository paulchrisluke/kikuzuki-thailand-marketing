<template>
  <section :class="['w-full', bgClass, paddings[padding]]">
    <div class="max-w-6xl mx-auto px-4">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  bg: {
    type: String,
    default: 'white',
    validator: v => ['white', 'black', 'dark', 'alt', 'gray', 'stone'].includes(v)
  },
  padding: {
    type: String,
    default: 'default',
    validator: v => ['none', 'sm', 'default', 'lg', 'xl'].includes(v)
  }
})

const backgrounds = {
  white: 'bg-[var(--ui-bg)] text-[color:--ui-text]',
  alt: 'bg-[var(--ui-bg-elevated)] text-[color:--ui-text]',
  black: 'bg-[var(--ui-bg-inverted)] text-[color:--ui-text-inverted]',
  dark: 'bg-[var(--ui-bg-inverted)] text-[color:--ui-text-inverted]',
  gray: 'bg-[var(--ui-bg-elevated)] text-[color:--ui-text]',
  stone: 'bg-[var(--ui-bg-elevated)] text-[color:--ui-text]'
}

const bgClass = computed(() => backgrounds[props.bg])

const paddings = {
  none: 'py-0',
  sm: 'py-8',
  default: 'py-16',
  lg: 'py-20',
  xl: 'py-24'
}
</script>
